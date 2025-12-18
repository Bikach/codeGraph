#!/usr/bin/env node

/**
 * Generate HTML report from MCP and Native benchmark results
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BenchmarkRunResult, BenchmarkReport, ComparisonResult, BenchmarkConfig } from './types.js';
import { generateHtmlReport } from './reporters/index.js';

const OUTPUT_DIR = path.join(process.cwd(), 'benchmark-results');
const MCP_RESULTS_PATH = path.join(OUTPUT_DIR, 'mcp-results.json');
const NATIVE_RESULTS_PATH = path.join(OUTPUT_DIR, 'native-results.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'report.html');

function calculateSavings(
  mcpTokens: number,
  nativeTokens: number,
  mcpCost: number,
  nativeCost: number,
  mcpTime: number,
  nativeTime: number,
  mcpLlmCalls: number,
  nativeLlmCalls: number
): { tokens: number; cost: number; time: number; llmCalls: number } {
  return {
    tokens: nativeTokens > 0 ? ((nativeTokens - mcpTokens) / nativeTokens) * 100 : 0,
    cost: nativeCost > 0 ? ((nativeCost - mcpCost) / nativeCost) * 100 : 0,
    time: nativeTime > 0 ? ((nativeTime - mcpTime) / nativeTime) * 100 : 0,
    llmCalls: nativeLlmCalls > 0 ? ((nativeLlmCalls - mcpLlmCalls) / nativeLlmCalls) * 100 : 0,
  };
}

function generateReport(): void {
  console.log('\n📊 Generating Benchmark Report\n');

  // Check if result files exist
  if (!fs.existsSync(MCP_RESULTS_PATH)) {
    console.error(`❌ Error: MCP results not found: ${MCP_RESULTS_PATH}`);
    console.error('   Run "npm run benchmark:mcp <project-path>" first.');
    process.exit(1);
  }

  if (!fs.existsSync(NATIVE_RESULTS_PATH)) {
    console.error(`❌ Error: Native results not found: ${NATIVE_RESULTS_PATH}`);
    console.error('   Run "npm run benchmark:native <project-path>" first.');
    process.exit(1);
  }

  // Load results
  const mcpResults: BenchmarkRunResult = JSON.parse(fs.readFileSync(MCP_RESULTS_PATH, 'utf-8'));
  const nativeResults: BenchmarkRunResult = JSON.parse(fs.readFileSync(NATIVE_RESULTS_PATH, 'utf-8'));

  console.log(`📁 MCP Results:    ${MCP_RESULTS_PATH}`);
  console.log(`   Timestamp: ${mcpResults.timestamp}`);
  console.log(`📁 Native Results: ${NATIVE_RESULTS_PATH}`);
  console.log(`   Timestamp: ${nativeResults.timestamp}\n`);

  // Validate that scenarios match
  if (mcpResults.scenarios.length !== nativeResults.scenarios.length) {
    console.error(`❌ Error: Scenario count mismatch (MCP: ${mcpResults.scenarios.length}, Native: ${nativeResults.scenarios.length})`);
    process.exit(1);
  }

  // Build comparison results
  const comparisons: ComparisonResult[] = [];

  for (const mcpScenario of mcpResults.scenarios) {
    const nativeScenario = nativeResults.scenarios.find((s) => s.scenarioId === mcpScenario.scenarioId);

    if (!nativeScenario) {
      console.error(`❌ Error: Scenario "${mcpScenario.scenarioId}" not found in native results`);
      process.exit(1);
    }

    const savings = calculateSavings(
      mcpScenario.metrics.tokenUsage.totalTokens,
      nativeScenario.metrics.tokenUsage.totalTokens,
      mcpScenario.metrics.cost.totalCost,
      nativeScenario.metrics.cost.totalCost,
      mcpScenario.metrics.executionTimeMs,
      nativeScenario.metrics.executionTimeMs,
      mcpScenario.metrics.llmCalls,
      nativeScenario.metrics.llmCalls
    );

    comparisons.push({
      scenarioId: mcpScenario.scenarioId,
      scenarioName: mcpScenario.scenarioName,
      description: mcpScenario.description,
      mcp: {
        ...mcpScenario.metrics,
        evaluation: mcpScenario.evaluation,
      },
      native: {
        ...nativeScenario.metrics,
        evaluation: nativeScenario.evaluation,
      },
      savings,
    });

    const mcpScore = mcpScenario.evaluation?.score || 0;
    const nativeScore = nativeScenario.evaluation?.score || 0;
    console.log(`✅ ${mcpScenario.scenarioName}: ${savings.cost.toFixed(0)}% cost savings | MCP: ${mcpScore}/10, Native: ${nativeScore}/10`);
  }

  // Calculate summary based on totals (not average of percentages)
  const totalMcpTime = comparisons.reduce((sum, r) => sum + r.mcp.executionTimeMs, 0);
  const totalNativeTime = comparisons.reduce((sum, r) => sum + r.native.executionTimeMs, 0);
  const totalMcpLlmCalls = comparisons.reduce((sum, r) => sum + r.mcp.llmCalls, 0);
  const totalNativeLlmCalls = comparisons.reduce((sum, r) => sum + r.native.llmCalls, 0);

  const avgTokenSavings = 0; // Token metrics not reliable from CLI
  const avgCostSavings = nativeResults.totals.cost > 0 ? ((nativeResults.totals.cost - mcpResults.totals.cost) / nativeResults.totals.cost) * 100 : 0;
  const avgTimeSavings = totalNativeTime > 0 ? ((totalNativeTime - totalMcpTime) / totalNativeTime) * 100 : 0;
  const avgLlmCallsSavings = totalNativeLlmCalls > 0 ? ((totalNativeLlmCalls - totalMcpLlmCalls) / totalNativeLlmCalls) * 100 : 0;

  // Calculate average scores
  const mcpScores = comparisons.filter(c => c.mcp.evaluation?.score).map(c => c.mcp.evaluation!.score);
  const nativeScores = comparisons.filter(c => c.native.evaluation?.score).map(c => c.native.evaluation!.score);
  const avgMcpScore = mcpScores.length > 0 ? mcpScores.reduce((a, b) => a + b, 0) / mcpScores.length : 0;
  const avgNativeScore = nativeScores.length > 0 ? nativeScores.reduce((a, b) => a + b, 0) / nativeScores.length : 0;

  const config: BenchmarkConfig = {
    projectPath: mcpResults.projectPath,
    runsPerScenario: 1,
  };

  const report: BenchmarkReport = {
    timestamp: new Date(),
    config,
    scenarios: comparisons,
    summary: {
      avgTokenSavings,
      avgCostSavings,
      avgTimeSavings,
      avgLlmCallsSavings,
      totalMcpCost: mcpResults.totals.cost,
      totalNativeCost: nativeResults.totals.cost,
      avgMcpScore,
      avgNativeScore,
    },
  };

  // Generate HTML report
  fs.writeFileSync(REPORT_PATH, generateHtmlReport(report));

  // Print summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('                    BENCHMARK REPORT GENERATED');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log(`📊 Average Savings with MCP Tools:`);
  console.log(`   • LLM Calls:  ${avgLlmCallsSavings.toFixed(0)}% fewer`);
  console.log(`   • Cost:       ${avgCostSavings.toFixed(0)}% saved`);
  console.log(`   • Time:       ${avgTimeSavings.toFixed(0)}% faster`);
  console.log(`\n💰 Total Costs:`);
  console.log(`   • MCP:    $${mcpResults.totals.cost.toFixed(4)}`);
  console.log(`   • Native: $${nativeResults.totals.cost.toFixed(4)}`);
  console.log(`   • Saved:  $${(nativeResults.totals.cost - mcpResults.totals.cost).toFixed(4)}`);
  console.log(`\n📊 Quality Scores (1-10):`);
  console.log(`   • MCP:    ${avgMcpScore.toFixed(1)}/10`);
  console.log(`   • Native: ${avgNativeScore.toFixed(1)}/10`);
  console.log(`\n📄 Report saved to: ${REPORT_PATH}`);
  console.log('\n════════════════════════════════════════════════════════════\n');
}

generateReport();
