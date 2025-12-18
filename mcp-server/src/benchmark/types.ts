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
  toolsUsed?: string[];
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  executionTimeMs: number;
  /** The actual response text from the LLM */
  response: string;
}

export interface ResponseEvaluation {
  /** Score from 1-10 */
  score: number;
  /** Explanation of the score */
  reasoning: string;
  /** Whether the expected tool was used */
  usedCorrectTool: boolean;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  description: string;
  prompt: string;
  /** Expected tool for MCP mode */
  expectedMcpTool?: string;
  metrics: BenchmarkMetrics;
  evaluation?: ResponseEvaluation;
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
  mcp: BenchmarkMetrics & { evaluation?: ResponseEvaluation };
  native: BenchmarkMetrics & { evaluation?: ResponseEvaluation };
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
    avgMcpScore: number;
    avgNativeScore: number;
  };
}

export interface BenchmarkConfig {
  projectPath: string;
  runsPerScenario: number;
}
