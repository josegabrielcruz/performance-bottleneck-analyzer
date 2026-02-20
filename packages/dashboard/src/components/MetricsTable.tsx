/**
 * Metric details table
 */

import React from 'react';
import type { MetricSummary } from '../api';

interface Props {
  summaries: MetricSummary[];
}

function fmt(value: number, metric: string): string {
  if (metric === 'CLS') return value.toFixed(3);
  return Math.round(value).toLocaleString();
}

export const MetricsTable: React.FC<Props> = ({ summaries }) => {
  if (summaries.length === 0) return null;

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>All Metrics</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Metric</th>
            <th style={styles.thRight}>Samples</th>
            <th style={styles.thRight}>Avg</th>
            <th style={styles.thRight}>p50</th>
            <th style={styles.thRight}>p75</th>
            <th style={styles.thRight}>p95</th>
            <th style={styles.thRight}>Min</th>
            <th style={styles.thRight}>Max</th>
            <th style={styles.thRight}>Good %</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map((s) => {
            const total = s.good_count + s.needs_improvement_count + s.poor_count;
            const goodPct = total > 0 ? ((s.good_count / total) * 100).toFixed(1) : '—';
            return (
              <tr key={s.metric_name} style={styles.tr}>
                <td style={styles.td}>
                  <strong>{s.metric_name}</strong>
                </td>
                <td style={styles.tdRight}>{s.count}</td>
                <td style={styles.tdRight}>{fmt(s.avg_value, s.metric_name)}</td>
                <td style={styles.tdRight}>{fmt(s.p50_value, s.metric_name)}</td>
                <td style={styles.tdRight}>{fmt(s.p75_value, s.metric_name)}</td>
                <td style={styles.tdRight}>{fmt(s.p95_value, s.metric_name)}</td>
                <td style={styles.tdRight}>{fmt(s.min_value, s.metric_name)}</td>
                <td style={styles.tdRight}>{fmt(s.max_value, s.metric_name)}</td>
                <td style={styles.tdRight}>{goodPct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1e1e2e',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    overflowX: 'auto',
  },
  title: {
    color: '#cdd6f4',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    marginTop: 0,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '8px 12px',
    color: '#6c7086',
    borderBottom: '1px solid #313244',
    fontWeight: 600,
  },
  thRight: {
    textAlign: 'right',
    padding: '8px 12px',
    color: '#6c7086',
    borderBottom: '1px solid #313244',
    fontWeight: 600,
  },
  tr: {
    borderBottom: '1px solid #313244',
  },
  td: {
    padding: '8px 12px',
    color: '#cdd6f4',
  },
  tdRight: {
    padding: '8px 12px',
    color: '#cdd6f4',
    textAlign: 'right',
    fontFamily: 'monospace',
  },
};
