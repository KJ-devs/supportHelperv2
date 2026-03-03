'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin();

const LOGOS = [
  'Acme Corp',
  'Startup Labs',
  'TechVentures',
  'DevStudio',
  'BuildFast',
  'CodeCraft',
  'ShipIt',
  'NexGen',
];

// Duplicate for seamless infinite scroll
const LOGOS_DOUBLED = [...LOGOS, ...LOGOS];

export function LogosV2() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track) return;

      const totalWidth = track.scrollWidth / 2;

      gsap.to(track, {
        x: `-=${totalWidth}`,
        duration: 24,
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
    <section
      ref={sectionRef}
      className="relative border-y border-white/5 bg-[#030712] py-10"
    >
      {/* Top gradient divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      {/* Label */}
      <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
        Trusted by 500+ engineering teams
      </p>

      {/* Marquee track with fade edges */}
      <div className="relative overflow-hidden">
        {/* Left fade */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#030712] to-transparent" />
        {/* Right fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#030712] to-transparent" />

        {/* Scrolling pills */}
        <div ref={trackRef} className="flex items-center gap-4 will-change-transform">
          {LOGOS_DOUBLED.map((name, i) => (
            <div
              key={i}
              className="flex-shrink-0 rounded-full border border-white/8 bg-white/[0.03] px-5 py-2 text-sm font-medium whitespace-nowrap text-slate-400 transition-colors hover:text-slate-200"
            >
              {name}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom gradient divider */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
    </section>
  );
}
