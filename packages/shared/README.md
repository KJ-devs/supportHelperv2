# @support-helper/shared

Shared TypeScript types, utilities, constants, and **design system** for the Support Helper Platform.

## Overview

This package provides:
- **Design System**: Unified design tokens and Tailwind preset
- **TypeScript Types**: Shared interfaces for tickets, users, tenants, media
- **Constants**: Enums for ticket status, severity, etc.
- **Utilities**: Validation and encryption helpers

## Installation

Already included in the monorepo workspace. Import as:

```typescript
import { designTokens, TicketStatus, validateEmail } from '@support-helper/shared';
```

## Design System

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for full documentation.

### Quick Start

**1. Update your Tailwind config:**

```javascript
// tailwind.config.js or tailwind.config.ts
module.exports = {
  presets: [require('@support-helper/shared/tailwind-preset')],
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
};
```

**2. Import base styles:**

```css
/* globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@import '@support-helper/shared/styles/base.css';
```

**3. Use design tokens:**

```typescript
import { designTokens } from '@support-helper/shared';

// Access color values
const primaryColor = designTokens.colors.light.primary;

// Access typography
const fontSans = designTokens.typography.fontFamily.sans;
```

## File Structure

```
packages/shared/
├── src/
│   ├── index.ts                # Main export file
│   ├── design-tokens.ts        # Design system tokens
│   ├── types/                  # TypeScript interfaces
│   ├── constants/              # Shared constants
│   └── utils/                  # Utility functions
├── styles/
│   └── base.css                # Shared CSS variables
├── tailwind-preset.js          # Tailwind config preset
├── DESIGN_SYSTEM.md            # Design system documentation
└── README.md                   # This file
```

## Design System Features

- **Unified Color Palette**: HSL-based colors with dark mode support
- **Typography Scale**: Consistent font sizes and line heights
- **Spacing System**: 4px-based spacing scale
- **Border Radius**: Computed from CSS variables
- **Shadows**: Elevation system for cards and modals
- **Animations**: Pre-defined keyframes and animations
- **CSS Utilities**: Custom scrollbar styles

## TypeScript Types

### Ticket Types

```typescript
import type { Ticket, TicketStatus, TicketSeverity } from '@support-helper/shared';

const ticket: Ticket = {
  id: '123',
  status: TicketStatus.OPEN,
  severity: TicketSeverity.HIGH,
  // ... more fields
};
```

### Media Types

```typescript
import type { Media, MediaStatus } from '@support-helper/shared';

const media: Media = {
  id: '456',
  status: MediaStatus.COMPLETED,
  // ... more fields
};
```

## Constants

```typescript
import { TicketStatus, TicketSeverity } from '@support-helper/shared';

// Use enums for type safety
const status = TicketStatus.OPEN; // "open"
const severity = TicketSeverity.CRITICAL; // "critical"
```

## Utilities

### Validation

```typescript
import { validateEmail, validateUrl } from '@support-helper/shared';

const isValidEmail = validateEmail('user@example.com');
const isValidUrl = validateUrl('https://example.com');
```

### Encryption

```typescript
import { encrypt, decrypt } from '@support-helper/shared';

const encrypted = encrypt('sensitive-data', 'secret-key');
const decrypted = decrypt(encrypted, 'secret-key');
```

## Development

### Build

```bash
pnpm --filter @support-helper/shared build
```

### Watch Mode

```bash
pnpm --filter @support-helper/shared dev
```

### Tests

```bash
pnpm --filter @support-helper/shared test
```

## Apps Using This Package

- **Dashboard** (`apps/dashboard/`) - Next.js 14 internal dashboard
- **Web App** (`apps/web/`) - Next.js 15 public web app
- **API** (`apps/api/`) - NestJS backend
- **Worker** (`apps/worker/`) - BullMQ job processor
- **SDK** (`packages/sdk-web/`) - Client-side SDK

## Migration from Custom Configs

If migrating from a custom Tailwind config:

1. Replace theme configuration with the shared preset
2. Import shared base styles in `globals.css`
3. Remove duplicate CSS variable definitions
4. Test dark mode functionality
5. Verify component rendering

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for detailed migration guide.

## Contributing

When adding new design tokens:

1. Update `src/design-tokens.ts`
2. Update `tailwind-preset.js` if needed
3. Update `styles/base.css` for CSS variables
4. Document changes in `DESIGN_SYSTEM.md`
5. Run `pnpm build` to compile TypeScript

## License

Private - Support Helper Platform
