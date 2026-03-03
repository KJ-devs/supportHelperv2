'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const TESTIMONIALS = [
  {
    quote:
      'We reduced our bug resolution time by 90%. Support Helper pays for itself in the first week.',
    name: 'Sarah Chen',
    role: 'CTO',
    company: 'StartupLabs',
    initials: 'SC',
    color: 'from-blue-500 to-violet-600',
  },
  {
    quote:
      'The auto-fix PR feature is magic. Our team can focus on features instead of debugging.',
    name: 'Marcus Johnson',
    role: 'Lead Developer',
    company: 'TechVentures',
    initials: 'MJ',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    quote:
      'Finally, bug reports that actually contain useful information. The AI analysis is scarily accurate.',
    name: 'Elena Rodriguez',
    role: 'VP Engineering',
    company: 'BuildFast',
    initials: 'ER',
    color: 'from-orange-500 to-pink-600',
  },
];

export function TestimonialsSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.testimonial-card', {
        opacity: 0,
        y: 50,
        stagger: 0.15,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.testimonials-heading', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.testimonials-heading',
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#04080f] py-24 sm:py-32">
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="testimonials-heading mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Testimonials
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Teams shipping faster with{' '}
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              Support Helper
            </span>
          </h2>
        </div>

        {/* Cards */}
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.name}
              className="testimonial-card flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-300 hover:border-white/10 hover:bg-white/[0.04]"
            >
              {/* Quote marks */}
              <div className="mb-4 text-4xl font-serif leading-none text-slate-700">&ldquo;</div>

              {/* Quote */}
              <blockquote className="flex-1 text-sm leading-relaxed text-slate-300">
                {testimonial.quote}
              </blockquote>

              {/* Attribution */}
              <div className="mt-6 flex items-center gap-3">
                {/* Avatar */}
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${testimonial.color}`}
                >
                  {testimonial.initials}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs text-slate-500">
                    {testimonial.role} @ {testimonial.company}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Social proof numbers */}
        <div className="mx-auto mt-16 flex flex-wrap items-center justify-center gap-12">
          {[
            { value: '500+', label: 'Engineering teams' },
            { value: '10k+', label: 'Bugs auto-resolved' },
            { value: '4.9/5', label: 'Average rating' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
