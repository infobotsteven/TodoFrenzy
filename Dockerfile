# syntax=docker/dockerfile:1

# --- 1. Build: the frontend (Vite) and the server (tsup). The full Debian image has the tools to compile better-sqlite3 if no prebuilt binary is available.
FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# --- 2. Production dependencies of the server (same OS and architecture as the final image, so the native module works after copying)
FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev -w server

# --- 3. Final image: only what is needed to run, as an unprivileged user
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/todo.db \
    BACKUP_DIR=/app/backups
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/drizzle ./server/drizzle
COPY --from=build /app/client/dist ./client/dist
# the data directories are created owned by "node" - a named volume inherits this ownership on first use
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
