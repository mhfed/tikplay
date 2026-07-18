# YouTube Cookies

YouTube may block `yt-dlp` on Fly/datacenter IPs with `Sign in to confirm you're not a bot`. TikPlay supports passing YouTube cookies to `yt-dlp` through the `YOUTUBE_COOKIES_B64` Fly secret.

## Export

1. Open a private/incognito browser window.
2. Log in to YouTube in that private window.
3. In the same private window, open `https://www.youtube.com/robots.txt`.
4. Export only `youtube.com` cookies in Netscape/Mozilla format with a cookies export extension.
5. Close the private window immediately after exporting so YouTube does not rotate that session.

The exported file should be much larger than a bare anonymous cookie export. If it is only around 1 KB, it probably does not contain a useful logged-in YouTube session.

## Install On Fly

```bash
npm run youtube:cookies -- /absolute/path/to/youtube-cookies.txt
fly deploy
```

The cookie file is never committed. The script base64-encodes it and writes only the encoded value to the Fly secret `YOUTUBE_COOKIES_B64`.

## Runtime

The Docker image installs Deno because recent `yt-dlp` YouTube extraction expects a JavaScript runtime and enables Deno by default. The app passes both `--js-runtimes deno:/usr/local/bin/deno` and `--cookies <generated-file>` when cookies are configured.
