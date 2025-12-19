#!/usr/bin/env node

/**
 * CodeGraph Benchmark CLI
 *
 * Compares MCP CodeGraph tools vs native Glob/Grep/Read operations.
 *
 * Usage:
 *   npm run benchmark:mcp <project-path>     # Run with MCP tools
 *   npm run benchmark:native <project-path>  # Run with native tools
 *   npm run benchmark:report                 # Generate HTML report from all JSON files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { scenarios } from './scenarios/index.js';
import { BenchmarkRunner, type RunnerMode } from './runners/index.js';
import type { BenchmarkRunResult, ScenarioResult } from './types.js';
import type { ScenarioContext } from './scenarios/types.js';

const OUTPUT_DIR = path.join(process.cwd(), 'benchmark-results');

/**
 * Generate a unique filename with timestamp
 * Format: mcp-results-20251219-143022.json
 */
function generateResultFilename(mode: RunnerMode): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15);
  return `${mode}-results-${timestamp}.json`;
}

function printUsage(): void {
  console.log(`
Usage:
  npm run benchmark:mcp <project-path>     Run benchmark with MCP tools
  npm run benchmark:native <project-path>  Run benchmark with native tools
  npm run benchmark:report                 Generate HTML report from results

Arguments:
  project-path    Path to the project to analyze (required for mcp/native)

Example:
  npm run benchmark:mcp /Users/me/my-kotlin-project
  npm run benchmark:native /Users/me/my-kotlin-project
  npm run benchmark:report
`);
}

/**
 * Hardcoded context for h-backend project benchmark
 * Uses functional descriptions instead of exact class/function names
 */
function getHBackendContext(): Omit<ScenarioContext, 'projectPath'> {
  return {
    targetFunctionDesc: 'the function that finds a user by their ID',
    targetClassDesc: 'the use case that handles user login',
    targetInterfaceDesc: 'the repository interface for managing users',
    impactTargetClassDesc: 'the domain model representing a user',
    callChainFromDesc: 'the function that retrieves a user by ID',
    callChainToDesc: 'the function that saves data to the database',
  };
}

async function runBenchmark(mode: RunnerMode, projectPath: string): Promise<void> {
  console.log(`\n🚀 Benchmark Suite - ${mode.toUpperCase()} Mode\n`);
  console.log(`📁 Project: ${projectPath}`);
  console.log(`📊 Scenarios: ${scenarios.length}\n`);

  const context: ScenarioContext = {
    ...getHBackendContext(),
    projectPath,
  };

  console.log('📌 Benchmark targets (functional descriptions):');
  console.log(`   • ${context.targetFunctionDesc}`);
  console.log(`   • ${context.targetClassDesc}`);
  console.log(`   • ${context.targetInterfaceDesc}`);
  console.log(`   • ${context.impactTargetClassDesc}\n`);

  const runner = new BenchmarkRunner(mode);
  const results: ScenarioResult[] = [];

  for (const scenario of scenarios) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const prompt = scenario.getPrompt(context);
    console.log(`💬 Prompt: "${prompt.substring(0, 80)}..."\n`);

    try {
      const metrics = await runner.runScenario(scenario, context);
      console.log(`   ✅ LLM calls: ${metrics.llmCalls}, Tool calls: ${metrics.toolCalls}`);
      console.log(`   📊 Tokens: ${metrics.tokenUsage.totalTokens.toLocaleString()} (in: ${metrics.tokenUsage.inputTokens.toLocaleString()}, out: ${metrics.tokenUsage.outputTokens.toLocaleString()})`);
      console.log(`   💰 Cost: $${metrics.cost.totalCost.toFixed(4)}`);
      console.log(`   ⏱️  Time: ${(metrics.executionTimeMs / 1000).toFixed(1)}s`);
      if (metrics.toolsUsed?.length) {
        console.log(`   🔧 Tools: ${metrics.toolsUsed.join(', ')}`);
      }

      results.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        description: scenario.description,
        prompt,
        metrics,
      });
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        description: scenario.description,
        prompt,
        metrics: {
          llmCalls: 0,
          toolCalls: 0,
          tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          cost: { totalCost: 0 },
          executionTimeMs: 0,
        },
      });
    }

    console.log('');
  }

  // Calculate totals
  const totals = {
    cost: results.reduce((sum, r) => sum + r.metrics.cost.totalCost, 0),
    tokens: results.reduce((sum, r) => sum + r.metrics.tokenUsage.totalTokens, 0),
    time: results.reduce((sum, r) => sum + r.metrics.executionTimeMs, 0),
    llmCalls: results.reduce((sum, r) => sum + r.metrics.llmCalls, 0),
    toolCalls: results.reduce((sum, r) => sum + r.metrics.toolCalls, 0),
  };

  const runResult: BenchmarkRunResult = {
    mode,
    timestamp: new Date().toISOString(),
    projectPath,
    scenarios: results,
    totals,
  };

  // Save results with unique filename
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputFilename = generateResultFilename(mode);
  const outputPath = path.join(OUTPUT_DIR, outputFilename);
  fs.writeFileSync(outputPath, JSON.stringify(runResult, null, 2));

  // Print summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`                    ${mode.toUpperCase()} BENCHMARK COMPLETE`);
  console.log('════════════════════════════════════════════════════════════\n');
  console.log(`📊 Totals:`);
  console.log(`   • LLM Calls:  ${totals.llmCalls}`);
  console.log(`   • Tool Calls: ${totals.toolCalls}`);
  console.log(`   • Tokens:     ${totals.tokens.toLocaleString()}`);
  console.log(`   • Cost:       $${totals.cost.toFixed(4)}`);
  console.log(`   • Time:       ${(totals.time / 1000).toFixed(1)}s`);
  console.log(`\n📄 Results saved to: ${outputPath}`);
  console.log('\n════════════════════════════════════════════════════════════\n');
}

// Main entry point
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printUsage();
  process.exit(args.length === 0 ? 1 : 0);
}

const mode = args[0] as RunnerMode;
const projectPath = args[1] ? path.resolve(args[1]) : undefined;

if (mode !== 'mcp' && mode !== 'native') {
  console.error(`❌ Error: Invalid mode "${mode}". Use "mcp" or "native".`);
  printUsage();
  process.exit(1);
}

if (!projectPath) {
  console.error(`❌ Error: Project path is required.`);
  printUsage();
  process.exit(1);
}

if (!fs.existsSync(projectPath)) {
  console.error(`❌ Error: Project path does not exist: ${projectPath}`);
  process.exit(1);
}

if (!fs.statSync(projectPath).isDirectory()) {
  console.error(`❌ Error: Project path is not a directory: ${projectPath}`);
  process.exit(1);
}

runBenchmark(mode, projectPath).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
