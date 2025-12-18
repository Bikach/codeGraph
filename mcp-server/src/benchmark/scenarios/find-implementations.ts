import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const findImplementationsScenario: BenchmarkScenario = {
  id: 'find-implementations',
  name: 'Find Implementations',
  description: 'Find all classes that implement a specific interface',

  getPrompt(context: ScenarioContext): string {
    const interfaceName = context.targetInterface || 'Repository';
    return `Find all classes that implement the interface "${interfaceName}".
Project path: ${context.projectPath}`;
  },

  validateOutput(output: string): boolean {
    return output.toLowerCase().includes('implement') || output.includes('class');
  },
};
