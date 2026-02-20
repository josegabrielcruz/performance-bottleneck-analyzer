/**
 * Time-series chart component using Recharts
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { TimeSeriesPoint } from '../api';

interface Props {
  data: TimeSeriesPoint[];
  metricName: string;
  threshold?: { good: number; poor: number };
}

const COLOR_MAP: Record<string, string> = {
  LCP: '#89b4fa',
  FID: '#a6e3a1',
  CLS: '#f9e2af',
  INP: '#cba6f7',
  TTFB: '#f38ba8',
};

function formatBucket(bucket: string): string {
  // Remove date part for hourly/minute intervals
  if (bucket.includes(' ')) {
    return bucket.split(' ')[1];
  }
  return bucket;
}

export const TimeSeriesChart: React.FC<Props> = ({ data, metricName, threshold }) => {
  if (data.length === 0) {
    return (
      <div style={styles.empty}>
        <p>No time-series data available for {metricName}</p>
      </div>
    );
  }

  const color = COLOR_MAP[metricName] || '#89b4fa';

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>{metricName} Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
          <XAxis dataKey="bucket" tickFormatter={formatBucket} stroke="#6c7086" fontSize={11} />
          <YAxis stroke="#6c7086" fontSize={11} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e1e2e',
              border: '1px solid #313244',
              borderRadius: '6px',
              color: '#cdd6f4',
              fontSize: '12px',
            }}
            formatter={(value: number) => [
              metricName === 'CLS' ? value.toFixed(3) : Math.round(value),
              metricName,
            ]}
          />
          {threshold && (
            <>
              <ReferenceLine
                y={threshold.good}
                stroke="#0cce6b"
                strokeDasharray="5 5"
                label={{ value: 'Good', fill: '#0cce6b', fontSize: 10 }}
              />
              <ReferenceLine
                y={threshold.poor}
                stroke="#ff4e42"
                strokeDasharray="5 5"
                label={{ value: 'Poor', fill: '#ff4e42', fontSize: 10 }}
              />
            </>
          )}
          <Line
            type="monotone"
            dataKey="avg_value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#1e1e2e',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
  },
  title: {
    color: '#cdd6f4',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    marginTop: 0,
  },
  empty: {
    textAlign: 'center',
    color: '#6c7086',
    padding: '40px',
    background: '#1e1e2e',
    borderRadius: '8px',
    marginBottom: '16px',
  },
};
