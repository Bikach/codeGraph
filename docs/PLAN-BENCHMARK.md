# Plan: Suite de Benchmarks MCP CodeGraph

## Objectif
Créer une suite de benchmarks comparant les performances MCP CodeGraph vs Claude Code natif (Glob/Grep/Read) pour mesurer:
- **Nombre d'appels LLM** : iterations/tool calls nécessaires
- **Tokens** : consommation input/output
- **Coût API** : calcul basé sur la tarification Anthropic
- **Temps** : latence de réponse

## Approche : API Anthropic réelle

On appelle l'API Claude pour des mesures précises :
- **Tokens** : `response.usage.input_tokens` / `output_tokens` (précis)
- **Coût** : tokens × tarifs Anthropic
- **LLM calls** : nombre réel d'itérations de la boucle agentique

**Coût estimé** : ~$2-4 pour une suite complète (5 scénarios × 3 runs)

## Architecture

```
mcp-server/src/benchmark/
├── index.ts                    # Runner principal + CLI
├── types.ts                    # Types (TokenUsage, BenchmarkMetrics, etc.)
├── config.ts                   # Config + pricing Anthropic
├── scenarios/                  # Scénarios de benchmark
│   ├── index.ts                # Registry des scénarios
│   ├── types.ts                # Interface BenchmarkScenario
│   ├── find-callers.ts         # Trouver les appelants d'une fonction
│   ├── find-implementations.ts # Trouver les implémentations d'interface
│   ├── impact-analysis.ts      # Analyser l'impact d'une modification
│   ├── dependency-graph.ts     # Mapper les dépendances
│   └── call-chain.ts           # Tracer la chaîne d'appels
├── runners/
│   ├── mcp-runner.ts           # Exécution avec MCP tools
│   ├── native-runner.ts        # Exécution avec Glob/Grep/Read
│   └── metrics-collector.ts    # Collecte tokens/temps/coût
├── reporters/
│   ├── json-reporter.ts        # Export JSON
│   ├── markdown-reporter.ts    # Tables markdown
│   ├── html-reporter.ts        # Rapport HTML avec graphiques
│   └── console-reporter.ts     # Affichage terminal
└── benchmark.test.ts           # Tests vitest
```

## Fichiers à créer

### 1. `benchmark/types.ts`
```typescript
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostBreakdown {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

export interface BenchmarkMetrics {
  llmCalls: number;           // Nombre d'appels au LLM
  toolCalls: number;          // Nombre de tool calls
  tokenUsage: TokenUsage;
  cost: CostBreakdown;
  executionTimeMs: number;
}

export interface ComparisonResult {
  scenarioId: string;
  scenarioName: string;
  mcp: BenchmarkMetrics;
  native: BenchmarkMetrics;
  savings: { tokens: number; cost: number; time: number; llmCalls: number }; // %
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
```

### 2. `benchmark/config.ts`
```typescript
// Tarification Anthropic (décembre 2025)
export const PRICING = {
  'claude-sonnet-4-20250514': {
    input: 3.00,   // $ par million tokens
    output: 15.00,
  },
  'claude-opus-4-20250514': {
    input: 15.00,
    output: 75.00,
  },
} as const;

export interface BenchmarkConfig {
  projectPath: string;
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
  anthropicApiKey: string;
  model: keyof typeof PRICING;
  runsPerScenario: number; // défaut: 3
}

export function calculateCost(tokens: TokenUsage, model: keyof typeof PRICING): CostBreakdown {
  const pricing = PRICING[model];
  const inputCost = (tokens.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (tokens.outputTokens / 1_000_000) * pricing.output;
  return { inputCost, outputCost, totalCost: inputCost + outputCost };
}
```

### 3. `benchmark/scenarios/` (5 scénarios)

| Scénario | MCP Tool | MCP (LLM calls) | Native (LLM calls) | Savings attendu |
|----------|----------|-----------------|-------------------|-----------------|
| find-callers | get_callers | 1 call, 1 tool | 4-8 calls | 75-85% |
| find-implementations | get_implementations | 1 call, 1 tool | 5-10 calls | 80-90% |
| impact-analysis | get_impact | 1 call, 1 tool | 8-15 calls | 85-95% |
| dependency-graph | get_neighbors | 1 call, 1 tool | 6-12 calls | 70-85% |
| call-chain | find_path | 1 call, 1 tool | 5-10 calls | 75-85% |

```typescript
// scenarios/types.ts
export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  // Prompt identique pour MCP et Native
  getPrompt(context: ScenarioContext): string;
  // Validation du résultat
  validateOutput(output: string): boolean;
}

export interface ScenarioContext {
  projectPath: string;
  targetClass?: string;
  targetFunction?: string;
  targetInterface?: string;
}
```

