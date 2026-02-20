# Performance Bottleneck Analyzer

Open-source performance monitoring tool that detects bottlenecks in production web apps and provides actionable insights via dashboards, CLI, Slack notifications, and VS Code integration.

## Features

- **Browser Agent** — Lightweight snippet (~5KB) collecting Core Web Vitals (LCP, CLS, FID, INP, TTFB), long tasks, resource timing, and navigation timing
- **API Server** — Express-based data collection with SQLite storage, batch ingestion, time-series queries, and percentile summaries
- **Analytics Engine** — Z-score anomaly detection, sliding-window regression analysis, EWMA, linear trend analysis
- **Dashboard** — React + Recharts visualization with score cards, time-series charts, and metric tables
- **CLI** — Command-line tool for site management, metric queries, and health checks
- **Notifications** — Slack webhooks, email (SMTP), and generic webhooks with HMAC-SHA256 signatures
- **VS Code Extension** — Status bar metrics, regression alerts, and performance summaries
- **SDK** — Framework integrations for React (hooks + context), Next.js (App Router + Pages Router), and vanilla JS

## How It Compares

|                       | Chrome DevTools        | Lighthouse         | PageSpeed Insights         | **PBN Analyzer**                     |
| --------------------- | ---------------------- | ------------------ | -------------------------- | ------------------------------------ |
| **Data source**       | Single browser session | Synthetic lab test | Lab + limited field (CrUX) | Real User Monitoring (all visitors)  |
| **Environment**       | Chrome only            | Chrome only        | Web-based                  | Any browser                          |
| **When**              | Manual, during dev     | Manual or CI       | On-demand                  | Continuous, in production            |
| **Regression alerts** | —                      | —                  | —                          | Slack, email, webhooks, VS Code      |
| **Trend analysis**    | —                      | CI diffing only    | 28-day CrUX                | Real-time with statistical detection |
| **Custom metrics**    | Performance marks      | —                  | —                          | Arbitrary named metrics + spans      |
| **Self-hosted**       | N/A                    | N/A                | No                         | Yes (Docker or npm)                  |
| **Framework SDK**     | —                      | —                  | —                          | React hooks, Next.js, vanilla JS     |

**In short:** Browser DevTools and Lighthouse are _diagnostic_ tools — they tell you _why_ a page is slow during development. PBN Analyzer is a _monitoring_ tool — it tells you _that_ something got slower for real users in production and alerts your team. Use them together: PBN catches the regression, DevTools helps you fix it.

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/performance-bottleneck.git
cd performance-bottleneck
npm install

# Build all packages
npm run build

# Start the API server
cd packages/api && node dist/index.js
```

### Add the browser agent to your site

```html
<script type="module">
  import { BrowserAgent } from '@pbn/browser-agent';

  const agent = new BrowserAgent({
    collectorUrl: 'https://your-api.example.com/api/metrics',
    siteId: 'your-site-id',
  });
  agent.start();
</script>
```

### React integration

```tsx
import { PBNProvider, useWebVitals } from '@pbn/sdk/react';

function App() {
  return (
    <PBNProvider config={{ collectorUrl: '/api/metrics', siteId: 'my-site' }}>
      <Dashboard />
    </PBNProvider>
  );
}

function Dashboard() {
  const vitals = useWebVitals();
  return <p>LCP: {vitals.lcp ?? '...'}</p>;
}
```

### Next.js integration

```tsx
// layout.tsx (App Router)
import { PBNProvider } from '@pbn/sdk/react';
import { createNextConfig } from '@pbn/sdk/next';

const pbnConfig = createNextConfig({ siteId: 'my-site' });

export default function RootLayout({ children }) {
  return <PBNProvider config={pbnConfig}>{children}</PBNProvider>;
}
```

### CLI

```bash
# Initialize a site
npx @pbn/cli init --api-url http://localhost:3001

# Check status
npx @pbn/cli status

# View metric summary
npx @pbn/cli summary
```

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│ Browser Agent │───▶│   API Server │───▶│ Analytics Engine  │
│  (client JS)  │    │  (Express)   │    │  (detection)      │
└──────────────┘    └──────┬───────┘    └────────┬─────────┘
                           │                     │
                    ┌──────┴───────┐    ┌────────┴─────────┐
                    │   SQLite DB  │    │  Notifications    │
                    │  (sql.js)    │    │  (Slack/email/wh) │
                    └──────────────┘    └──────────────────┘

┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
│  Dashboard   │    │     CLI      │    │  VS Code Ext     │
│  (React)     │    │ (Commander)  │    │  (status bar)    │
└──────────────┘    └──────────────┘    └──────────────────┘
```

## Packages

| Package                 | Description                                 | Key Technologies                |
| ----------------------- | ------------------------------------------- | ------------------------------- |
| `@pbn/browser-agent`    | Client-side metric collection               | PerformanceObserver, sendBeacon |
| `@pbn/api`              | Data collection & query API                 | Express, sql.js, helmet         |
| `@pbn/analytics-engine` | Statistical analysis & regression detection | Pure TypeScript                 |
| `@pbn/dashboard`        | Web visualization dashboard                 | React, Recharts, Vite           |
| `@pbn/cli`              | Command-line interface                      | Commander, chalk, axios         |
| `@pbn/sdk`              | Framework integrations                      | React hooks, Next.js            |
| `@pbn/vscode-extension` | VS Code integration                         | VS Code API, esbuild            |

