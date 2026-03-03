'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Book,
  Code,
  Terminal,
  Zap,
  Shield,
  Database,
  GitBranch,
  Puzzle,
  Settings,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Menu,
  X,
  Cpu,
  Globe,
  Server,
  Layers,
  ArrowRight,
  Bot,
  BarChart3,
  Users,
  Activity,
  Search,
  Hash,
  Cloud,
  Lock,
  Bell,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Sidebar sections
// ---------------------------------------------------------------------------

interface NavSection {
  id: string;
  label: string;
  icon: React.ReactNode;
  subsections?: { id: string; label: string }[];
}

const NAV_SECTIONS: NavSection[] = [
  { id: 'introduction', label: 'Introduction', icon: <Book className="h-4 w-4" /> },
  {
    id: 'quick-start',
    label: 'Quick Start',
    icon: <Terminal className="h-4 w-4" />,
    subsections: [
      { id: 'prerequisites', label: 'Prerequisites' },
      { id: 'installation-steps', label: 'Installation' },
      { id: 'services', label: 'Services & Ports' },
    ],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    icon: <Layers className="h-4 w-4" />,
    subsections: [
      { id: 'components', label: 'Components' },
      { id: 'tech-stack', label: 'Tech Stack' },
    ],
  },
  {
    id: 'sdk',
    label: 'SDK Integration',
    icon: <Code className="h-4 w-4" />,
    subsections: [
      { id: 'sdk-install', label: 'Installation' },
      { id: 'sdk-web', label: 'Web Component' },
      { id: 'sdk-react', label: 'React' },
      { id: 'sdk-vue', label: 'Vue' },
      { id: 'sdk-options', label: 'Options' },
      { id: 'sdk-events', label: 'Events' },
      { id: 'sdk-offline', label: 'Offline Mode' },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: 'tickets',
    label: 'Tickets',
    icon: <FileText className="h-4 w-4" />,
    subsections: [
      { id: 'ticket-lifecycle', label: 'Lifecycle' },
      { id: 'ticket-severity', label: 'Severity & Types' },
      { id: 'ticket-ai', label: 'AI Fields' },
    ],
  },
  {
    id: 'ai-agent',
    label: 'AI Agent',
    icon: <Bot className="h-4 w-4" />,
    subsections: [
      { id: 'agent-pipeline', label: 'Pipeline' },
      { id: 'agent-modes', label: 'Agent Modes' },
    ],
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <Puzzle className="h-4 w-4" />,
    subsections: [
      { id: 'platform-integrations', label: 'Platforms' },
      { id: 'ai-providers', label: 'AI Providers (BYOK)' },
    ],
  },
  {
    id: 'api',
    label: 'API Reference',
    icon: <Server className="h-4 w-4" />,
    subsections: [
      { id: 'api-auth', label: 'Authentication' },
      { id: 'api-tickets', label: 'Tickets' },
      { id: 'api-sdk', label: 'SDK Endpoints' },
      { id: 'api-media', label: 'Media Upload' },
      { id: 'api-websocket', label: 'WebSocket' },
    ],
  },
  {
    id: 'configuration',
    label: 'Configuration',
    icon: <Settings className="h-4 w-4" />,
    subsections: [
      { id: 'env-vars', label: 'Environment Variables' },
      { id: 'plans', label: 'Plans' },
    ],
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
];

// ---------------------------------------------------------------------------
// Code block with copy button
// ---------------------------------------------------------------------------

function CodeBlock({
  code,
  language = 'bash',
  className,
}: {
  code: string;
  language?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  return (
    <div className={cn('group relative rounded-lg overflow-hidden', className)}>
      <div className="flex items-center justify-between bg-[#161b22] px-4 py-2 border-b border-white/10">
        <span className="text-xs font-medium text-gray-400">{language}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#0d1117] p-4 text-sm leading-relaxed">
        <code className="font-mono text-gray-300">{code}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

function SectionHeading({
  id,
  level = 2,
  children,
  className,
}: {
  id: string;
  level?: 2 | 3;
  children: React.ReactNode;
  className?: string;
}) {
  const Tag = `h${level}` as const;
  return (
    <Tag
      id={id}
      className={cn(
        'scroll-mt-20 font-bold text-foreground',
        level === 2 ? 'text-2xl mt-12 mb-4' : 'text-lg mt-8 mb-3',
        className
      )}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Collapsible (for env vars and troubleshooting)
// ---------------------------------------------------------------------------

function Collapsible({
  title,
  children,
  defaultOpen = false,
  titleClassName,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  titleClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-muted/50',
          open ? 'bg-muted/50' : 'bg-card',
          titleClassName
        )}
      >
        <span>{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {open && <div className="border-t border-border">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

function DocTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border my-4">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                'border-b border-border last:border-0',
                i % 2 === 0 ? 'bg-background' : 'bg-muted/20'
              )}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-foreground align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge / Pill
// ---------------------------------------------------------------------------

function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'red' | 'orange' | 'yellow' | 'blue' | 'green' | 'purple' | 'gray';
}) {
  const variants = {
    default: 'bg-primary/10 text-primary',
    red: 'bg-red-500/10 text-red-600',
    orange: 'bg-orange-500/10 text-orange-600',
    yellow: 'bg-yellow-500/10 text-yellow-700',
    blue: 'bg-blue-500/10 text-blue-600',
    green: 'bg-green-500/10 text-green-700',
    purple: 'bg-purple-500/10 text-purple-600',
    gray: 'bg-muted text-muted-foreground',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        variants[variant]
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline code
// ---------------------------------------------------------------------------

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction');
  const [mobileTocOpen, setMobileTocOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Collect all section IDs for the observer
  const allSectionIds = NAV_SECTIONS.flatMap((s) => [
    s.id,
    ...(s.subsections?.map((sub) => sub.id) ?? []),
  ]);

  useEffect(() => {
    const sectionEls = allSectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveSection(visible[0].target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    sectionEls.forEach((el) => observerRef.current?.observe(el));
    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
      setMobileTocOpen(false);
    }
  };

  // Determine which nav section is "active" (parent or child)
  const isActive = (id: string) => {
    if (activeSection === id) return true;
    const section = NAV_SECTIONS.find((s) => s.id === id);
    return section?.subsections?.some((sub) => sub.id === activeSection) ?? false;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile TOC toggle */}
      <div className="sticky top-16 z-40 border-b border-border bg-background/95 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTocOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
        >
          <span className="flex items-center gap-2">
            <Book className="h-4 w-4 text-primary" />
            Table of Contents
          </span>
          {mobileTocOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        {mobileTocOpen && (
          <nav className="border-t border-border bg-background px-4 pb-4 pt-2">
            {NAV_SECTIONS.map((section) => (
              <div key={section.id}>
                <button
                  onClick={() => scrollTo(section.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors',
                    isActive(section.id)
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {section.icon}
                  {section.label}
                </button>
                {section.subsections && isActive(section.id) && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {section.subsections.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => scrollTo(sub.id)}
                        className={cn(
                          'block w-full rounded px-2 py-1 text-left text-xs transition-colors',
                          activeSection === sub.id
                            ? 'text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-10 py-10">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-56 flex-shrink-0">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto scrollbar-thin pr-2">
              <nav className="space-y-1">
                {NAV_SECTIONS.map((section) => (
                  <div key={section.id}>
                    <button
                      onClick={() => scrollTo(section.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                        isActive(section.id)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      {section.icon}
                      {section.label}
                    </button>
                    {section.subsections && isActive(section.id) && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-3">
                        {section.subsections.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => scrollTo(sub.id)}
                            className={cn(
                              'block w-full rounded px-2 py-1 text-left text-xs transition-colors',
                              activeSection === sub.id
                                ? 'text-primary font-semibold'
                                : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0 flex-1">

            {/* ------------------------------------------------------------------ */}
            {/* INTRODUCTION */}
            {/* ------------------------------------------------------------------ */}

            <section id="introduction" className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Book className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Documentation</p>
                  <h1 className="text-3xl font-bold text-foreground">Support Helper</h1>
                </div>
              </div>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Support Helper is an <strong className="text-foreground">AI-powered bug resolution platform</strong> that
                eliminates the back-and-forth between users and engineering teams. Users capture bugs with a
                video widget — the AI analyzes the recording, understands the codebase, and generates a
                ready-to-merge pull request.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  {
                    icon: <Globe className="h-5 w-5 text-blue-500" />,
                    title: 'SDK Widget',
                    desc: 'Embeddable Web Component with video capture, offline queuing, and automatic context collection.',
                  },
                  {
                    icon: <BarChart3 className="h-5 w-5 text-purple-500" />,
                    title: 'Dashboard',
                    desc: 'Internal tool for triaging tickets, reviewing AI analysis, managing integrations and team members.',
                  },
                  {
                    icon: <Bot className="h-5 w-5 text-green-500" />,
                    title: 'AI Engine',
                    desc: 'Multi-provider AI (BYOK) for video analysis, codebase understanding, and automated fix generation.',
                  },
                  {
                    icon: <Cpu className="h-5 w-5 text-orange-500" />,
                    title: 'Background Worker',
                    desc: 'BullMQ-powered pipeline for video processing, GitHub sync, search indexing, and notifications.',
                  },
                ].map((card) => (
                  <div
                    key={card.title}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        {card.icon}
                      </div>
                      <h3 className="font-semibold text-foreground">{card.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{card.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* ------------------------------------------------------------------ */}
            {/* QUICK START */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="quick-start">Quick Start</SectionHeading>
            <p className="text-muted-foreground mb-6">
              Get Support Helper running locally in under 5 minutes.
            </p>

            <SectionHeading id="prerequisites" level={3}>Prerequisites</SectionHeading>
            <div className="flex flex-wrap gap-2 mb-6">
              {['Node.js >= 20', 'pnpm >= 8', 'Docker Desktop', 'Git'].map((req) => (
                <span
                  key={req}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm font-medium text-foreground"
                >
                  <Check className="h-3 w-3 text-green-500" />
                  {req}
                </span>
              ))}
            </div>

            <SectionHeading id="installation-steps" level={3}>Installation</SectionHeading>
            <div className="space-y-4">
              {[
                {
                  step: '1',
                  title: 'Clone & install dependencies',
                  code: `git clone https://github.com/KJ-devs/supportHelperv2.git\ncd supportHelperv2\npnpm install`,
                },
                {
                  step: '2',
                  title: 'Configure environment',
                  code: `cp .env.example .env.local\n# Edit .env.local with your API keys and secrets`,
                  lang: 'bash',
                },
                {
                  step: '3',
                  title: 'Start infrastructure',
                  code: `pnpm docker:up\n# Starts PostgreSQL, Redis, MinIO, MeiliSearch, MailHog`,
                },
                {
                  step: '4',
                  title: 'Setup database',
                  code: `pnpm db:migrate   # Apply Prisma migrations\npnpm db:seed      # Seed test data`,
                },
                {
                  step: '5',
                  title: 'Launch all services',
                  code: `pnpm dev\n# API :3001 | Dashboard :3000 | Web :3002`,
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="mb-2 font-medium text-foreground">{item.title}</p>
                    <CodeBlock code={item.code} language={item.lang ?? 'bash'} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <p className="text-sm font-medium text-green-700">Test credentials</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Email: <InlineCode>owner@test.local</InlineCode> &nbsp;/&nbsp; Password:{' '}
                <InlineCode>password123</InlineCode>
              </p>
            </div>

            <SectionHeading id="services" level={3}>Services & Ports</SectionHeading>
            <DocTable
              headers={['Service', 'Port', 'Description']}
              rows={[
                ['API (NestJS)', ':3001', 'REST API + WebSocket + Swagger at /api/docs'],
                ['Dashboard (Next.js)', ':3000', 'Internal dashboard for engineers'],
                ['Web (Next.js)', ':3002', 'Public marketing & docs site'],
                ['PostgreSQL', ':5432', 'Primary relational database'],
                ['Redis', ':6379', 'Job queue & caching'],
                ['MinIO', ':9000 / :9001', 'S3-compatible object storage (console: :9001)'],
                ['MeiliSearch', ':7700', 'Full-text search engine'],
                ['MailHog', ':8025 / :1025', 'Local email capture (UI: :8025)'],
              ]}
            />

            {/* ------------------------------------------------------------------ */}
            {/* ARCHITECTURE */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="architecture">Architecture</SectionHeading>
            <p className="text-muted-foreground mb-6">
              Support Helper is a monorepo with a clear separation of concerns between data ingestion
              (SDK), processing (API + Worker), and presentation (Dashboard).
            </p>

            {/* Architecture diagram */}
            <div id="components" className="scroll-mt-20 rounded-xl border border-border bg-card p-6 mb-8">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">Data Flow</p>
              <div className="flex flex-col items-center gap-3">
                {/* SDK Widget */}
                <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-5 py-3 w-full max-w-xs text-center">
                  <Globe className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">SDK Widget</p>
                    <p className="text-xs text-muted-foreground">Web Component / React / Vue</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                {/* API */}
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-5 py-3 w-full max-w-xs text-center">
                  <Server className="h-5 w-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">API (NestJS)</p>
                    <p className="text-xs text-muted-foreground">REST + WebSocket + Auth</p>
                  </div>
                </div>
                <div className="flex w-full max-w-lg items-center justify-center gap-4">
                  <div className="h-px flex-1 bg-border" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  <div className="h-px flex-1 bg-border" />
                </div>
                {/* Worker & Dashboard side by side */}
                <div className="flex w-full max-w-lg gap-4">
                  <div className="flex flex-1 items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3">
                    <Cpu className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground text-xs">Worker (BullMQ)</p>
                      <p className="text-xs text-muted-foreground">Video analysis, GitHub sync</p>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center gap-3 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3">
                    <BarChart3 className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-foreground text-xs">Dashboard</p>
                      <p className="text-xs text-muted-foreground">Next.js 14 internal app</p>
                    </div>
                  </div>
                </div>
                <div className="flex w-full max-w-lg items-center justify-center gap-4">
                  <div className="h-px flex-1 bg-border" />
                  <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                  <div className="h-px flex-1 bg-border" />
                </div>
                {/* Data stores */}
                <div className="flex w-full max-w-lg gap-2 flex-wrap justify-center">
                  {[
                    { icon: <Database className="h-3 w-3" />, label: 'PostgreSQL', color: 'text-sky-600' },
                    { icon: <Activity className="h-3 w-3" />, label: 'Redis', color: 'text-red-500' },
                    { icon: <Cloud className="h-3 w-3" />, label: 'MinIO (S3)', color: 'text-yellow-600' },
                    { icon: <Search className="h-3 w-3" />, label: 'MeiliSearch', color: 'text-pink-500' },
                  ].map((store) => (
                    <div
                      key={store.label}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium',
                        store.color
                      )}
                    >
                      {store.icon}
                      {store.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <SectionHeading id="tech-stack" level={3}>Tech Stack</SectionHeading>
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                'NestJS', 'Next.js 14', 'Prisma ORM', 'BullMQ', 'Socket.io',
                'PostgreSQL', 'Redis', 'MinIO', 'MeiliSearch', 'pgvector',
                'TanStack Query', 'TailwindCSS', 'TypeScript', 'pnpm workspaces',
              ].map((tech) => (
                <Badge key={tech} variant="gray">{tech}</Badge>
              ))}
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* SDK INTEGRATION */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="sdk">SDK Integration</SectionHeading>
            <p className="text-muted-foreground mb-6">
              The SDK widget is a self-contained Web Component that can be embedded in any web application.
              It captures video, collects browser context, and submits bug reports via the API.
            </p>

            <SectionHeading id="sdk-install" level={3}>Installation</SectionHeading>
            <p className="text-sm text-muted-foreground mb-3">Via npm (recommended for bundled apps):</p>
            <CodeBlock code="npm install @support-helper/sdk-web" language="bash" />
            <p className="text-sm text-muted-foreground mt-4 mb-3">Via CDN (drop-in for any HTML page):</p>
            <CodeBlock
              code={`<script src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@latest/dist/cdn/sdk.iife.js"></script>`}
              language="html"
            />

            <SectionHeading id="sdk-web" level={3}>Web Component</SectionHeading>
            <p className="text-sm text-muted-foreground mb-3">
              Add the custom element anywhere in your HTML. No framework required.
            </p>
            <CodeBlock
              code={`<support-helper
  sdk-key="sk_live_your_key_here"
  api-url="https://api.example.com"
  position="bottom-right"
  primary-color="#6366f1"
  theme="auto"
></support-helper>`}
              language="html"
            />

            <SectionHeading id="sdk-react" level={3}>React Integration</SectionHeading>
            <CodeBlock
              code={`import { SupportHelperWidget } from '@support-helper/sdk-web/react';

function App() {
  return (
    <SupportHelperWidget
      sdkKey="sk_live_your_key_here"
      apiUrl="https://api.example.com"
      onSubmit={(e) => console.log('Ticket created:', e.detail.ticketId)}
    />
  );
}`}
              language="jsx"
            />

            <SectionHeading id="sdk-vue" level={3}>Vue Integration</SectionHeading>
            <CodeBlock
              code={`<template>
  <SupportHelperWidget
    sdk-key="sk_live_your_key_here"
    api-url="https://api.example.com"
    @submit="onSubmit"
  />
</template>

<script setup>
import { SupportHelperWidget } from '@support-helper/sdk-web/vue';

function onSubmit(event) {
  console.log('Ticket:', event.detail.ticketId);
}
</script>`}
              language="vue"
            />

            <SectionHeading id="sdk-options" level={3}>Configuration Options</SectionHeading>
            <DocTable
              headers={['Attribute', 'Type', 'Default', 'Description']}
              rows={[
                [<InlineCode key="k">sdk-key</InlineCode>, 'string', '—', 'Required. SDK key from dashboard Applications settings.'],
                [<InlineCode key="u">api-url</InlineCode>, 'string', '—', 'Required. Your API endpoint URL.'],
                [<InlineCode key="p">position</InlineCode>, 'string', 'bottom-right', 'Widget position: bottom-right, bottom-left, top-right, top-left.'],
                [<InlineCode key="c">primary-color</InlineCode>, 'string', '#6366f1', 'Accent color as a hex value.'],
                [<InlineCode key="t">theme</InlineCode>, 'string', 'auto', 'light | dark | auto (follows system preference).'],
                [<InlineCode key="z">z-index</InlineCode>, 'number', '99999', 'CSS z-index for the widget container.'],
                [<InlineCode key="l">locale</InlineCode>, 'string', 'en', 'UI language (en, fr, de, es).'],
                [<InlineCode key="h">hide-branding</InlineCode>, 'boolean', 'false', 'Hide "Powered by Support Helper" branding (Pro+).'],
              ]}
            />

            <SectionHeading id="sdk-events" level={3}>Events</SectionHeading>
            <p className="text-sm text-muted-foreground mb-3">
              All events are dispatched on the widget element and bubble up to the document.
            </p>
            <DocTable
              headers={['Event', 'Detail', 'Description']}
              rows={[
                [<InlineCode key="o">sh:open</InlineCode>, '—', 'Widget was opened by the user.'],
                [<InlineCode key="c">sh:close</InlineCode>, '—', 'Widget was closed.'],
                [<InlineCode key="rs">sh:recording-start</InlineCode>, '—', 'Screen recording started.'],
                [<InlineCode key="rp">sh:recording-stop</InlineCode>, '{ duration, size }', 'Recording finished; includes duration in ms and file size in bytes.'],
                [<InlineCode key="s">sh:submit</InlineCode>, '{ ticketId, aiAnalysis? }', 'Bug report submitted successfully.'],
                [<InlineCode key="e">sh:error</InlineCode>, '{ message }', 'An error occurred during submission.'],
                [<InlineCode key="q">sh:queued</InlineCode>, '{ reason }', 'Report saved offline (no connectivity).'],
              ]}
            />

            <SectionHeading id="sdk-offline" level={3}>Offline Mode</SectionHeading>
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                The widget automatically detects connectivity loss and stores pending reports in{' '}
                <InlineCode>IndexedDB</InlineCode>. Reports are flushed automatically when the
                connection is restored. The queue supports up to{' '}
                <strong className="text-foreground">50 pending reports</strong> and a maximum of{' '}
                <strong className="text-foreground">500 MB</strong> of stored video data. Reports
                beyond these limits are dropped and a <InlineCode>sh:error</InlineCode> event is
                dispatched.
              </p>
              <CodeBlock
                code={`widget.addEventListener('sh:queued', (e) => {
  console.log('Saved offline, reason:', e.detail.reason);
  // reason: 'offline' | 'queue_full' | 'storage_exceeded'
});`}
                language="javascript"
                className="mt-4"
              />
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* DASHBOARD */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="dashboard">Dashboard</SectionHeading>
            <p className="text-muted-foreground mb-6">
              The internal dashboard provides a complete interface for managing support tickets, reviewing
              AI analysis, and configuring your team.
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: <FileText className="h-5 w-5 text-blue-500" />,
                  title: 'Ticket Management',
                  desc: 'Filter, search, bulk operations. Update status, severity, assignee across multiple tickets at once.',
                },
                {
                  icon: <Bot className="h-5 w-5 text-green-500" />,
                  title: 'AI Analysis',
                  desc: 'Automatic classification, severity detection, keyword extraction, and type confidence scoring.',
                },
                {
                  icon: <Activity className="h-5 w-5 text-purple-500" />,
                  title: 'Real-time Updates',
                  desc: 'WebSocket-powered live ticket updates. No refresh needed as tickets move through the pipeline.',
                },
                {
                  icon: <BarChart3 className="h-5 w-5 text-orange-500" />,
                  title: 'Analytics',
                  desc: 'Trend charts, resolution rates, AI performance metrics, and team productivity dashboards.',
                },
                {
                  icon: <Users className="h-5 w-5 text-pink-500" />,
                  title: 'Team Management',
                  desc: 'Role-based access control: owner > admin > member > viewer. Invite members via email.',
                },
                {
                  icon: <Globe className="h-5 w-5 text-sky-500" />,
                  title: 'SDK Demo',
                  desc: 'Test the widget directly in the dashboard before embedding it in your application.',
                },
              ].map((card) => (
                <div key={card.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted mb-3">
                    {card.icon}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">{card.title}</h3>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
              ))}
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* TICKETS */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="tickets">Tickets</SectionHeading>
            <p className="text-muted-foreground mb-6">
              Tickets are the core entity of Support Helper. They track the full lifecycle of a bug report
              from submission through AI analysis to resolution.
            </p>

            <SectionHeading id="ticket-lifecycle" level={3}>Ticket Lifecycle</SectionHeading>
            <div className="overflow-x-auto pb-2">
              <div className="flex items-center gap-1 min-w-max flex-wrap">
                {[
                  { status: 'new', color: 'bg-gray-100 text-gray-700 border-gray-200' },
                  { status: 'open', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                  { status: 'in_progress', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                  { status: 'analyzing', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                  { status: 'analyzed', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
                  { status: 'triaged', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                  { status: 'fix_proposed', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                  { status: 'resolved', color: 'bg-green-50 text-green-700 border-green-200' },
                  { status: 'merged', color: 'bg-green-100 text-green-800 border-green-300' },
                  { status: 'closed', color: 'bg-gray-200 text-gray-600 border-gray-300' },
                ].map((item, i, arr) => (
                  <div key={item.status} className="flex items-center gap-1">
                    <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', item.color)}>
                      {item.status}
                    </span>
                    {i < arr.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <SectionHeading id="ticket-severity" level={3}>Severity & Types</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Severity Levels</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="red">critical</Badge>
                    <span className="text-xs text-muted-foreground">Production down, data loss risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="orange">high</Badge>
                    <span className="text-xs text-muted-foreground">Major feature broken</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="yellow">medium</Badge>
                    <span className="text-xs text-muted-foreground">Feature degraded, workaround exists</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="blue">low</Badge>
                    <span className="text-xs text-muted-foreground">Minor issue, cosmetic</span>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Ticket Types</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="red">bug</Badge>
                  <Badge variant="blue">feature_request</Badge>
                  <Badge variant="gray">question</Badge>
                  <Badge variant="gray">documentation</Badge>
                  <Badge variant="orange">performance</Badge>
                  <Badge variant="purple">security</Badge>
                </div>
              </div>
            </div>

            <SectionHeading id="ticket-ai" level={3}>AI Fields</SectionHeading>
            <DocTable
              headers={['Field', 'Type', 'Description']}
              rows={[
                [<InlineCode key="as">aiSummary</InlineCode>, 'string?', 'Human-readable summary generated from video analysis.'],
                [<InlineCode key="aa">aiAnalysis</InlineCode>, 'JSON?', 'Full structured analysis including affected components and suggested approach.'],
                [<InlineCode key="k">keywords</InlineCode>, 'string[]', 'Extracted keywords for search indexing and similarity matching.'],
                [<InlineCode key="tc">typeConfidence</InlineCode>, 'float?', 'Confidence score (0-1) for the AI-assigned ticket type.'],
                [<InlineCode key="sc">severityConfidence</InlineCode>, 'float?', 'Confidence score (0-1) for the AI-assigned severity level.'],
                [<InlineCode key="d">diagnosis</InlineCode>, 'string?', 'Deep analysis diagnosis after codebase vector search (Pro+).'],
              ]}
            />
            <p className="text-sm text-muted-foreground mt-2">
              Bulk operations available: update status, assign to team member, change priority/severity, and delete (with confirmation).
            </p>

            {/* ------------------------------------------------------------------ */}
            {/* AI AGENT */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="ai-agent">AI Agent</SectionHeading>
            <p className="text-muted-foreground mb-6">
              The AI Agent goes beyond analysis — it reads your codebase, generates a fix, and can open
              a Pull Request automatically. Each step requires explicit human approval (configurable).
            </p>

            <SectionHeading id="agent-pipeline" level={3}>4-Step Pipeline</SectionHeading>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {[
                {
                  step: '1',
                  icon: <Search className="h-5 w-5 text-blue-500" />,
                  title: 'Analyze',
                  desc: 'AI examines the ticket, video, and relevant source files via vector similarity search.',
                  color: 'border-blue-500/20 bg-blue-500/5',
                },
                {
                  step: '2',
                  icon: <FileText className="h-5 w-5 text-yellow-500" />,
                  title: 'Plan',
                  desc: 'Generates a structured action plan. Team reviews and approves before proceeding.',
                  color: 'border-yellow-500/20 bg-yellow-500/5',
                },
                {
                  step: '3',
                  icon: <Code className="h-5 w-5 text-green-500" />,
                  title: 'Code',
                  desc: 'Generates patch/diff for the fix. Engineers review the actual code changes.',
                  color: 'border-green-500/20 bg-green-500/5',
                },
                {
                  step: '4',
                  icon: <GitBranch className="h-5 w-5 text-purple-500" />,
                  title: 'PR',
                  desc: 'Creates a GitHub Pull Request with the fix, linked to the ticket for traceability.',
                  color: 'border-purple-500/20 bg-purple-500/5',
                },
              ].map((item) => (
                <div key={item.step} className={cn('rounded-xl border p-4', item.color)}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-xs font-bold text-foreground">
                      {item.step}
                    </span>
                    {item.icon}
                    <span className="font-semibold text-foreground text-sm">{item.title}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>

            <SectionHeading id="agent-modes" level={3}>Agent Modes</SectionHeading>
            <DocTable
              headers={['Mode', 'Description', 'Human Reviews']}
              rows={[
                ['Fully Autonomous', 'Agent completes all 4 steps without stopping.', 'Final PR only'],
                ['Review Plan', 'Agent pauses after Step 2 for plan approval.', 'Plan + PR'],
                ['Review All', 'Agent pauses after every step.', 'Plan + Code + PR'],
              ]}
            />

            {/* ------------------------------------------------------------------ */}
            {/* INTEGRATIONS */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="integrations">Integrations</SectionHeading>
            <p className="text-muted-foreground mb-6">
              Connect Support Helper to your existing tools. All third-party credentials are encrypted
              at rest using AES-256-GCM.
            </p>

            <SectionHeading id="platform-integrations" level={3}>Platform Integrations</SectionHeading>
            <div className="space-y-3 mb-6">
              {[
                {
                  icon: <GitBranch className="h-5 w-5" />,
                  name: 'GitHub',
                  badge: 'OAuth + App',
                  desc: 'OAuth authentication, GitHub App installation for repository access. Bidirectional issue sync. AI Agent creates Pull Requests automatically.',
                  color: 'text-gray-700',
                },
                {
                  icon: <Hash className="h-5 w-5" />,
                  name: 'Jira',
                  badge: 'Sync',
                  desc: 'Bidirectional ticket sync. Support Helper tickets automatically mirror to Jira issues and status updates flow back.',
                  color: 'text-blue-600',
                },
                {
                  icon: <Bell className="h-5 w-5" />,
                  name: 'Slack',
                  badge: 'Notifications',
                  desc: 'Post notifications to channels when tickets are created, analyzed, or resolved. Mention specific users for critical bugs.',
                  color: 'text-purple-600',
                },
                {
                  icon: <Users className="h-5 w-5" />,
                  name: 'HubSpot',
                  badge: 'CRM',
                  desc: 'Sync tickets with HubSpot contacts and deals. Link bug reports to customer records for better context.',
                  color: 'text-orange-600',
                },
                {
                  icon: <FileText className="h-5 w-5" />,
                  name: 'Notion',
                  badge: 'Docs',
                  desc: 'Sync resolved tickets and post-mortems to Notion databases. Build your institutional knowledge base automatically.',
                  color: 'text-gray-600',
                },
              ].map((item) => (
                <div key={item.name} className="flex gap-4 rounded-lg border border-border bg-card p-4">
                  <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted', item.color)}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-foreground text-sm">{item.name}</span>
                      <Badge variant="gray">{item.badge}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <SectionHeading id="ai-providers" level={3}>AI Providers (BYOK)</SectionHeading>
            <p className="text-sm text-muted-foreground mb-3">
              Bring Your Own Key (BYOK) lets you connect your AI provider. Your prompts and data go
              directly to your provider — Support Helper never stores them.
            </p>
            <DocTable
              headers={['Provider', 'Models', 'Best For']}
              rows={[
                ['Anthropic', 'Claude 3.5 Sonnet, Claude 3 Opus', 'Deep code analysis, fix generation'],
                ['OpenAI', 'GPT-4o, GPT-4, GPT-4 Turbo', 'Analysis, embeddings, vision'],
                ['Google', 'Gemini Pro, Gemini Flash', 'Fast triage, cost-efficient'],
                ['AWS Bedrock', 'Claude, Titan, Llama', 'Enterprise, data residency requirements'],
                ['Ollama', 'Any local model (Llama 3, Mistral…)', 'Self-hosted, air-gapped environments'],
              ]}
            />

            {/* ------------------------------------------------------------------ */}
            {/* API REFERENCE */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="api">API Reference</SectionHeading>
            <p className="text-muted-foreground mb-4">
              The REST API is documented interactively at{' '}
              <a
                href="http://localhost:3001/api/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                localhost:3001/api/docs
              </a>{' '}
              (Swagger UI). All endpoints use the <InlineCode>/api</InlineCode> prefix.
            </p>

            <SectionHeading id="api-auth" level={3}>Authentication</SectionHeading>
            <DocTable
              headers={['Method', 'Endpoint', 'Description']}
              rows={[
                ['POST', '/api/auth/login', 'Login with email + password. Returns access + refresh tokens.'],
                ['POST', '/api/auth/register', 'Register a new account. Returns tokens.'],
                ['POST', '/api/auth/refresh', 'Exchange refresh token for a new access token.'],
                ['GET', '/api/auth/me', 'Get current authenticated user profile.'],
                ['POST', '/api/auth/logout', 'Invalidate current refresh token.'],
              ]}
            />
            <CodeBlock
              code={`# All dashboard endpoints require Bearer token
curl -H "Authorization: Bearer <access_token>" \\
  https://api.example.com/api/tickets`}
              language="bash"
              className="mt-3"
            />

            <SectionHeading id="api-tickets" level={3}>Tickets</SectionHeading>
            <DocTable
              headers={['Method', 'Endpoint', 'Description']}
              rows={[
                ['GET', '/api/tickets', 'List tickets with filtering, sorting, pagination.'],
                ['POST', '/api/tickets', 'Create a ticket manually.'],
                ['GET', '/api/tickets/:id', 'Get ticket detail with AI analysis and media.'],
                ['PATCH', '/api/tickets/:id', 'Update ticket fields (status, assignee, severity…).'],
                ['DELETE', '/api/tickets/:id', 'Delete a ticket.'],
                ['POST', '/api/tickets/bulk', 'Bulk update or delete tickets.'],
                ['GET', '/api/tickets/search', 'Full-text search via MeiliSearch.'],
                ['POST', '/api/tickets/:id/analyze', 'Trigger AI analysis for a ticket.'],
              ]}
            />

            <SectionHeading id="api-sdk" level={3}>SDK Endpoints</SectionHeading>
            <p className="text-sm text-muted-foreground mb-3">
              SDK endpoints use an <InlineCode>x-sdk-key</InlineCode> header instead of Bearer token.
            </p>
            <DocTable
              headers={['Method', 'Endpoint', 'Description']}
              rows={[
                ['POST', '/api/sdk/tickets/report', 'Submit a bug report (multipart FormData with video).'],
                ['GET', '/api/sdk/tickets/:id', 'Get ticket status (for SDK polling after submission).'],
                ['GET', '/api/sdk/applications/config', 'Get widget configuration for an SDK key.'],
              ]}
            />

            <SectionHeading id="api-media" level={3}>Media Upload Flow</SectionHeading>
            <p className="text-sm text-muted-foreground mb-3">
              Direct-to-S3 upload in 3 steps:
            </p>
            <div className="space-y-3">
              {[
                {
                  step: '1',
                  title: 'Request a pre-signed URL',
                  code: `POST /api/media/presigned-url
{ "filename": "recording.webm", "contentType": "video/webm" }

# Response
{ "mediaId": "uuid", "uploadUrl": "https://s3.../...", "storageKey": "..." }`,
                },
                {
                  step: '2',
                  title: 'Upload directly to S3/MinIO',
                  code: `PUT <uploadUrl>
Content-Type: video/webm
# Body: raw file bytes (NO Authorization header)`,
                },
                {
                  step: '3',
                  title: 'Confirm the upload',
                  code: `POST /api/media/complete
{ "mediaId": "uuid", "storageKey": "..." }

# Response
{ "mediaId": "uuid", "storageKey": "...", "status": "pending" }`,
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-1.5">{item.title}</p>
                    <CodeBlock code={item.code} language="bash" />
                  </div>
                </div>
              ))}
            </div>

            <SectionHeading id="api-websocket" level={3}>WebSocket</SectionHeading>
            <p className="text-sm text-muted-foreground mb-3">
              Connect via Socket.io to <InlineCode>ws://localhost:3001</InlineCode> with a Bearer token.
            </p>
            <DocTable
              headers={['Namespace', 'Key Events', 'Description']}
              rows={[
                ['/tickets', 'ticket:created, ticket:updated, ticket:deleted', 'Real-time ticket updates for the dashboard list.'],
                ['/agent', 'agent:message, agent:step, agent:complete', 'Agent pipeline progress messages.'],
                ['/agent-tasks', 'task:started, task:completed, task:failed', 'Background task status updates.'],
              ]}
            />

            {/* ------------------------------------------------------------------ */}
            {/* CONFIGURATION */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="configuration">Configuration</SectionHeading>
            <p className="text-muted-foreground mb-6">
              All configuration is via environment variables in <InlineCode>.env.local</InlineCode>.
            </p>

            <SectionHeading id="env-vars" level={3}>Environment Variables</SectionHeading>
            <div className="space-y-3">
              <Collapsible
                title={<span className="flex items-center gap-2"><Database className="h-4 w-4 text-sky-500" /> Database & Cache</span>}
                defaultOpen
              >
                <div className="p-4 space-y-2">
                  <DocTable
                    headers={['Variable', 'Required', 'Description']}
                    rows={[
                      [<InlineCode key="1">DATABASE_URL</InlineCode>, <Badge key="r" variant="red">required</Badge>, 'PostgreSQL connection string.'],
                      [<InlineCode key="2">REDIS_URL</InlineCode>, <Badge key="r2" variant="red">required</Badge>, 'Redis connection string for BullMQ.'],
                      [<InlineCode key="3">MEILISEARCH_HOST</InlineCode>, <Badge key="o" variant="gray">optional</Badge>, 'MeiliSearch host URL.'],
                      [<InlineCode key="4">MEILISEARCH_MASTER_KEY</InlineCode>, <Badge key="o2" variant="gray">optional</Badge>, 'MeiliSearch master key.'],
                    ]}
                  />
                </div>
              </Collapsible>

              <Collapsible
                title={<span className="flex items-center gap-2"><Lock className="h-4 w-4 text-green-500" /> Authentication</span>}
              >
                <div className="p-4 space-y-2">
                  <DocTable
                    headers={['Variable', 'Required', 'Description']}
                    rows={[
                      [<InlineCode key="1">JWT_SECRET</InlineCode>, <Badge key="r" variant="red">required</Badge>, 'JWT signing secret. Generate: openssl rand -hex 32'],
                      [<InlineCode key="2">JWT_REFRESH_SECRET</InlineCode>, <Badge key="r2" variant="red">required</Badge>, 'Refresh token signing secret.'],
                      [<InlineCode key="3">JWT_EXPIRES_IN</InlineCode>, <Badge key="o" variant="gray">optional</Badge>, 'Access token TTL (default: 15m).'],
                      [<InlineCode key="4">JWT_REFRESH_EXPIRES_IN</InlineCode>, <Badge key="o2" variant="gray">optional</Badge>, 'Refresh token TTL (default: 7d).'],
                    ]}
                  />
                </div>
              </Collapsible>

              <Collapsible
                title={<span className="flex items-center gap-2"><Bot className="h-4 w-4 text-purple-500" /> AI Providers</span>}
              >
                <div className="p-4 space-y-2">
                  <DocTable
                    headers={['Variable', 'Required', 'Description']}
                    rows={[
                      [<InlineCode key="1">ANTHROPIC_API_KEY</InlineCode>, <Badge key="o" variant="gray">optional</Badge>, 'Anthropic Claude API key (BYOK).'],
                      [<InlineCode key="2">OPENAI_API_KEY</InlineCode>, <Badge key="o2" variant="gray">optional</Badge>, 'OpenAI API key (BYOK).'],
                      [<InlineCode key="3">GOOGLE_AI_API_KEY</InlineCode>, <Badge key="o3" variant="gray">optional</Badge>, 'Google Gemini API key.'],
                      [<InlineCode key="4">EMBEDDING_MODEL</InlineCode>, <Badge key="o4" variant="gray">optional</Badge>, 'Embedding model for codebase search (default: text-embedding-3-small).'],
                    ]}
                  />
                </div>
              </Collapsible>

              <Collapsible
                title={<span className="flex items-center gap-2"><Cloud className="h-4 w-4 text-yellow-500" /> Storage (S3 / MinIO)</span>}
              >
                <div className="p-4 space-y-2">
                  <DocTable
                    headers={['Variable', 'Required', 'Description']}
                    rows={[
                      [<InlineCode key="1">S3_ENDPOINT</InlineCode>, <Badge key="r" variant="red">required</Badge>, 'S3-compatible endpoint (e.g., http://localhost:9000 for MinIO).'],
                      [<InlineCode key="2">S3_ACCESS_KEY_ID</InlineCode>, <Badge key="r2" variant="red">required</Badge>, 'S3 access key ID.'],
                      [<InlineCode key="3">S3_SECRET_ACCESS_KEY</InlineCode>, <Badge key="r3" variant="red">required</Badge>, 'S3 secret access key.'],
                      [<InlineCode key="4">S3_BUCKET</InlineCode>, <Badge key="r4" variant="red">required</Badge>, 'S3 bucket name.'],
                      [<InlineCode key="5">S3_REGION</InlineCode>, <Badge key="o" variant="gray">optional</Badge>, 'S3 region (default: us-east-1).'],
                    ]}
                  />
                </div>
              </Collapsible>

              <Collapsible
                title={<span className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-gray-600" /> GitHub</span>}
              >
                <div className="p-4 space-y-2">
                  <DocTable
                    headers={['Variable', 'Required', 'Description']}
                    rows={[
                      [<InlineCode key="1">GITHUB_APP_ID</InlineCode>, <Badge key="o" variant="gray">optional</Badge>, 'GitHub App ID for AI Agent PR creation.'],
                      [<InlineCode key="2">GITHUB_PRIVATE_KEY</InlineCode>, <Badge key="o2" variant="gray">optional</Badge>, 'GitHub App private key (PEM format, newlines as \\n).'],
                      [<InlineCode key="3">GITHUB_CLIENT_ID</InlineCode>, <Badge key="o3" variant="gray">optional</Badge>, 'GitHub OAuth App Client ID.'],
                      [<InlineCode key="4">GITHUB_CLIENT_SECRET</InlineCode>, <Badge key="o4" variant="gray">optional</Badge>, 'GitHub OAuth App Client Secret.'],
                    ]}
                  />
                </div>
              </Collapsible>

              <Collapsible
                title={<span className="flex items-center gap-2"><Shield className="h-4 w-4 text-orange-500" /> Billing (Stripe)</span>}
              >
                <div className="p-4 space-y-2">
                  <DocTable
                    headers={['Variable', 'Required', 'Description']}
                    rows={[
                      [<InlineCode key="1">STRIPE_SECRET_KEY</InlineCode>, <Badge key="o" variant="gray">optional</Badge>, 'Stripe secret key for billing.'],
                      [<InlineCode key="2">STRIPE_WEBHOOK_SECRET</InlineCode>, <Badge key="o2" variant="gray">optional</Badge>, 'Stripe webhook signing secret.'],
                      [<InlineCode key="3">STRIPE_PRO_PRICE_ID</InlineCode>, <Badge key="o3" variant="gray">optional</Badge>, 'Stripe price ID for Pro plan.'],
                      [<InlineCode key="4">STRIPE_ENTERPRISE_PRICE_ID</InlineCode>, <Badge key="o4" variant="gray">optional</Badge>, 'Stripe price ID for Enterprise plan.'],
                    ]}
                  />
                </div>
              </Collapsible>

              <Collapsible
                title={<span className="flex items-center gap-2"><Activity className="h-4 w-4 text-red-500" /> Monitoring</span>}
              >
                <div className="p-4 space-y-2">
                  <DocTable
                    headers={['Variable', 'Required', 'Description']}
                    rows={[
                      [<InlineCode key="1">SENTRY_DSN</InlineCode>, <Badge key="o" variant="gray">optional</Badge>, 'Sentry DSN for error tracking.'],
                      [<InlineCode key="2">POSTHOG_API_KEY</InlineCode>, <Badge key="o2" variant="gray">optional</Badge>, 'PostHog API key for product analytics.'],
                      [<InlineCode key="3">BETTERSTACK_SOURCE_TOKEN</InlineCode>, <Badge key="o3" variant="gray">optional</Badge>, 'BetterStack log aggregation token.'],
                      [<InlineCode key="4">LOG_LEVEL</InlineCode>, <Badge key="o4" variant="gray">optional</Badge>, 'Logging level: debug | info | warn | error (default: info).'],
                    ]}
                  />
                </div>
              </Collapsible>
            </div>

            <SectionHeading id="plans" level={3}>Plans</SectionHeading>
            <DocTable
              headers={['Feature', 'Free', 'Pro ($79/mo)', 'Enterprise ($249/mo)']}
              rows={[
                ['AI Analyses', '5/month', 'Unlimited (BYOK)', 'Unlimited'],
                ['Applications', '1', 'Unlimited', 'Unlimited'],
                ['Video Analysis', <Badge key="y1" variant="green">Yes</Badge>, <Badge key="y2" variant="green">Yes</Badge>, <Badge key="y3" variant="green">Yes</Badge>],
                ['Deep Code Analysis', <Badge key="n1" variant="gray">No</Badge>, <Badge key="y4" variant="green">Yes</Badge>, <Badge key="y5" variant="green">Yes</Badge>],
                ['Auto-fix PRs', <Badge key="n2" variant="gray">No</Badge>, <Badge key="y6" variant="green">Yes</Badge>, <Badge key="y7" variant="green">Yes</Badge>],
                ['Custom Integrations', <Badge key="n3" variant="gray">No</Badge>, <Badge key="y8" variant="green">Yes</Badge>, <Badge key="y9" variant="green">Yes</Badge>],
                ['SSO / SAML', <Badge key="n4" variant="gray">No</Badge>, <Badge key="n5" variant="gray">No</Badge>, <Badge key="y10" variant="green">Yes</Badge>],
                ['Audit Logs', <Badge key="n6" variant="gray">No</Badge>, <Badge key="n7" variant="gray">No</Badge>, <Badge key="y11" variant="green">Yes</Badge>],
                ['Support', 'Community', 'Email & chat', 'Priority + SLA'],
              ]}
            />

            {/* ------------------------------------------------------------------ */}
            {/* TROUBLESHOOTING */}
            {/* ------------------------------------------------------------------ */}

            <SectionHeading id="troubleshooting">Troubleshooting</SectionHeading>
            <p className="text-muted-foreground mb-6">
              Common issues and their solutions. Click any item to expand.
            </p>

            <div className="space-y-2">
              {[
                {
                  title: '"Prisma client not generated" error',
                  solution: (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">
                        After editing the Prisma schema or pulling new changes, regenerate the client:
                      </p>
                      <CodeBlock code="pnpm db:generate" language="bash" />
                      <p className="text-xs text-muted-foreground mt-2">
                        This generates the client for both <InlineCode>apps/api</InlineCode> and{' '}
                        <InlineCode>apps/worker</InlineCode> (worker uses a path alias to the API schema).
                      </p>
                    </>
                  ),
                },
                {
                  title: '"Port already in use" / EADDRINUSE',
                  solution: (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">Kill all Node.js processes:</p>
                      <CodeBlock code={`# macOS / Linux\npkill -f node\n\n# Windows\ntaskkill /F /IM node.exe`} language="bash" />
                      <p className="text-xs text-muted-foreground mt-2">
                        Then restart with <InlineCode>pnpm dev</InlineCode>.
                      </p>
                    </>
                  ),
                },
                {
                  title: 'CORS errors in browser',
                  solution: (
                    <p className="text-sm text-muted-foreground">
                      Ensure <InlineCode>DASHBOARD_URL</InlineCode> in <InlineCode>.env.local</InlineCode>{' '}
                      matches the exact origin of your dashboard (e.g., <InlineCode>http://localhost:3000</InlineCode>).
                      The API uses this value to configure allowed CORS origins. Restart the API after changing it.
                    </p>
                  ),
                },
                {
                  title: 'SDK widget not rendering / appearing',
                  solution: (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">
                        The CDN IIFE bundle must be built separately from the main SDK build:
                      </p>
                      <CodeBlock code="pnpm --filter @support-helper/sdk-web build:cdn" language="bash" />
                      <p className="text-xs text-muted-foreground mt-2">
                        Verify that <InlineCode>packages/sdk-web/dist/cdn/sdk.iife.js</InlineCode> exists
                        after the build completes.
                      </p>
                    </>
                  ),
                },
                {
                  title: 'Video analysis failing or stuck at "analyzing"',
                  solution: (
                    <p className="text-sm text-muted-foreground">
                      Check that your AI provider API key is configured correctly. For the Starter tier,
                      ensure <InlineCode>GOOGLE_AI_API_KEY</InlineCode> is set. For Pro/Enterprise, verify
                      the BYOK key in dashboard Settings → AI Provider. Check worker logs for specific
                      error messages: <InlineCode>pnpm --filter @support-helper/worker dev</InlineCode>.
                    </p>
                  ),
                },
                {
                  title: 'GitHub App JWT authentication fails',
                  solution: (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">
                        The private key must be in PEM format with literal newline characters encoded as{' '}
                        <InlineCode>\n</InlineCode> in the env var. Convert it:
                      </p>
                      <CodeBlock
                        code={`# Convert PEM file to single-line env var value\nawk 'NF {sub(/\\r/, ""); printf "%s\\\\n",$0;}' private-key.pem`}
                        language="bash"
                      />
                    </>
                  ),
                },
                {
                  title: 'Integration encryption error',
                  solution: (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">
                        The <InlineCode>INTEGRATION_ENCRYPTION_KEY</InlineCode> must be exactly 64 hex
                        characters (32 bytes). Generate one:
                      </p>
                      <CodeBlock code="openssl rand -hex 32" language="bash" />
                    </>
                  ),
                },
                {
                  title: 'Build fails unexpectedly',
                  solution: (
                    <>
                      <p className="text-sm text-muted-foreground mb-3">
                        Clear Turborepo cache and reinstall dependencies:
                      </p>
                      <CodeBlock code="pnpm clean && pnpm install && pnpm build" language="bash" />
                    </>
                  ),
                },
              ].map((item, i) => (
                <Collapsible
                  key={i}
                  title={
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <span className="text-foreground">{item.title}</span>
                    </span>
                  }
                >
                  <div className="p-4">{item.solution}</div>
                </Collapsible>
              ))}
            </div>

            {/* Footer CTA */}
            <div className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
              <Zap className="mx-auto h-8 w-8 text-primary mb-3" />
              <h2 className="text-xl font-bold text-foreground mb-2">Ready to get started?</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Deploy Support Helper in minutes and start resolving bugs with AI.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={`${process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000'}/signup`}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
                >
                  Start for Free
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  href="/pricing"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  View Pricing
                </Link>
              </div>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
