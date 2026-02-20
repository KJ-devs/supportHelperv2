import Anthropic from '@anthropic-ai/sdk';

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
  | 'escalate_to_human';

export interface ToolCallResult {
  toolCallId: string;
  name: ToolName;
  input: Record<string, unknown>;
  result: unknown;
  error?: string;
  durationMs: number;
}

export const AGENT_TOOLS: Anthropic.Tool[] = [
  // ── CODE SOURCE ──────────────────────────────────────────
  {
    name: 'read_file',
    description:
      'Read the content of a file from a connected GitHub repository. Use this to examine source code, configuration files, or any file in the repo.',
    input_schema: {
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
          description: 'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'list_directory',
    description:
      'List files and subdirectories in a directory of the repo. Use to understand project structure.',
    input_schema: {
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
          description: 'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_code',
    description:
      'Search for a text pattern across a repository (like grep). Returns matching lines with file paths and line numbers.',
    input_schema: {
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
          description: 'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_codebase_semantic',
    description:
      'Semantic search through the indexed codebase using AI embeddings. Best for finding conceptually related code even if exact terms differ.',
    input_schema: {
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
    input_schema: {
      type: 'object',
      properties: {
        max_depth: {
          type: 'number',
          description: 'Maximum directory depth (default: 3)',
        },
        exclude_patterns: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Patterns to exclude (default: ["node_modules", "dist", ".git", "*.lock"])',
        },
        repo: {
          type: 'string',
          description: 'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
    },
  },
  {
    name: 'get_file_history',
    description:
      'Get recent git commit history for a specific file. Shows who changed what and when.',
    input_schema: {
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
          description: 'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'get_file_blame',
    description:
      'Get git blame information for a file, showing the last author and commit for each line range.',
    input_schema: {
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
          description: 'Optional: target repository in "owner/repo" format. If omitted, uses the primary repo.',
        },
      },
      required: ['file_path'],
    },
  },
  {
    name: 'list_repos',
    description:
      'List all connected repositories for this application. Returns each repo with its role (main, frontend, backend, etc.) and whether it is the primary repo.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  // ── DIAGNOSTIC ────────────────────────────────────────────
  {
    name: 'update_diagnosis',
    description:
      'Update the current bug diagnosis with findings from code investigation. Call this after examining relevant code.',
    input_schema: {
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
  // ── TICKET MANAGEMENT (existing, kept) ─────────────────
  {
    name: 'search_similar_tickets',
    description: 'Search for similar tickets using semantic similarity on past tickets.',
    input_schema: {
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
    input_schema: {
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
    input_schema: {
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
    input_schema: {
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
];
