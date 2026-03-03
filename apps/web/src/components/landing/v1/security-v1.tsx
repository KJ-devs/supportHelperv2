'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Shield, Lock, Key, FileText } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface SecurityItem {
  icon: React.ElementType;
  title: string;
  description: string;
  iconColor: string;
  glowColor: string;
}

const SECURITY_ITEMS: SecurityItem[] = [
  {
    icon: Shield,
    title: 'AES-256-GCM',
    description: 'API keys encrypted at rest',
    iconColor: 'text-blue-400',
    glowColor: 'shadow-blue-500/10',
  },
  {
    icon: Lock,
    title: 'SOC 2 Ready',
    description: 'Compliance built in',
    iconColor: 'text-emerald-400',
    glowColor: 'shadow-emerald-500/10',
  },
  {
    icon: Key,
    title: 'SSO / SAML',
    description: 'Enterprise authentication',
    iconColor: 'text-amber-400',
    glowColor: 'shadow-amber-500/10',
  },
  {
    icon: FileText,
    title: 'Audit Logs',
    description: 'Full activity tracking',
    iconColor: 'text-violet-400',
    glowColor: 'shadow-violet-500/10',
  },
];

export function SecurityV1() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v1-security-card', {
        opacity: 0,
        y: 40,
        stagger: 0.12,
        duration: 0.75,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 70%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.v1-security-title', {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="v1-security"
      className="relative bg-[#030712] py-24 sm:py-32"
    >
      {/* Divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,rgba(59,130,246,0.04)_0%,transparent_100%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="v1-security-title mx-auto max-w-2xl text-center">
          <p className="font-mono text-sm font-semibold uppercase tracking-widest text-blue-400">
            Security
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Enterprise-grade{' '}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              security
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Built for teams where security is non-negotiable.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECURITY_ITEMS.map((item) => (
            <div
              key={item.title}
              className={`v1-security-card group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04] hover:shadow-xl ${item.glowColor}`}
            >
              {/* Glass highlight on top edge */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <div
                className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/5 bg-white/[0.05] ${item.iconColor}`}
              >
                <item.icon className="h-6 w-6" />
              </div>

              <h3 className="text-sm font-bold text-white">{item.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
