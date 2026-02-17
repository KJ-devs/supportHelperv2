# Unified Design System

**Shared design tokens and Tailwind preset for Support Helper Platform**

This package provides a unified design system shared between:
- **Dashboard** (Next.js 14, App Router) - `apps/dashboard/`
- **Web App** (Next.js 15, App Router) - `apps/web/`

## Overview

The design system is based on **shadcn/ui** principles with:
- HSL color values for better dark mode support
- CSS variables for runtime theming
- Radix UI primitives compatibility
- Consistent spacing, typography, and animations

## Files

```
packages/shared/
├── src/
│   └── design-tokens.ts        # TypeScript design token definitions
├── styles/
│   └── base.css                # Shared CSS variables and utilities
├── tailwind-preset.js          # Tailwind config preset
└── DESIGN_SYSTEM.md            # This file
```

## Usage

### 1. Install Dependencies

The shared package is already in the monorepo workspace. No installation needed.

### 2. Update Tailwind Config

In your app's `tailwind.config.js` or `tailwind.config.ts`:

```typescript
// apps/dashboard/tailwind.config.js
module.exports = {
  presets: [require('@support-helper/shared/tailwind-preset')],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
};
```

```typescript
// apps/web/tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [require('@support-helper/shared/tailwind-preset')],
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
};

export default config;
```

### 3. Import Base Styles

In your app's `globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Import shared design system styles */
@import '@support-helper/shared/styles/base.css';
```

**Alternative:** Copy CSS variables from `base.css` into your `globals.css` if you need to customize them.

### 4. Use Design Tokens in TypeScript

```typescript
import { designTokens } from '@support-helper/shared';

// Access color values
const primaryColor = designTokens.colors.light.primary; // "221.2 83.2% 53.3%"

// Access typography
const fontSans = designTokens.typography.fontFamily.sans;

// Access spacing
const spacing4 = designTokens.spacing[4]; // "1rem"
```

## Design Tokens

### Colors

All colors use **HSL format** for CSS variable compatibility:

```typescript
colors: {
  light: {
    background: '0 0% 100%',
    foreground: '222.2 84% 4.9%',
    primary: '221.2 83.2% 53.3%',
    // ... more colors
  },
  dark: {
    background: '222.2 84% 4.9%',
    foreground: '210 40% 98%',
    // ... dark mode variants
  }
}
```

**Color Palette:**
- `background` / `foreground` - Base page colors
- `card` - Card background and text
- `popover` - Popover/dropdown background
- `primary` - Brand color (blue)
- `secondary` - Secondary actions (gray)
- `muted` - Muted backgrounds and text
- `accent` - Accent backgrounds
- `destructive` - Error/delete actions (red)
- `success` - Success states (green)
- `warning` - Warning states (yellow/orange)
- `border` - Border color
- `input` - Input border color
- `ring` - Focus ring color

### Typography

```typescript
typography: {
  fontFamily: {
    sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
    mono: ['var(--font-geist-mono)', 'monospace'],
  },
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    // ... up to 5xl
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
}
```

### Spacing

Based on Tailwind's default scale (4px base unit):

```typescript
spacing: {
  0: '0',
  px: '1px',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  // ... up to 32: '8rem' (128px)
}
```

### Border Radius

Computed from `--radius` CSS variable (default: `0.5rem`):

```typescript
borderRadius: {
  sm: 'calc(var(--radius) - 4px)',
  md: 'calc(var(--radius) - 2px)',
  lg: 'var(--radius)',
  xl: 'calc(var(--radius) + 2px)',
  '2xl': 'calc(var(--radius) + 4px)',
  '3xl': 'calc(var(--radius) + 8px)',
  full: '9999px',
}
```

### Shadows

```typescript
boxShadow: {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), ...',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), ...',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), ...',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), ...',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
}
```

### Animations

Pre-defined animations for common UI patterns:

```typescript
keyframes: {
  'accordion-down': { /* ... */ },
  'accordion-up': { /* ... */ },
  'fade-in': { /* ... */ },
  'slide-in-from-top': { /* ... */ },
  'slide-in-from-bottom': { /* ... */ },
  'slide-in-from-left': { /* ... */ },
  'slide-in-from-right': { /* ... */ },
}

