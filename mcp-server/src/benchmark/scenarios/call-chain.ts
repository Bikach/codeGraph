import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const callChainScenario: BenchmarkScenario = {
  id: 'call-chain',
  name: 'Call Chain',
  description: 'Trace the call chain between two functions',
  expectedMcpTool: 'mcp__codegraph__find_path',

  getPrompt(context: ScenarioContext): string {
    const fromDesc = context.callChainFromDesc || 'the function that retrieves a user by ID';
    const toDesc = context.callChainToDesc || 'the function that persists data to the database';
    return `Trace the call chain from ${fromDesc} to ${toDesc}. Find if there's a path of function calls connecting these two functions. Return the call chain if it exists.`;
  },
};
