import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Code2,
  Video,
  Brain,
  GitPullRequest,
  Film,
  Search,
  Building2,
  KeyRound,
  BarChart3,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { NavBar } from '@/components/marketing/nav-bar';
import { Footer } from '@/components/marketing/footer';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  title: 'AI-Powered Bug Resolution — Support Helper',
  description:
    'Film the bug. AI finds the fix. Automatically. Add the SDK with one line of code and let AI handle the rest.',
};

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: Code2,
    title: 'Integrate',
    description: 'Add the SDK with one line of code. Works with any JavaScript framework.',
    code: '<script src="https://cdn.supporthelper.io/sdk.js"\n  data-sdk-key="your-key">\n</script>',
  },
  {
    step: '02',
    icon: Video,
    title: 'Capture',
    description: 'Users film the bug directly in your app with one click. No setup required.',
  },
  {
    step: '03',
    icon: Brain,
    title: 'Analyze',
    description:
      'AI investigates your codebase automatically, correlating the video with your code.',
  },
  {
    step: '04',
    icon: GitPullRequest,
    title: 'Fix',
    description: 'Receive a Pull Request with the fix directly in your GitHub repository.',
  },
];

const FEATURES = [
  {
    icon: Film,
    title: 'Video Capture + AI Analysis',
    description:
      'Users record bugs in-app. AI extracts frames, OCR text, console errors, and network calls automatically.',
  },
  {
    icon: Search,
    title: 'Deep Code Investigation',
    description:
      'AI autonomously explores your codebase, reads files, and traces execution paths to pinpoint the root cause.',
  },
  {
    icon: GitPullRequest,
    title: 'Auto-fix PR Generation',
    description:
      'Beyond diagnosis — the AI writes the actual fix and opens a Pull Request in your repository.',
  },
  {
    icon: Building2,
    title: 'Multi-tenant Architecture',
    description:
      'Built for agencies and enterprises. Full data isolation per organization with role-based access control.',
  },
  {
    icon: KeyRound,
    title: 'Bring Your Own AI Key (BYOK)',
    description:
      'Use your own OpenAI, Anthropic, or Gemini API key. Your data stays under your control.',
  },
  {
    icon: BarChart3,
    title: 'Usage Analytics & Budget Control',
    description:
      'Track AI spending, set budget limits per application, and monitor analysis quality.',
  },
];

const TRUSTED_BY = ['Acme Corp', 'Startup Labs', 'TechVentures', 'DevStudio', 'BuildFast', 'CodeCraft'];

const HIGHLIGHTS = [
  'No credit card required to start',
  '10 free AI analyses per month',
  'Setup in under 5 minutes',
  'Works with any JavaScript framework',
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-background to-muted/30 pb-20 pt-16 sm:pt-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                Now with autonomous PR generation
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                AI-Powered Bug{' '}
                <span className="text-primary">Resolution</span>
              </h1>

              <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
                Film the bug. AI finds the fix. Automatically.
              </p>

              <p className="mt-3 text-base text-muted-foreground">
                Your users record bugs in-app with one click. Our AI investigates your codebase,
                finds the root cause, and opens a Pull Request with the fix.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <a
                  href={`${DASHBOARD_URL}/signup`}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Get Started Free
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href="mailto:demo@supporthelper.io"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-border bg-background px-6 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  Book a Demo
                </a>
              </div>

              <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2">
                {HIGHLIGHTS.map((item) => (
                  <li key={item} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Hero visual */}
            <div className="mx-auto mt-16 max-w-2xl">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                  <span className="ml-3 flex-1 text-center text-xs text-muted-foreground">
                    yourapp.com — Bug Reporter
                  </span>
                </div>
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8">
                  <div className="flex flex-col items-center gap-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 ring-4 ring-primary/30">
                      <Video className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-white">Bug detected?</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Record a quick video and let AI handle the rest
                      </p>
                    </div>
                    <div className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-white shadow-lg">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      Start Recording
                    </div>
                    <div className="mt-2 w-full rounded-lg bg-slate-800/60 p-4 text-left">
                      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                        AI Analysis in progress...
                      </p>
                      {[
                        { label: 'Extracting video frames', done: true },
                        { label: 'Analyzing console errors', done: true },
                        { label: 'Investigating codebase', done: false },
                      ].map((item) => (
                        <div key={item.label} className="mb-2 flex items-center gap-2">
                          {item.done ? (
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
                          ) : (
                            <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-primary border-t-transparent" />
                          )}
                          <span className={`text-xs ${item.done ? 'text-slate-300' : 'text-slate-400'}`}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="bg-background py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                How it works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                From bug report to Pull Request in minutes. No manual triage, no back-and-forth.
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="flex flex-col">
                  <div className="mb-4">
                    <span className="text-4xl font-bold leading-none tabular-nums text-muted/50">
                      {item.step}
                    </span>
                  </div>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                  {item.code && (
                    <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-xs text-foreground">
                      <code>{item.code}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-muted/30 py-20 sm:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything you need to resolve bugs faster
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A complete platform from capture to fix, powered by the latest AI models.
              </p>
            </div>
            <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trusted By */}
        <section className="bg-background py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Trusted by engineering teams at
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-8">
              {TRUSTED_BY.map((company) => (
                <div
                  key={company}
                  className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/50 px-6"
                >
                  <span className="text-sm font-medium text-muted-foreground">{company}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="bg-primary py-16 sm:py-20">
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
              Stop debugging manually.
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/80">
              Let AI handle bug triage and fixes while your team ships new features.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={`${DASHBOARD_URL}/signup`}
                className="inline-flex h-11 items-center gap-2 rounded-md bg-white px-6 text-sm font-semibold text-primary shadow transition-colors hover:bg-white/90"
              >
                Start for Free
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center gap-2 rounded-md border border-white/30 px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-white/10"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
