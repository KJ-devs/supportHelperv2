import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Support Helper Dashboard',
    template: '%s | Support Helper',
  },
  description: 'AI-powered customer support platform dashboard',
  keywords: ['support', 'customer service', 'AI', 'dashboard'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