### 4. `benchmark/runners/mcp-runner.ts`
```typescript
import Anthropic from '@anthropic-ai/sdk';

export class McpRunner {
  private client: Anthropic;

  async runScenario(scenario: BenchmarkScenario, context: ScenarioContext): Promise<BenchmarkMetrics> {
    const startTime = Date.now();
    let llmCalls = 0;
    let toolCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: scenario.getPrompt(context) }
    ];

    // Boucle agentique
    while (true) {
      llmCalls++;
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 4096,
        tools: this.getMcpTools(), // search_nodes, get_callers, get_callees, etc.
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      if (response.stop_reason === 'end_turn') break;

      // Exécuter les tool calls
      const toolUses = response.content.filter(c => c.type === 'tool_use');
      toolCalls += toolUses.length;

      for (const tool of toolUses) {
        const result = await this.executeMcpTool(tool.name, tool.input);
        messages.push({ role: 'assistant', content: response.content });
        messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: tool.id, content: result }] });
      }
    }

    return {
      llmCalls,
      toolCalls,
      tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalTokens: totalInputTokens + totalOutputTokens },
      cost: calculateCost({ inputTokens: totalInputTokens, outputTokens: totalOutputTokens, totalTokens: 0 }, this.config.model),
      executionTimeMs: Date.now() - startTime,
    };
  }

  private getMcpTools(): Anthropic.Tool[] {
    return [
      { name: 'search_nodes', description: 'Search for classes, interfaces, functions by name', input_schema: {...} },
      { name: 'get_callers', description: 'Find all functions that call a specified function', input_schema: {...} },
      { name: 'get_callees', description: 'Find all functions called by a specified function', input_schema: {...} },
      { name: 'get_neighbors', description: 'Get dependencies and dependents of a class', input_schema: {...} },
      { name: 'get_implementations', description: 'Find interface implementations', input_schema: {...} },
      { name: 'get_impact', description: 'Analyze impact of modifying a node', input_schema: {...} },
      { name: 'find_path', description: 'Find shortest path between two nodes', input_schema: {...} },
      { name: 'get_file_symbols', description: 'List all symbols in a file', input_schema: {...} },
    ];
  }
}
```

### 5. `benchmark/runners/native-runner.ts`
```typescript
export class NativeRunner {
  async runScenario(scenario: BenchmarkScenario, context: ScenarioContext): Promise<BenchmarkMetrics> {
    // Même structure mais avec tools Glob/Grep/Read uniquement
    const tools: Anthropic.Tool[] = [
      {
        name: 'glob',
        description: 'Find files matching a glob pattern (e.g., **/*.kt)',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Glob pattern' },
            path: { type: 'string', description: 'Base directory' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'grep',
        description: 'Search for pattern in files',
        input_schema: {
          type: 'object',
          properties: {
            pattern: { type: 'string', description: 'Regex pattern to search' },
            path: { type: 'string', description: 'Directory to search in' },
            glob: { type: 'string', description: 'File pattern filter' },
          },
          required: ['pattern'],
        },
      },
      {
        name: 'read',
        description: 'Read file contents',
        input_schema: {
          type: 'object',
          properties: {
            file_path: { type: 'string', description: 'Path to file' },
            offset: { type: 'number', description: 'Line offset' },
            limit: { type: 'number', description: 'Max lines to read' },
          },
          required: ['file_path'],
        },
      },
    ];

    // Claude va naturellement faire plus d'itérations sans MCP
    // car il doit grep → read → grep → read pour trouver les infos
  }
}
```

