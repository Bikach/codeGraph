import { spawnSync } from 'node:child_process';
import * as os from 'node:os';
import type { BenchmarkMetrics } from '../types.js';
import type { BenchmarkScenario, ScenarioContext } from '../scenarios/types.js';

const CLAUDE_PATH = `${os.homedir()}/.claude/local/claude`;

export type RunnerMode = 'mcp' | 'native';

interface ClaudeResultMessage {
  type: 'result';
  duration_ms: number;
  num_turns: number;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface ClaudeAssistantMessage {
  type: 'assistant';
  message?: {
    content?: Array<{ type: string; name?: string; text?: string }>;
  };
}

type ClaudeMessage = ClaudeResultMessage | ClaudeAssistantMessage | { type: string };

export class BenchmarkRunner {
  private mode: RunnerMode;

  constructor(mode: RunnerMode) {
    this.mode = mode;
  }

  async runScenario(scenario: BenchmarkScenario, context: ScenarioContext): Promise<BenchmarkMetrics> {
    const prompt = scenario.getPrompt(context);

    const args = [
      '-p',
      '--output-format', 'json',
      '--model', 'sonnet',
      '--permission-mode', 'bypassPermissions',
    ];

    // Native mode: disable all MCP by clearing setting sources
    if (this.mode === 'native') {
      args.push('--setting-sources', '');
    }

    args.push(prompt);

    const result = spawnSync(CLAUDE_PATH, args, {
      encoding: 'utf-8',
      timeout: 300000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: context.projectPath,
    });

    const output = result.stdout || '';
    if (!output && result.stderr) {
      throw new Error(`CLI error: ${result.stderr}`);
    }

    return this.parseOutput(output);
  }

  private parseOutput(output: string): BenchmarkMetrics {
    const messages: ClaudeMessage[] = JSON.parse(output);

    let toolCalls = 0;
    const toolsUsed: string[] = [];

    for (const message of messages) {
      if (message.type === 'assistant') {
        const assistantMsg = message as ClaudeAssistantMessage;
        if (assistantMsg.message?.content) {
          for (const content of assistantMsg.message.content) {
            if (content.type === 'tool_use') {
              toolCalls++;
              if (content.name && !toolsUsed.includes(content.name)) {
                toolsUsed.push(content.name);
              }
            }
          }
        }
      }
    }

    const resultMessage = messages.find((m) => m.type === 'result') as ClaudeResultMessage | undefined;

    if (resultMessage) {
      return {
        llmCalls: resultMessage.num_turns,
        toolCalls,
        toolsUsed,
        tokenUsage: {
          inputTokens: resultMessage.usage.input_tokens,
          outputTokens: resultMessage.usage.output_tokens,
          totalTokens: resultMessage.usage.input_tokens + resultMessage.usage.output_tokens,
        },
        cost: { totalCost: resultMessage.total_cost_usd },
        executionTimeMs: resultMessage.duration_ms,
      };
    }

    return {
      llmCalls: 0,
      toolCalls,
      toolsUsed,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { totalCost: 0 },
      executionTimeMs: 0,
    };
  }
}
