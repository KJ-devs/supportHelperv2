import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Track Your Ticket',
    template: '%s | Support Helper',
  },
  description: 'Track the status of your support ticket',
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background to-muted">
      <main className="flex-1 flex items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
        Powered by Support Helper
      </footer>
    </div>
  );
}
