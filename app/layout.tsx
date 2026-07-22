// biome-ignore-all lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized from a static object owned by the app.
import './globals.css';
import './components.css';
import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, JetBrains_Mono, Montserrat } from 'next/font/google';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import TermsDialog from '@/components/TermsDialog';
import { PlaybackProvider } from '@/hooks/usePlayback';

const montserrat = Montserrat({
  weight: ['700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
});

const mono = JetBrains_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

const SITE_URL = 'https://craw-music.fly.dev';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'TikPlay — Nghe nhạc từ TikTok & YouTube',
    template: '%s | TikPlay',
  },
  description:
    'Trình phát phi thương mại để quản lý và nghe nội dung âm thanh cá nhân từ liên kết TikTok hoặc YouTube.',
  keywords: [
    'tiktok music',
    'youtube music',
    'nhac tiktok',
    'nghe nhac',
    'music player',
    'tikplay',
    'nhac tik tok',
    'phat nhac',
  ],
  authors: [{ name: 'TikPlay' }],
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    siteName: 'TikPlay',
    title: 'TikPlay — Nghe nhạc từ TikTok & YouTube',
    description:
      'Trình phát phi thương mại để quản lý và nghe nội dung âm thanh cá nhân.',
    images: [
      {
        url: '/icons/icon-512.png',
        width: 512,
        height: 512,
        alt: 'TikPlay',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TikPlay — Nghe nhạc từ TikTok & YouTube',
    description:
      'Trình phát phi thương mại để quản lý và nghe nội dung âm thanh cá nhân.',
    images: ['/icons/icon-512.png'],
  },
  robots: { index: true, follow: true },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TikPlay',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0a',
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'TikPlay',
      url: SITE_URL,
      description:
        'Trình phát phi thương mại để quản lý và nghe nội dung âm thanh cá nhân.',
      inLanguage: 'vi',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'TikPlay',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description:
        'Trình phát phi thương mại để quản lý và nghe nội dung âm thanh cá nhân.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="vi"
      className={`${montserrat.variable} ${hanken.variable} ${mono.variable}`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <PlaybackProvider>
          <ServiceWorkerRegister />
          {children}
          <TermsDialog />
        </PlaybackProvider>
      </body>
    </html>
  );
}
