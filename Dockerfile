# Build a self-contained Next.js image with ffmpeg + yt-dlp.
FROM node:20-slim

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

WORKDIR /app

# Install deps first to leverage Docker layer caching.
COPY package.json package-lock.json* ./
RUN npm install

# Copy the rest of the app.
COPY . .

# Build the Next.js app.
RUN npm run build

# Try to refresh yt-dlp at build time (best-effort; TikTok changes often).
RUN yt-dlp -U || true

# Persistent cache volume. Mount a disk here in production.
# CACHE_MAX_GB kept under Fly's 3GB free volume.
ENV CACHE_DIR=/app/cache
ENV CACHE_TTL_DAYS=7
ENV CACHE_MAX_GB=2
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

VOLUME ["/app/cache"]

EXPOSE 3000

CMD ["npm", "start"]
