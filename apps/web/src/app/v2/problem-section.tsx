'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { MessageSquare, Clock, FileQuestion } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const PAIN_POINTS = [
  {
    icon: MessageSquare,
    stat: '20 minutes',
    label: 'Average time to reproduce a bug',
    description:
      'Teams waste a fifth of their day just trying to recreate what the user already experienced.',
    color: 'red',
  },
  {
    icon: Clock,
    stat: '3 days',
    label: 'Average backlog wait time',
    description:
      "The bug is filed. Then it sits. Meanwhile users churn and engineers guess at what's wrong.",
    color: 'orange',
  },
  {
    icon: FileQuestion,
    stat: '67%',
    label: 'Of bug reports lack enough context',
    description:
      'Two-thirds of tickets arrive with a vague description, a blurry screenshot, and no steps to reproduce.',
    color: 'red',
  },
];

export function ProblemSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.problem-card', {
        opacity: 0,
        y: 60,
        stagger: 0.15,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.problem-heading', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.problem-heading',
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  return (
    <section ref={sectionRef} className="relative bg-[#030712] py-24 sm:py-32">
      {/* Divider top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="problem-heading mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-red-400">
            The Problem
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Every bug report today is{' '}
            <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              broken
            </span>
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            The current bug reporting process is a game of telephone — from user frustration to
            developer confusion, nothing reaches the right person with the right context.
          </p>
        </div>

        {/* Pain point cards */}
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
          {PAIN_POINTS.map((point) => {
            const Icon = point.icon;
            return (
              <div
                key={point.stat}
                className="problem-card group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-300 hover:border-red-500/20 hover:bg-red-500/[0.03]"
              >
                {/* Top accent */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

                {/* Icon */}
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/10">
                  <Icon className="h-6 w-6 text-red-400" />
                </div>

                {/* Stat */}
                <p className="text-4xl font-bold tracking-tight text-white">{point.stat}</p>

                {/* Label */}
                <p className="mt-2 text-sm font-semibold text-slate-300">{point.label}</p>

                {/* Description */}
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{point.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
