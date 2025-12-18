export interface ScenarioContext {
  projectPath: string;
  // Functional descriptions (not exact names)
  targetFunctionDesc?: string;
  targetClassDesc?: string;
  targetInterfaceDesc?: string;
  impactTargetClassDesc?: string;
  callChainFromDesc?: string;
  callChainToDesc?: string;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  /** Expected MCP tool to be used */
  expectedMcpTool: string;
  /** Prompt used for both MCP and Native modes (same prompt, different tools available) */
  getPrompt(context: ScenarioContext): string;
}
