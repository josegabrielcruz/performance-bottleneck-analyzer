/**
 * Header with site selector and settings
 */

import React from 'react';

interface Props {
  siteId: string;
  apiKey: string;
  interval: string;
  onSiteIdChange: (id: string) => void;
  onApiKeyChange: (key: string) => void;
  onIntervalChange: (interval: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const Header: React.FC<Props> = ({
  siteId,
  apiKey,
  interval,
  onSiteIdChange,
  onApiKeyChange,
  onIntervalChange,
  onRefresh,
  loading,
}) => {
  return (
    <header style={styles.header}>
      <div style={styles.brand}>
        <h1 style={styles.title}>PBN Dashboard</h1>
        <span style={styles.subtitle}>Performance Bottleneck Analyzer</span>
      </div>
      <div style={styles.controls}>
        <label style={styles.label}>
          Site ID
          <input
            style={styles.input}
            value={siteId}
            onChange={(e) => onSiteIdChange(e.target.value)}
            placeholder="my-site"
          />
        </label>
        <label style={styles.label}>
          API Key
          <input
            style={styles.input}
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="pbn_..."
          />
        </label>
        <label style={styles.label}>
          Interval
          <select
            style={styles.select}
            value={interval}
            onChange={(e) => onIntervalChange(e.target.value)}
          >
            <option value="minute">Minute</option>
            <option value="hour">Hour</option>
            <option value="day">Day</option>
          </select>
        </label>
        <button style={styles.button} onClick={onRefresh} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 0',
    borderBottom: '1px solid #313244',
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 700,
    color: '#cdd6f4',
  },
  subtitle: {
    fontSize: '12px',
    color: '#6c7086',
  },
  controls: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px',
    flexWrap: 'wrap',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '11px',
    color: '#6c7086',
    gap: '4px',
  },
  input: {
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: '4px',
    padding: '6px 10px',
    color: '#cdd6f4',
    fontSize: '13px',
    width: '140px',
  },
  select: {
    background: '#313244',
    border: '1px solid #45475a',
    borderRadius: '4px',
    padding: '6px 10px',
    color: '#cdd6f4',
    fontSize: '13px',
  },
  button: {
    background: '#89b4fa',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 20px',
    color: '#1e1e2e',
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
  },
};
