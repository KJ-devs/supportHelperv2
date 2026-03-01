import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://supporthelper.io'),
  title: {
    default: 'Support Helper — AI-Powered Bug Resolution',
    template: '%s | Support Helper',
  },
  description:
    'Film the bug. AI finds the fix. Automatically. The AI-powered technical support platform that turns video bug reports into pull requests.',
  keywords: ['bug tracking', 'AI', 'developer tools', 'video bug reports', 'automated PR'],
  openGraph: {
    title: 'Support Helper — AI-Powered Bug Resolution',
    description: 'Film the bug. AI finds the fix. Automatically.',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Support Helper',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Support Helper — AI-Powered Bug Resolution',
    description: 'Film the bug. AI finds the fix. Automatically.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
