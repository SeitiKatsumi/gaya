FROM node:24-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY package.json pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:24-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=768
RUN pnpm build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=80 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 DATABASE_URL=file:/app/data/gaya.sqlite STORAGE_PATH=/app/storage BACKUP_PATH=/app/backups
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/whisper && /opt/whisper/bin/pip install --no-cache-dir faster-whisper==1.2.1
RUN /opt/whisper/bin/python -c "from faster_whisper import WhisperModel; WhisperModel('base',device='cpu',compute_type='int8',download_root='/opt/whisper-cache')"
ENV TRANSCRIPTION_PROVIDER=local LOCAL_WHISPER_PYTHON=/opt/whisper/bin/python LOCAL_WHISPER_CACHE=/opt/whisper-cache LOCAL_WHISPER_MODEL=base
RUN mkdir -p /app/data /app/storage /app/backups
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/scripts/prepare-production.ts /app/scripts/gaya-units.json ./scripts/
COPY --from=builder /app/src/lib/db.ts ./src/lib/db.ts
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:80/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh","-c","node --experimental-strip-types scripts/prepare-production.ts && exec node server.js"]
