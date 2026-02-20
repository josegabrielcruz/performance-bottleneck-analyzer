/**
 * Database layer using sql.js (pure JS SQLite via WebAssembly)
 * Handles schema creation, metric storage, and queries
 */

import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { MetricRecord, SiteRecord, WebhookRecord, MetricsQuery, MetricSummary } from './types';

let db: SqlJsDatabase;
let dbFilePath: string;
let saveTimer: ReturnType<typeof setInterval> | null = null;

/** Initialize the database connection and create tables */
export async function initDatabase(dbPath?: string): Promise<SqlJsDatabase> {
  const resolvedPath = dbPath || path.resolve(process.cwd(), 'data', 'pbn.db');
  dbFilePath = resolvedPath;

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(resolvedPath)) {
    const fileBuffer = fs.readFileSync(resolvedPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  createTables();

  // Auto-save to disk every 5 seconds
  saveTimer = setInterval(() => saveToFile(), 5000);

  return db;
}

/** Save the in-memory database to disk */
function saveToFile(): void {
  if (db && dbFilePath) {
    try {
      const data = db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(dbFilePath, buffer);
    } catch {
      // Ignore save errors
    }
  }
}

/** Get the database instance */
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ─── SQL Helpers ─────────────────────────────────────────────────────────────

type BindParams = (string | number | null | Uint8Array)[];

/** Run a SELECT query and return all rows as objects */
function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as BindParams);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

/** Run a SELECT query and return the first row */
function queryOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params as BindParams);
  let result: T | undefined;
  if (stmt.step()) {
    result = stmt.getAsObject() as T;
  }
  stmt.free();
  return result;
}

/** Run an INSERT/UPDATE/DELETE statement */
function execute(sql: string, params: unknown[] = []): void {
  db.run(sql, params as BindParams);
}

/** Get the last inserted row ID */
function lastInsertId(): number {
  const row = queryOne<{ id: number }>('SELECT last_insert_rowid() as id');
  return row?.id || 0;
}

