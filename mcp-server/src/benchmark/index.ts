#!/usr/bin/env node

/**
 * CodeGraph Benchmark CLI
 *
 * Compares MCP CodeGraph tools vs native Glob/Grep/Read operations
 * to measure token savings, cost reduction, and performance improvements.
 *
 * Usage:
 *   npm run benchmark <project-path>
 *
 * Example:
 *   npm run benchmark /path/to/kotlin-project
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY   - Required: Anthropic API key
 *   BENCHMARK_MODEL     - Model to use (default: claude-sonnet-4-20250514)
 *   NEO4J_URI          - Neo4j connection URI
 *   NEO4J_USER         - Neo4j username
 *   NEO4J_PASSWORD     - Neo4j password
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from './config.js';

function printUsage(): void {
  console.log(`
Usage: npm run benchmark <project-path>

Arguments:
  project-path    Path to the Kotlin project to analyze (required)

Example:
  npm run benchmark /Users/me/my-kotlin-project

Environment variables:
  ANTHROPIC_API_KEY   Anthropic API key (required)
  BENCHMARK_MODEL     Model: claude-sonnet-4-20250514 or claude-opus-4-20250514
  NEO4J_URI           Neo4j URI (default: bolt://localhost:7687)
`);
}
import { scenarios } from './scenarios/index.js';
import type { ScenarioContext } from './scenarios/types.js';
import { McpRunner } from './runners/index.js';
import { NativeRunner } from './runners/index.js';
import { generateHtmlReport } from './reporters/index.js';
import type { BenchmarkReport, ComparisonResult, BenchmarkMetrics } from './types.js';

function calculateSavings(
  mcp: BenchmarkMetrics,
  native: BenchmarkMetrics
): { tokens: number; cost: number; time: number; llmCalls: number } {
  const tokenSavings = native.tokenUsage.totalTokens > 0
    ? ((native.tokenUsage.totalTokens - mcp.tokenUsage.totalTokens) / native.tokenUsage.totalTokens) * 100
    : 0;

  const costSavings = native.cost.totalCost > 0
    ? ((native.cost.totalCost - mcp.cost.totalCost) / native.cost.totalCost) * 100
    : 0;

  const timeSavings = native.executionTimeMs > 0
    ? ((native.executionTimeMs - mcp.executionTimeMs) / native.executionTimeMs) * 100
    : 0;

  const llmCallsSavings = native.llmCalls > 0
    ? ((native.llmCalls - mcp.llmCalls) / native.llmCalls) * 100
    : 0;

  return { tokens: tokenSavings, cost: costSavings, time: timeSavings, llmCalls: llmCallsSavings };
}

async function runBenchmarks(): Promise<void> {
  // Parse CLI argument for project path
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const projectPath = path.resolve(args[0]!);

  // Validate project path exists
  if (!fs.existsSync(projectPath)) {
    console.error(`❌ Error: Project path does not exist: ${projectPath}`);
    process.exit(1);
  }

  if (!fs.statSync(projectPath).isDirectory()) {
    console.error(`❌ Error: Project path is not a directory: ${projectPath}`);
    process.exit(1);
  }

  console.log('🚀 Benchmark Suite\n');

  // Load configuration with CLI project path
  const config = { ...loadConfig(), projectPath };
  console.log(`📁 Project: ${config.projectPath}`);
  console.log(`🔄 Runs per scenario: ${config.runsPerScenario}`);
  console.log(`📊 Scenarios: ${scenarios.length}\n`);

  // Initialize runners
  const mcpRunner = new McpRunner();
  const nativeRunner = new NativeRunner();

  await mcpRunner.initialize();
  console.log('✅ Runners initialized\n');

  const context: ScenarioContext = {
    projectPath: config.projectPath,
    targetFunction: 'handleSearchNodes',
    targetClass: 'Neo4jClient',
    targetInterface: 'LanguageParser',
  };

  const results: ComparisonResult[] = [];

  // Run each scenario
  for (const scenario of scenarios) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Run MCP version
    console.log('🔷 Running MCP version...');
    let mcpMetrics: BenchmarkMetrics;
    try {
      mcpMetrics = await mcpRunner.runScenario(scenario, context);
      console.log(`   ✅ LLM calls: ${mcpMetrics.llmCalls}, Tool calls: ${mcpMetrics.toolCalls}`);
      console.log(`   📊 Tokens: ${mcpMetrics.tokenUsage.totalTokens.toLocaleString()}`);
      console.log(`   💰 Cost: $${mcpMetrics.cost.totalCost.toFixed(4)}`);
      console.log(`   ⏱️  Time: ${(mcpMetrics.executionTimeMs / 1000).toFixed(1)}s`);
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      mcpMetrics = {
        llmCalls: 0,
        toolCalls: 0,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { totalCost: 0 },
        executionTimeMs: 0,
      };
    }

    // Run Native version
    console.log('\n🔶 Running Native version...');
    let nativeMetrics: BenchmarkMetrics;
    try {
      nativeMetrics = await nativeRunner.runScenario(scenario, context);
      console.log(`   ✅ LLM calls: ${nativeMetrics.llmCalls}, Tool calls: ${nativeMetrics.toolCalls}`);
      console.log(`   📊 Tokens: ${nativeMetrics.tokenUsage.totalTokens.toLocaleString()}`);
      console.log(`   💰 Cost: $${nativeMetrics.cost.totalCost.toFixed(4)}`);
      console.log(`   ⏱️  Time: ${(nativeMetrics.executionTimeMs / 1000).toFixed(1)}s`);
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      nativeMetrics = {
        llmCalls: 0,
        toolCalls: 0,
        tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        cost: { totalCost: 0 },
        executionTimeMs: 0,
      };
    }

    const savings = calculateSavings(mcpMetrics, nativeMetrics);
    console.log(`\n📈 Savings: ${savings.cost.toFixed(0)}% cost, ${savings.tokens.toFixed(0)}% tokens, ${savings.llmCalls.toFixed(0)}% LLM calls`);

    results.push({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      description: scenario.description,
      mcp: mcpMetrics,
      native: nativeMetrics,
      savings,
    });

  }

  // Calculate summary
  const avgTokenSavings = results.reduce((sum, r) => sum + r.savings.tokens, 0) / results.length;
  const avgCostSavings = results.reduce((sum, r) => sum + r.savings.cost, 0) / results.length;
  const avgTimeSavings = results.reduce((sum, r) => sum + r.savings.time, 0) / results.length;
  const avgLlmCallsSavings = results.reduce((sum, r) => sum + r.savings.llmCalls, 0) / results.length;
  const totalMcpCost = results.reduce((sum, r) => sum + r.mcp.cost.totalCost, 0);
  const totalNativeCost = results.reduce((sum, r) => sum + r.native.cost.totalCost, 0);

  const report: BenchmarkReport = {
    timestamp: new Date(),
    config,
    scenarios: results,
    summary: {
      avgTokenSavings,
      avgCostSavings,
      avgTimeSavings,
      avgLlmCallsSavings,
      totalMcpCost,
      totalNativeCost,
    },
  };

  // Generate HTML report
  const outputDir = path.join(process.cwd(), 'benchmark-results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const htmlPath = path.join(outputDir, 'report.html');
  fs.writeFileSync(htmlPath, generateHtmlReport(report));

  // Cleanup
  await mcpRunner.cleanup();

  // Print summary
  console.log('\n\n════════════════════════════════════════════════════════════');
  console.log('                    BENCHMARK SUMMARY');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log(`📊 Average Savings with Optimized Approach:`);
  console.log(`   • LLM Calls:  ${avgLlmCallsSavings.toFixed(0)}% fewer`);
  console.log(`   • Tokens:     ${avgTokenSavings.toFixed(0)}% saved`);
  console.log(`   • Cost:       ${avgCostSavings.toFixed(0)}% saved`);
  console.log(`   • Time:       ${avgTimeSavings.toFixed(0)}% faster`);
  console.log(`\n💰 Total Costs:`);
  console.log(`   • MCP:    $${totalMcpCost.toFixed(4)}`);
  console.log(`   • Native: $${totalNativeCost.toFixed(4)}`);
  console.log(`   • Saved:  $${(totalNativeCost - totalMcpCost).toFixed(4)}`);
  console.log(`\n📄 Report saved to: ${htmlPath}`);
  console.log('\n════════════════════════════════════════════════════════════\n');
}

// Main entry point
runBenchmarks().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
