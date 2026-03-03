'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

const navLinks = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#pricing', label: 'Pricing' },
  { href: `${DASHBOARD_URL}/docs`, label: 'Docs', external: true },
];

export function NavBarDark() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-white/5 bg-[#030712]/80 backdrop-blur-xl'
          : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-white">Support Helper</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium transition-colors hover:text-white',
                  pathname === link.href.split('#')[0] ? 'text-white' : 'text-slate-400'
                )}
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-3 md:flex">
          <a
            href={`${DASHBOARD_URL}/login`}
            className="text-sm font-medium text-slate-400 transition-colors hover:text-white"
          >
            Log in
          </a>
          <a
            href={`${DASHBOARD_URL}/signup`}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:shadow-lg hover:shadow-blue-500/20"
          >
            Get Started
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:text-white md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/5 bg-[#030712]/95 px-4 py-4 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-slate-400"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-slate-400"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              )
            )}
            <hr className="border-white/5" />
            <a
              href={`${DASHBOARD_URL}/login`}
              className="text-sm font-medium text-slate-400"
              onClick={() => setMobileOpen(false)}
            >
              Log in
            </a>
            <a
              href={`${DASHBOARD_URL}/signup`}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-medium text-white"
              onClick={() => setMobileOpen(false)}
            >
              Get Started Free
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
