import Link from 'next/link';
import { Zap, Github, Twitter } from 'lucide-react';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const footerLinks = {
  Product: [
    { label: 'Features', href: '/#features' },
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'Changelog', href: '#' },
  ],
  Resources: [
    { label: 'Documentation', href: `${DASHBOARD_URL}/docs`, external: true },
    { label: 'API Reference', href: `${DASHBOARD_URL}/docs/api`, external: true },
    { label: 'Status', href: '#' },
  ],
  Company: [
    { label: 'Contact', href: 'mailto:hello@supporthelper.io' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
  ],
};

export function FooterDark() {
  return (
    <footer className="border-t border-white/5 bg-[#030712]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-white">Support Helper</span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-slate-500">
              AI-powered bug resolution for modern engineering teams.
              Film the bug. AI finds the fix.
            </p>
            <div className="mt-5 flex items-center gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 transition-colors hover:text-slate-400"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-600 transition-colors hover:text-slate-400"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-slate-300">{category}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-500 transition-colors hover:text-slate-300"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-slate-500 transition-colors hover:text-slate-300"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/5 pt-8">
          <p className="text-center text-sm text-slate-600">
            &copy; {new Date().getFullYear()} Support Helper. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
