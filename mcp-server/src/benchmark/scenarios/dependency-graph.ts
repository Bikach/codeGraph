import type { BenchmarkScenario, ScenarioContext } from './types.js';

export const dependencyGraphScenario: BenchmarkScenario = {
  id: 'dependency-analysis',
  name: 'Dependency Analysis',
  description: 'Analyze all dependencies of a class (incoming and outgoing)',
  expectedMcpTool: 'mcp__codegraph__get_neighbors',

  getPrompt(context: ScenarioContext): string {
    const classDesc = context.targetClassDesc || 'the use case that handles user authentication';
    return `Analyze all dependencies of ${classDesc}. Find what it depends on (imports, injections) and what depends on it (usages). Return the dependency graph.`;
  },
};
