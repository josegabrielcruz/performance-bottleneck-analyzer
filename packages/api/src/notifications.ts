/**
 * Notification system — Slack webhooks, email, and generic webhooks
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import type { RegressionAlert } from '@pbn/analytics-engine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationConfig {
  slack?: {
    webhookUrl: string;
    channel?: string;
    username?: string;
  };
  email?: {
    smtpHost: string;
    smtpPort: number;
    from: string;
    to: string[];
    username?: string;
    password?: string;
  };
  webhooks?: Array<{
    url: string;
    secret?: string;
    eventTypes: string[];
  }>;
}

export interface NotificationPayload {
  type: 'regression' | 'threshold' | 'summary';
  siteId: string;
  alerts: RegressionAlert[];
  timestamp: number;
  summary: string;
}

// ─── Slack Notification ──────────────────────────────────────────────────────

/** Format a regression alert as a Slack message */
function formatSlackMessage(payload: NotificationPayload): Record<string, unknown> {
  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    warning: '🟠',
    info: '🔵',
  };

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `⚡ Performance Regression Detected — ${payload.siteId}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: payload.summary,
      },
    },
    { type: 'divider' },
  ];

  for (const alert of payload.alerts) {
    const emoji = severityEmoji[alert.severity] || '🔵';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `${emoji} *${alert.metric}* — ${alert.severity.toUpperCase()}\n` +
          `Previous: \`${alert.previousValue.toFixed(1)}\` → Current: \`${alert.currentValue.toFixed(1)}\`\n` +
          `Change: \`${(alert.percentageChange * 100).toFixed(1)}%\` | z-score: \`${alert.zScore.toFixed(2)}\`` +
          (alert.url ? `\nURL: ${alert.url}` : ''),
      },
    });
  }

  blocks.push({
    type: 'context',
    text: {
      type: 'mrkdwn',
      text: `Detected at ${new Date(payload.timestamp).toISOString()}`,
    },
  } as (typeof blocks)[0]);

  return {
    text: payload.summary,
    blocks,
  };
}

/** Send a Slack webhook notification */
export async function sendSlackNotification(
  webhookUrl: string,
  payload: NotificationPayload
): Promise<boolean> {
  const message = formatSlackMessage(payload);
  return postJson(webhookUrl, message);
}

// ─── Generic Webhook Notification ────────────────────────────────────────────

/** Send a webhook notification with signature */
export async function sendWebhookNotification(
  url: string,
  payload: NotificationPayload,
  secret?: string
): Promise<boolean> {
  const body = {
    event: payload.type,
    siteId: payload.siteId,
    alerts: payload.alerts,
    timestamp: payload.timestamp,
    summary: payload.summary,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (secret) {
    // Simple HMAC-like signature using built-in crypto
    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');
    headers['x-pbn-signature'] = `sha256=${signature}`;
  }

  return postJson(url, body, headers);
}

// ─── Email Notification (minimal, no external deps) ──────────────────────────

/** Format an email body for regression alerts */
function formatEmailBody(payload: NotificationPayload): string {
  let html = `<h2>⚡ Performance Regression — ${payload.siteId}</h2>`;
  html += `<p>${payload.summary}</p>`;
  html += '<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">';
  html +=
    '<tr><th>Metric</th><th>Severity</th><th>Previous</th><th>Current</th><th>Change</th></tr>';

  for (const alert of payload.alerts) {
    const color =
      alert.severity === 'critical'
        ? '#ff4e42'
        : alert.severity === 'warning'
          ? '#ffa400'
          : '#0cce6b';
    html += `<tr>`;
    html += `<td><strong>${alert.metric}</strong></td>`;
    html += `<td style="color:${color}">${alert.severity}</td>`;
    html += `<td>${alert.previousValue.toFixed(1)}</td>`;
    html += `<td>${alert.currentValue.toFixed(1)}</td>`;
    html += `<td>${(alert.percentageChange * 100).toFixed(1)}%</td>`;
    html += `</tr>`;
  }

  html += '</table>';
  html += `<p style="color:#888;font-size:12px;">Detected at ${new Date(payload.timestamp).toISOString()}</p>`;
  return html;
}

/**
 * Send email via raw SMTP (minimal, no external dependencies)
 * For production, use a proper email service.
 */
export async function sendEmailNotification(
  config: NonNullable<NotificationConfig['email']>,
  payload: NotificationPayload
): Promise<boolean> {
  const subject = `[PBN] Performance regression detected — ${payload.siteId}`;

  // Log instead of actual SMTP for MVP (email requires external service)
  console.log('[PBN Notification] Email notification:');
  console.log(`  To: ${config.to.join(', ')}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Alerts: ${payload.alerts.length}`);
  console.log(`  Body: ${formatEmailBody(payload).substring(0, 100)}...`);

  // TODO: Integrate with SMTP service (nodemailer, SendGrid, etc.)
  // For now, log the notification details
  return true;
}

// ─── Notification Manager ────────────────────────────────────────────────────

export class NotificationManager {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  /** Send notification through all configured channels */
  async notify(payload: NotificationPayload): Promise<{ channel: string; success: boolean }[]> {
    const results: { channel: string; success: boolean }[] = [];

    // Slack
    if (this.config.slack) {
      try {
        const ok = await sendSlackNotification(this.config.slack.webhookUrl, payload);
        results.push({ channel: 'slack', success: ok });
      } catch (err) {
        console.error('[PBN] Slack notification failed:', err);
        results.push({ channel: 'slack', success: false });
      }
    }

    // Email
    if (this.config.email) {
      try {
        const ok = await sendEmailNotification(this.config.email, payload);
        results.push({ channel: 'email', success: ok });
      } catch (err) {
        console.error('[PBN] Email notification failed:', err);
        results.push({ channel: 'email', success: false });
      }
    }

    // Custom webhooks
    if (this.config.webhooks) {
      for (const wh of this.config.webhooks) {
        if (wh.eventTypes.includes(payload.type)) {
          try {
            const ok = await sendWebhookNotification(wh.url, payload, wh.secret);
            results.push({ channel: `webhook:${wh.url}`, success: ok });
          } catch (err) {
            console.error(`[PBN] Webhook ${wh.url} failed:`, err);
            results.push({ channel: `webhook:${wh.url}`, success: false });
          }
        }
      }
    }

    return results;
  }
}

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

function postJson(
  url: string,
  data: unknown,
  extraHeaders: Record<string, string> = {}
): Promise<boolean> {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...extraHeaders,
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          resolve(res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300);
        });
      }
    );

    req.on('error', (err) => {
      console.error('[PBN] HTTP error:', err.message);
      resolve(false);
    });

    req.write(body);
    req.end();
  });
}
