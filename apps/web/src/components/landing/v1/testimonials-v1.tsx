'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

interface Testimonial {
  quote: string;
  name: string;
  role: string;
  company: string;
  initials: string;
  avatarColor: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'We reduced our bug resolution time by 90%. Support Helper pays for itself in the first week.',
    name: 'Sarah Chen',
    role: 'CTO',
    company: 'StartupLabs',
    initials: 'SC',
    avatarColor: 'from-blue-500 to-cyan-500',
  },
  {
    quote:
      'The auto-fix PR feature is magic. Our team can focus on features instead of debugging.',
    name: 'Marcus Johnson',
    role: 'Lead Dev',
    company: 'TechVentures',
    initials: 'MJ',
    avatarColor: 'from-violet-500 to-purple-500',
  },
  {
    quote:
      'Finally, bug reports with useful information. The AI analysis is scarily accurate.',
    name: 'Elena Rodriguez',
    role: 'VP Engineering',
    company: 'BuildFast',
    initials: 'ER',
    avatarColor: 'from-emerald-500 to-green-500',
  },
];

export function TestimonialsV1() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v1-testimonial-card', {
        opacity: 0,
        y: 50,
        stagger: 0.18,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="v1-testimonials"
      className="relative bg-[#030712] py-24 sm:py-32"
    >
      {/* Divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(59,130,246,0.04)_0%,transparent_100%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-sm font-semibold uppercase tracking-widest text-blue-400">
            Social Proof
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Teams shipping faster with{' '}
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Support Helper
            </span>
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="v1-testimonial-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
            >
              {/* Glass highlight on top edge */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Quote mark */}
              <div className="mb-6 text-4xl font-serif leading-none text-emerald-400/70">&ldquo;</div>

              {/* Quote text */}
              <p className="flex-1 text-sm leading-relaxed text-slate-300">{t.quote}</p>

              {/* Author */}
              <div className="mt-8 flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.avatarColor} text-xs font-bold text-white shadow-lg`}
                >
                  {t.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{t.name}</p>
                  <p className="text-xs text-slate-500">
                    {t.role} @ {t.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
