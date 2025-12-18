import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const impactAnalysisScenario: BenchmarkScenario = {
  id: 'impact-analysis',
  name: 'Impact Analysis',
  description: 'Analyze the impact of modifying a class or function',

  getPrompt(context: ScenarioContext): string {
    const className = context.targetClass || 'UserService';
    return `Analyze the impact of modifying the class "${className}".
What code would be affected if this class changes?
Project path: ${context.projectPath}`;
  },

  validateOutput(output: string): boolean {
    return output.toLowerCase().includes('impact') || output.toLowerCase().includes('dependent');
  },
};