## API Endpoints

### Sites

- `POST /api/sites` — Create a site (returns API key)
- `GET /api/sites` — List all sites
- `GET /api/sites/:siteId` — Get site details
- `DELETE /api/sites/:siteId` — Delete a site

### Metrics

- `POST /api/metrics` — Ingest metrics (batch, rate-limited to 1000/min)
- `GET /api/metrics?siteId=X` — Query raw metrics
- `GET /api/metrics/summary?siteId=X` — Get aggregated summary (avg, p50, p75, p95)
- `GET /api/metrics/timeseries?siteId=X&metric=LCP` — Time-series data

### Webhooks

- `POST /api/webhooks` — Register a webhook (returns signing secret)
- `GET /api/webhooks` — List webhooks
- `DELETE /api/webhooks/:id` — Delete a webhook

## Development

```bash
# Install dependencies
npm install

# Run all packages in dev mode
npm run dev

# Build everything
npm run build

# Type check
npm run type-check

# Run tests
npx vitest run

# Run tests in watch mode
npx vitest
```

## Docker

```bash
# Build and run the API
docker build -t pbn-api .
docker run -p 3001:3001 pbn-api

# Or use docker compose for API + Dashboard
docker compose up
```

## Configuration

### Environment Variables (API)

| Variable   | Default       | Description             |
| ---------- | ------------- | ----------------------- |
| `PORT`     | `3001`        | Server port             |
| `NODE_ENV` | `development` | Environment             |
| `API_KEY`  | —             | Optional global API key |

### VS Code Extension Settings

| Setting            | Default                 | Description                 |
| ------------------ | ----------------------- | --------------------------- |
| `pbn.apiUrl`       | `http://localhost:3001` | API server URL              |
| `pbn.siteId`       | —                       | Site ID to monitor          |
| `pbn.apiKey`       | —                       | API key for authentication  |
| `pbn.pollInterval` | `60`                    | Polling interval in seconds |

### SDK Configuration

```ts
interface SDKConfig {
  collectorUrl: string; // Required: API endpoint
  siteId: string; // Required: Site identifier
  environment?: string; // 'production' | 'staging' | 'development'
  debug?: boolean; // Enable console logging
  sampleRate?: number; // 0-1, percentage of sessions to track
  batchSize?: number; // Metrics per batch
  flushInterval?: number; // Ms between flushes
  trackRouteChanges?: boolean; // SPA route change tracking
}
```

## Testing

```bash
# Run all tests
npx vitest run

# Run with verbose output
npx vitest run --reporter=verbose

# Run tests for a specific package
npx vitest run packages/analytics-engine

# Watch mode
npx vitest
```

## Project Structure

```
performance-bottleneck/
├── packages/
│   ├── browser-agent/    # Client-side metric collector
│   │   └── src/
│   │       ├── index.ts       # BrowserAgent class
│   │       ├── collectors.ts  # LCP, CLS, FID, INP, TTFB collectors
│   │       ├── transport.ts   # Batching, retry, offline queue
│   │       ├── types.ts       # Type definitions
│   │       └── utils.ts       # Session ID, page context
│   ├── api/              # Express API server
│   │   └── src/
│   │       ├── index.ts        # Express app setup
│   │       ├── database.ts     # sql.js database layer
│   │       ├── middleware.ts   # Auth, rate limiting, validation
│   │       ├── notifications.ts # Slack, email, webhooks
│   │       ├── types.ts        # API types
│   │       └── routes/         # Metrics, sites, webhooks
│   ├── analytics-engine/ # Statistical analysis
│   │   └── src/
│   │       ├── statistics.ts  # Mean, median, percentile, z-score, EWMA
│   │       ├── detector.ts    # RegressionDetector class
│   │       └── thresholds.ts  # Web Vitals thresholds
│   ├── dashboard/        # React dashboard
│   │   └── src/
│   │       ├── App.tsx         # Main dashboard
│   │       ├── api.ts          # API client
│   │       └── components/     # ScoreCards, Charts, Table
│   ├── cli/              # Command-line tool
│   │   └── src/cli.ts         # init, status, summary, metrics, sites
│   ├── sdk/              # Framework integrations
│   │   └── src/
│   │       ├── index.ts   # Core SDK class
│   │       ├── react.ts   # React hooks & PBNProvider
│   │       ├── next.ts    # Next.js helpers
│   │       ├── helpers.ts # Event emitter, spans, utilities
│   │       └── types.ts   # SDK types
│   └── vscode-extension/ # VS Code extension
│       └── src/extension.ts   # Polling, status bar, alerts
├── .github/workflows/ci.yml  # GitHub Actions CI
├── Dockerfile                 # API container
├── Dockerfile.dashboard       # Dashboard container
├── docker-compose.yml         # Full stack
├── turbo.json                 # Turbo pipeline
├── vitest.config.ts           # Test config
└── package.json               # Workspace root
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE) for details.
