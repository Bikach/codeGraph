import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const dependencyGraphScenario: BenchmarkScenario = {
  id: 'dependency-analysis',
  name: 'Dependency Analysis',
  description: 'Analyze all dependencies of a class (incoming and outgoing)',

  getPrompt(context: ScenarioContext): string {
    const className = context.targetClass || 'DataProcessor';
    return `What are all the dependencies of the class "${className}"?
Project path: ${context.projectPath}`;
  },

  validateOutput(output: string): boolean {
    return output.toLowerCase().includes('depend') || output.includes('→') || output.includes('->');
  },
};
