/**
 * Performance Bottleneck Analyzer — VS Code Extension
 * Polls the PBN API for metric summaries and shows regression alerts
 */

import * as vscode from 'vscode';
import https from 'https';
import http from 'http';
import { URL } from 'url';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PbnConfig {
  apiUrl: string;
  siteId: string;
  apiKey: string;
  pollInterval: number; // seconds
}

interface MetricSummaryItem {
  metric_name: string;
  count: number;
  avg_value: number;
  p75_value: number;
  p95_value: number;
  good_count: number;
  needs_improvement_count: number;
  poor_count: number;
}

// ─── State ───────────────────────────────────────────────────────────────────

let statusBarItem: vscode.StatusBarItem;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let outputChannel: vscode.OutputChannel;
const previousSummaries: Map<string, number> = new Map();

// ─── Activation ──────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext) {
  outputChannel = vscode.window.createOutputChannel('PBN');
  outputChannel.appendLine('Performance Bottleneck Analyzer activated');

  // Status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'pbn.showSummary';
  statusBarItem.text = '$(pulse) PBN';
  statusBarItem.tooltip = 'Performance Bottleneck Analyzer';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('pbn.showSummary', showSummaryCommand),
    vscode.commands.registerCommand('pbn.showAlert', showAlertCommand),
    vscode.commands.registerCommand('pbn.configure', configureCommand),
    vscode.commands.registerCommand('pbn.startMonitoring', () => startPolling(context)),
    vscode.commands.registerCommand('pbn.stopMonitoring', stopPolling)
  );

  // Auto-start if configured
  const config = getConfig();
  if (config.apiUrl && config.siteId && config.apiKey) {
    startPolling(context);
  }
}

export function deactivate() {
  stopPolling();
  outputChannel?.appendLine('PBN deactivated');
}

// ─── Configuration ───────────────────────────────────────────────────────────

function getConfig(): PbnConfig {
  const config = vscode.workspace.getConfiguration('pbn');
  return {
    apiUrl: config.get<string>('apiUrl', 'http://localhost:3001'),
    siteId: config.get<string>('siteId', ''),
    apiKey: config.get<string>('apiKey', ''),
    pollInterval: config.get<number>('pollInterval', 60),
  };
}

async function configureCommand() {
  const apiUrl = await vscode.window.showInputBox({
    prompt: 'PBN API URL',
    value: getConfig().apiUrl,
    placeHolder: 'http://localhost:3001',
  });
  if (!apiUrl) return;

  const siteId = await vscode.window.showInputBox({
    prompt: 'Site ID',
    value: getConfig().siteId,
    placeHolder: 'my-site',
  });
  if (!siteId) return;

  const apiKey = await vscode.window.showInputBox({
    prompt: 'API Key',
    value: getConfig().apiKey,
    placeHolder: 'pbn_...',
    password: true,
  });
  if (!apiKey) return;

  const config = vscode.workspace.getConfiguration('pbn');
  await config.update('apiUrl', apiUrl, vscode.ConfigurationTarget.Global);
  await config.update('siteId', siteId, vscode.ConfigurationTarget.Global);
  await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);

  vscode.window.showInformationMessage('PBN configured successfully');
}

// ─── Polling ─────────────────────────────────────────────────────────────────

function startPolling(_context: vscode.ExtensionContext) {
  const config = getConfig();

  if (!config.siteId || !config.apiKey) {
    vscode.window.showWarningMessage(
      'PBN: Configure Site ID and API Key first. Run "PBN: Configure"'
    );
    return;
  }

  stopPolling();
  outputChannel.appendLine(`Polling ${config.apiUrl} every ${config.pollInterval}s`);
  statusBarItem.text = '$(pulse) PBN ⏳';

  // Poll immediately, then at interval
  checkMetrics(config);
  pollTimer = setInterval(() => checkMetrics(config), config.pollInterval * 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
    statusBarItem.text = '$(pulse) PBN ⏸';
    outputChannel.appendLine('Monitoring stopped');
  }
}

// ─── Metric Check ────────────────────────────────────────────────────────────

