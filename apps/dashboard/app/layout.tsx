import './globals.css';
import { ReactNode } from 'react';
import { Metadata } from 'next';
import { PostHogProvider } from '@/lib/monitoring/posthog';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/providers/theme-provider';

export const metadata: Metadata = {
  title: 'Support Helper Dashboard',
  description: 'AI-powered technical support platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-950">
        <ThemeProvider>
          <PostHogProvider>
            <AuthProvider>{children}</AuthProvider>
          </PostHogProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
