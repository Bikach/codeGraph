import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const callChainScenario: BenchmarkScenario = {
  id: 'call-chain',
  name: 'Call Chain',
  description: 'Trace the call chain between two functions',

  getPrompt(context: ScenarioContext): string {
    const fromFunction = context.targetFunction || 'handleRequest';
    const toFunction = 'saveToDatabase';
    return `Find the call path from "${fromFunction}" to "${toFunction}".
Project path: ${context.projectPath}`;
  },

  validateOutput(output: string): boolean {
    return output.toLowerCase().includes('call') || output.includes('→') || output.includes('->');
  },
};
