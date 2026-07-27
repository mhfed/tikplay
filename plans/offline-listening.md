# Offline Listening — Design Plan

**Goal:** Allow users to download tracks for offline playback using OPFS (Origin Private File System) + Persistent Storage, with full UI controls and library browsing support.

---

## 1. Storage Architecture

### 1.1 OPFS (Origin Private File System)

Primary storage for audio files. OPFS stores files as real files in the browser's private origin, not as blobs in IndexedDB.

**Advantages over IndexedDB:**
- Higher effective quota (same pool as Cache API + IndexedDB combined, but file-based)
- Direct `File` objects → blob URLs without loading entire file into memory
- `createWritable()` for streaming writes (great for large audio)
- `createSyncAccessHandle` for high-performance reads (available in Workers)

**Quota:** Shared with origin's IndexedDB + Cache API storage. Chrome typically allows up to 60% of free disk space. On a device with 64GB free, that's ~38GB — enough for thousands of tracks at ~3MB each.

### 1.2 IndexedDB Metadata Store

A lightweight IndexedDB database to store metadata about what's downloaded:

```typescript
interface OfflineTrackMeta {
  trackId: number;
  audioKey: string;      // matches /api/audio/[key]
  title: string;
  author: string;
  cover: string;
  duration: number;
  fileSize: number;      // bytes
  downloadedAt: number;
  lastPlayedAt: number | null;
  opfsFileName: string;  // the OPFS filename for this track
}

interface OfflineStore {
  tracks: Map<number, OfflineTrackMeta>;  // keyed by trackId
  totalBytes: number;
  lastSyncAt: number;
}
```

### 1.3 Persistent Storage

Request `navigator.storage.persist()` to make the origin's storage immune to automatic eviction by the browser. This is typically granted for installed PWAs that have user engagement.

### 1.4 File Naming Convention

OPFS file names: `audio-${audioKey}.m4a`

The `audioKey` is already a SHA-256 hex string, so it's safe for filenames and collision-free.

---

## 2. Module Structure

### New files:

```
lib/offline/
├── db.ts              # OPFS operations (read/write/delete audio files)
├── metadata.ts        # IndexedDB metadata layer (what's downloaded)
├── storage.ts         # Storage management (quota, persist request, estimation)
└── index.ts           # Public API re-exports

hooks/
└── useOffline.ts      # React hook: download, remove, status, progress

components/
├── OfflineBadge.tsx           # Download status icon for track rows
├── OfflineManagerDialog.tsx   # Full offline management UI
├── OfflineIndicator.tsx       # Network status pill
└── DownloadProgressToast.tsx  # Inline download progress
```

### Modified files:

```
public/sw.js                  # Request persistent storage on activate
hooks/usePlayback.tsx          # Check offline availability before loading audio
hooks/useAudioEngine.ts        # Support blob URLs from OPFS
components/TrackRow.tsx        # Add download button
components/TrackActionsDialog.tsx  # Add download option
components/TrackList.tsx       # Wire offline state
components/AppShell.tsx        # Add offline manager entry
```

---

## 3. Core Implementation Details

### 3.1 `lib/offline/db.ts` — OPFS Wrapper

```
class OfflineFileStore {
  private root: FileSystemDirectoryHandle | null

  async init(): Promise<void>
    // Request OPFS root via navigator.storage.getDirectory()
    // Create 'tikplay-offline' subdirectory if not exists

  async saveAudio(audioKey: string, blob: Blob): Promise<{ fileName: string, fileSize: number }>
    // Open/create file: audio-${audioKey}.m4a
    // Create writable stream via createWritable()
    // Write blob data
    // Return file metadata

  async getAudioFile(audioKey: string): Promise<File | null>
    // Get File handle from OPFS
    // Return File object (can be used with URL.createObjectURL)

  async deleteAudio(audioKey: string): Promise<void>
    // Remove file from OPFS

  async getTotalUsedBytes(): Promise<number>
    // Iterate files in directory, sum sizes

  async clearAll(): Promise<void>
    // Remove all audio files from OPFS directory
}
```

### 3.2 `lib/offline/metadata.ts` — IndexedDB Metadata

