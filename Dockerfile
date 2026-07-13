# Build a self-contained Next.js image with ffmpeg + yt-dlp.
FROM node:20-slim

# ffmpeg for audio extraction, python3/pip for yt-dlp (and curl as fallback).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install yt-dlp via pip (reliable on Debian slim).
RUN pip3 install --no-cache-dir yt-dlp

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
ENV CACHE_DIR=/app/cache
ENV CACHE_TTL_DAYS=7
ENV CACHE_MAX_GB=5

VOLUME ["/app/cache"]

EXPOSE 3000

CMD ["npm", "start"]
