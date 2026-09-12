import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SITE } from '@/lib/site-content';
import './globals.css';

const geistSans = localFont({
  src: './fonts/geist-10dc7658.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
});
const geistMono = localFont({
  src: './fonts/geist-mono-10dc7658.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  fallback: ['Consolas', 'monospace'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: SITE.title,
  description: SITE.description,
  applicationName: 'Mathmagician',
  authors: [{ name: SITE.creator.name, url: SITE.creator.url }],
  creator: SITE.creator.name,
  publisher: SITE.publisher.name,
  category: 'Games',
  alternates: { canonical: SITE.url },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/mathmagician.svg',
    apple: '/icons/mathmagician-apple-touch.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mathmagician',
  },
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    url: SITE.url,
    type: 'website',
    siteName: 'Mathmagician by Lowkey Tools',
    locale: 'en_US',
    images: [{ ...SITE.image, type: 'image/jpeg' }],
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@shrinath_prabhu',
    title: SITE.title,
    description: SITE.description,
    images: [{ url: SITE.image.url, alt: SITE.image.alt }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#111115',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <link
          rel="alternate"
          type="text/markdown"
          href={new URL('index.md', SITE.url).href}
          title="Mathmagician game guide in Markdown"
        />
        <link
          rel="describedby"
          href={new URL('llms.txt', SITE.url).href}
          type="text/plain"
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to the game
        </a>
        <noscript>
          <p className="no-script">
            Enable JavaScript to play Mathmagician. You can still read the game
            rules, modes, and FAQs below.
          </p>
        </noscript>
        {children}
      </body>
    </html>
  );
}
