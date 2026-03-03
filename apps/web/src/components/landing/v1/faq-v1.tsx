'use client';

import { useState, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is BYOK (Bring Your Own Key)?',
    answer:
      'BYOK lets you connect your own API key from providers like Anthropic, OpenAI, or Google Gemini. Your data goes directly to your chosen provider — we never see your prompts or results.',
  },
  {
    question: 'How does the Starter tier work?',
    answer:
      'The Starter tier gives you 5 AI analyses per month at no cost. Analyses use Gemini Flash. When you hit the limit, upgrade to Pro with your own API key for unlimited analyses.',
  },
  {
    question: 'Can I change plans later?',
    answer:
      'Yes, upgrade or downgrade anytime. Upgrades take effect immediately. Downgrades at end of billing period. No lock-in.',
  },
  {
    question: 'Is my API key secure?',
    answer:
      'Your API keys are encrypted at rest using AES-256-GCM. Keys are decrypted only in memory at analysis time and never logged.',
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'Anthropic Claude, OpenAI GPT-4, Google Gemini, AWS Bedrock, and self-hosted models via Ollama.',
  },
];

function FaqAccordionItem({ item }: { item: FaqItem; index?: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  function toggle() {
    const el = contentRef.current;
    if (!el) {
      setIsOpen((prev) => !prev);
      return;
    }

    if (isOpen) {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.inOut',
        onComplete: () => setIsOpen(false),
      });
    } else {
      setIsOpen(true);
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        { height: 'auto', opacity: 1, duration: 0.32, ease: 'power2.out' }
      );
    }
  }

  return (
    <div
      className={`v1-faq-item overflow-hidden rounded-2xl border transition-colors duration-200 ${
        isOpen ? 'border-white/10 bg-white/[0.04]' : 'border-white/5 bg-white/[0.02]'
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between px-6 py-5 text-left"
      >
        <span className="text-sm font-semibold text-white sm:text-base">
          {item.question}
        </span>
        <ChevronDown
          className={`ml-4 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        ref={contentRef}
        style={{ height: isOpen ? 'auto' : 0, overflow: 'hidden', opacity: isOpen ? 1 : 0 }}
      >
        <div className="px-6 pb-5">
          <p className="text-sm leading-relaxed text-slate-400">{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqV1() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.v1-faq-item', {
        opacity: 0,
        y: 30,
        stagger: 0.1,
        duration: 0.7,
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
    <section ref={sectionRef} id="v1-faq" className="relative bg-[#030712] py-24 sm:py-32">
      {/* Divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-mono text-sm font-semibold uppercase tracking-widest text-cyan-400">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Frequently asked{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              questions
            </span>
          </h2>
        </div>

        <div className="mx-auto mt-16 max-w-3xl space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <FaqAccordionItem key={item.question} item={item} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
