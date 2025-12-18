import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const findCallersScenario: BenchmarkScenario = {
  id: 'find-callers',
  name: 'Find Callers',
  description: 'Find all functions that call a specific function',
  expectedMcpTool: 'mcp__codegraph__get_callers',

  getPrompt(context: ScenarioContext): string {
    const functionDesc = context.targetFunctionDesc || 'the function that finds a user by their ID';
    return `Find all functions that call ${functionDesc} in this codebase. Return the list of callers with their file locations.`;
  },
};
