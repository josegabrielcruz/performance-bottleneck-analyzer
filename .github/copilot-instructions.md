# Performance Bottleneck Analyzer - Development Guide

## Project Overview

Open-source performance monitoring tool with a hybrid SaaS model. Monorepo using Turbo for workspace management.

## Packages

- **browser-agent**: Lightweight JS snippet for collecting metrics from production sites
- **sdk**: NPM package for integrating with applications
- **api**: Node.js/Express backend API for data collection and processing
- **analytics-engine**: Core analysis and regression detection logic
- **dashboard**: React web dashboard for visualizations
- **vscode-extension**: VS Code extension for real-time notifications
- **cli**: Command-line interface tool

## Development Setup

1. Install dependencies: `npm install`
2. Build all packages: `npm run build`
3. Start dev mode: `npm run dev`

## Key Technologies

- Node.js 18+
- TypeScript
- React (dashboard)
- Turbo (monorepo management)
- Express (API)

## MVP Goals (Phase 1)

- Browser agent collecting Core Web Vitals
- Simple backend API for data storage
- Slack notifications for regressions
- Basic dashboard with time-series charts

## Contributing

Follow TypeScript best practices. Use Prettier for formatting. Ensure all packages compile without errors.
