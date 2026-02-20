#!/usr/bin/env node

/**
 * Performance Bottleneck Analyzer CLI
 */

import { Command } from 'commander';
import chalk from 'chalk';
import axios, { AxiosError } from 'axios';
import fs from 'fs';
import path from 'path';

const program = new Command();
const CONFIG_FILE = '.pbnrc.json';

interface PbnConfig {
  apiUrl: string;
  siteId: string;
  apiKey: string;
}

// ─── Config helpers ──────────────────────────────────────────────────────────

function loadConfig(): PbnConfig | null {
  const configPath = path.resolve(process.cwd(), CONFIG_FILE);
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveConfig(config: PbnConfig): void {
  const configPath = path.resolve(process.cwd(), CONFIG_FILE);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

function requireConfig(): PbnConfig {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('No .pbnrc.json found. Run `pbn init` first.'));
    process.exit(1);
  }
  return config;
}

function apiHeaders(config: PbnConfig): Record<string, string> {
  return { 'x-api-key': config.apiKey, 'Content-Type': 'application/json' };
}

// ─── CLI Setup ───────────────────────────────────────────────────────────────

program.name('pbn').description(chalk.bold('Performance Bottleneck Analyzer CLI')).version('0.1.0');

// ─── init ────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize PBN configuration for this project')
  .option('--api-url <url>', 'API server URL', 'http://localhost:3001')
  .option('--site-id <id>', 'Site identifier')
  .option('--api-key <key>', 'API key for authentication')
  .action(async (opts) => {
    console.log(chalk.blue.bold('\n  Performance Bottleneck Analyzer\n'));

    const config: PbnConfig = {
      apiUrl: opts.apiUrl,
      siteId: opts.siteId || '',
      apiKey: opts.apiKey || '',
    };

    if (!config.siteId) {
      // Try to create a site automatically
      const projectName = path.basename(process.cwd());
      console.log(chalk.gray(`  Creating site "${projectName}"...`));
      try {
        const res = await axios.post(`${config.apiUrl}/api/sites`, { name: projectName });
        config.siteId = res.data.data.siteId;
        config.apiKey = res.data.data.apiKey;
        console.log(chalk.green(`  Site created: ${config.siteId}`));
        console.log(chalk.yellow(`  API Key: ${config.apiKey}`));
      } catch (err) {
        const msg =
          err instanceof AxiosError ? err.response?.data?.message || err.message : String(err);
        console.log(chalk.yellow(`  Could not auto-create site: ${msg}`));
        console.log(chalk.gray('  Provide --site-id and --api-key manually.'));
        return;
      }
    }

    saveConfig(config);
    console.log(chalk.green(`\n  Config saved to ${CONFIG_FILE}`));
    console.log(chalk.gray('  Add .pbnrc.json to .gitignore (contains API key)\n'));
  });

// ─── status ──────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Check API connection and site status')
  .action(async () => {
    const config = requireConfig();

    try {
      const healthRes = await axios.get(`${config.apiUrl}/health`);
      console.log(chalk.green('  API:'), chalk.gray(config.apiUrl), chalk.green('✓'));
      console.log(
        chalk.gray(
          `  Version: ${healthRes.data.version}, Uptime: ${Math.round(healthRes.data.uptime)}s`
        )
      );
    } catch {
      console.log(chalk.red('  API:'), chalk.gray(config.apiUrl), chalk.red('✗ unreachable'));
      return;
    }

    try {
      const siteRes = await axios.get(`${config.apiUrl}/api/sites/${config.siteId}`);
      console.log(chalk.green('  Site:'), chalk.cyan(siteRes.data.data.name), chalk.green('✓'));
    } catch {
      console.log(chalk.red('  Site:'), chalk.gray(config.siteId), chalk.red('✗ not found'));
    }
  });

// ─── summary ─────────────────────────────────────────────────────────────────

