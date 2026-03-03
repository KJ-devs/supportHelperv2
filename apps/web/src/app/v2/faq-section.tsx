'use client';

import { useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const FAQ_ITEMS = [
  {
    question: 'What is BYOK?',
    answer:
      'BYOK stands for "Bring Your Own Key." On the Pro and Enterprise plans, you connect your own API key from OpenAI, Anthropic, Google, AWS Bedrock, or Ollama. Your data goes directly to your chosen AI provider — we never see your API key or the AI responses. You pay your provider directly at their standard rates.',
  },
  {
    question: 'How does the Starter tier work?',
    answer:
      'The Starter tier is completely free, forever. You get 5 AI analyses per month at no cost, powered by Gemini Flash. No credit card required to sign up. When you hit the limit, you can upgrade to Pro or wait for the next month to reset. Starter is perfect for side projects, evaluations, or small apps with infrequent bugs.',
  },
  {
    question: 'Can I change plans at any time?',
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. When you upgrade, you'll be billed the prorated difference immediately and gain instant access to Pro features. When you downgrade, the change takes effect at your next billing cycle. You'll never be locked in.",
  },
  {
    question: 'Is my API key secure?',
    answer:
      'Your BYOK API key is encrypted at rest using AES-256-GCM before being stored. We use envelope encryption — your key is encrypted with a data encryption key (DEK), which is itself encrypted with a key encryption key (KEK) stored in a separate secure key management service. Only the decryption flow triggered during analysis can access your key.',
  },
  {
    question: 'What AI providers are supported?',
    answer:
      'Support Helper integrates with all major AI providers: OpenAI (GPT-4o, GPT-4 Vision), Anthropic (Claude 3.5 Sonnet, Claude 3 Opus), Google (Gemini 1.5 Pro, Gemini Flash), AWS Bedrock (multiple models), and Ollama for self-hosted models. You can switch providers at any time from your settings.',
  },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      gsap.from('.faq-item', {
        opacity: 0,
        y: 20,
        stagger: 0.1,
        duration: 0.5,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 65%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.faq-heading', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '.faq-heading',
          start: 'top 75%',
          toggleActions: 'play none none none',
        },
      });
    },
    { scope: sectionRef }
  );

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <section ref={sectionRef} className="relative bg-[#04080f] py-24 sm:py-32">
      {/* Top divider */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-500/20 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="faq-heading mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Everything you need to know about Support Helper.
          </p>
        </div>

        {/* Accordion */}
        <div className="mx-auto mt-12 max-w-3xl divide-y divide-white/5">
          {FAQ_ITEMS.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.question} className="faq-item py-5">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 text-left"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-medium text-white">{item.question}</span>
                  <ChevronDown
                    className={`mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="mt-4">
                    <p className="text-sm leading-relaxed text-slate-400">{item.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