```
const DB_NAME = 'tikplay-offline-v1';
const STORE_NAME = 'tracks';

interface OfflineTrackMeta {
  trackId: number;         // primary key
  audioKey: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  fileSize: number;
  downloadedAt: number;
  lastPlayedAt: number | null;
}

class OfflineMetadataStore {
  private db: IDBDatabase | null

  async init(): Promise<void>
    // Open IndexedDB, create object store with trackId as key

  async addTrack(meta: OfflineTrackMeta): Promise<void>
  async removeTrack(trackId: number): Promise<void>
  async getTrack(trackId: number): Promise<OfflineTrackMeta | null>
  async getAllTracks(): Promise<OfflineTrackMeta[]>
  async isDownloaded(trackId: number): Promise<boolean>
  async getTotalBytes(): Promise<number>
  async clearAll(): Promise<void>
}
```

### 3.3 `lib/offline/storage.ts` — Storage Management

```
async function requestPersistentStorage(): Promise<boolean>
  // navigator.storage.persist()
  // Return whether granted

async function getStorageEstimate(): Promise<{ usage: number, quota: number }>
  // navigator.storage.estimate()
  // Return current usage and quota in bytes

async function getStorageInfo(): Promise<StorageInfo>
  interface StorageInfo {
    usageBytes: number;
    quotaBytes: number;
    usageFormatted: string;   // e.g. "245 MB"
    quotaFormatted: string;   // e.g. "2.1 GB"
    percentUsed: number;      // 0-100
    isPersistent: boolean;
  }
```

### 3.4 `hooks/useOffline.ts` — React Hook

```
interface OfflineState {
  downloadedTracks: Map<number, {
    meta: OfflineTrackMeta;
    isDownloading: boolean;
    progress: number;        // 0-1
    error: string | null;
  }>;
  storageInfo: StorageInfo | null;
  isOnline: boolean;
  isInitialized: boolean;
}

interface OfflineActions {
  downloadTrack: (track: Track) => Promise<void>;
  removeTrack: (trackId: number) => Promise<void>;
  removeAll: () => Promise<void>;
  isDownloaded: (trackId: number) => boolean;
  getAudioUrl: (trackId: number) => Promise<string | null>;
    // Returns blob URL for offline track, or null if not available
  refreshStorageInfo: () => Promise<void>;
}
```

**Key behaviors:**
- On mount: init OPFS + IndexedDB, load metadata, compute storage info
- `downloadTrack(track)`: 
  1. Fetch `/api/audio/${track.audioKey}` with `response.blob()`
  2. Show progress (Chrome supports fetch progress via ReadableStream)
  3. Write blob to OPFS via `saveAudio()`
  4. Save metadata to IndexedDB
  5. Update state
- `getAudioUrl(trackId)`:
  1. Check metadata in IndexedDB
  2. If exists, get File from OPFS
  3. Create and return `URL.createObjectURL(file)`
  4. Cache the blob URL to revoke later
- Track online/offline status via `navigator.onLine` and events

### 3.5 Audio Engine Integration

**In `hooks/usePlayback.tsx`** — modify the effect that loads tracks:

```typescript
// Before calling loadTrack, check offline availability
useEffect(() => {
  if (!currentTrack) {
    pauseAudio();
    return;
  }

  const loadAudio = async () => {
    let audioUrl = currentTrack.audioUrl;

    // If offline or track is downloaded, use offline version
    if (offlineStore.isDownloaded(currentTrack.id)) {
      const blobUrl = await offlineStore.getAudioUrl(currentTrack.id);
      if (blobUrl) {
        audioUrl = blobUrl;
      }
    }

    loadTrack(audioUrl, restoredPositionRef.current ?? undefined);
    restoredPositionRef.current = null;
    if (isPlaying) playAudio();
    else pauseAudio();
  };

  loadAudio();
}, [currentTrack?.id, isPlaying, ...]);
```

**In `hooks/useAudioEngine.ts`** — revoke old blob URLs when loading new tracks:

```typescript
const loadTrack = useCallback((audioUrl: string, initialTime?: number) => {
  // Revoke previous blob URL if it was an offline one
  if (lastBlobUrlRef.current) {
    URL.revokeObjectURL(lastBlobUrlRef.current);
    lastBlobUrlRef.current = null;
  }

  // Store blob URLs for later cleanup
  if (audioUrl.startsWith('blob:')) {
    lastBlobUrlRef.current = audioUrl;
  }

  // ... rest of existing logic
}, []);
```

### 3.6 Blob URL Lifecycle

- When loading an offline track, `getAudioUrl()` creates `URL.createObjectURL(file)` 
- The blob URL is passed to `loadTrack()` which sets `audio.src = blobUrl`
- When the track changes, the old blob URL is revoked in `useAudioEngine`
- When the component unmounts, all blob URLs are revoked
- The OPFS `File` handle persists — blob URLs can be recreated on next load

