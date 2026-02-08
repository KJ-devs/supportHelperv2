export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex h-[calc(100vh-4rem)] flex-col">{children}</div>;
}
