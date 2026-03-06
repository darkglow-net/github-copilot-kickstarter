# Build stage
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM node:24-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN mkdir -p /data && chown app:app /data
USER app
EXPOSE 3001
VOLUME ["/data"]
ENV NODE_ENV=production
ENV PORT=3001
ENV LOG_LEVEL=info
ENV DB_PATH=/data/workflow-state.db
ENV ORPHAN_TTL_DAYS=7
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "dist/server.js"]
