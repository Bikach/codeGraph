import { query } from '@anthropic-ai/claude-agent-sdk';
import type { BenchmarkMetrics } from '../types.js';
import type { BenchmarkScenario, ScenarioContext } from '../scenarios/types.js';

export class McpRunner {
  async initialize(): Promise<void> {
    // No initialization needed for Claude Agent SDK
  }

  async cleanup(): Promise<void> {
    // No cleanup needed
  }

  async runScenario(scenario: BenchmarkScenario, context: ScenarioContext): Promise<BenchmarkMetrics> {
    const startTime = Date.now();
    let toolCalls = 0;

    const prompt = scenario.getPrompt(context);

    for await (const message of query({
      prompt,
      options: {
        maxTurns: 10,
        permissionMode: 'bypassPermissions',
        // Minimal system prompt for reduced token usage
        systemPrompt:
          'You are a code analysis assistant. Use the CodeGraph MCP tools to answer questions. Be concise and direct.',
        // Explicit model selection
        model: 'claude-sonnet-4-20250514',
        // No external settings (default, but explicit for clarity)
        settingSources: [],
        allowedTools: [
          'mcp__codegraph__search_nodes',
          'mcp__codegraph__get_callers',
          'mcp__codegraph__get_callees',
          'mcp__codegraph__get_neighbors',
          'mcp__codegraph__get_implementations',
          'mcp__codegraph__get_impact',
          'mcp__codegraph__find_path',
          'mcp__codegraph__get_file_symbols',
        ],
      },
    })) {
      // Count tool uses from assistant messages
      if (message.type === 'assistant' && message.message?.content) {
        const toolUses = message.message.content.filter(
          (c: { type: string }) => c.type === 'tool_use'
        );
        toolCalls += toolUses.length;
      }

      // Extract final metrics from result message
      if (message.type === 'result') {
        return {
          llmCalls: message.num_turns,
          toolCalls,
          tokenUsage: {
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            totalTokens: message.usage.input_tokens + message.usage.output_tokens,
          },
          cost: { totalCost: message.total_cost_usd },
          executionTimeMs: message.duration_ms,
        };
      }
    }

    // Fallback if no result message received
    return {
      llmCalls: 0,
      toolCalls,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { totalCost: 0 },
      executionTimeMs: Date.now() - startTime,
    };
  }
}
