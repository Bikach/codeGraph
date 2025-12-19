import type { BenchmarkReport } from '../types.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateHtmlReport(report: BenchmarkReport): string {
  const scenariosJson = JSON.stringify(
    report.scenarios.map((s) => ({
      scenarioName: s.scenarioName,
      description: s.description,
      optimized: {
        llmCalls: s.mcp.llmCalls,
        toolCalls: s.mcp.toolCalls,
        tokens: s.mcp.tokenUsage.totalTokens,
        totalCost: s.mcp.cost.totalCost,
        executionTimeMs: s.mcp.executionTimeMs,
      },
      baseline: {
        llmCalls: s.native.llmCalls,
        toolCalls: s.native.toolCalls,
        tokens: s.native.tokenUsage.totalTokens,
        totalCost: s.native.cost.totalCost,
        executionTimeMs: s.native.executionTimeMs,
      },
      savings: s.savings,
    }))
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeGraph Benchmark Report</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            mcp: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
            native: { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
          }
        }
      }
    }
  </script>
  <style>
    .chart-wrapper { position: relative; width: 100%; height: 300px; }
    @media (min-width: 768px) { .chart-wrapper { height: 350px; } }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased">
  <div class="min-h-screen">
    <!-- Header -->
    <header class="bg-white border-b border-slate-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-slate-900">Benchmark</h1>
            <p class="mt-1 text-sm text-slate-500">Code analysis performance: with MCP vs without MCP</p>
          </div>
          <div class="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>${report.timestamp.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      <!-- Summary Cards -->
      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-4">Performance Summary</h2>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg class="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
              </div>
              <div>
                <p class="text-2xl sm:text-3xl font-bold text-slate-900">${report.summary.avgLlmCallsSavings.toFixed(0)}%</p>
                <p class="text-xs sm:text-sm text-slate-500">Fewer LLM Calls</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg class="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                </svg>
              </div>
              <div>
                <p class="text-2xl sm:text-3xl font-bold text-slate-900">${report.summary.avgTokenSavings.toFixed(0)}%</p>
                <p class="text-xs sm:text-sm text-slate-500">Fewer Tokens</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-violet-50 flex items-center justify-center">
                <svg class="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <p class="text-2xl sm:text-3xl font-bold text-slate-900">${report.summary.avgCostSavings.toFixed(0)}%</p>
                <p class="text-xs sm:text-sm text-slate-500">Cost Reduction</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-amber-50 flex items-center justify-center">
                <svg class="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <p class="text-2xl sm:text-3xl font-bold text-slate-900">${report.summary.avgTimeSavings.toFixed(0)}%</p>
                <p class="text-xs sm:text-sm text-slate-500">Faster Execution</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Total Cost Comparison -->
      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-4">Total Cost Comparison</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div class="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 sm:p-6 text-white shadow-lg">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-emerald-100 text-sm font-medium">With MCP</p>
                <p class="text-3xl sm:text-4xl font-bold mt-1">$${report.summary.totalMcpCost.toFixed(2)}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </div>
          </div>

          <div class="bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl p-5 sm:p-6 text-white shadow-lg">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-slate-300 text-sm font-medium">Without MCP</p>
                <p class="text-3xl sm:text-4xl font-bold mt-1">$${report.summary.totalNativeCost.toFixed(2)}</p>
              </div>
              <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Legend -->
      <div class="flex items-center justify-center gap-6 sm:gap-8 py-2">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded bg-emerald-500"></span>
          <span class="text-sm text-slate-600 font-medium">With MCP</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded bg-slate-400"></span>
          <span class="text-sm text-slate-600 font-medium">Without MCP</span>
        </div>
      </div>

      <!-- Charts Grid -->
      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-4">Detailed Metrics</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-slate-700 mb-4">LLM Calls per Scenario</h3>
            <div class="chart-wrapper">
              <canvas id="llmCallsChart"></canvas>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-slate-700 mb-4">Tokens per Scenario</h3>
            <div class="chart-wrapper">
              <canvas id="tokensChart"></canvas>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-slate-700 mb-4">Cost per Scenario ($)</h3>
            <div class="chart-wrapper">
              <canvas id="costChart"></canvas>
            </div>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <h3 class="text-sm font-semibold text-slate-700 mb-4">Execution Time (seconds)</h3>
            <div class="chart-wrapper">
              <canvas id="timeChart"></canvas>
            </div>
          </div>
        </div>
      </section>

      <!-- Detailed Results - Desktop Table -->
      <section class="hidden lg:block">
        <h2 class="text-lg font-semibold text-slate-900 mb-4">Scenario Breakdown</h2>
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-slate-100 border-b border-slate-200">
                  <th class="text-left px-4 sm:px-6 py-2 font-semibold text-slate-600" rowspan="2">Scenario</th>
                  <th class="text-center px-3 sm:px-4 py-2 font-semibold text-slate-600 border-b border-slate-200" colspan="2">LLM Calls</th>
                  <th class="text-center px-3 sm:px-4 py-2 font-semibold text-slate-600 border-b border-slate-200" colspan="2">Tokens</th>
                  <th class="text-center px-3 sm:px-4 py-2 font-semibold text-slate-600 border-b border-slate-200" colspan="2">Cost</th>
                  <th class="text-right px-4 sm:px-6 py-2 font-semibold text-slate-600" rowspan="2">Savings</th>
                </tr>
                <tr class="bg-slate-50 border-b border-slate-200">
                  <th class="text-right px-3 sm:px-4 py-2 text-xs font-medium text-emerald-600 whitespace-nowrap">With</th>
                  <th class="text-right px-3 sm:px-4 py-2 text-xs font-medium text-slate-500 whitespace-nowrap">Without</th>
                  <th class="text-right px-3 sm:px-4 py-2 text-xs font-medium text-emerald-600 whitespace-nowrap">With</th>
                  <th class="text-right px-3 sm:px-4 py-2 text-xs font-medium text-slate-500 whitespace-nowrap">Without</th>
                  <th class="text-right px-3 sm:px-4 py-2 text-xs font-medium text-emerald-600 whitespace-nowrap">With</th>
                  <th class="text-right px-3 sm:px-4 py-2 text-xs font-medium text-slate-500 whitespace-nowrap">Without</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${report.scenarios
                  .map(
                    (s) => `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="px-4 sm:px-6 py-4">
                    <div class="font-medium text-slate-900">${escapeHtml(s.scenarioName)}</div>
                    <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(s.description)}</div>
                  </td>
                  <td class="text-right px-3 sm:px-4 py-4 text-slate-700 tabular-nums">${s.mcp.llmCalls.toFixed(1)}</td>
                  <td class="text-right px-3 sm:px-4 py-4 text-slate-700 tabular-nums">${s.native.llmCalls.toFixed(1)}</td>
                  <td class="text-right px-3 sm:px-4 py-4 text-slate-700 tabular-nums">${Math.round(s.mcp.tokenUsage.totalTokens).toLocaleString()}</td>
                  <td class="text-right px-3 sm:px-4 py-4 text-slate-700 tabular-nums">${Math.round(s.native.tokenUsage.totalTokens).toLocaleString()}</td>
                  <td class="text-right px-3 sm:px-4 py-4 text-slate-700 tabular-nums">$${s.mcp.cost.totalCost.toFixed(4)}</td>
                  <td class="text-right px-3 sm:px-4 py-4 text-slate-700 tabular-nums">$${s.native.cost.totalCost.toFixed(4)}</td>
                  <td class="text-right px-4 sm:px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.savings.cost >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">
                      ${s.savings.cost >= 0 ? '+' : ''}${s.savings.cost.toFixed(0)}%
                    </span>
                  </td>
                </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- Detailed Results - Mobile Accordion -->
      <section class="lg:hidden">
        <h2 class="text-lg font-semibold text-slate-900 mb-4">Scenario Breakdown</h2>
        <div class="space-y-3">
          ${report.scenarios
            .map(
              (s, index) => `
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <button
              onclick="toggleAccordion(${index})"
              class="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-slate-900">${escapeHtml(s.scenarioName)}</span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.savings.cost >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">
                    ${s.savings.cost >= 0 ? '+' : ''}${s.savings.cost.toFixed(0)}%
                  </span>
                </div>
                <div class="text-xs text-slate-500 mt-0.5 truncate">${escapeHtml(s.description)}</div>
              </div>
              <svg id="accordion-icon-${index}" class="w-5 h-5 text-slate-400 transition-transform flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            <div id="accordion-content-${index}" class="hidden border-t border-slate-100">
              <div class="p-4 space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-slate-50 rounded-lg p-3">
                    <p class="text-xs text-slate-500 mb-1">LLM Calls</p>
                    <div class="flex items-baseline gap-2">
                      <span class="text-lg font-semibold text-emerald-600">${s.mcp.llmCalls.toFixed(1)}</span>
                      <span class="text-sm text-slate-400">vs</span>
                      <span class="text-sm text-slate-600">${s.native.llmCalls.toFixed(1)}</span>
                    </div>
                  </div>
                  <div class="bg-slate-50 rounded-lg p-3">
                    <p class="text-xs text-slate-500 mb-1">Tokens</p>
                    <div class="flex items-baseline gap-2">
                      <span class="text-lg font-semibold text-emerald-600">${Math.round(s.mcp.tokenUsage.totalTokens).toLocaleString()}</span>
                      <span class="text-sm text-slate-400">vs</span>
                      <span class="text-sm text-slate-600">${Math.round(s.native.tokenUsage.totalTokens).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                  <div class="bg-slate-50 rounded-lg p-3">
                    <p class="text-xs text-slate-500 mb-1">Cost</p>
                    <div class="flex items-baseline gap-2">
                      <span class="text-lg font-semibold text-emerald-600">$${s.mcp.cost.totalCost.toFixed(2)}</span>
                      <span class="text-sm text-slate-400">vs</span>
                      <span class="text-sm text-slate-600">$${s.native.cost.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                  <div class="bg-slate-50 rounded-lg p-3">
                    <p class="text-xs text-slate-500 mb-1">Time</p>
                    <div class="flex items-baseline gap-2">
                      <span class="text-lg font-semibold text-emerald-600">${(s.mcp.executionTimeMs / 1000).toFixed(0)}s</span>
                      <span class="text-sm text-slate-400">vs</span>
                      <span class="text-sm text-slate-600">${(s.native.executionTimeMs / 1000).toFixed(0)}s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          `
            )
            .join('')}
        </div>
      </section>

      <!-- Configuration -->
      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-4">Test Configuration</h2>
        <div class="bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Target</p>
              <p class="mt-1 text-sm text-slate-900">Quarkus/Kotlin Backend</p>
            </div>
            <div>
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Runs with MCP</p>
              <p class="mt-1 text-sm text-slate-900">${report.config.mcpRuns} iterations</p>
            </div>
            <div>
              <p class="text-xs font-medium text-slate-500 uppercase tracking-wide">Runs without MCP</p>
              <p class="mt-1 text-sm text-slate-900">${report.config.nativeRuns} iterations</p>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-200 bg-white mt-8">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <p class="text-center text-xs text-slate-400">Benchmark performed using Claude Code CLI</p>
      </div>
    </footer>
  </div>

  <script>
    // Accordion toggle function
    function toggleAccordion(index) {
      const content = document.getElementById('accordion-content-' + index);
      const icon = document.getElementById('accordion-icon-' + index);

      if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(180deg)';
      } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
      }
    }

    Chart.register(ChartDataLabels);

    const scenarios = ${scenariosJson};

    const chartColors = {
      mcp: '#10b981',
      native: '#94a3b8'
    };

    // Fix: disable resize animation to prevent infinite loop
    Chart.defaults.animation = false;
    Chart.defaults.responsive = true;
    Chart.defaults.maintainAspectRatio = false;

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      resizeDelay: 100,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#475569',
          font: { weight: '600', size: 10 },
          formatter: (value) => value.toLocaleString()
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { color: '#64748b', font: { size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            maxRotation: 45,
            minRotation: 0
          }
        }
      }
    };

    // LLM Calls Chart
    new Chart(document.getElementById('llmCallsChart'), {
      type: 'bar',
      data: {
        labels: scenarios.map(s => s.scenarioName),
        datasets: [
          {
            label: 'With MCP',
            data: scenarios.map(s => s.optimized.llmCalls),
            backgroundColor: chartColors.mcp,
            borderRadius: 4,
            barPercentage: 0.35
          },
          {
            label: 'Without MCP',
            data: scenarios.map(s => s.baseline.llmCalls),
            backgroundColor: chartColors.native,
            borderRadius: 4,
            barPercentage: 0.35
          }
        ]
      },
      options: chartOptions
    });

    // Tokens Chart
    new Chart(document.getElementById('tokensChart'), {
      type: 'bar',
      data: {
        labels: scenarios.map(s => s.scenarioName),
        datasets: [
          {
            label: 'With MCP',
            data: scenarios.map(s => s.optimized.tokens),
            backgroundColor: chartColors.mcp,
            borderRadius: 4,
            barPercentage: 0.35
          },
          {
            label: 'Without MCP',
            data: scenarios.map(s => s.baseline.tokens),
            backgroundColor: chartColors.native,
            borderRadius: 4,
            barPercentage: 0.35
          }
        ]
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          datalabels: {
            ...chartOptions.plugins.datalabels,
            formatter: (value) => value >= 1000 ? (value / 1000).toFixed(1) + 'k' : Math.round(value)
          }
        }
      }
    });

    // Cost Chart
    new Chart(document.getElementById('costChart'), {
      type: 'bar',
      data: {
        labels: scenarios.map(s => s.scenarioName),
        datasets: [
          {
            label: 'With MCP',
            data: scenarios.map(s => s.optimized.totalCost),
            backgroundColor: chartColors.mcp,
            borderRadius: 4,
            barPercentage: 0.35
          },
          {
            label: 'Without MCP',
            data: scenarios.map(s => s.baseline.totalCost),
            backgroundColor: chartColors.native,
            borderRadius: 4,
            barPercentage: 0.35
          }
        ]
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          datalabels: {
            ...chartOptions.plugins.datalabels,
            formatter: (value) => '$' + value.toFixed(2)
          }
        }
      }
    });

    // Time Chart
    new Chart(document.getElementById('timeChart'), {
      type: 'bar',
      data: {
        labels: scenarios.map(s => s.scenarioName),
        datasets: [
          {
            label: 'With MCP',
            data: scenarios.map(s => s.optimized.executionTimeMs / 1000),
            backgroundColor: chartColors.mcp,
            borderRadius: 4,
            barPercentage: 0.35
          },
          {
            label: 'Without MCP',
            data: scenarios.map(s => s.baseline.executionTimeMs / 1000),
            backgroundColor: chartColors.native,
            borderRadius: 4,
            barPercentage: 0.35
          }
        ]
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          datalabels: {
            ...chartOptions.plugins.datalabels,
            formatter: (value) => value.toFixed(0) + 's'
          }
        }
      }
    });
  </script>
</body>
</html>`;
}
