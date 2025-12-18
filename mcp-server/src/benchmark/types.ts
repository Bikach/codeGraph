export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  totalCost: number;
}

export interface BenchmarkMetrics {
  llmCalls: number;
  toolCalls: number;
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  executionTimeMs: number;
}

export interface ComparisonResult {
  scenarioId: string;
  scenarioName: string;
  description: string;
  mcp: BenchmarkMetrics;
  native: BenchmarkMetrics;
  savings: {
    tokens: number;
    cost: number;
    time: number;
    llmCalls: number;
  };
}

export interface BenchmarkReport {
  timestamp: Date;
  config: BenchmarkConfig;
  scenarios: ComparisonResult[];
  summary: {
    avgTokenSavings: number;
    avgCostSavings: number;
    avgTimeSavings: number;
    avgLlmCallsSavings: number;
    totalMcpCost: number;
    totalNativeCost: number;
  };
}

export interface BenchmarkConfig {
  projectPath: string;
  runsPerScenario: number;
}
