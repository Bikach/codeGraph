import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const findCallersScenario: BenchmarkScenario = {
  id: 'find-callers',
  name: 'Find Callers',
  description: 'Find all functions that call a specific function',

  getPrompt(context: ScenarioContext): string {
    const functionName = context.targetFunction || 'processRequest';
    return `Find all functions that call "${functionName}".
Project path: ${context.projectPath}`;
  },

  validateOutput(output: string): boolean {
    return output.toLowerCase().includes('caller') || output.includes(':');
  },
};
