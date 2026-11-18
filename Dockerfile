FROM node:24-bookworm-slim AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app/BACKEND
ENV NODE_ENV=production SIVEC_WEB_DIR=/app/web VEEDURIA_STORAGE_DIR=/app/data
COPY --chown=node:node BACKEND/package.json BACKEND/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && mkdir -p /app/data \
    && chown node:node /app/data
COPY --chown=node:node BACKEND/src ./src
COPY --chown=node:node BACKEND/scripts ./scripts
COPY --chown=node:node BACKEND/migrations ./migrations
COPY --from=web --chown=node:node /build/frontend/dist /app/web
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