---

## 4. UI Components

### 4.1 `OfflineBadge.tsx` — Download Status Badge

Small icon overlay shown on `Cover` component or next to track title:

| State | Icon | Tooltip |
|-------|------|---------|
| Not downloaded | — (hidden) | — |
| Downloading | Spinner + progress % | "Đang tải... 45%" |
| Downloaded | ✅ green check | "Đã tải offline" |
| Error | ⚠️ warning | "Lỗi tải xuống" |

### 4.2 `OfflineManagerDialog.tsx` — Full Management UI

```
┌─────────────────────────────────────────────────────────┐
│  Quản lý tải offline                          [X] Close │
│                                                         │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ 📊 Đã dùng 245 MB / 2.1 GB (11%)     🟢 Persistent │ │
│  │ [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │ │
│  │                                         [Xóa tất cả] │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                         │
│  Tìm kiếm: [___________________________]                │
│                                                         │
│  ☑ Track 1 — Author                    3.2 MB  [Xóa]   │
│  ☑ Track 2 — Author                    2.8 MB  [Xóa]   │
│  ☑ Track 3 — Author                    4.1 MB  [Xóa]   │
│                                                         │
│  📶 Trạng thái: 🟢 Đang online                          │
│  (30 bài đã tải — 95.2 MB)                              │
└─────────────────────────────────────────────────────────┘
```

### 4.3 `OfflineIndicator.tsx` — Network Status Pill

Shown in the sidebar or header:

```
🟢 Online     or     🔴 Offline (có 12 bài offline)
```

### 4.4 `DownloadProgressToast.tsx` — Inline Progress

Shown as a small toast or within the track row while downloading:

```
[Track title]  ⬇️ ████████░░ 65%
```

---

## 5. Download Flow

```
User taps download icon on track
         │
         ▼
┌─────────────────────────┐
│ Check storage quota     │
│ Estimate vs track size  │
│ If insufficient → warn  │
└─────────┬───────────────┘
          │ OK
          ▼
┌─────────────────────────┐
│ Fetch /api/audio/[key]  │
│ with streaming progress │
│ (use Response.blob() or │
│  ReadableStream)        │
└─────────┬───────────────┘
          │ blob received
          ▼
┌─────────────────────────┐
│ Write to OPFS via       │
│ createWritable()        │
└─────────┬───────────────┘
          │ done
          ▼
┌─────────────────────────┐
│ Save metadata to        │
│ IndexedDB               │
└─────────┬───────────────┘
          │ done
          ▼
┌─────────────────────────┐
│ Update UI: show ✅      │
│ Update storage info     │
└─────────────────────────┘
```

---

## 6. Playback Flow (Offline)

```
User taps play on a track
         │
         ▼
┌─────────────────────────┐
│ Check navigator.onLine  │
│ and download status     │
└─────────┬───────────────┘
     ┌────┴────┐
     │         │
  Online    Offline
     │         │
     │         ▼
     │  ┌─────────────────┐
     │  │ Is track        │
     │  │ downloaded?     │
     │  └──┬──────────┬──┘
     │   Yes          No
     │     │           │
     │     ▼           ▼
     │  Use OPFS    Show "Không
     │  File →      available
     │  blob URL    offline"
     │     │
     └─────┘
       Use /api/audio/[key]
       (normal flow)
```

---

## 7. Storage Edge Cases

| Scenario | Behavior |
|----------|----------|
| Quota exceeded during download | Catch error, show "Không đủ dung lượng", suggest removing old tracks |
| Track deleted from library | Remove from OPFS + IndexedDB automatically |
| Re-download track | Replace existing OPFS file, update timestamp |
| Browser clears site data | All offline data lost — show "not downloaded" state |
| Storage persistence denied | Still works but browser may evict data under pressure — show warning |
| OPFS not supported (Firefox) | Fall back gracefully — show "Trình duyệt không hỗ trợ tải offline" |

**Browser compatibility note:** OPFS is supported in Chrome 86+, Safari 16.4+, Edge 86+. Firefox does not support OPFS yet (Bug 1785121). For Firefox, we can fall back to IndexedDB/blob storage as a secondary option, but this is out of scope for Phase 1.

---

## 8. Implementation Phases

### Phase 1A — Storage Layer (Backend)

