# Fix Plan — PR #39 Review (Multi-platform expansion)

## Overview

8 fixes across 6 files, addressing review feedback from PR #39.

---

## 🚨 Blocking fixes

### 1. Revert `cacheKey` hash from MD5 → SHA-256

**File:** [`lib/media/processor.ts`](lib/media/processor.ts:14)

**Problem:** Line 14 uses `createHash('md5')` which breaks all existing cached audio/cover/metadata files keyed with SHA-256 (64-char hex).

**Fix:** Change `'md5'` → `'sha256'` and update the comment accordingly.

```diff
-  return createHash('md5').update(normalizedUrl).digest('hex');
+  return createHash('sha256').update(normalizedUrl).digest('hex');
```

**Comment update** (lines 11–13): Remove MD5 justification; restore SHA-256 note:

```diff
-  // Use MD5 to comfortably fit within filesystem filename limits. Since these
-  // are only used as lookup keys for public media, collisions/security aren't
-  // concerns.
+  // SHA-256 (64 chars) is well within macOS filename limits (255 chars).
+  // Cached data on disk uses this as the key, so the algorithm is stable.
```

---

### 2. Add validation check in `cacheKeyFromRaw`

**File:** [`lib/media/processor.ts`](lib/media/processor.ts:17)

**Problem:** `cacheKeyFromRaw` calls `validateMediaUrl` but ignores `result.valid`. If the URL is invalid, it silently hashes the raw URL, leading to cryptic yt-dlp errors downstream.

**Fix:** Check `result.valid` and throw early.

```diff
 export function cacheKeyFromRaw(rawUrl: string): string {
   const result = validateMediaUrl(rawUrl);
-  return cacheKey(result.normalized || rawUrl);
+  if (!result.valid) {
+    throw new Error(result.error ?? 'URL không hợp lệ');
+  }
+  return cacheKey(result.normalized!);
 }
```

---

### 3. Fix `next.config.mjs` — duplicate `turbopack` key + ESM `__dirname`

**File:** [`next.config.mjs`](next.config.mjs:21)

**Problem:** Two issues:
1. **Duplicate `turbopack` key** — lines 21 (`turbopack: {}`) and 29–33 (`turbopack: { resolveAlias: ... }`). In JS objects, the second key overwrites the first, making line 21 dead code.
2. **`resolveAlias` with `__dirname`** — even though `__dirname` is defined on line 4 via `fileURLToPath`, the alias `@/` already works through `tsconfig.json` paths, which Turbopack reads natively. The `resolveAlias` block is redundant.

**Fix:** Keep the single `turbopack: {}` (needed to silence Next.js warnings), remove the `resolveAlias` block entirely. Also remove the now-unused `__dirname` computation and `path`/`fileURLToPath` imports if `webpack` config also doesn't need them.

Actually, `webpack` config on lines 22–28 uses `__dirname` for `config.resolve.alias['@']`, which is also redundant since `tsconfig.json` paths handle it. However, the webpack config is harmless. Let's keep it minimal: **remove the second `turbopack` block only**.

```diff
   turbopack: {},
-  webpack(config) {
-    config.resolve.alias = {
-      ...config.resolve.alias,
-      '@': __dirname,
-    };
-    return config;
-  },
-  turbopack: {
-    resolveAlias: {
-      '@': __dirname,
-    },
-  },
 };
```

Also remove the now-unused imports:

```diff
-import path from 'node:path';
-import { fileURLToPath } from 'node:url';
-
-const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

**Wait** — the `webpack` config is still valid for non-Turbopack builds (e.g., `npm run build`). Let's keep the webpack alias but remove only the Turbopack `resolveAlias`:

```diff
   turbopack: {},
-  turbopack: {
-    resolveAlias: {
-      '@': __dirname,
-    },
-  },
 };
```

Since the `__dirname` variable is still used by `webpack` config, keep the imports too. However, the webpack alias `@` → `__dirname` might also be redundant since `tsconfig.json` `paths` handles it for webpack too. But removing webpack config is out of scope — this fix is specifically about the Turbopack `resolveAlias` issue.

**Revised fix:** Remove only lines 29–33 (the second `turbopack` block with `resolveAlias`). Keep the first `turbopack: {}` and the webpack config.

---

### 4. Remove build artifact files from repo

**Files:** [`lint-out.txt`](lint-out.txt), [`e2e-output.log`](e2e-output.log)

**Problem:** These are build artifacts committed by mistake.

**Fix:**

**Step A — Add to `.gitignore`:**
```diff
  # local claude settings
  .claude/settings.local.json
