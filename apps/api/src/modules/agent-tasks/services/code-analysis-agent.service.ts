import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicClientFactory } from '../../ai-config/anthropic-client.factory';
import { AiConfigService } from '../../ai-config/ai-config.service';
import { CodebaseSearchService } from '../../codebase-index/services/codebase-search.service';
import { GithubAppService } from '../../github/services/github-app.service';
import { ActionPlan } from '../types/action-plan.types';
import { Octokit } from '@octokit/rest';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TREE_ENTRIES = 200;
const MAX_SNIPPET_LINES = 100;

@Injectable()
export class CodeAnalysisAgentService {
  private readonly logger = new Logger(CodeAnalysisAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropicClientFactory: AnthropicClientFactory,
    private readonly aiConfigService: AiConfigService,
    private readonly codebaseSearchService: CodebaseSearchService,
    private readonly githubAppService: GithubAppService,
  ) {}

  async analyzeTicket(agentTaskId: string): Promise<ActionPlan> {
    this.logger.log(`Starting code analysis for agent task ${agentTaskId}`);

    // 1. Load the full chain: agentTask -> ticket -> application -> ProjectGithubConfig -> GithubInstallation
    const agentTask = await this.prisma.agentTask.findUnique({
      where: { id: agentTaskId },
      include: {
        ticket: {
          include: {
            application: {
              include: {
                githubConfig: {
                  include: {
                    installation: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!agentTask) {
      throw new BadRequestException(`Agent task ${agentTaskId} not found`);
    }

    const { ticket } = agentTask;
    const { application } = ticket;
    const githubConfig = application.githubConfig;

    if (!githubConfig) {
      throw new BadRequestException(
        `No GitHub configuration found for application ${application.id}. Link a repository first.`,
      );
    }

    const { installation, owner, repo } = githubConfig;

    // 2. Get Anthropic client for this tenant
    const anthropic = await this.anthropicClientFactory.createForTenant(
      agentTask.tenantId,
    );

    if (!anthropic) {
      throw new BadRequestException(
        'No Anthropic API key configured for this tenant. Configure it in AI Settings.',
      );
    }

    // Get the configured model (or use default)
    const aiConfig = await this.aiConfigService.getConfig(agentTask.tenantId);
    const model = aiConfig?.model || DEFAULT_MODEL;

    // 3. Get repo tree via GitHub App installation
    const repoTree = await this.getRepoTree(
      Number(installation.installationId),
      owner,
      repo,
    );

    // 4. Search relevant code via RAG
    const relevantCode = await this.codebaseSearchService.findRelevantForTicket(
      ticket.id,
      10,
    );

    // 5. Build prompts
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(ticket, repoTree, relevantCode);

    // 6. Call Claude
    this.logger.log(
      `Calling Claude (${model}) for agent task ${agentTaskId}`,
    );

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // 7. Extract and parse JSON from response
    const textBlock = response.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new BadRequestException(
        'Claude returned an unexpected response format (no text block)',
      );
    }

    const actionPlan = this.parseActionPlan(textBlock.text);

    this.logger.log(
      `Code analysis complete for agent task ${agentTaskId}: ${actionPlan.files.length} files identified`,
    );

    return actionPlan;
  }

  private async getRepoTree(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<string[]> {
    try {
      const octokit: Octokit =
        await this.githubAppService.getInstallationOctokit(installationId);

      const { data } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: 'HEAD',
        recursive: 'true',
      });

      // Filter to blobs (files) only, limit to MAX_TREE_ENTRIES
      const filePaths = data.tree
        .filter((item) => item.type === 'blob' && item.path)
        .map((item) => item.path!)
        .slice(0, MAX_TREE_ENTRIES);

      return filePaths;
    } catch (error: any) {
      this.logger.warn(
        `Failed to get repo tree for ${owner}/${repo}: ${error.message}`,
      );
      return [];
    }
  }

  private buildSystemPrompt(): string {
    return `You are a senior software developer analyzing a bug report for a codebase.
Your job is to:
1. Understand the reported issue from the ticket details
2. Analyze the relevant source code provided
3. Identify the root cause
4. Propose a concrete action plan with specific file changes

Project conventions:
- TypeScript with strict mode
- NestJS framework with dependency injection
- Prisma ORM for database access
- async/await over raw promises
- class-validator decorators for DTOs
- NestJS exceptions for error handling (BadRequestException, NotFoundException, etc.)
- Multi-tenant architecture: all data access must be scoped by tenantId

You MUST respond with valid JSON matching this exact structure:
{
  "summary": "Brief one-sentence summary of the issue and proposed fix",
  "rootCause": "Detailed explanation of what causes the bug",
  "files": [
    {
      "filePath": "path/to/file.ts",
      "operation": "modify",
      "description": "What needs to change in this file and why",
      "changeType": "bug_fix",
      "order": 1
    }
  ],
  "testingStrategy": "How to verify the fix works (unit tests, manual steps, etc.)",
  "risks": ["List of potential risks or side effects of the changes"],
  "estimatedComplexity": "low"
}

Rules:
- "operation" must be one of: "modify", "create", "delete"
- "changeType" must be one of: "bug_fix", "enhancement", "refactor", "test"
- "order" indicates the sequence in which files should be changed (1 = first)
- "estimatedComplexity" must be one of: "low", "medium", "high"
- File paths must match paths from the repository tree
- Be specific in descriptions: mention function names, line-level changes
- Only include files that actually need changes
- Do NOT wrap the JSON in markdown code blocks. Output raw JSON only.`;
  }

  private buildUserPrompt(
    ticket: any,
    repoTree: string[],
    relevantCode: Array<{
      filePath: string;
      content: string;
      language: string;
      distance: number;
    }>,
  ): string {
    const parts: string[] = [];

    // Ticket details
    parts.push('## Bug Report\n');
    parts.push(`**Title:** ${ticket.title || 'Untitled'}`);
    parts.push(`**Type:** ${ticket.type || 'Unknown'}`);
    parts.push(`**Severity:** ${ticket.severity || 'Unknown'}`);

    if (ticket.description) {
      parts.push(`\n**Description:**\n${ticket.description}`);
    }

    if (ticket.aiSummary) {
      parts.push(`\n**AI Summary:**\n${ticket.aiSummary}`);
    }

    if (ticket.aiAnalysis) {
      const analysisStr =
        typeof ticket.aiAnalysis === 'string'
          ? ticket.aiAnalysis
          : JSON.stringify(ticket.aiAnalysis, null, 2);
      parts.push(`\n**AI Analysis:**\n${analysisStr}`);
    }

    if (ticket.reproductionSteps) {
      const stepsStr =
        typeof ticket.reproductionSteps === 'string'
          ? ticket.reproductionSteps
          : JSON.stringify(ticket.reproductionSteps, null, 2);
      parts.push(`\n**Reproduction Steps:**\n${stepsStr}`);
    }

    // Repository tree
    if (repoTree.length > 0) {
      parts.push('\n## Repository Structure\n');
      parts.push('```');
      parts.push(repoTree.join('\n'));
      parts.push('```');
    }

    // Relevant code snippets from RAG
    if (relevantCode.length > 0) {
      parts.push('\n## Relevant Code Snippets\n');

      for (const snippet of relevantCode) {
        const truncatedContent = this.truncateSnippet(
          snippet.content,
          MAX_SNIPPET_LINES,
        );
        parts.push(`### ${snippet.filePath} (similarity: ${(1 - snippet.distance).toFixed(3)})`);
        parts.push(`\`\`\`${snippet.language || 'typescript'}`);
        parts.push(truncatedContent);
        parts.push('```\n');
      }
    }

    return parts.join('\n');
  }

  private truncateSnippet(content: string, maxLines: number): string {
    const lines = content.split('\n');
    if (lines.length <= maxLines) {
      return content;
    }
    return (
      lines.slice(0, maxLines).join('\n') +
      `\n// ... truncated (${lines.length - maxLines} more lines)`
    );
  }

  private parseActionPlan(text: string): ActionPlan {
    // Try to extract JSON from the response (handle potential markdown wrapping)
    let jsonStr = text.trim();

    // Remove markdown code block if present
    const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      this.logger.error(
        `Failed to parse Claude response as JSON. Response: ${text.substring(0, 500)}`,
      );
      throw new BadRequestException(
        'Claude returned invalid JSON. The analysis could not be completed.',
      );
    }

    // Validate required fields
    if (!parsed.summary || typeof parsed.summary !== 'string') {
      throw new BadRequestException('Action plan missing required field: summary');
    }
    if (!parsed.rootCause || typeof parsed.rootCause !== 'string') {
      throw new BadRequestException('Action plan missing required field: rootCause');
    }
    if (!Array.isArray(parsed.files)) {
      throw new BadRequestException('Action plan missing required field: files (array)');
    }

    const validOperations = ['modify', 'create', 'delete'];
    const validChangeTypes = ['bug_fix', 'enhancement', 'refactor', 'test'];
    const validComplexities = ['low', 'medium', 'high'];

    // Validate each file entry
    for (const file of parsed.files) {
      if (!file.filePath || typeof file.filePath !== 'string') {
        throw new BadRequestException('Action plan file missing filePath');
      }
      if (!validOperations.includes(file.operation)) {
        throw new BadRequestException(
          `Invalid operation "${file.operation}" for file ${file.filePath}`,
        );
      }
      if (!validChangeTypes.includes(file.changeType)) {
        throw new BadRequestException(
          `Invalid changeType "${file.changeType}" for file ${file.filePath}`,
        );
      }
    }

    const plan: ActionPlan = {
      summary: parsed.summary,
      rootCause: parsed.rootCause,
      files: parsed.files.map((f: any, i: number) => ({
        filePath: f.filePath,
        operation: f.operation,
        description: f.description || '',
        changeType: f.changeType,
        order: typeof f.order === 'number' ? f.order : i + 1,
      })),
      testingStrategy: parsed.testingStrategy || '',
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      estimatedComplexity: validComplexities.includes(parsed.estimatedComplexity)
        ? parsed.estimatedComplexity
        : 'medium',
    };

    return plan;
  }
}
