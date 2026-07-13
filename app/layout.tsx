import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TikTok Music Player',
  description: 'Phát nhạc từ URL TikTok',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
