jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({})),
}));

import {
  estimateTokens,
  estimateMessageTokens,
  truncateToolResults,
  pruneMessages,
} from '../../../src/modules/agent-v2/agentic-loop.service';
import type { AgentMessage } from '../../../src/ai/providers/tool-capable-provider.interface';

describe('Context Pruning', () => {
  describe('estimateTokens', () => {
    it('should estimate 1 token per 4 characters', () => {
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('abcde')).toBe(2);
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('a'.repeat(100))).toBe(25);
    });
  });

  describe('estimateMessageTokens', () => {
    it('should estimate tokens for a string message', () => {
      const msg: AgentMessage = { role: 'user', content: 'a'.repeat(400) };
      expect(estimateMessageTokens(msg)).toBe(100);
    });

    it('should estimate tokens for text blocks', () => {
      const msg: AgentMessage = {
        role: 'assistant',
        content: [{ type: 'text', text: 'a'.repeat(200) }],
      };
      expect(estimateMessageTokens(msg)).toBe(50);
    });

    it('should estimate tokens for tool_use blocks', () => {
      const msg: AgentMessage = {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 't1',
          name: 'read_file',
          input: { file_path: 'src/index.ts' },
        }],
      };
      expect(estimateMessageTokens(msg)).toBeGreaterThan(0);
    });

    it('should estimate tokens for tool_result blocks', () => {
      const msg: AgentMessage = {
        role: 'user',
        content: [{ type: 'tool_result', toolUseId: 't1', content: 'x'.repeat(4000) }],
      };
      expect(estimateMessageTokens(msg)).toBe(1000);
    });
  });

  describe('truncateToolResults', () => {
    it('should not modify short tool results', () => {
      const msg: AgentMessage = {
        role: 'user',
        content: [{ type: 'tool_result', toolUseId: 't1', content: 'short result' }],
      };
      const result = truncateToolResults(msg);
      expect((result.content as any)[0].content).toBe('short result');
    });

    it('should truncate tool results exceeding 2000 chars', () => {
      const longContent = 'x'.repeat(5000);
      const msg: AgentMessage = {
        role: 'user',
        content: [{ type: 'tool_result', toolUseId: 't1', content: longContent }],
      };
      const result = truncateToolResults(msg);
      const content = (result.content as any)[0].content as string;
      expect(content.length).toBeLessThan(longContent.length);
      expect(content).toContain('[... truncated]');
      expect(content.startsWith('x'.repeat(2000))).toBe(true);
    });

    it('should pass through string messages unchanged', () => {
      const msg: AgentMessage = { role: 'user', content: 'hello' };
      const result = truncateToolResults(msg);
      expect(result.content).toBe('hello');
    });

    it('should not modify text or tool_use blocks', () => {
      const msg: AgentMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'a'.repeat(5000) },
          { type: 'tool_use', id: 't1', name: 'read_file', input: { file_path: 'a.ts' } },
        ],
      };
      const result = truncateToolResults(msg);
      expect((result.content as any)[0].text).toBe('a'.repeat(5000));
    });
  });

  describe('pruneMessages', () => {
    // Helper to create a large tool_result message
    function makeLargeToolResult(id: string, chars: number): AgentMessage {
      return {
        role: 'user',
        content: [{ type: 'tool_result', toolUseId: id, content: 'x'.repeat(chars) }],
      };
    }

    function makeToolUse(id: string, name: string): AgentMessage {
      return {
        role: 'assistant',
        content: [{ type: 'tool_use', id, name, input: { file_path: 'a.ts' } }],
      };
    }

    it('should not prune when under token budget', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Investigate this bug' },
        { role: 'assistant', content: 'OK, let me look.' },
      ];
      const { pruned, prunedCount, tokensSaved } = pruneMessages(messages, 50000, 100);
      expect(prunedCount).toBe(0);
      expect(tokensSaved).toBe(0);
      expect(pruned).toHaveLength(2);
    });

    it('should prune when over token budget', () => {
      // Create 20 messages with large tool results to exceed budget
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Investigate this bug' },
      ];
      for (let i = 0; i < 15; i++) {
        messages.push(makeToolUse(`t${i}`, 'read_file'));
        messages.push(makeLargeToolResult(`t${i}`, 8000)); // 2000 tokens each after truncation
      }

      // maxTokens = 5000 — way under the total
      const { pruned, prunedCount } = pruneMessages(messages, 5000, 100);
      expect(prunedCount).toBeGreaterThan(0);
      expect(pruned.length).toBeLessThan(messages.length);
    });

    it('should preserve the first user message', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'INITIAL PROMPT HERE' },
      ];
      for (let i = 0; i < 15; i++) {
        messages.push(makeToolUse(`t${i}`, 'read_file'));
        messages.push(makeLargeToolResult(`t${i}`, 8000));
      }

      const { pruned } = pruneMessages(messages, 5000, 100);
      expect(pruned[0].content).toBe('INITIAL PROMPT HERE');
    });

    it('should preserve recent messages (sliding window)', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'initial' },
      ];
      for (let i = 0; i < 12; i++) {
        messages.push(makeToolUse(`t${i}`, 'read_file'));
        messages.push(makeLargeToolResult(`t${i}`, 8000));
      }
      // Add identifiable recent messages
      messages.push({ role: 'assistant', content: 'RECENT_MSG_1' });
      messages.push({ role: 'user', content: 'RECENT_MSG_2' });

      const { pruned } = pruneMessages(messages, 5000, 100);

      // The last 6 messages should be preserved intact
      const last6 = pruned.slice(-6);
      const allContents = last6.map((m) =>
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      );
      expect(allContents).toContain('RECENT_MSG_1');
      expect(allContents).toContain('RECENT_MSG_2');
    });

    it('should preserve messages containing update_diagnosis', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'initial' },
      ];
      // Add many large messages
      for (let i = 0; i < 10; i++) {
        messages.push(makeToolUse(`t${i}`, 'read_file'));
        messages.push(makeLargeToolResult(`t${i}`, 8000));
      }
      // Add an update_diagnosis call in the middle
      const diagnosisMsg: AgentMessage = {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'diag-1',
          name: 'update_diagnosis',
          input: { diagnosis: 'Root cause found' },
        }],
      };
      // Insert it early (index 3 — between first tool pairs)
      messages.splice(3, 0, diagnosisMsg);

      // Add 6 more recent to fill the sliding window
      for (let i = 20; i < 23; i++) {
        messages.push(makeToolUse(`t${i}`, 'search_code'));
        messages.push(makeLargeToolResult(`t${i}`, 1000));
      }

      const { pruned } = pruneMessages(messages, 5000, 100);

      // Find the diagnosis message in pruned output
      const hasDiagnosis = pruned.some((m) => {
        if (typeof m.content === 'string') return false;
        return m.content.some(
          (b) => b.type === 'tool_use' && b.name === 'update_diagnosis',
        );
      });
      expect(hasDiagnosis).toBe(true);
    });

    it('should create a summary block for pruned messages', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'initial' },
      ];
      for (let i = 0; i < 15; i++) {
        messages.push(makeToolUse(`t${i}`, 'read_file'));
        messages.push(makeLargeToolResult(`t${i}`, 8000));
      }

      const { pruned } = pruneMessages(messages, 5000, 100);

      // Second message should be the summary block
      const summaryMsg = pruned[1];
      expect(typeof summaryMsg.content).toBe('string');
      expect(summaryMsg.content as string).toContain('[Context summary of');
      expect(summaryMsg.content as string).toContain('earlier messages');
    });

    it('should truncate long tool results during pruning', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'initial' },
        makeLargeToolResult('t1', 5000), // 5000 chars → should be truncated to 2000
      ];

      // Under budget so no pruning, but truncation should still happen
      const { pruned } = pruneMessages(messages, 100000, 100);
      const resultBlock = (pruned[1].content as any)[0];
      expect(resultBlock.content.length).toBeLessThan(5000);
      expect(resultBlock.content).toContain('[... truncated]');
    });

    it('should report tokens saved', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'initial' },
      ];
      for (let i = 0; i < 15; i++) {
        messages.push(makeToolUse(`t${i}`, 'read_file'));
        messages.push(makeLargeToolResult(`t${i}`, 8000));
      }

      const { tokensSaved } = pruneMessages(messages, 5000, 100);
      expect(tokensSaved).toBeGreaterThan(0);
    });
  });
});
