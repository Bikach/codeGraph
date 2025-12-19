export interface CostBreakdown {
  totalCost: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface BenchmarkMetrics {
  llmCalls: number;
  toolCalls: number;
  toolsUsed?: string[];
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  executionTimeMs: number;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  description: string;
  prompt: string;
  metrics: BenchmarkMetrics;
}

export interface BenchmarkRunResult {
  mode: 'mcp' | 'native';
  timestamp: string;
  projectPath: string;
  scenarios: ScenarioResult[];
  totals: {
    cost: number;
    tokens: number;
    time: number;
    llmCalls: number;
    toolCalls: number;
  };
}

export interface ComparisonResult {
  scenarioId: string;
  scenarioName: string;
  description: string;
  prompt: string;
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
  mcpRuns: number;
  nativeRuns: number;
}
