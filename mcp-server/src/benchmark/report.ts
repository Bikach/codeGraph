#!/usr/bin/env node

/**
 * Generate HTML report from MCP and Native benchmark results
 *
 * Reads all mcp-results-*.json and native-results-*.json files,
 * calculates averages across runs, and generates a comparison report.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BenchmarkRunResult, BenchmarkReport, ComparisonResult, BenchmarkConfig, BenchmarkMetrics } from './types.js';
import { generateHtmlReport } from './reporters/index.js';

const OUTPUT_DIR = path.join(process.cwd(), 'benchmark-results');
const REPORT_PATH = path.join(OUTPUT_DIR, 'report.html');

/**
 * Find all result files matching the pattern
 */
function findResultFiles(mode: 'mcp' | 'native'): string[] {
  if (!fs.existsSync(OUTPUT_DIR)) {
    return [];
  }

  const files = fs.readdirSync(OUTPUT_DIR);
  const pattern = new RegExp(`^${mode}-results-\\d{8}-\\d{6}\\.json$`);

  return files
    .filter(f => pattern.test(f))
    .map(f => path.join(OUTPUT_DIR, f))
    .sort();
}

/**
 * Load all result files for a mode
 */
function loadResults(mode: 'mcp' | 'native'): BenchmarkRunResult[] {
  const files = findResultFiles(mode);
  return files.map(f => JSON.parse(fs.readFileSync(f, 'utf-8')) as BenchmarkRunResult);
}

/**
 * Average metrics across multiple runs for a scenario
 */
function averageMetrics(
  scenarioId: string,
  runs: BenchmarkRunResult[]
): BenchmarkMetrics {
  const scenarioResults = runs
    .map(r => r.scenarios.find(s => s.scenarioId === scenarioId))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  if (scenarioResults.length === 0) {
    return {
      llmCalls: 0,
      toolCalls: 0,
      toolsUsed: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: { totalCost: 0 },
      executionTimeMs: 0,
    };
  }

  const count = scenarioResults.length;

  // Collect all unique tools used across runs
  const allToolsUsed = new Set<string>();
  for (const s of scenarioResults) {
    for (const tool of s.metrics.toolsUsed || []) {
      allToolsUsed.add(tool);
    }
  }

  return {
    llmCalls: scenarioResults.reduce((sum, s) => sum + s.metrics.llmCalls, 0) / count,
    toolCalls: scenarioResults.reduce((sum, s) => sum + s.metrics.toolCalls, 0) / count,
    toolsUsed: Array.from(allToolsUsed),
    tokenUsage: {
      inputTokens: scenarioResults.reduce((sum, s) => sum + s.metrics.tokenUsage.inputTokens, 0) / count,
      outputTokens: scenarioResults.reduce((sum, s) => sum + s.metrics.tokenUsage.outputTokens, 0) / count,
      totalTokens: scenarioResults.reduce((sum, s) => sum + s.metrics.tokenUsage.totalTokens, 0) / count,
    },
    cost: {
      totalCost: scenarioResults.reduce((sum, s) => sum + s.metrics.cost.totalCost, 0) / count,
    },
    executionTimeMs: scenarioResults.reduce((sum, s) => sum + s.metrics.executionTimeMs, 0) / count,
  };
}

function calculateSavings(
  mcpValue: number,
  nativeValue: number
): number {
  if (nativeValue === 0) return 0;
  return ((nativeValue - mcpValue) / nativeValue) * 100;
}

