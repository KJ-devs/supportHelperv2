import './globals.css';
import { ReactNode } from 'react';
import { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { PostHogProvider } from '@/lib/monitoring/posthog';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Support Helper Dashboard',
  description: 'AI-powered technical support platform',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-gray-950">
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <PostHogProvider>
              <AuthProvider>
                <ToastProvider>{children}</ToastProvider>
              </AuthProvider>
            </PostHogProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