async function checkMetrics(config: PbnConfig) {
  try {
    const data = await apiGet<{ data: MetricSummaryItem[] }>(
      `${config.apiUrl}/api/metrics/summary?siteId=${config.siteId}`,
      config.apiKey
    );

    const summaries = data.data;
    if (!summaries || summaries.length === 0) {
      statusBarItem.text = '$(pulse) PBN —';
      return;
    }

    // Check for regressions by comparing to previous check
    const alerts: string[] = [];
    for (const s of summaries) {
      const prevP75 = previousSummaries.get(s.metric_name);
      if (prevP75 !== undefined && prevP75 > 0) {
        const change = (s.p75_value - prevP75) / prevP75;
        if (change > 0.2) {
          const severity = change > 0.5 ? '🔴' : change > 0.3 ? '🟠' : '🟡';
          alerts.push(
            `${severity} ${s.metric_name}: p75 ${prevP75.toFixed(0)} → ${s.p75_value.toFixed(0)} (+${(change * 100).toFixed(0)}%)`
          );
        }
      }
      previousSummaries.set(s.metric_name, s.p75_value);
    }

    // Update status bar
    const lcpSummary = summaries.find((s) => s.metric_name === 'LCP');
    if (lcpSummary) {
      const total =
        lcpSummary.good_count + lcpSummary.needs_improvement_count + lcpSummary.poor_count;
      const goodPct = total > 0 ? Math.round((lcpSummary.good_count / total) * 100) : 0;
      const icon = goodPct >= 75 ? '$(check)' : goodPct >= 50 ? '$(warning)' : '$(error)';
      statusBarItem.text = `${icon} LCP p75: ${Math.round(lcpSummary.p75_value)}ms`;
    } else {
      statusBarItem.text = '$(pulse) PBN ✓';
    }

    // Show regression alerts
    if (alerts.length > 0) {
      outputChannel.appendLine(`[${new Date().toISOString()}] Regressions detected:`);
      for (const a of alerts) {
        outputChannel.appendLine(`  ${a}`);
      }

      const message = `PBN: ${alerts.length} performance regression${alerts.length > 1 ? 's' : ''} detected`;
      const action = await vscode.window.showWarningMessage(message, 'View Details', 'Dismiss');
      if (action === 'View Details') {
        outputChannel.show();
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    outputChannel.appendLine(`[Error] ${msg}`);
    statusBarItem.text = '$(pulse) PBN ⚠';
  }
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function showSummaryCommand() {
  const config = getConfig();
  if (!config.siteId || !config.apiKey) {
    vscode.window.showWarningMessage('PBN: Not configured. Run "PBN: Configure" first.');
    return;
  }

  try {
    const data = await apiGet<{ data: MetricSummaryItem[] }>(
      `${config.apiUrl}/api/metrics/summary?siteId=${config.siteId}`,
      config.apiKey
    );

    if (!data.data || data.data.length === 0) {
      vscode.window.showInformationMessage('PBN: No metrics collected yet.');
      return;
    }

    outputChannel.clear();
    outputChannel.appendLine('═══ Performance Summary ═══\n');

    for (const s of data.data) {
      const total = s.good_count + s.needs_improvement_count + s.poor_count;
      const goodPct = total > 0 ? Math.round((s.good_count / total) * 100) : 0;
      const indicator = goodPct >= 75 ? '✅' : goodPct >= 50 ? '⚠️' : '❌';

      outputChannel.appendLine(
        `${indicator} ${s.metric_name.padEnd(8)} avg: ${s.avg_value.toFixed(1).padStart(8)}  p75: ${s.p75_value.toFixed(1).padStart(8)}  p95: ${s.p95_value.toFixed(1).padStart(8)}  good: ${goodPct}%  (${s.count} samples)`
      );
    }

    outputChannel.show();
  } catch (err) {
    vscode.window.showErrorMessage(
      `PBN: Failed to fetch summary — ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function showAlertCommand() {
  outputChannel.show();
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

function apiGet<T>(url: string, apiKey: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.get(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers: { 'x-api-key': apiKey },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Invalid JSON response from ${url}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}