// ─── Schema ──────────────────────────────────────────────────────────────────

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      api_key TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      url TEXT NOT NULL,
      referrer TEXT DEFAULT '',
      metric_name TEXT NOT NULL,
      metric_value REAL NOT NULL,
      rating TEXT DEFAULT 'good',
      tags TEXT DEFAULT '{}',
      user_agent TEXT DEFAULT '',
      screen_width INTEGER DEFAULT 0,
      screen_height INTEGER DEFAULT 0,
      device_pixel_ratio REAL DEFAULT 1,
      connection_type TEXT DEFAULT 'unknown',
      effective_type TEXT DEFAULT 'unknown',
      device_memory REAL,
      hardware_concurrency INTEGER DEFAULT 0,
      pathname TEXT DEFAULT '/',
      viewport_width INTEGER DEFAULT 0,
      viewport_height INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(site_id)
    );

    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id TEXT NOT NULL,
      url TEXT NOT NULL,
      event_types TEXT DEFAULT '["regression"]',
      secret TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(site_id)
    );

    CREATE INDEX IF NOT EXISTS idx_metrics_site_id ON metrics(site_id);
    CREATE INDEX IF NOT EXISTS idx_metrics_metric_name ON metrics(metric_name);
    CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON metrics(created_at);
    CREATE INDEX IF NOT EXISTS idx_metrics_site_metric ON metrics(site_id, metric_name);
    CREATE INDEX IF NOT EXISTS idx_metrics_site_time ON metrics(site_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_metrics_pathname ON metrics(pathname);
  `);
}

// ─── Site Operations ─────────────────────────────────────────────────────────

/** Create a new site */
export function createSite(siteId: string, name: string, apiKey: string): SiteRecord {
  execute('INSERT INTO sites (site_id, name, api_key) VALUES (?, ?, ?)', [siteId, name, apiKey]);
  return getSiteById(siteId)!;
}

/** Get site by site_id */
export function getSiteById(siteId: string): SiteRecord | undefined {
  return queryOne<SiteRecord>('SELECT * FROM sites WHERE site_id = ?', [siteId]);
}

/** Get site by API key */
export function getSiteByApiKey(apiKey: string): SiteRecord | undefined {
  return queryOne<SiteRecord>('SELECT * FROM sites WHERE api_key = ?', [apiKey]);
}

/** List all sites */
export function listSites(): SiteRecord[] {
  return queryAll<SiteRecord>('SELECT * FROM sites ORDER BY created_at DESC');
}

/** Delete a site and all its data */
export function deleteSite(siteId: string): void {
  execute('DELETE FROM metrics WHERE site_id = ?', [siteId]);
  execute('DELETE FROM webhooks WHERE site_id = ?', [siteId]);
  execute('DELETE FROM sites WHERE site_id = ?', [siteId]);
}

// ─── Metric Operations ──────────────────────────────────────────────────────

/** Insert a batch of metrics in a transaction */
export function insertMetrics(
  siteId: string,
  sessionId: string,
  url: string,
  referrer: string,
  context: {
    userAgent: string;
    screenWidth: number;
    screenHeight: number;
    devicePixelRatio: number;
    connectionType: string;
    effectiveType: string;
    deviceMemory: number | null;
    hardwareConcurrency: number;
    pathname: string;
    viewportWidth: number;
    viewportHeight: number;
  },
  metrics: Array<{
    name: string;
    value: number;
    timestamp: number;
    rating: string;
    tags?: Record<string, string>;
  }>
): number {
  const sql = `
    INSERT INTO metrics (
      site_id, session_id, url, referrer, metric_name, metric_value, rating, tags,
      user_agent, screen_width, screen_height, device_pixel_ratio,
      connection_type, effective_type, device_memory, hardware_concurrency,
      pathname, viewport_width, viewport_height
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.exec('BEGIN TRANSACTION');
  try {
    for (const metric of metrics) {
      execute(sql, [
        siteId,
        sessionId,
        url,
        referrer,
        metric.name,
        metric.value,
        metric.rating || 'good',
        JSON.stringify(metric.tags || {}),
        context.userAgent,
        context.screenWidth,
        context.screenHeight,
        context.devicePixelRatio,
        context.connectionType,
        context.effectiveType,
        context.deviceMemory,
        context.hardwareConcurrency,
        context.pathname,
        context.viewportWidth,
        context.viewportHeight,
      ]);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  saveToFile();
  return metrics.length;
}

/** Query metrics with filters */
export function queryMetrics(query: MetricsQuery): MetricRecord[] {
  const conditions: string[] = ['site_id = ?'];
  const params: unknown[] = [query.siteId];

  if (query.metricName) {
    conditions.push('metric_name = ?');
    params.push(query.metricName);
  }
  if (query.startTime) {
    conditions.push("created_at >= datetime(?, 'unixepoch')");
    params.push(Math.floor(query.startTime / 1000));
  }
  if (query.endTime) {
    conditions.push("created_at <= datetime(?, 'unixepoch')");
    params.push(Math.floor(query.endTime / 1000));
  }
  if (query.pathname) {
    conditions.push('pathname = ?');
    params.push(query.pathname);
  }
  if (query.rating) {
    conditions.push('rating = ?');
    params.push(query.rating);
  }
  if (query.connectionType) {
    conditions.push('connection_type = ?');
    params.push(query.connectionType);
  }

  const limit = Math.min(query.limit || 100, 1000);
  const offset = query.offset || 0;

  const sql = `
    SELECT * FROM metrics
    WHERE ${conditions.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);

  return queryAll<MetricRecord>(sql, params);
}

/** Get aggregated metric summary for a site */
export function getMetricSummary(
  siteId: string,
  metricName?: string,
  startTime?: number,
  endTime?: number
): MetricSummary[] {
  const conditions: string[] = ['site_id = ?'];
  const params: unknown[] = [siteId];

  if (metricName) {
    conditions.push('metric_name = ?');
    params.push(metricName);
  }
  if (startTime) {
    conditions.push("created_at >= datetime(?, 'unixepoch')");
    params.push(Math.floor(startTime / 1000));
  }
  if (endTime) {
    conditions.push("created_at <= datetime(?, 'unixepoch')");
    params.push(Math.floor(endTime / 1000));
  }

  const sql = `
    SELECT
      metric_name,
      COUNT(*) as count,
      AVG(metric_value) as avg_value,
      MIN(metric_value) as min_value,
      MAX(metric_value) as max_value,
      SUM(CASE WHEN rating = 'good' THEN 1 ELSE 0 END) as good_count,
      SUM(CASE WHEN rating = 'needs-improvement' THEN 1 ELSE 0 END) as needs_improvement_count,
      SUM(CASE WHEN rating = 'poor' THEN 1 ELSE 0 END) as poor_count
    FROM metrics
    WHERE ${conditions.join(' AND ')}
    GROUP BY metric_name
    ORDER BY metric_name
  `;

  const results = queryAll<Omit<MetricSummary, 'p50_value' | 'p75_value' | 'p95_value'>>(
    sql,
    params
  );

  return results.map((row) => {
    const percentiles = getPercentiles(siteId, row.metric_name, startTime, endTime);
    return {
      ...row,
      p50_value: percentiles.p50,
      p75_value: percentiles.p75,
      p95_value: percentiles.p95,
    };
  });
}

/** Calculate p50, p75, p95 for a specific metric */
function getPercentiles(
  siteId: string,
  metricName: string,
  startTime?: number,
  endTime?: number
): { p50: number; p75: number; p95: number } {
  const conditions: string[] = ['site_id = ?', 'metric_name = ?'];
  const params: unknown[] = [siteId, metricName];

  if (startTime) {
    conditions.push("created_at >= datetime(?, 'unixepoch')");
    params.push(Math.floor(startTime / 1000));
  }
  if (endTime) {
    conditions.push("created_at <= datetime(?, 'unixepoch')");
    params.push(Math.floor(endTime / 1000));
  }

  const sql = `
    SELECT metric_value FROM metrics
    WHERE ${conditions.join(' AND ')}
    ORDER BY metric_value ASC
  `;

  const rows = queryAll<{ metric_value: number }>(sql, params);
  const values = rows.map((r) => r.metric_value);

  if (values.length === 0) {
    return { p50: 0, p75: 0, p95: 0 };
  }

  return {
    p50: values[Math.floor(values.length * 0.5)] || 0,
    p75: values[Math.floor(values.length * 0.75)] || 0,
    p95: values[Math.floor(values.length * 0.95)] || 0,
  };
}

/** Get time-series data grouped by interval */
export function getTimeSeries(
  siteId: string,
  metricName: string,
  interval: 'minute' | 'hour' | 'day' = 'hour',
  startTime?: number,
  endTime?: number
): Array<{ bucket: string; avg_value: number; count: number }> {
  const conditions: string[] = ['site_id = ?', 'metric_name = ?'];
  const params: unknown[] = [siteId, metricName];

  if (startTime) {
    conditions.push("created_at >= datetime(?, 'unixepoch')");
    params.push(Math.floor(startTime / 1000));
  }
  if (endTime) {
    conditions.push("created_at <= datetime(?, 'unixepoch')");
    params.push(Math.floor(endTime / 1000));
  }

  const formatMap = {
    minute: '%Y-%m-%d %H:%M',
    hour: '%Y-%m-%d %H:00',
    day: '%Y-%m-%d',
  };

  const sql = `
    SELECT
      strftime('${formatMap[interval]}', created_at) as bucket,
      AVG(metric_value) as avg_value,
      COUNT(*) as count
    FROM metrics
    WHERE ${conditions.join(' AND ')}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;

  return queryAll<{ bucket: string; avg_value: number; count: number }>(sql, params);
}

// ─── Webhook Operations ─────────────────────────────────────────────────────

/** Create a webhook */
export function createWebhook(
  siteId: string,
  url: string,
  eventTypes: string[],
  secret: string
): WebhookRecord {
  execute('INSERT INTO webhooks (site_id, url, event_types, secret) VALUES (?, ?, ?, ?)', [
    siteId,
    url,
    JSON.stringify(eventTypes),
    secret,
  ]);
  const id = lastInsertId();
  return getWebhookById(id)!;
}

/** Get webhook by ID */
export function getWebhookById(id: number): WebhookRecord | undefined {
  return queryOne<WebhookRecord>('SELECT * FROM webhooks WHERE id = ?', [id]);
}

/** List webhooks for a site */
export function listWebhooks(siteId: string): WebhookRecord[] {
  return queryAll<WebhookRecord>(
    'SELECT * FROM webhooks WHERE site_id = ? ORDER BY created_at DESC',
    [siteId]
  );
}

/** Delete a webhook */
export function deleteWebhook(id: number): void {
  execute('DELETE FROM webhooks WHERE id = ?', [id]);
}

/** Get active webhooks for a site that listen for a specific event type */
export function getActiveWebhooks(siteId: string, eventType: string): WebhookRecord[] {
  const all = queryAll<WebhookRecord>('SELECT * FROM webhooks WHERE site_id = ? AND active = 1', [
    siteId,
  ]);
  return all.filter((w) => {
    const types: string[] = JSON.parse(w.event_types as string);
    return types.includes(eventType);
  });
}

/** Close the database connection and save final state */
export function closeDatabase(): void {
  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }
  if (db) {
    saveToFile();
    db.close();
  }
}
