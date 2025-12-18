import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const findImplementationsScenario: BenchmarkScenario = {
  id: 'find-implementations',
  name: 'Find Implementations',
  description: 'Find all classes that implement a specific interface',
  expectedMcpTool: 'mcp__codegraph__get_implementations',

  getPrompt(context: ScenarioContext): string {
    const interfaceDesc = context.targetInterfaceDesc || 'the repository interface for managing users';
    return `Find all classes that implement ${interfaceDesc}. Return the list with file paths.`;
  },
};