| # | Task | Files | Description |
|---|------|-------|-------------|
| 1 | Create `lib/offline/db.ts` | New | OPFS wrapper: init, save, read, delete audio files |
| 2 | Create `lib/offline/metadata.ts` | New | IndexedDB metadata store for download tracking |
| 3 | Create `lib/offline/storage.ts` | New | Storage estimation, persist request, online detection |
| 4 | Create `lib/offline/index.ts` | New | Re-export public API |
| 5 | Update `public/sw.js` | Modified | Request persistent storage on activate event |

### Phase 1B — React Integration

| # | Task | Files | Description |
|---|------|-------|-------------|
| 6 | Create `hooks/useOffline.ts` | New | React hook: download/remove/list offline tracks, progress tracking |
| 7 | Modify `hooks/usePlayback.tsx` | Modified | Check offline availability before loading audio; use blob URLs when offline |
| 8 | Modify `hooks/useAudioEngine.ts` | Modified | Revoke blob URLs on track change; support blob: protocol URLs |

### Phase 1C — UI Components

| # | Task | Files | Description |
|---|------|-------|-------------|
| 9 | Create `components/OfflineBadge.tsx` | New | Download status icon (not downloaded / downloading / downloaded / error) |
| 10 | Create `components/OfflineIndicator.tsx` | New | Network status pill (online/offline + track count) |
| 11 | Create `components/OfflineManagerDialog.tsx` | New | Full management UI: storage bar, track list with remove, search |
| 12 | Modify `components/TrackRow.tsx` | Modified | Add download button with status badge |
| 13 | Modify `components/TrackActionsDialog.tsx` | Modified | Add "Tải offline" / "Xóa offline" option |
| 14 | Modify `components/AppShell.tsx` | Modified | Add offline indicator + manager entry point |
| 15 | Add download icons to `components/icons.tsx` | Modified | DownloadIcon, CheckCircleIcon, OfflineIcon, StorageIcon |

### Phase 1D — Polish & Testing

| # | Task | Files | Description |
|---|------|-------|-------------|
| 16 | Add E2E tests for offline download + playback | New `e2e/offline.spec.ts` | Test download flow, offline playback, storage management |
| 17 | Run lint and typecheck | — | `npm run lint`, `npx tsc --noEmit` |
| 18 | Update docs | `docs/product-roadmap.md` | Update Phase 5 status |

---

## 9. Files Changed Summary

### New Files
| File | Purpose |
|------|---------|
| `lib/offline/db.ts` | OPFS audio file storage |
| `lib/offline/metadata.ts` | IndexedDB metadata for downloaded tracks |
| `lib/offline/storage.ts` | Storage management utilities |
| `lib/offline/index.ts` | Public API exports |
| `hooks/useOffline.ts` | React hook for offline management |
| `components/OfflineBadge.tsx` | Download status badge |
| `components/OfflineIndicator.tsx` | Network status pill |
| `components/OfflineManagerDialog.tsx` | Full offline management dialog |
| `e2e/offline.spec.ts` | E2E tests |

### Modified Files
| File | Changes |
|------|---------|
| `public/sw.js` | Add `persist()` call on activate |
| `hooks/usePlayback.tsx` | Integrate offline URL resolution |
| `hooks/useAudioEngine.ts` | Blob URL cleanup lifecycle |
| `components/TrackRow.tsx` | Download button + status badge |
| `components/TrackActionsDialog.tsx` | Download/remove offline action |
| `components/AppShell.tsx` | Offline indicator + manager entry |
| `components/icons.tsx` | New icon components |
| `docs/product-roadmap.md` | Update Phase 5 |

---

## 10. Key Design Decisions

### Why OPFS over Cache API?
- Cache API stores HTTP responses, not files — less control
- OPFS provides direct File objects for blob URLs
- OPFS write streams are more efficient for large binaries
- OPFS + IndexedDB metadata is more flexible than Cache API for listing/managing tracks

### Why not use `/api/audio/[key]` directly with SW cache?
- Audio streaming uses Range requests — complex to cache properly in SW
- SW cache still subject to same quota as OPFS
- OPFS gives us direct file access, cleaner integration

### Why Stream download progress?
- Fetch API via `response.body.getReader()` gives chunked reads
- Can show real progress: `loaded / total * 100`
- Better UX than an indeterminate spinner

### Blob URL cleanup strategy:
- Track the last blob URL in `useAudioEngine` via a ref
- Revoke when `loadTrack()` is called with a different URL
- Revoke on component unmount
- This prevents memory leaks from unreleased blob URLs
