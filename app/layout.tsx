import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, JetBrains_Mono, Montserrat } from 'next/font/google';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

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

export const metadata: Metadata = {
  title: 'TikPlay',
  description: 'Personal music player — extract & play audio from TikTok.',
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
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
