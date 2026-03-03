'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Shield, Lock, Key, FileText } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const SECURITY_ITEMS = [
  {
    icon: Shield,
    title: 'AES-256-GCM',
    subtitle: 'Encrypted at rest',
    iconBg: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  },
  {
    icon: FileText,
    title: 'SOC 2 Ready',
    subtitle: 'Built-in compliance',
    iconBg: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
  },
  {
    icon: Lock,
    title: 'SSO / SAML',
    subtitle: 'Enterprise auth',
    iconBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  },
  {
    icon: Key,
    title: 'Audit Logs',
    subtitle: 'Full tracking',
    iconBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  },
];

export function SecurityV2() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.security-card', {
        opacity: 0,
        y: 40,
        stagger: 0.12,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.security-heading', {
        opacity: 0,
        y: 25,
        duration: 0.55,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.security-heading',
          start: 'top 78%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#030712] py-20 sm:py-28">
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="security-heading mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Security
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            Enterprise-grade{' '}
            <span className="bg-gradient-to-r from-slate-300 to-slate-100 bg-clip-text text-transparent">
              security
            </span>
          </h2>
        </div>

        {/* Security cards — 4 in a row */}
        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
          {SECURITY_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="security-card group flex flex-col items-center rounded-xl border border-white/5 bg-white/[0.02] p-6 text-center transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
              >
                <div
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl border ${item.iconBg}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom divider */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />
    </section>
  );
}
