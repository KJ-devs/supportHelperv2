import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AnthropicClientFactory } from '../../ai-config/anthropic-client.factory';
import { AiConfigService } from '../../ai-config/ai-config.service';
import { CodebaseSearchService } from '../../codebase-index/services/codebase-search.service';
import { GithubAppService } from '../../github/services/github-app.service';
import { AgentTasksService } from '../agent-tasks.service';
import { ActionPlan, ActionPlanFile } from '../types/action-plan.types';
import {
  GeneratedFile,
  GeneratedCodeResult,
} from '../types/code-generation.types';
import { Octokit } from '@octokit/rest';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_API_CALLS = 10;
const GENERATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SNIPPET_LINES = 100;

@Injectable()
export class CodeGenerationAgentService {
  private readonly logger = new Logger(CodeGenerationAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropicClientFactory: AnthropicClientFactory,
    private readonly aiConfigService: AiConfigService,
    private readonly codebaseSearchService: CodebaseSearchService,
    private readonly githubAppService: GithubAppService,
    private readonly agentTasksService: AgentTasksService,
  ) {}

  async generateCode(agentTaskId: string): Promise<GeneratedCodeResult> {
    const startTime = Date.now();
    this.logger.log(`Starting code generation for agent task ${agentTaskId}`);

    // 1. Load the full chain: agentTask -> ticket -> application -> ProjectGithubConfig -> GithubInstallation
    const agentTask = await this.prisma.agentTask.findUnique({
      where: { id: agentTaskId },
      include: {
        ticket: {
          include: {
            application: {
              include: {
                githubConfigs: {
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
    const githubConfig = application.githubConfigs?.find((c: { isPrimary: boolean }) => c.isPrimary) ?? application.githubConfigs?.[0];

    if (!githubConfig) {
      throw new BadRequestException(
        `No GitHub configuration found for application ${application.id}. Link a repository first.`,
      );
    }

    const { installation, owner, repo } = githubConfig;
    const actionPlan = agentTask.actionPlan as unknown as ActionPlan | null;

    if (!actionPlan || !actionPlan.files || actionPlan.files.length === 0) {
      throw new BadRequestException(
        `Agent task ${agentTaskId} has no approved action plan or plan has no files.`,
      );
    }

    // 2. Get Anthropic client for this tenant
    const anthropic = await this.anthropicClientFactory.createForTenant(
      agentTask.tenantId,
    );

    if (!anthropic) {
      throw new BadRequestException(
        'No Anthropic API key configured for this tenant. Configure it in AI Settings.',
      );
    }

    const aiConfig = await this.aiConfigService.getConfig(agentTask.tenantId);
    const model = aiConfig?.model || DEFAULT_MODEL;

    // 3. Get Octokit for repo access
    const octokit: Octokit =
      await this.githubAppService.getInstallationOctokit(
        Number(installation.installationId),
      );

    // 4. Sort files by order
    const sortedFiles = [...actionPlan.files].sort(
      (a, b) => a.order - b.order,
    );

    // 5. Generate code for each file
    let apiCallCount = 0;
    const generatedFiles: GeneratedFile[] = [];

    await this.agentTasksService.appendLog(agentTaskId, {
      step: 'generation_started',
      totalFiles: sortedFiles.length,
      model,
    });

    for (const planFile of sortedFiles) {
      // Check global timeout
      if (Date.now() - startTime > GENERATION_TIMEOUT_MS) {
        const errorMsg = `Code generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s while processing ${planFile.filePath}`;
        this.logger.error(errorMsg);
        await this.agentTasksService.appendLog(agentTaskId, {
          step: 'timeout',
          file: planFile.filePath,
          error: errorMsg,
        });
        await this.agentTasksService.setError(agentTaskId, errorMsg);
        throw new BadRequestException(errorMsg);
      }

      // Check rate limit
      if (apiCallCount >= MAX_API_CALLS) {
        const errorMsg = `Rate limit exceeded: ${MAX_API_CALLS} Claude API calls used. Remaining files will not be processed.`;
        this.logger.error(errorMsg);
        await this.agentTasksService.appendLog(agentTaskId, {
          step: 'rate_limit_exceeded',
          file: planFile.filePath,
          apiCallCount,
        });
        break;
      }

      try {
        const result = await this.generateFileCode(
          agentTaskId,
          planFile,
          actionPlan,
          ticket,
          octokit,
          owner,
          repo,
          githubConfig.defaultBranch,
          anthropic,
          model,
        );

        apiCallCount++;
        generatedFiles.push(result);

        await this.agentTasksService.appendLog(agentTaskId, {
          step: 'file_generated',
          file: planFile.filePath,
          operation: planFile.operation,
          apiCallCount,
        });
      } catch (error: any) {
        this.logger.error(
          `Failed to generate code for ${planFile.filePath}: ${error.message}`,
        );
        await this.agentTasksService.appendLog(agentTaskId, {
          step: 'file_generation_failed',
          file: planFile.filePath,
          error: error.message,
        });
        // Continue with remaining files
      }
    }

    const generationTimeMs = Date.now() - startTime;

    // If all files failed, mark task as failed
    if (generatedFiles.length === 0 && sortedFiles.length > 0) {
      const errorMsg = 'All file generations failed. No code was produced.';
      await this.agentTasksService.setError(agentTaskId, errorMsg);
      throw new BadRequestException(errorMsg);
    }

    const result: GeneratedCodeResult = {
      files: generatedFiles,
      totalApiCalls: apiCallCount,
      generationTimeMs,
    };

    await this.agentTasksService.appendLog(agentTaskId, {
      step: 'generation_completed',
      filesGenerated: generatedFiles.length,
      totalFiles: sortedFiles.length,
      totalApiCalls: apiCallCount,
      generationTimeMs,
    });

    this.logger.log(
      `Code generation complete for agent task ${agentTaskId}: ${generatedFiles.length}/${sortedFiles.length} files, ${apiCallCount} API calls, ${generationTimeMs}ms`,
    );

    return result;
  }

  private async generateFileCode(
    agentTaskId: string,
    planFile: ActionPlanFile,
    actionPlan: ActionPlan,
    ticket: any,
    octokit: Octokit,
    owner: string,
    repo: string,
    defaultBranch: string,
    anthropic: any,
    model: string,
  ): Promise<GeneratedFile> {
    // 1. Fetch current file content from GitHub (skip for 'create' operations)
    let originalContent: string | undefined;

    if (planFile.operation !== 'create') {
      originalContent = await this.fetchFileContent(
        octokit,
        owner,
        repo,
        defaultBranch,
        planFile.filePath,
      );
    }

    // 2. For delete operations, return immediately with empty content
    if (planFile.operation === 'delete') {
      return {
        filePath: planFile.filePath,
        operation: 'delete',
        originalContent,
        generatedContent: '',
        changeType: planFile.changeType,
      };
    }

    // 3. Search for related code context via RAG
    const relatedCode =
      await this.codebaseSearchService.findRelevantFiles(
        ticket.applicationId,
        `${planFile.filePath} ${planFile.description}`,
        5,
      );

    // 4. Build prompts
    const systemPrompt = this.buildSystemPrompt(actionPlan);
    const userPrompt = this.buildFilePrompt(
      planFile,
      actionPlan,
      ticket,
      originalContent,
      relatedCode,
    );

    // 5. Call Claude
    this.logger.log(
      `Calling Claude (${model}) for file ${planFile.filePath} in task ${agentTaskId}`,
    );

    const response = await anthropic.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // 6. Extract generated code from response
    const textBlock = response.content.find(
      (block: any) => block.type === 'text',
    );

    if (!textBlock || textBlock.type !== 'text') {
      throw new ServiceUnavailableException(
        `Claude returned an unexpected response format for ${planFile.filePath}`,
      );
    }

    const generatedContent = this.extractCode(textBlock.text);

    // 7. Basic syntax validation (log errors but don't block)
    this.validateSyntax(planFile.filePath, generatedContent, agentTaskId);

    return {
      filePath: planFile.filePath,
      operation: planFile.operation,
      originalContent,
      generatedContent,
      changeType: planFile.changeType,
    };
  }

  private async fetchFileContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    ref: string,
    filePath: string,
  ): Promise<string | undefined> {
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref,
      });

      if ('content' in data && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return undefined;
    } catch (error: any) {
      if (error.status === 404) {
        this.logger.warn(
          `File not found on GitHub: ${owner}/${repo}/${filePath} (ref: ${ref})`,
        );
        return undefined;
      }
      throw error;
    }
  }

  private buildSystemPrompt(actionPlan: ActionPlan): string {
    return `You are a senior software developer implementing code changes for a bug fix or feature.

Your job is to generate the COMPLETE file content based on the action plan and context provided.

Project conventions:
- TypeScript with strict mode
- NestJS framework with dependency injection
- Prisma ORM for database access
- async/await over raw promises
- class-validator decorators for DTOs
- NestJS exceptions for error handling (BadRequestException, NotFoundException, etc.)
- Multi-tenant architecture: all data access must be scoped by tenantId

Action plan summary: ${actionPlan.summary}
Root cause: ${actionPlan.rootCause}

IMPORTANT RULES:
- Output ONLY the complete file content. No markdown code fences, no explanations, no comments about what changed.
- The output must be valid TypeScript that can be written directly to the file.
- Preserve existing imports, exports, and structure unless the action plan specifically calls for changes.
- Follow the existing code style and patterns in the file.
- Do not add unrelated changes or "improvements" beyond what the action plan specifies.`;
  }

  private buildFilePrompt(
    planFile: ActionPlanFile,
    actionPlan: ActionPlan,
    ticket: any,
    originalContent: string | undefined,
    relatedCode: Array<{
      filePath: string;
      content: string;
      language: string;
      distance: number;
    }>,
  ): string {
    const parts: string[] = [];

    // Task description
    parts.push('## Task\n');
    parts.push(`**File:** ${planFile.filePath}`);
    parts.push(`**Operation:** ${planFile.operation}`);
    parts.push(`**Change type:** ${planFile.changeType}`);
    parts.push(`**Description:** ${planFile.description}`);

    // Ticket context
    parts.push('\n## Ticket Context\n');
    parts.push(`**Title:** ${ticket.title || 'Untitled'}`);
    if (ticket.description) {
      parts.push(`**Description:** ${ticket.description}`);
    }
    if (ticket.aiSummary) {
      parts.push(`**AI Summary:** ${ticket.aiSummary}`);
    }

    // Testing strategy
    if (actionPlan.testingStrategy) {
      parts.push(`\n**Testing strategy:** ${actionPlan.testingStrategy}`);
    }

    // Current file content
    if (originalContent && planFile.operation === 'modify') {
      parts.push('\n## Current File Content\n');
      parts.push('```typescript');
      parts.push(originalContent);
      parts.push('```');
    }

    if (planFile.operation === 'create') {
      parts.push(
        '\n## Note\nThis is a new file. Generate the complete file from scratch based on the task description and related code patterns.',
      );
    }

    // Related code snippets from RAG
    if (relatedCode.length > 0) {
      parts.push('\n## Related Code (for context)\n');
      for (const snippet of relatedCode) {
        const truncated = this.truncateSnippet(
          snippet.content,
          MAX_SNIPPET_LINES,
        );
        parts.push(`### ${snippet.filePath}`);
        parts.push(`\`\`\`${snippet.language || 'typescript'}`);
        parts.push(truncated);
        parts.push('```\n');
      }
    }

    // Other files in the action plan (for awareness)
    if (actionPlan.files.length > 1) {
      parts.push('\n## Other Files in This Change Set\n');
      for (const f of actionPlan.files) {
        if (f.filePath !== planFile.filePath) {
          parts.push(`- \`${f.filePath}\` (${f.operation}): ${f.description}`);
        }
      }
    }

    parts.push(
      '\n## Instructions\nGenerate the COMPLETE file content. Output ONLY the raw file content, no markdown fences, no explanations.',
    );

    return parts.join('\n');
  }

  private extractCode(responseText: string): string {
    let code = responseText.trim();

    // Remove markdown code fences if Claude included them despite instructions
    const codeBlockMatch = code.match(
      /^```(?:typescript|ts|javascript|js)?\s*\n([\s\S]*?)\n```$/,
    );
    if (codeBlockMatch) {
      code = codeBlockMatch[1];
    }

    return code;
  }

  private validateSyntax(
    filePath: string,
    content: string,
    agentTaskId: string,
  ): void {
    // Basic validation: check for common syntax issues
    const ext = filePath.split('.').pop()?.toLowerCase();

    if (!ext || !['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
      return;
    }

    const issues: string[] = [];

    // Check for balanced braces
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < content.length; i++) {
      const ch = content[i];
      const prev = i > 0 ? content[i - 1] : '';

      if (inString) {
        if (ch === stringChar && prev !== '\\') {
          inString = false;
        }
        continue;
      }

      if ((ch === '"' || ch === "'" || ch === '`') && prev !== '\\') {
        inString = true;
        stringChar = ch;
        continue;
      }

      if (ch === '{') braceCount++;
      if (ch === '}') braceCount--;
      if (ch === '(') parenCount++;
      if (ch === ')') parenCount--;
      if (ch === '[') bracketCount++;
      if (ch === ']') bracketCount--;
    }

    if (braceCount !== 0) {
      issues.push(`Unbalanced braces (${braceCount > 0 ? 'missing }' : 'extra }'})`);
    }
    if (parenCount !== 0) {
      issues.push(`Unbalanced parentheses (${parenCount > 0 ? 'missing )' : 'extra )'})`);
    }
    if (bracketCount !== 0) {
      issues.push(`Unbalanced brackets (${bracketCount > 0 ? 'missing ]' : 'extra ]'})`);
    }

    if (issues.length > 0) {
      this.logger.warn(
        `Syntax validation warnings for ${filePath} in task ${agentTaskId}: ${issues.join(', ')}`,
      );
    }
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
}
