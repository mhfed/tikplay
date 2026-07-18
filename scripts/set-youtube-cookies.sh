#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  printf 'Usage: npm run youtube:cookies -- /path/to/youtube-cookies.txt\n' >&2
  exit 2
fi

cookies_file=$1

if [[ ! -f "$cookies_file" ]]; then
  printf 'Cookie file not found: %s\n' "$cookies_file" >&2
  exit 1
fi

if [[ ! -s "$cookies_file" ]]; then
  printf 'Cookie file is empty: %s\n' "$cookies_file" >&2
  exit 1
fi

if ! grep -E '(^|\.)youtube\.com[[:space:]]' "$cookies_file" >/dev/null; then
  printf 'Cookie file does not look like a Netscape youtube.com export: %s\n' "$cookies_file" >&2
  exit 1
fi

encoded=$(base64 < "$cookies_file" | tr -d '\n')

fly secrets set YOUTUBE_COOKIES_B64="$encoded"

printf 'Updated Fly secret YOUTUBE_COOKIES_B64 from %s\n' "$cookies_file"
printf 'Run `fly deploy` if the app was not restarted by the secret update.\n'
