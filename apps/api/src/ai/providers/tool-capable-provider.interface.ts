export interface AgentTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface AgentTurnResult {
  textBlocks: TextBlock[];
  toolUseBlocks: ToolUseBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | string;
  /** Full assistant message ready to append to the conversation history. */
  assistantMessage: AgentMessage;
}

export interface ToolCapableProvider {
  chat(options: {
    model: string;
    maxTokens: number;
    systemPrompt: string;
    messages: AgentMessage[];
    tools: AgentTool[];
  }): Promise<AgentTurnResult>;
}
