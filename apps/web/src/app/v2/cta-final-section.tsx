'use client';

import { useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

export function CtaFinalSection() {
  const [email, setEmail] = useState('');
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.cta-final-content', {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      window.location.href = `${DASHBOARD_URL}/signup?email=${encodeURIComponent(email)}`;
    }
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#030712] py-24 sm:py-32">
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

      {/* Gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-violet-600/10" />

      {/* Animated orbs */}
      <div className="pointer-events-none absolute -left-40 top-0 h-[400px] w-[400px] rounded-full bg-blue-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[120px]" />

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#030712_70%)]" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="cta-final-content">
          {/* Headline */}
          <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your next bug could{' '}
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
              fix itself.
            </span>
          </h2>

          {/* Sub-headline */}
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-400">
            Join 500+ engineering teams that ship faster with AI-powered bug resolution.
          </p>

          {/* Email + CTA form */}
          <form
            onSubmit={handleSubmit}
            className="mx-auto mt-10 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your work email"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all focus:border-blue-500/50 focus:bg-white/8 focus:ring-2 focus:ring-blue-500/20"
              required
            />
            <button
              type="submit"
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-500/30 sm:flex-shrink-0"
            >
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </form>

          {/* Trust copy */}
          <p className="mt-4 text-sm text-slate-600">
            Free forever for small projects.{' '}
            <span className="text-slate-400">Pro trial for 14 days.</span>{' '}
            No credit card required.
          </p>

          {/* Features list */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            {[
              '5 free AI analyses',
              'No setup required',
              'Works with any JS framework',
              'Cancel anytime',
            ].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <span className="h-1 w-1 rounded-full bg-blue-500" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