animation: {
  'accordion-down': 'accordion-down 0.2s ease-out',
  'accordion-up': 'accordion-up 0.2s ease-out',
  'fade-in': 'fade-in 0.3s ease-out',
  'slide-in': 'slide-in-from-top 0.3s ease-out',
  // ... more animations
}
```

## CSS Utilities

The base stylesheet includes custom utilities:

```css
.scrollbar-thin {
  scrollbar-width: thin;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
```

## Dark Mode

Dark mode is enabled via the `class` strategy. Add the `dark` class to the root element:

```tsx
<html className="dark">
  {/* ... */}
</html>
```

Use `next-themes` for automatic theme switching:

```tsx
import { ThemeProvider } from 'next-themes';

<ThemeProvider attribute="class" defaultTheme="system">
  {children}
</ThemeProvider>
```

## Component Guidelines

### Using Colors in Components

```tsx
// Background and foreground
<div className="bg-background text-foreground">

// Cards
<div className="bg-card text-card-foreground border border-border">

// Primary actions
<button className="bg-primary text-primary-foreground">

// Destructive actions
<button className="bg-destructive text-destructive-foreground">

// Success states
<div className="bg-success text-success-foreground">

// Muted text
<p className="text-muted-foreground">
```

### Typography

```tsx
// Font families
<p className="font-sans">System UI text</p>
<code className="font-mono">Monospace code</code>

// Font sizes
<h1 className="text-4xl font-bold">Large heading</h1>
<p className="text-base">Body text</p>
<small className="text-sm text-muted-foreground">Helper text</small>
```

### Spacing

```tsx
// Padding and margins
<div className="p-4 mb-6">       {/* 16px padding, 24px bottom margin */}
<div className="px-6 py-3">      {/* 24px horizontal, 12px vertical */}
<div className="space-y-4">      {/* 16px vertical spacing between children */}
```

### Border Radius

```tsx
<div className="rounded-lg">     {/* var(--radius) = 0.5rem */}
<div className="rounded-md">     {/* calc(var(--radius) - 2px) */}
<div className="rounded-full">   {/* Circular */}
```

### Shadows

```tsx
<div className="shadow-sm">      {/* Subtle shadow */}
<div className="shadow-md">      {/* Medium shadow for cards */}
<div className="shadow-lg">      {/* Large shadow for modals */}
```

### Animations

```tsx
<div className="animate-fade-in">
<div className="animate-slide-in">
```

## Migration Guide

### Dashboard (Next.js 14)

1. Update `tailwind.config.js`:
   ```js
   module.exports = {
     presets: [require('@support-helper/shared/tailwind-preset')],
     content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
   };
   ```

2. Update `app/globals.css`:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;

   @import '@support-helper/shared/styles/base.css';
   ```

3. Remove custom theme configuration (if any)

### Web App (Next.js 15)

The Web App already uses the shadcn/ui design system, so migration is minimal:

1. Update `tailwind.config.ts` to use the preset
2. Verify CSS variables match the shared base styles
3. Test dark mode functionality

## Benefits

- **Consistency**: Same look and feel across Dashboard and Web App
- **Maintainability**: Single source of truth for design tokens
- **Type Safety**: TypeScript types for design tokens
- **Dark Mode**: Built-in support with CSS variables
- **Performance**: Optimized with Tailwind CSS
- **Scalability**: Easy to extend and customize
- **Developer Experience**: Auto-complete for design tokens

## Extending the Design System

### Adding Custom Colors

```typescript
// In your app's tailwind.config
module.exports = {
  presets: [require('@support-helper/shared/tailwind-preset')],
  theme: {
    extend: {
      colors: {
        brand: '#your-color',
      },
    },
  },
};
```

### Custom Animations

```typescript
module.exports = {
  presets: [require('@support-helper/shared/tailwind-preset')],
  theme: {
    extend: {
      keyframes: {
        'custom-animation': { /* ... */ },
      },
      animation: {
        'custom': 'custom-animation 1s ease-in-out',
      },
    },
  },
};
```

## Future Improvements

Potential enhancements tracked in issue #107:

- [ ] Create shared `packages/ui/` with React components
- [ ] Migrate Dashboard to Radix UI primitives
- [ ] Unify form handling with TanStack Form + Zod
- [ ] Unify table components with TanStack Table
- [ ] Add Storybook for component documentation
- [ ] Create design system playground

## References

- [shadcn/ui](https://ui.shadcn.com/) - Component library inspiration
- [Radix UI](https://www.radix-ui.com/) - Headless UI primitives
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [next-themes](https://github.com/pacocoursey/next-themes) - Theme switching

## Support

For questions or issues related to the design system:
- Open an issue on GitHub: `KJ-devs/supportHelperv2`
- Reference issue #107 for design system unification
