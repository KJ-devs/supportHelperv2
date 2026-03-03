'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

export function CtaSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.cta-content', {
        opacity: 0,
        y: 40,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });

      // Floating orbs in CTA
      gsap.to('.cta-orb-1', {
        y: -20,
        x: 10,
        duration: 5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.cta-orb-2', {
        y: 15,
        x: -15,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#030712] py-24 sm:py-32">
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="cta-content relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/20 via-violet-600/10 to-purple-600/20 p-12 sm:p-16 lg:p-20">
          {/* Orbs */}
          <div className="cta-orb-1 pointer-events-none absolute -left-20 -top-20 h-60 w-60 rounded-full bg-blue-600/20 blur-[80px]" />
          <div className="cta-orb-2 pointer-events-none absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-violet-600/20 blur-[80px]" />

          {/* Grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Stop debugging manually.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                Let AI handle it.
              </span>
            </h2>
            <p className="mt-6 text-lg text-slate-300">
              Join hundreds of teams already resolving bugs faster with AI.
              Set up in 5 minutes, free forever for small projects.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={`${DASHBOARD_URL}/signup`}
                className="group inline-flex h-12 items-center gap-2 rounded-lg bg-white px-8 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-xl"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/20 px-8 text-sm font-semibold text-white transition-all hover:border-white/30 hover:bg-white/5"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
