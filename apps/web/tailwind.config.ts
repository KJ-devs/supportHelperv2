import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [require('@support-helper/shared/tailwind-preset')],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
