/**
 * Core Web Vitals score cards
 */

import React from 'react';
import type { MetricSummary } from '../api';

interface Props {
  summaries: MetricSummary[];
}

const METRIC_LABELS: Record<string, string> = {
  LCP: 'Largest Contentful Paint',
  FID: 'First Input Delay',
  CLS: 'Cumulative Layout Shift',
  INP: 'Interaction to Next Paint',
  TTFB: 'Time to First Byte',
};

const METRIC_UNITS: Record<string, string> = {
  LCP: 'ms',
  FID: 'ms',
  CLS: '',
  INP: 'ms',
  TTFB: 'ms',
};

function getRatingColor(good: number, ni: number, poor: number): string {
  const total = good + ni + poor;
  if (total === 0) return '#888';
  const goodPct = good / total;
  if (goodPct >= 0.75) return '#0cce6b';
  if (goodPct >= 0.5) return '#ffa400';
  return '#ff4e42';
}

function formatValue(name: string, value: number): string {
  if (name === 'CLS') return value.toFixed(3);
  return Math.round(value).toString();
}

export const ScoreCards: React.FC<Props> = ({ summaries }) => {
  const coreVitals = summaries.filter((s) =>
    ['LCP', 'FID', 'CLS', 'INP', 'TTFB'].includes(s.metric_name)
  );

  if (coreVitals.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No metric data yet. Install the browser agent to start collecting data.</p>
      </div>
    );
  }

  return (
    <div style={styles.grid}>
      {coreVitals.map((metric) => {
        const color = getRatingColor(
          metric.good_count,
          metric.needs_improvement_count,
          metric.poor_count
        );
        const total = metric.good_count + metric.needs_improvement_count + metric.poor_count;
        const goodPct = total > 0 ? Math.round((metric.good_count / total) * 100) : 0;

        return (
          <div key={metric.metric_name} style={{ ...styles.card, borderLeftColor: color }}>
            <div style={styles.cardHeader}>
              <span style={styles.metricName}>{metric.metric_name}</span>
              <span style={styles.metricLabel}>
                {METRIC_LABELS[metric.metric_name] || metric.metric_name}
              </span>
            </div>
            <div style={styles.value}>
              {formatValue(metric.metric_name, metric.p75_value)}
              <span style={styles.unit}>{METRIC_UNITS[metric.metric_name] || 'ms'}</span>
            </div>
            <div style={styles.subtitle}>p75</div>
            <div style={styles.ratingBar}>
              <div
                style={{
                  ...styles.ratingSegment,
                  width: `${(metric.good_count / Math.max(total, 1)) * 100}%`,
                  backgroundColor: '#0cce6b',
                }}
              />
              <div
                style={{
                  ...styles.ratingSegment,
                  width: `${(metric.needs_improvement_count / Math.max(total, 1)) * 100}%`,
                  backgroundColor: '#ffa400',
                }}
              />
              <div
                style={{
                  ...styles.ratingSegment,
                  width: `${(metric.poor_count / Math.max(total, 1)) * 100}%`,
                  backgroundColor: '#ff4e42',
                }}
              />
            </div>
            <div style={styles.stats}>
              <span>{goodPct}% good</span>
              <span>{metric.count} samples</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '16px',
    marginBottom: '24px',
  },
  card: {
    background: '#1e1e2e',
    borderRadius: '8px',
    padding: '16px',
    borderLeft: '4px solid #888',
  },
  cardHeader: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '8px',
  },
  metricName: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#cdd6f4',
  },
  metricLabel: {
    fontSize: '11px',
    color: '#6c7086',
    marginTop: '2px',
  },
  value: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#cdd6f4',
    lineHeight: 1.1,
  },
  unit: {
    fontSize: '14px',
    fontWeight: 400,
    marginLeft: '4px',
    color: '#6c7086',
  },
  subtitle: {
    fontSize: '11px',
    color: '#6c7086',
    marginBottom: '12px',
  },
  ratingBar: {
    display: 'flex',
    height: '6px',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '8px',
    backgroundColor: '#313244',
  },
  ratingSegment: {
    height: '100%',
  },
  stats: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px',
    color: '#6c7086',
  },
  empty: {
    textAlign: 'center',
    color: '#6c7086',
    padding: '40px',
  },
};
