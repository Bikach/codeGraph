import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const impactAnalysisScenario: BenchmarkScenario = {
  id: 'impact-analysis',
  name: 'Impact Analysis',
  description: 'Analyze the impact of modifying a class or function',
  expectedMcpTool: 'mcp__codegraph__get_impact',

  getPrompt(context: ScenarioContext): string {
    const classDesc = context.impactTargetClassDesc || 'the domain model representing a user';
    return `Analyze the impact of modifying ${classDesc}. Find all code that would be affected by changes to this class, including direct and indirect dependents. Return the impact analysis.`;
  },
};
