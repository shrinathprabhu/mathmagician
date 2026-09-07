import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Mathmagician — Fast math. Sharp mind.',
  description:
    'Race the clock in five mental math modes. Play 10-second to 2-minute rounds, beat your personal best, and share your Mathmagician score. Works offline.',
  applicationName: 'Mathmagician',
  alternates: { canonical: 'https://lowkey.tools/mathmagician' },
  manifest: './manifest.webmanifest',
  icons: { icon: './icon.svg', apple: './icons/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mathmagician',
  },
  openGraph: {
    title: 'Mathmagician — Fast math. Sharp mind.',
    description: 'Small numbers. A ticking clock. How many can you solve?',
    url: 'https://mathmagician.lowkey.tools',
    type: 'website',
    siteName: 'Mathmagician',
  },
  twitter: {
    card: 'summary',
    title: 'Mathmagician — Fast math. Sharp mind.',
    description: 'Race the clock. Solve fast. Share your score.',
  },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111115',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
