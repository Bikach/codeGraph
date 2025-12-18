#!/usr/bin/env node

/**
 * CodeGraph Benchmark CLI
 *
 * Compares MCP CodeGraph tools vs native Glob/Grep/Read operations.
 *
 * Usage:
 *   npm run benchmark:mcp <project-path>     # Run with MCP tools
 *   npm run benchmark:native <project-path>  # Run with native tools
 *   npm run benchmark:report                 # Generate HTML report from JSON files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { scenarios } from './scenarios/index.js';
import { BenchmarkRunner, type RunnerMode } from './runners/index.js';
import { evaluateResponse } from './evaluator.js';
import type { BenchmarkRunResult, ScenarioResult, ResponseEvaluation } from './types.js';
import type { ScenarioContext } from './scenarios/types.js';

const OUTPUT_DIR = path.join(process.cwd(), 'benchmark-results');

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
    if (mode === 'mcp') {
      console.log(`   Expected tool: ${scenario.expectedMcpTool}`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    const prompt = scenario.getPrompt(context);
    console.log(`💬 Prompt: "${prompt.substring(0, 80)}..."\n`);

    try {
      const metrics = await runner.runScenario(scenario, context);
      console.log(`   ✅ LLM calls: ${metrics.llmCalls}, Tool calls: ${metrics.toolCalls}`);
      console.log(`   📊 Tokens: ${metrics.tokenUsage.totalTokens.toLocaleString()}`);
      console.log(`   💰 Cost: $${metrics.cost.totalCost.toFixed(4)}`);
      console.log(`   ⏱️  Time: ${(metrics.executionTimeMs / 1000).toFixed(1)}s`);
      if (metrics.toolsUsed?.length) {
        console.log(`   🔧 Tools: ${metrics.toolsUsed.join(', ')}`);
        // Check if expected tool was used
        if (mode === 'mcp') {
          const usedExpected = metrics.toolsUsed.some(t => t === scenario.expectedMcpTool);
          console.log(`   ${usedExpected ? '✅' : '❌'} Expected tool: ${usedExpected ? 'YES' : 'NO'}`);
        }
      }
      console.log(`   📝 Response: ${metrics.response.substring(0, 100)}...`);

      // Evaluate response
      console.log(`\n   🔍 Evaluating response...`);
      let evaluation: ResponseEvaluation | undefined;
      try {
        evaluation = await evaluateResponse(
          scenario,
          prompt,
          metrics.response,
          metrics.toolsUsed || [],
          mode === 'mcp' ? scenario.expectedMcpTool : undefined
        );
        console.log(`   📊 Score: ${evaluation.score}/10`);
        console.log(`   💭 ${evaluation.reasoning}`);
        console.log(`   🔧 Correct tool: ${evaluation.usedCorrectTool ? 'YES' : 'NO'}`);
      } catch {
        console.log(`   ⚠️ Could not evaluate response`);
      }

      results.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        description: scenario.description,
        prompt,
        expectedMcpTool: mode === 'mcp' ? scenario.expectedMcpTool : undefined,
        metrics,
        evaluation,
      });
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      results.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        description: scenario.description,
        prompt,
        expectedMcpTool: mode === 'mcp' ? scenario.expectedMcpTool : undefined,
        metrics: {
          llmCalls: 0,
          toolCalls: 0,
          tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          cost: { totalCost: 0 },
          executionTimeMs: 0,
          response: `Error: ${error instanceof Error ? error.message : String(error)}`,
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

  // Calculate average score
  const scoredResults = results.filter(r => r.evaluation?.score);
  const avgScore = scoredResults.length > 0
    ? scoredResults.reduce((sum, r) => sum + (r.evaluation?.score || 0), 0) / scoredResults.length
    : 0;

  const runResult: BenchmarkRunResult = {
    mode,
    timestamp: new Date().toISOString(),
    projectPath,
    scenarios: results,
    totals,
  };

  // Save results
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const outputPath = path.join(OUTPUT_DIR, `${mode}-results.json`);
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
  console.log(`   • Avg Score:  ${avgScore.toFixed(1)}/10`);
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