+lint-out.txt
+e2e-output.log
```

**Step B — Remove from git tracking:**
```bash
git rm --cached lint-out.txt e2e-output.log
```

---

## ⚠️ Should-fix

### 5. Move `cacheKey`/`cacheKeyFromRaw` from `processor.ts` → `source.ts`

**Problem:** [`app/api/copyright-reports/route.ts`](app/api/copyright-reports/route.ts:3) and [`e2e/copyright-flow.spec.ts`](e2e/copyright-flow.spec.ts:4) import `cacheKey` from `lib/media/processor`, pulling in a dependency on the entire `MediaProcessor` class just for a hash function. The hash functions are pure utilities that belong with URL handling.

**Fix:**

**Step A — Move functions to [`lib/media/source.ts`](lib/media/source.ts):**
```diff
+import { createHash } from 'node:crypto';
+
+export function cacheKey(normalizedUrl: string): string {
+  return createHash('sha256').update(normalizedUrl).digest('hex');
+}
+
+export function cacheKeyFromRaw(rawUrl: string): string {
+  const result = validateMediaUrl(rawUrl);
+  if (!result.valid) {
+    throw new Error(result.error ?? 'URL không hợp lệ');
+  }
+  return cacheKey(result.normalized!);
+}
```

**Step B — In [`lib/media/processor.ts`](lib/media/processor.ts):**
Remove the two function definitions and their `createHash` import. Re-export from source.ts for backward compatibility if other modules import from processor.ts:
```diff
-import { createHash } from 'node:crypto';
...
-export function cacheKey(...) { ... }
-export function cacheKeyFromRaw(...) { ... }
```

Add re-exports at top or simply have code use `cacheKey` internally through the already-imported `validateMediaUrl` from source.ts. Since `processor.ts` already imports from `'./source'`, we can import `cacheKey` and `cacheKeyFromRaw` from there. But `processor.ts` internally uses `cacheKeyFromRaw` on line 89 and `cacheKey` is not used internally (only `cacheKeyFromRaw` is). Let's check...

Line 89: `const key = cacheKeyFromRaw(rawUrl);` — this is inside `process()` method.

So `processor.ts` uses `cacheKeyFromRaw`. We need to make sure this still works after moving. Since `processor.ts` already imports from `'./source'`, we just need to add `cacheKeyFromRaw` to the import:

```diff
-import { type MediaSource, validateMediaUrl } from './source';
+import { type MediaSource, validateMediaUrl, cacheKeyFromRaw } from './source';
```

**Step C — Update imports in consumers:**

[`app/api/copyright-reports/route.ts`](app/api/copyright-reports/route.ts:3):
```diff
-import { cacheKey } from '@/lib/media/processor';
+import { cacheKey } from '@/lib/media/source';
```

[`e2e/copyright-flow.spec.ts`](e2e/copyright-flow.spec.ts:4):
```diff
-import { cacheKey } from '../lib/media/processor';
+import { cacheKey } from '../lib/media/source';
```

---

### 6. Comment typo in `normalizeFacebookUrl`

**File:** [`lib/media/source.ts`](lib/media/source.ts:148)

**Problem:** "remote other tracking params" → should be "remove".

```diff
-    // Keep ?v= parameter for Facebook video URLs, remote other tracking params
+    // Keep ?v= parameter for Facebook video URLs, remove other tracking params
```

---

### 7. `document.body.appendChild(audio)` — missing parentNode guard

**File:** [`hooks/useAudioEngine.ts`](hooks/useAudioEngine.ts:79)

**Problem:** `getOrCreateAudio()` calls `document.body.appendChild(audio)` every time it's invoked. If `getOrCreateAudio()` is called multiple times (which happens on re-renders), the audio element gets re-appended to the DOM each time. While `appendChild` moves an existing node rather than duplicating it, the extra DOM operations are unnecessary.

**Fix:** Guard with a `parentNode` check:

```diff
-      document.body.appendChild(audio);
+      if (!audio.parentNode) {
+        document.body.appendChild(audio);
+      }
```

---

### 8. `useButtonType: "off"` in biome.json

**File:** [`biome.json`](biome.json:42)

**Problem:** `useButtonType` is set to `"off"`. This disables the lint rule that requires `<button>` elements to have a `type="button"` attribute. Without this, buttons inside forms default to `type="submit"`, causing accidental form submissions.

**Fix:** Change from `"off"` to `"warn"` (or remove the line entirely to fall back to Biome's default `"error"`).

```diff
       "a11y": {
-        "useButtonType": "off",
         "noSvgWithoutTitle": "off",
```

---

## Execution Order

| # | Fix | Risk | Files touched |
|---|-----|------|--------------|
| 1 | `cacheKey` SHA-256 revert | **High** — affects all cached data | `lib/media/processor.ts` |
| 2 | `cacheKeyFromRaw` validation | Low — adds early throw | `lib/media/processor.ts` |
| 3 | `next.config.mjs` duplicate `turbopack` | Low | `next.config.mjs` |
| 4 | `.gitignore` + remove build artifacts | Low | `.gitignore` |
| 5 | Move hash functions to `source.ts` | **Medium** — import changes across 3 files | `lib/media/source.ts`, `lib/media/processor.ts`, `app/api/copyright-reports/route.ts`, `e2e/copyright-flow.spec.ts` |
| 6 | Comment typo | Trivial | `lib/media/source.ts` |
| 7 | `parentNode` guard | Low | `hooks/useAudioEngine.ts` |
| 8 | `useButtonType` rule | Low | `biome.json` |

Fixes 1–4 are blocking (must merge). Fixes 5–8 are should-fix.