program
  .command('summary')
  .description('Show metric summary for the configured site')
  .option('--metric <name>', 'Filter to a specific metric')
  .action(async (opts) => {
    const config = requireConfig();

    try {
      const params: Record<string, string> = { siteId: config.siteId };
      if (opts.metric) params.metricName = opts.metric;

      const res = await axios.get(`${config.apiUrl}/api/metrics/summary`, {
        headers: apiHeaders(config),
        params,
      });

      const summaries = res.data.data;
      if (summaries.length === 0) {
        console.log(chalk.yellow('\n  No metrics collected yet.\n'));
        return;
      }

      console.log(chalk.bold('\n  Metric Summary\n'));
      console.log(
        chalk.gray(
          '  ' +
            pad('Metric', 12) +
            pad('Samples', 10) +
            pad('Avg', 10) +
            pad('p75', 10) +
            pad('p95', 10) +
            pad('Good%', 8)
        )
      );
      console.log(chalk.gray('  ' + '─'.repeat(60)));

      for (const s of summaries) {
        const total = s.good_count + s.needs_improvement_count + s.poor_count;
        const goodPct = total > 0 ? Math.round((s.good_count / total) * 100) : 0;
        const color = goodPct >= 75 ? chalk.green : goodPct >= 50 ? chalk.yellow : chalk.red;

        console.log(
          '  ' +
            chalk.bold(pad(s.metric_name, 12)) +
            pad(String(s.count), 10) +
            pad(fmtVal(s.avg_value, s.metric_name), 10) +
            pad(fmtVal(s.p75_value, s.metric_name), 10) +
            pad(fmtVal(s.p95_value, s.metric_name), 10) +
            color(pad(goodPct + '%', 8))
        );
      }
      console.log();
    } catch (err) {
      handleApiError(err);
    }
  });

// ─── metrics ─────────────────────────────────────────────────────────────────

program
  .command('metrics')
  .description('List recent raw metrics')
  .option('--metric <name>', 'Filter by metric name')
  .option('--limit <n>', 'Number of results', '20')
  .option('--rating <rating>', 'Filter by rating (good, needs-improvement, poor)')
  .action(async (opts) => {
    const config = requireConfig();

    try {
      const res = await axios.get(`${config.apiUrl}/api/metrics`, {
        headers: apiHeaders(config),
        params: {
          siteId: config.siteId,
          metricName: opts.metric,
          rating: opts.rating,
          limit: opts.limit,
        },
      });

      const metrics = res.data.data;
      if (metrics.length === 0) {
        console.log(chalk.yellow('\n  No metrics found.\n'));
        return;
      }

      console.log(chalk.bold(`\n  Recent Metrics (${metrics.length})\n`));
      for (const m of metrics) {
        const ratingColor =
          m.rating === 'good' ? chalk.green : m.rating === 'poor' ? chalk.red : chalk.yellow;
        console.log(
          '  ' +
            chalk.bold(pad(m.metric_name, 10)) +
            pad(fmtVal(m.metric_value, m.metric_name), 10) +
            ratingColor(pad(m.rating, 20)) +
            chalk.gray(m.pathname) +
            chalk.gray(' ' + m.created_at)
        );
      }
      console.log();
    } catch (err) {
      handleApiError(err);
    }
  });

// ─── sites ───────────────────────────────────────────────────────────────────

program
  .command('sites')
  .description('List all registered sites')
  .action(async () => {
    const config = requireConfig();

    try {
      const res = await axios.get(`${config.apiUrl}/api/sites`);
      const sites = res.data.data;
      console.log(chalk.bold(`\n  Sites (${sites.length})\n`));
      for (const s of sites) {
        const active = s.siteId === config.siteId ? chalk.green(' (active)') : '';
        console.log(`  ${chalk.cyan(s.siteId)}  ${chalk.gray(s.name)}${active}`);
      }
      console.log();
    } catch (err) {
      handleApiError(err);
    }
  });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(str: string, len: number): string {
  return str.padEnd(len);
}

function fmtVal(value: number, metric: string): string {
  if (metric === 'CLS') return value.toFixed(3);
  return Math.round(value).toString();
}

function handleApiError(err: unknown): void {
  if (err instanceof AxiosError) {
    const msg = err.response?.data?.message || err.message;
    console.error(chalk.red(`\n  Error: ${msg}\n`));
  } else {
    console.error(chalk.red(`\n  Error: ${String(err)}\n`));
  }
}

program.parse(process.argv);

export { program };
