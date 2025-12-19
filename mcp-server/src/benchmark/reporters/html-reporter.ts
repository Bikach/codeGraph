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
  <title>Code Analysis Benchmark Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js"></script>
  <style>
    :root {
      --optimized: #22c55e;
      --baseline: #ef4444;
      --bg: #f8fafc;
      --card: #ffffff;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #e2e8f0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 2rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    header {
      text-align: center;
      margin-bottom: 2rem;
    }

    header h1 {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 0.5rem;
    }

    header p {
      color: var(--text-muted);
      font-size: 1rem;
    }

    .card {
      background: var(--card);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      border: 1px solid var(--border);
    }

    .card h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--text);
    }

    .card h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin: 1rem 0 0.5rem;
      color: var(--text);
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
    }

    .metric-card {
      background: linear-gradient(135deg, var(--optimized) 0%, #16a34a 100%);
      border-radius: 12px;
      padding: 1.5rem;
      text-align: center;
      color: white;
    }

    .metric-card.baseline {
      background: linear-gradient(135deg, var(--baseline) 0%, #dc2626 100%);
    }

    .metric-card.neutral {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    }

    .metric-value {
      font-size: 2rem;
      font-weight: 700;
      line-height: 1.2;
    }

    .metric-label {
      font-size: 0.875rem;
      opacity: 0.9;
      margin-top: 0.25rem;
    }

    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
      gap: 1.5rem;
    }

    .chart-container {
      position: relative;
      height: 350px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      background: var(--bg);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    tr:hover td {
      background: var(--bg);
    }

    .savings-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.75rem;
      background: #dcfce7;
      color: #166534;
    }

    .savings-badge.negative {
      background: #fee2e2;
      color: #991b1b;
    }

    .legend {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 1.5rem;
      padding: 1rem;
      background: var(--card);
      border-radius: 8px;
      border: 1px solid var(--border);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      font-weight: 500;
    }

    .legend-dot {
      width: 16px;
      height: 16px;
      border-radius: 4px;
    }

    .legend-dot.optimized { background: var(--optimized); }
    .legend-dot.baseline { background: var(--baseline); }

    .config-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      font-size: 0.875rem;
    }

    .config-item {
      display: flex;
      flex-direction: column;
    }

    .config-item label {
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .config-item span {
      font-weight: 500;
    }

    @media (max-width: 768px) {
      body { padding: 1rem; }
      header h1 { font-size: 1.75rem; }
      .charts-grid { grid-template-columns: 1fr; }
      .chart-container { height: 300px; }
      table { font-size: 0.75rem; }
      th, td { padding: 0.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Code Analysis Benchmark Report</h1>
      <p>MCP vs Native Comparison - Generated: ${report.timestamp.toISOString()}</p>
    </header>

    <div class="card">
      <h2>Summary</h2>
      <div class="summary-grid">
        <div class="metric-card">
          <div class="metric-value">${report.summary.avgLlmCallsSavings.toFixed(0)}%</div>
          <div class="metric-label">Fewer LLM Calls</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${report.summary.avgTokenSavings.toFixed(0)}%</div>
          <div class="metric-label">Fewer Tokens</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${report.summary.avgCostSavings.toFixed(0)}%</div>
          <div class="metric-label">Cost Reduction</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">${report.summary.avgTimeSavings.toFixed(0)}%</div>
          <div class="metric-label">Faster</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Total Cost Comparison</h2>
      <div class="summary-grid">
        <div class="metric-card">
          <div class="metric-value">$${report.summary.totalMcpCost.toFixed(4)}</div>
          <div class="metric-label">MCP Total Cost</div>
        </div>
        <div class="metric-card baseline">
          <div class="metric-value">$${report.summary.totalNativeCost.toFixed(4)}</div>
          <div class="metric-label">Native Total Cost</div>
        </div>
      </div>
    </div>

    <div class="legend">
      <div class="legend-item">
        <span class="legend-dot optimized"></span>
        <span>MCP</span>
      </div>
      <div class="legend-item">
        <span class="legend-dot baseline"></span>
        <span>Native</span>
      </div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <h2>LLM Calls per Scenario</h2>
        <div class="chart-container">
          <canvas id="llmCallsChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Tokens per Scenario</h2>
        <div class="chart-container">
          <canvas id="tokensChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Cost per Scenario ($)</h2>
        <div class="chart-container">
          <canvas id="costChart"></canvas>
        </div>
      </div>

      <div class="card">
        <h2>Execution Time (seconds)</h2>
        <div class="chart-container">
          <canvas id="timeChart"></canvas>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Detailed Results</h2>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>MCP Calls</th>
              <th>Native Calls</th>
              <th>MCP Tokens</th>
              <th>Native Tokens</th>
              <th>MCP Cost</th>
              <th>Native Cost</th>
              <th>Cost Savings</th>
            </tr>
          </thead>
          <tbody>
            ${report.scenarios
              .map(
                (s) => `
            <tr>
              <td><strong>${escapeHtml(s.scenarioName)}</strong><br><small style="color: var(--text-muted)">${escapeHtml(s.description)}</small></td>
              <td>${s.mcp.llmCalls.toFixed(1)}</td>
              <td>${s.native.llmCalls.toFixed(1)}</td>
              <td>${Math.round(s.mcp.tokenUsage.totalTokens).toLocaleString()}</td>
              <td>${Math.round(s.native.tokenUsage.totalTokens).toLocaleString()}</td>
              <td>$${s.mcp.cost.totalCost.toFixed(4)}</td>
              <td>$${s.native.cost.totalCost.toFixed(4)}</td>
              <td><span class="savings-badge${s.savings.cost < 0 ? ' negative' : ''}">${s.savings.cost >= 0 ? '+' : ''}${s.savings.cost.toFixed(0)}%</span></td>
            </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <h2>Configuration</h2>
      <div class="config-info">
        <div class="config-item">
          <label>Project Path</label>
          <span>${escapeHtml(report.config.projectPath)}</span>
        </div>
        <div class="config-item">
          <label>MCP Runs</label>
          <span>${report.config.mcpRuns}</span>
        </div>
        <div class="config-item">
          <label>Native Runs</label>
          <span>${report.config.nativeRuns}</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    Chart.register(ChartDataLabels);

    const scenarios = ${scenariosJson};

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: 'end',
          align: 'top',
          color: '#1e293b',
          font: { weight: 'bold', size: 11 },
          formatter: (value) => value.toLocaleString()
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#e2e8f0' }
        },
        x: {
          grid: { display: false }
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
            label: 'MCP',
            data: scenarios.map(s => s.optimized.llmCalls),
            backgroundColor: '#22c55e',
            borderRadius: 6,
            barPercentage: 0.4
          },
          {
            label: 'Native',
            data: scenarios.map(s => s.baseline.llmCalls),
            backgroundColor: '#ef4444',
            borderRadius: 6,
            barPercentage: 0.4
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
            label: 'MCP',
            data: scenarios.map(s => s.optimized.tokens),
            backgroundColor: '#22c55e',
            borderRadius: 6,
            barPercentage: 0.4
          },
          {
            label: 'Native',
            data: scenarios.map(s => s.baseline.tokens),
            backgroundColor: '#ef4444',
            borderRadius: 6,
            barPercentage: 0.4
          }
        ]
      },
      options: {
        ...chartOptions,
        plugins: {
          ...chartOptions.plugins,
          datalabels: {
            ...chartOptions.plugins.datalabels,
            formatter: (value) => (value / 1000).toFixed(0) + 'k'
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
            label: 'MCP',
            data: scenarios.map(s => s.optimized.totalCost),
            backgroundColor: '#22c55e',
            borderRadius: 6,
            barPercentage: 0.4
          },
          {
            label: 'Native',
            data: scenarios.map(s => s.baseline.totalCost),
            backgroundColor: '#ef4444',
            borderRadius: 6,
            barPercentage: 0.4
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
            label: 'MCP',
            data: scenarios.map(s => s.optimized.executionTimeMs / 1000),
            backgroundColor: '#22c55e',
            borderRadius: 6,
            barPercentage: 0.4
          },
          {
            label: 'Native',
            data: scenarios.map(s => s.baseline.executionTimeMs / 1000),
            backgroundColor: '#ef4444',
            borderRadius: 6,
            barPercentage: 0.4
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
