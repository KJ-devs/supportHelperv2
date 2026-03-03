'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

const COMPANIES = [
  'Acme Corp',
  'Startup Labs',
  'TechVentures',
  'DevStudio',
  'BuildFast',
  'CodeCraft',
  'ShipIt',
  'NexGen',
];

// Duplicate for seamless loop
const MARQUEE_ITEMS = [...COMPANIES, ...COMPANIES];

export function LogosV1() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track) return;

      const totalWidth = track.scrollWidth / 2;

      gsap.to(track, {
        x: -totalWidth,
        duration: 22,
        ease: 'none',
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((x: string) => parseFloat(x) % totalWidth),
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#030712] py-16">
      {/* Divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-10 text-center font-mono text-sm font-semibold uppercase tracking-widest text-slate-600">
          Trusted by engineering teams at
        </p>
      </div>

      {/* Marquee track with fade edges */}
      <div className="relative overflow-hidden">
        {/* Left fade */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-[#030712] to-transparent" />
        {/* Right fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-[#030712] to-transparent" />

        <div ref={trackRef} className="flex gap-6 whitespace-nowrap">
          {MARQUEE_ITEMS.map((company, idx) => (
            <div
              key={`${company}-${idx}`}
              className="inline-flex items-center rounded-full border border-white/5 bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-slate-400 backdrop-blur-sm"
            >
              {company}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
