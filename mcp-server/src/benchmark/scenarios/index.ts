import { findCallersScenario } from './find-callers.js';
import { findImplementationsScenario } from './find-implementations.js';
import { impactAnalysisScenario } from './impact-analysis.js';
import { dependencyGraphScenario } from './dependency-graph.js';
import { callChainScenario } from './call-chain.js';
import type { BenchmarkScenario } from './types.js';

export const scenarios: BenchmarkScenario[] = [
  findCallersScenario,
  findImplementationsScenario,
  impactAnalysisScenario,
  dependencyGraphScenario,
  callChainScenario,
];

export type { BenchmarkScenario, ScenarioContext } from './types.js';
