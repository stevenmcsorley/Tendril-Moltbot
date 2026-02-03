# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install agent dependencies
COPY package*.json ./
RUN npm ci

# Install dashboard dependencies
COPY dashboard/package*.json ./dashboard/
RUN cd dashboard && npm ci

# Copy source
COPY . .

# Build agent
RUN npm run build

# Build dashboard
RUN cd dashboard && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dashboard/dist ./dashboard/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .

# Create data directory
RUN mkdir -p data

# Non-root user
RUN addgroup -g 1001 -S moltbot && \
    adduser -u 1001 -S moltbot -G moltbot && \
    chown -R moltbot:moltbot /app

USER moltbot

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3333/health || exit 1

EXPOSE 3333

CMD ["node", "dist/index.js"]
