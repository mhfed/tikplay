# Build a self-contained Next.js image with ffmpeg + yt-dlp.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runner

# ffmpeg for audio extraction, python3/pip for yt-dlp (and curl as fallback).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install yt-dlp + curl_cffi (curl_cffi is REQUIRED — TikTok now needs
# impersonation, without it yt-dlp fails with "Requested format is not
# available"). --break-system-packages needed on Debian bookworm (PEP 668).
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp curl_cffi

# Try to refresh yt-dlp at build time (best-effort; TikTok changes often).
RUN yt-dlp -U || true

WORKDIR /app

# `output: 'standalone'` traces only the node_modules this app actually
# needs, so the runner image doesn't carry the full install from `builder`.
# `npm run build` already copies public/ and .next/static into it.
COPY --from=builder /app/.next/standalone ./

# Persistent cache volume. Mount a disk here in production.
# CACHE_MAX_GB kept under Fly's 3GB free volume.
ENV CACHE_DIR=/app/cache
ENV DB_PATH=/app/cache/tikplay.json
ENV CACHE_TTL_DAYS=7
ENV CACHE_MAX_GB=2
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

VOLUME ["/app/cache"]

EXPOSE 3000

# server.js (from `output: 'standalone'`) binds HOSTNAME/PORT itself — no
# need for `next start -H -p` flags.
CMD ["node", "server.js"]
