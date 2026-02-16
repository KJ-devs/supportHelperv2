/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@support-helper/shared/tailwind-preset')],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
