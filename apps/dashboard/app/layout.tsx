import './globals.css';
import { ReactNode } from 'react';
import { Metadata } from 'next';
import { PostHogProvider } from '@/lib/monitoring/posthog';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Support Helper Dashboard',
  description: 'AI-powered technical support platform',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50">
        <PostHogProvider>
          <AuthProvider>{children}</AuthProvider>
        </PostHogProvider>
      </body>
    </html>
  );
}
