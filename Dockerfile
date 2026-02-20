FROM node:20-slim AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json turbo.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/analytics-engine/package.json ./packages/analytics-engine/
COPY packages/browser-agent/package.json ./packages/browser-agent/
COPY packages/sdk/package.json ./packages/sdk/

RUN npm ci --omit=dev

# Build stage
FROM base AS build

RUN npm ci

COPY tsconfig.json ./
COPY packages/analytics-engine/ ./packages/analytics-engine/
COPY packages/browser-agent/ ./packages/browser-agent/
COPY packages/sdk/ ./packages/sdk/
COPY packages/api/ ./packages/api/

RUN npx turbo run build --filter=@pbn/api...

# Production stage
FROM node:20-slim AS production

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy built artifacts and production deps
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/package.json ./packages/api/
COPY --from=build /app/packages/analytics-engine/dist ./packages/analytics-engine/dist
COPY --from=build /app/packages/analytics-engine/package.json ./packages/analytics-engine/

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:3001/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "packages/api/dist/index.js"]
