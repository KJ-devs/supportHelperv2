'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

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

export function LogosSection() {
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track) return;

      // Infinite horizontal scroll
      const totalWidth = track.scrollWidth / 2;

      gsap.to(track, {
        x: -totalWidth,
        duration: 30,
        ease: 'none',
        repeat: -1,
        modifiers: {
          x: gsap.utils.unitize((x: number) => parseFloat(String(x)) % totalWidth),
        },
      });
    },
    { scope: trackRef }
  );

  return (
    <section className="relative overflow-hidden border-y border-white/5 bg-[#030712] py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
          Trusted by engineering teams worldwide
        </p>
      </div>

      <div className="relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-[#030712] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-[#030712] to-transparent" />

        <div ref={trackRef} className="flex gap-8 whitespace-nowrap">
          {[...LOGOS, ...LOGOS].map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex h-12 flex-shrink-0 items-center rounded-lg border border-white/5 bg-white/[0.02] px-8"
            >
              <span className="text-sm font-semibold text-slate-500">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
