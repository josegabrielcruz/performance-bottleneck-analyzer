/**
 * Performance Bottleneck Analyzer Dashboard
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { ScoreCards } from './components/ScoreCards';
import { TimeSeriesChart } from './components/TimeSeriesChart';
import { MetricsTable } from './components/MetricsTable';
import { fetchSummary, fetchTimeSeries } from './api';
import type { MetricSummary, TimeSeriesPoint } from './api';

const WEB_VITALS_THRESHOLDS: Record<string, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
};

const CHART_METRICS = ['LCP', 'CLS', 'INP', 'TTFB', 'FID'];

interface DashboardProps {
  siteId?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ siteId: initialSiteId }) => {
  const [siteId, setSiteId] = useState(initialSiteId || '');
  const [apiKey, setApiKey] = useState('');
  const [interval, setInterval_] = useState('hour');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<MetricSummary[]>([]);
  const [timeSeries, setTimeSeries] = useState<Record<string, TimeSeriesPoint[]>>({});

  const loadData = useCallback(async () => {
    if (!siteId || !apiKey) {
      setError('Enter a Site ID and API Key to view data.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch summary
      const summaryRes = await fetchSummary(siteId, apiKey);
      setSummaries(summaryRes.data);

      // Fetch time-series for each core metric that has data
      const availableMetrics = summaryRes.data
        .map((s) => s.metric_name)
        .filter((m) => CHART_METRICS.includes(m));

      const tsResults: Record<string, TimeSeriesPoint[]> = {};
      await Promise.all(
        availableMetrics.map(async (metricName) => {
          try {
            const tsRes = await fetchTimeSeries(siteId, metricName, interval, apiKey);
            tsResults[metricName] = tsRes.data;
          } catch {
            tsResults[metricName] = [];
          }
        })
      );
      setTimeSeries(tsResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [siteId, apiKey, interval]);

  // Auto-load when settings change (debounced)
  useEffect(() => {
    if (siteId && apiKey) {
      const timer = setTimeout(loadData, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [siteId, apiKey, interval, loadData]);

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        <Header
          siteId={siteId}
          apiKey={apiKey}
          interval={interval}
          onSiteIdChange={setSiteId}
          onApiKeyChange={setApiKey}
          onIntervalChange={setInterval_}
          onRefresh={loadData}
          loading={loading}
        />

        {error && <div style={styles.error}>{error}</div>}

        <ScoreCards summaries={summaries} />

        {CHART_METRICS.map((metric) => {
          const data = timeSeries[metric];
          if (!data || data.length === 0) return null;
          return (
            <TimeSeriesChart
              key={metric}
              data={data}
              metricName={metric}
              threshold={WEB_VITALS_THRESHOLDS[metric]}
            />
          );
        })}

        <MetricsTable summaries={summaries} />
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    backgroundColor: '#11111b',
    color: '#cdd6f4',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px',
  },
  error: {
    background: '#302030',
    border: '1px solid #f38ba8',
    borderRadius: '6px',
    padding: '12px 16px',
    color: '#f38ba8',
    fontSize: '13px',
    marginBottom: '16px',
  },
};

export default Dashboard;
