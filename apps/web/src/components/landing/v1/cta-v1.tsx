'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

gsap.registerPlugin(ScrollTrigger);

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'http://localhost:3000';

export function CtaV1() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v1-cta-content', {
        opacity: 0,
        y: 40,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });

      gsap.to('.v1-cta-orb-1', {
        y: -25,
        x: 15,
        duration: 5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.v1-cta-orb-2', {
        y: 20,
        x: -20,
        duration: 6.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });
      gsap.to('.v1-cta-orb-3', {
        y: -15,
        x: 10,
        duration: 4.5,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
        delay: 1,
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[#030712] py-24 sm:py-32"
    >
      {/* Divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="v1-cta-content relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-blue-600/15 via-emerald-600/8 to-cyan-600/10 p-12 sm:p-16 lg:p-20">
          {/* Floating orbs */}
          <div className="v1-cta-orb-1 pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-blue-600/20 blur-[90px]" />
          <div className="v1-cta-orb-2 pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-emerald-600/20 blur-[90px]" />
          <div className="v1-cta-orb-3 pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/10 blur-[80px]" />

          {/* Dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Stop debugging.
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Start shipping.
              </span>
            </h2>
            <p className="mt-6 text-lg text-slate-300">
              Let AI handle the bug triage while your team focuses on features.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href={`${DASHBOARD_URL}/signup`}
                className="group inline-flex h-12 items-center gap-2 rounded-lg bg-white px-8 text-sm font-semibold text-slate-900 shadow-lg transition-all hover:bg-slate-50 hover:shadow-xl"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
              <Link
                href="/v1#v1-pricing"
                className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/20 px-8 text-sm font-semibold text-white transition-all hover:border-white/30 hover:bg-white/[0.06]"
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
