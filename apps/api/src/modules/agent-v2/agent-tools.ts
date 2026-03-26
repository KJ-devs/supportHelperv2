import { AgentTool } from '../../ai/providers/tool-capable-provider.interface';

export type ToolName =
  | 'read_file'
  | 'list_directory'
  | 'search_code'
  | 'search_codebase_semantic'
  | 'get_repo_structure'
  | 'get_file_history'
  | 'get_file_blame'
  | 'list_repos'
  | 'update_diagnosis'
  | 'search_similar_tickets'
  | 'get_ticket_details'
  | 'update_ticket_status'
  | 'escalate_to_human'
  | 'create_branch'
  | 'write_file'
  | 'edit_file'
  | 'create_pull_request'
  | 'generate_test';

export interface ToolCallResult {
  toolCallId: string;
  name: ToolName;
  input: Record<string, unknown>;
  result: unknown;
  error?: string;
  durationMs: number;
}

export const AGENT_TOOLS: AgentTool[] = [
  // ── CODE SOURCE ──────────────────────────────────────────
  {
    name: 'read_file',
    description:
      'Read the content of a file from a connected GitHub repository. Use this to examine source code, configuration files, or any file in the repo.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path relative to repo root (e.g. "src/services/auth.service.ts")',
        },
        start_line: {
          type: 'number',
          description: 'Optional: start reading from this line (1-indexed)',
        },
        end_line: {
          type: 'number',
          description: 'Optional: stop reading at this line',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'list_directory',
    description:
      'List files and subdirectories in a directory of the repo. Use to understand project structure.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to repo root (e.g. "src/modules/")',
        },
        recursive: {
          type: 'boolean',
          description: 'If true, list recursively (max 2 levels deep). Default: false',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_code',
    description:
      'Search for a text pattern across a repository (like grep). Returns matching lines with file paths and line numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Text or regex pattern to search for',
        },
        file_pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter files (e.g. "*.ts", "src/**/*.tsx")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of results (default: 20)',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_codebase_semantic',
    description:
      'Semantic search through the indexed codebase using AI embeddings. Best for finding conceptually related code even if exact terms differ.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language description of what you are looking for',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_repo_structure',
    description:
      'Get a condensed tree view of the entire repository structure. Use as a first step to understand the project layout.',
    inputSchema: {
      type: 'object',
      properties: {
        max_depth: {
          type: 'number',
          description: 'Maximum directory depth (default: 3)',
        },
        exclude_patterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Patterns to exclude (default: ["node_modules", "dist", ".git", "*.lock"])',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
    },
  },
  {
    name: 'get_file_history',
    description:
      'Get recent git commit history for a specific file. Shows who changed what and when.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file',
        },
        limit: {
          type: 'number',
          description: 'Number of commits to retrieve (default: 5)',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'get_file_blame',
    description:
      'Get git blame information for a file, showing the last author and commit for each line range.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the file',
        },
        start_line: { type: 'number' },
        end_line: { type: 'number' },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'list_repos',
    description:
      'List all connected repositories for this application. Returns each repo with its role (main, frontend, backend, etc.) and whether it is the primary repo.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // ── DIAGNOSTIC ────────────────────────────────────────────
  {
    name: 'update_diagnosis',
    description:
      'Update the current bug diagnosis with findings from code investigation. Call this after examining relevant code.',
    inputSchema: {
      type: 'object',
      properties: {
        root_cause: {
          type: 'string',
          description: 'Identified root cause of the bug',
        },
        affected_files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_path: { type: 'string' },
              relevance: { type: 'string', enum: ['primary', 'secondary', 'context'] },
              description: { type: 'string' },
            },
          },
          description: 'Files involved in the bug',
        },
        confidence: {
          type: 'number',
          description: 'Confidence level 0.0-1.0',
        },
        suggested_fix: {
          type: 'string',
          description: 'High-level description of the fix',
        },
        remaining_questions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Questions that still need answers',
        },
      },
      required: ['root_cause', 'confidence'],
    },
  },
  // ── TICKET MANAGEMENT ─────────────────────────────────────
  {
    name: 'search_similar_tickets',
    description: 'Search for similar tickets using semantic similarity on past tickets.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_ticket_details',
    description: 'Get full details of a ticket including media and AI analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string' },
      },
      required: ['ticket_id'],
    },
  },
  {
    name: 'update_ticket_status',
    description: 'Update ticket status.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string' },
        status: {
          type: 'string',
          enum: ['new', 'open', 'in_progress', 'resolved', 'closed'],
        },
      },
      required: ['ticket_id', 'status'],
    },
  },
  {
    name: 'escalate_to_human',
    description:
      'Escalate to a human support agent when the issue is too complex or the user requests it.',
    inputSchema: {
      type: 'object',
      properties: {
        ticket_id: { type: 'string' },
        reason: { type: 'string' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
        },
      },
      required: ['ticket_id', 'reason'],
    },
  },
  // ── WRITE TOOLS ───────────────────────────────────────────
  {
    name: 'create_branch',
    description:
      'Create a new git branch in the connected repository, or reuse it if it already exists. Always create a fix branch before writing any files.',
    inputSchema: {
      type: 'object',
      properties: {
        branch_name: {
          type: 'string',
          description: 'Name for the new branch (e.g. "fix/ticket-abc123-null-pointer")',
        },
        from_branch: {
          type: 'string',
          description: 'Base branch to fork from. Defaults to the repository default branch.',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['branch_name'],
    },
  },
  {
    name: 'write_file',
    description:
      'Create or update a file on a branch. You MUST provide the COMPLETE file content — never partial content. Always call create_branch first.',
    inputSchema: {
      type: 'object',
      properties: {
        branch: {
          type: 'string',
          description: 'Target branch name (must already exist)',
        },
        file_path: {
          type: 'string',
          description: 'Path relative to repo root (e.g. "src/services/auth.service.ts")',
        },
        content: {
          type: 'string',
          description: 'Complete file content to write (never partial)',
        },
        commit_message: {
          type: 'string',
          description: 'Git commit message (e.g. "fix: handle null user in auth guard")',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['branch', 'file_path', 'content', 'commit_message'],
    },
  },
  {
    name: 'edit_file',
    description:
      'Apply a targeted edit to a file on a branch. Preferred over write_file for small changes (< 50 lines). Provide the exact old text to find and the new text to replace it with.',
    inputSchema: {
      type: 'object',
      properties: {
        branch: {
          type: 'string',
          description: 'Target branch name (must already exist)',
        },
        file_path: {
          type: 'string',
          description: 'Path relative to repo root (e.g. "src/services/auth.service.ts")',
        },
        old_text: {
          type: 'string',
          description: 'Exact text to find in the file (must match exactly)',
        },
        new_text: {
          type: 'string',
          description: 'Replacement text',
        },
        commit_message: {
          type: 'string',
          description: 'Git commit message (e.g. "fix: handle null user in auth guard")',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['branch', 'file_path', 'old_text', 'new_text', 'commit_message'],
    },
  },
  {
    name: 'create_pull_request',
    description:
      'Open a pull request on GitHub after writing all fix files to the branch. If a PR already exists for the same head branch, a comment with the new fixes will be added to the existing PR instead of creating a duplicate. Include a clear title and a body that references the ticket.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'PR title (e.g. "fix(auth): handle null user in JWT guard")',
        },
        body: {
          type: 'string',
          description: 'PR description with root cause, changes made, and testing notes',
        },
        head_branch: {
          type: 'string',
          description: 'Source branch with the fix commits',
        },
        base_branch: {
          type: 'string',
          description: 'Target branch to merge into. Defaults to the repo default branch.',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['title', 'body', 'head_branch'],
    },
  },

  // ── TEST GENERATION ────────────────────────────────────────
  {
    name: 'generate_test',
    description:
      'Write a test file for the fix you just implemented. Detect the test framework from the repo (Jest, Vitest, pytest, Go test, etc.) and write appropriate test cases that verify the fix. The test file will be committed to the same branch as the fix.',
    inputSchema: {
      type: 'object',
      properties: {
        test_file_path: {
          type: 'string',
          description:
            'Path for the new test file relative to repo root (e.g. "src/__tests__/auth.fix.spec.ts")',
        },
        test_content: {
          type: 'string',
          description: 'Full content of the test file',
        },
        related_fix_file: {
          type: 'string',
          description: 'The source file this test covers (for context)',
        },
        branch: {
          type: 'string',
          description: 'The branch to write the test file to (same as the fix branch)',
        },
        repo: {
          type: 'string',
          description:
            'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['test_file_path', 'test_content', 'related_fix_file', 'branch'],
    },
  },
];
