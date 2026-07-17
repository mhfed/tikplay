# Plan: Sửa routing & thêm SEO meta cho TikPlay

## Tổng quan
Project hiện tại là **SPA 1 page** (`/`) — tất cả navigation là client-side state. Cần tạo **URL routing riêng** cho từng view và thêm **full SEO metadata**.

## 1. Thêm URL Routing (Next.js App Router)

### Cấu trúc routes mới:
```
app/
  layout.tsx          # Root layout — update metadata với SEO
  page.tsx            # Home page (redirect/dashboard)
  library/
    page.tsx          # All Tracks (/library)
    favorites/
      page.tsx        # Favorites (/library/favorites)
    [id]/
      page.tsx        # Playlist cụ thể (/library/3)
```

### Thay đổi chi tiết:

**A. `app/layout.tsx`** — Cập nhật root metadata:
- Thêm `metadataBase: new URL('https://craw-music.fly.dev')`
- Thêm full `openGraph` tags (title, description, image, url, type, site_name)
- Thêm `twitter` card tags (summary_large_image)
- Thêm `keywords`, `authors`, `robots` (allow all)
- Template title: `'%s | TikPlay'`

**B. `app/page.tsx`** — Trang chủ:
- Thêm `generateMetadata()` với title "TikPlay — Nghe nhạc từ TikTok"
- Giữ nguyên logic server-side data loading + AppShell

**C. `app/library/page.tsx`** — All Tracks:
- Server component đọc tracks từ DB
- `generateMetadata()` → "All Tracks | TikPlay"
- Render AppShell với initialData (playlistId=1, view='library')

**D. `app/library/favorites/page.tsx`** — Favorites:
- `generateMetadata()` → "Yêu thích | TikPlay"
- Render AppShell với initialData (playlistId=-1, view='library')

**E. `app/library/[id]/page.tsx`** — Playlist theo ID:
- `generateMetadata()` → tên playlist dynamic từ DB
- Render AppShell với initialData (playlistId từ URL, view='library')

### Chuyển navigation từ state sang URL:

**F. `components/Sidebar.tsx`** — Thay `onClick={selectPlaylist(id)}` bằng `<Link href="/library/3">` cho playlists, `<Link href="/library">` cho All Tracks, `<Link href="/library/favorites">` cho Favorites.

**G. `components/Home.tsx`** — Thay `goToPlaylist(id)` bằng Next.js `<Link>` tới `/library/[id]`, `/library/favorites`, `/library`.

**H. `components/MobileNav.tsx`** — Tab "Library" chuyển sang `/library`, "Home" chuyển sang `/`.

**I. `hooks/useAppStore.tsx`** — Thay `selectPlaylist()` dùng `router.push()` thay vì chỉ setState. Xóa logic `window.history.replaceState` thủ công, dùng Next.js router thay thế. `goHome()` → `router.push('/')`.

## 2. Thêm SEO Metadata

### `app/layout.tsx` — Root metadata:
```typescript
export const metadata: Metadata = {
  metadataBase: new URL('https://craw-music.fly.dev'),
  title: {
    default: 'TikPlay — Nghe nhạc từ TikTok',
    template: '%s | TikPlay',
  },
  description: 'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok. Tạo playlist, yêu thích bài hát, nghe offline.',
  keywords: ['tiktok music', 'nhac tiktok', 'nghe nhac', 'music player', 'tikplay', 'download nhac tiktok'],
  authors: [{ name: 'TikPlay' }],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'TikPlay',
    title: 'TikPlay — Nghe nhạc từ TikTok',
    description: 'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok.',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'TikPlay' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TikPlay — Nghe nhạc từ TikTok',
    description: 'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok.',
    images: ['/icons/icon-512.png'],
  },
  robots: { index: true, follow: true },
  icons: { /* giữ nguyên */ },
  appleWebApp: { /* giữ nguyên */ },
};
```

### `app/robots.ts` — Dynamic robots.txt:
```typescript
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://craw-music.fly.dev/sitemap.xml',
  };
}
```

### `app/sitemap.ts` — Dynamic sitemap.xml:
- Tạo sitemap từ danh sách playlists (đọc từ DB)
- Include: `/`, `/library`, `/library/favorites`, `/library/[id]` cho mỗi playlist

### JSON-LD Structured Data:
- Thêm `<script type="application/ld+json">` vào layout với `WebSite` schema + `MusicApplication` schema

## 3. Thứ tự thực hiện
1. Cập nhật `app/layout.tsx` với full SEO metadata
2. Tạo `app/robots.ts` + `app/sitemap.ts`
3. Tạo `app/library/page.tsx`, `app/library/favorites/page.tsx`, `app/library/[id]/page.tsx`
4. Cập nhật `app/page.tsx` với `generateMetadata()`
5. Thêm JSON-LD vào layout
6. Refactor Sidebar dùng `<Link>` thay `onClick`
7. Refactor Home dùng `<Link>` thay `onClick`
8. Refactor MobileNav dùng `<Link>`
9. Refactor useAppStore dùng Next.js router thay `window.history`
10. Test build: `npm run build`