### 6. `benchmark/reporters/html-reporter.ts`
```typescript
export function generateHtmlReport(report: BenchmarkReport): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>CodeGraph Benchmark Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: system-ui; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    .card { background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .chart-container { width: 100%; max-width: 600px; margin: 20px auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; border: 1px solid #ddd; text-align: left; }
    th { background: #f8f9fa; }
    .savings { color: #22c55e; font-weight: bold; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
    .metric { text-align: center; }
    .metric-value { font-size: 2rem; font-weight: bold; color: #3b82f6; }
    .metric-label { color: #666; }
  </style>
</head>
<body>
  <h1>CodeGraph MCP Benchmark Report</h1>
  <p>Generated: ${report.timestamp.toISOString()}</p>

  <div class="card">
    <h2>Summary</h2>
    <div class="summary">
      <div class="metric">
        <div class="metric-value">${report.summary.avgLlmCallsSavings.toFixed(0)}%</div>
        <div class="metric-label">LLM Calls Saved</div>
      </div>
      <div class="metric">
        <div class="metric-value">${report.summary.avgTokenSavings.toFixed(0)}%</div>
        <div class="metric-label">Tokens Saved</div>
      </div>
      <div class="metric">
        <div class="metric-value">${report.summary.avgCostSavings.toFixed(0)}%</div>
        <div class="metric-label">Cost Saved</div>
      </div>
      <div class="metric">
        <div class="metric-value">${report.summary.avgTimeSavings.toFixed(0)}%</div>
        <div class="metric-label">Time Saved</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>LLM Calls Comparison</h2>
    <div class="chart-container">
      <canvas id="llmCallsChart"></canvas>
    </div>
  </div>

  <div class="card">
    <h2>Token Usage Comparison</h2>
    <div class="chart-container">
      <canvas id="tokensChart"></canvas>
    </div>
  </div>

  <div class="card">
    <h2>Cost Comparison</h2>
    <div class="chart-container">
      <canvas id="costChart"></canvas>
    </div>
  </div>

  <div class="card">
    <h2>Detailed Results</h2>
    <table>
      <thead>
        <tr>
          <th>Scenario</th>
          <th>MCP LLM Calls</th>
          <th>Native LLM Calls</th>
          <th>MCP Tokens</th>
          <th>Native Tokens</th>
          <th>MCP Cost</th>
          <th>Native Cost</th>
          <th>Savings</th>
        </tr>
      </thead>
      <tbody>
        ${report.scenarios.map(s => `
        <tr>
          <td>${s.scenarioName}</td>
          <td>${s.mcp.llmCalls}</td>
          <td>${s.native.llmCalls}</td>
          <td>${s.mcp.tokenUsage.totalTokens.toLocaleString()}</td>
          <td>${s.native.tokenUsage.totalTokens.toLocaleString()}</td>
          <td>$${s.mcp.cost.totalCost.toFixed(4)}</td>
          <td>$${s.native.cost.totalCost.toFixed(4)}</td>
          <td class="savings">${s.savings.cost.toFixed(0)}%</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <script>
    const scenarios = ${JSON.stringify(report.scenarios)};

    // LLM Calls Chart
    new Chart(document.getElementById('llmCallsChart'), {
      type: 'bar',
      data: {
        labels: scenarios.map(s => s.scenarioName),
        datasets: [
          { label: 'MCP', data: scenarios.map(s => s.mcp.llmCalls), backgroundColor: '#3b82f6' },
          { label: 'Native', data: scenarios.map(s => s.native.llmCalls), backgroundColor: '#ef4444' }
        ]
      },
      options: { plugins: { title: { display: true, text: 'LLM Calls per Scenario' } } }
    });

    // Tokens Chart
    new Chart(document.getElementById('tokensChart'), {
      type: 'bar',
      data: {
        labels: scenarios.map(s => s.scenarioName),
        datasets: [
          { label: 'MCP', data: scenarios.map(s => s.mcp.tokenUsage.totalTokens), backgroundColor: '#3b82f6' },
          { label: 'Native', data: scenarios.map(s => s.native.tokenUsage.totalTokens), backgroundColor: '#ef4444' }
        ]
      },
      options: { plugins: { title: { display: true, text: 'Token Usage per Scenario' } } }
    });

    // Cost Chart
    new Chart(document.getElementById('costChart'), {
      type: 'bar',
      data: {
        labels: scenarios.map(s => s.scenarioName),
        datasets: [
          { label: 'MCP', data: scenarios.map(s => s.mcp.cost.totalCost), backgroundColor: '#3b82f6' },
          { label: 'Native', data: scenarios.map(s => s.native.cost.totalCost), backgroundColor: '#ef4444' }
        ]
      },
      options: { plugins: { title: { display: true, text: 'Cost per Scenario ($)' } } }
    });
  </script>
</body>
</html>`;
}
```

## Dépendances à ajouter
```json
{
  "devDependencies": {
    "@anthropic-ai/sdk": "^0.30.0"
  }
}
```

## Scripts npm à ajouter
```json
{
  "scripts": {
    "benchmark": "tsx src/benchmark/index.ts",
    "benchmark:report": "tsx src/benchmark/index.ts --report-only"
  }
}
```

## Exécution

```bash
# 1. Indexer le projet Kotlin dans Neo4j (préalable)
npm run index -- /chemin/vers/projet-kotlin

# 2. Lancer les benchmarks
ANTHROPIC_API_KEY=sk-... \
BENCHMARK_PROJECT=/chemin/vers/projet-kotlin \
npm run benchmark

# 3. Résultats générés dans benchmark/results/
#    - report.html (graphiques interactifs)
#    - report.json (données brutes)
#    - report.md (tableau markdown)
```

## Prérequis
- Projet Kotlin indexé dans Neo4j
- Clé API Anthropic (ANTHROPIC_API_KEY)
- Docker Neo4j running
