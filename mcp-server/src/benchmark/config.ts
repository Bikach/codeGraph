import type { BenchmarkConfig } from './types.js';

export function loadConfig(): BenchmarkConfig {
  return {
    projectPath: process.env.BENCHMARK_PROJECT || process.cwd(),
    runsPerScenario: parseInt(process.env.BENCHMARK_RUNS || '1', 10),
  };
}
