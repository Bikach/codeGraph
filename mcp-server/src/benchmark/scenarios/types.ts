export interface ScenarioContext {
  projectPath: string;
  targetClass?: string;
  targetFunction?: string;
  targetInterface?: string;
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  getPrompt(context: ScenarioContext): string;
  validateOutput(output: string): boolean;
}