function generateReport(): void {
  console.log('\n📊 Generating Benchmark Report\n');

  // Load all result files
  const mcpRuns = loadResults('mcp');
  const nativeRuns = loadResults('native');

  console.log(`📁 Found ${mcpRuns.length} MCP run(s)`);
  console.log(`📁 Found ${nativeRuns.length} Native run(s)\n`);

  if (mcpRuns.length === 0) {
    console.error('❌ Error: No MCP results found.');
    console.error('   Run "npm run benchmark:mcp <project-path>" first.');
    process.exit(1);
  }

  if (nativeRuns.length === 0) {
    console.error('❌ Error: No Native results found.');
    console.error('   Run "npm run benchmark:native <project-path>" first.');
    process.exit(1);
  }

  const firstMcpRun = mcpRuns[0]!;

  // Get all unique scenario IDs from the first run
  const scenarioIds = firstMcpRun.scenarios.map(s => s.scenarioId);

  // Build comparison results with averaged metrics
  const comparisons: ComparisonResult[] = [];

  for (const scenarioId of scenarioIds) {
    const mcpScenario = firstMcpRun.scenarios.find(s => s.scenarioId === scenarioId);
    if (!mcpScenario) continue;

    const mcpAvg = averageMetrics(scenarioId, mcpRuns);
    const nativeAvg = averageMetrics(scenarioId, nativeRuns);

    const savings = {
      tokens: calculateSavings(mcpAvg.tokenUsage.totalTokens, nativeAvg.tokenUsage.totalTokens),
      cost: calculateSavings(mcpAvg.cost.totalCost, nativeAvg.cost.totalCost),
      time: calculateSavings(mcpAvg.executionTimeMs, nativeAvg.executionTimeMs),
      llmCalls: calculateSavings(mcpAvg.llmCalls, nativeAvg.llmCalls),
    };

    comparisons.push({
      scenarioId,
      scenarioName: mcpScenario.scenarioName,
      description: mcpScenario.description,
      prompt: mcpScenario.prompt,
      mcp: mcpAvg,
      native: nativeAvg,
      savings,
    });

    console.log(`✅ ${mcpScenario.scenarioName}: ${savings.cost >= 0 ? '+' : ''}${savings.cost.toFixed(0)}% cost savings`);
  }

  // Calculate totals
  const totalMcpCost = comparisons.reduce((sum, c) => sum + c.mcp.cost.totalCost, 0);
  const totalNativeCost = comparisons.reduce((sum, c) => sum + c.native.cost.totalCost, 0);
  const totalMcpTime = comparisons.reduce((sum, c) => sum + c.mcp.executionTimeMs, 0);
  const totalNativeTime = comparisons.reduce((sum, c) => sum + c.native.executionTimeMs, 0);
  const totalMcpLlmCalls = comparisons.reduce((sum, c) => sum + c.mcp.llmCalls, 0);
  const totalNativeLlmCalls = comparisons.reduce((sum, c) => sum + c.native.llmCalls, 0);
  const totalMcpTokens = comparisons.reduce((sum, c) => sum + c.mcp.tokenUsage.totalTokens, 0);
  const totalNativeTokens = comparisons.reduce((sum, c) => sum + c.native.tokenUsage.totalTokens, 0);

  const config: BenchmarkConfig = {
    projectPath: firstMcpRun.projectPath,
    mcpRuns: mcpRuns.length,
    nativeRuns: nativeRuns.length,
  };

  const report: BenchmarkReport = {
    timestamp: new Date(),
    config,
    scenarios: comparisons,
    summary: {
      avgTokenSavings: calculateSavings(totalMcpTokens, totalNativeTokens),
      avgCostSavings: calculateSavings(totalMcpCost, totalNativeCost),
      avgTimeSavings: calculateSavings(totalMcpTime, totalNativeTime),
      avgLlmCallsSavings: calculateSavings(totalMcpLlmCalls, totalNativeLlmCalls),
      totalMcpCost,
      totalNativeCost,
    },
  };

  // Generate HTML report
  fs.writeFileSync(REPORT_PATH, generateHtmlReport(report));

  // Print summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                    BENCHMARK REPORT GENERATED');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log(`📊 Runs analyzed: ${mcpRuns.length} MCP, ${nativeRuns.length} Native`);
  console.log(`\n📈 Average Savings with MCP Tools:`);
  console.log(`   • LLM Calls:  ${report.summary.avgLlmCallsSavings.toFixed(0)}% fewer`);
  console.log(`   • Cost:       ${report.summary.avgCostSavings.toFixed(0)}% saved`);
  console.log(`   • Time:       ${report.summary.avgTimeSavings.toFixed(0)}% faster`);
  console.log(`\n💰 Total Costs:`);
  console.log(`   • MCP:    $${totalMcpCost.toFixed(4)}`);
  console.log(`   • Native: $${totalNativeCost.toFixed(4)}`);
  console.log(`   • Saved:  $${(totalNativeCost - totalMcpCost).toFixed(4)}`);
  console.log(`\n📄 Report saved to: ${REPORT_PATH}`);
  console.log('\n════════════════════════════════════════════════════════════\n');
}

generateReport();
