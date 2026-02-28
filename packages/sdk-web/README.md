# @support-helper/sdk-web

<div align="center">

[![npm version](https://img.shields.io/npm/v/@support-helper/sdk-web.svg?style=for-the-badge)](https://www.npmjs.com/package/@support-helper/sdk-web)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@support-helper/sdk-web?style=for-the-badge)](https://bundlephobia.com/package/@support-helper/sdk-web)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

**Web SDK for Support Helper Platform**

Enable one-click bug reporting with video capture in your web applications.

[Quick Start](#quick-start) • [API Reference](#api-reference) • [Framework Examples](#framework-examples) • [TypeScript Types](#typescript-types)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎥 **Screen Recording** | `MediaRecorder` API with audio support |
| 📍 **Context Capture** | Browser, OS, viewport, URL automatically captured |
| ☁️ **S3 Upload** | Pre-signed URL uploads directly to storage |
| 📦 **Lightweight** | `<50KB` gzipped bundle size |
| 📝 **TypeScript** | Full type definitions included |
| 🔧 **Framework Agnostic** | Works with React, Vue, Angular, or Vanilla JS |

## 📦 Installation

```bash
# npm
npm install @support-helper/sdk-web

# yarn
yarn add @support-helper/sdk-web

# pnpm
pnpm add @support-helper/sdk-web
```

### CDN (Script Tag)

For non-bundled projects, use the CDN-hosted IIFE bundle:

```html
<!-- Versioned (recommended for production) -->
<script src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js"></script>

<!-- Latest version (development only) -->
<script src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@latest/dist/cdn/sdk.iife.js"></script>

<script>
  // Available as global SupportHelper
  const sdk = new SupportHelper({
    sdkKey: 'sk_live_your_sdk_key',
    apiUrl: 'https://api.support-helper.com'
  });
</script>
```

**With Subresource Integrity (SRI) for security:**

```html
<script
  src="https://cdn.jsdelivr.net/npm/@support-helper/sdk-web@0.1.0/dist/cdn/sdk.iife.js"
  integrity="sha384-..."
  crossorigin="anonymous">
</script>
```

Generate SRI hash: [https://www.srihash.org/](https://www.srihash.org/)

See [CDN_SETUP.md](./CDN_SETUP.md) for custom S3/CloudFront deployment.

## 🚀 Quick Start

```typescript
import { SupportHelper } from '@support-helper/sdk-web';

// Initialize
const supportHelper = new SupportHelper({
  sdkKey: 'sk_live_your_sdk_key',
  apiUrl: 'https://api.support-helper.com',
});

// Start recording
await supportHelper.startRecording();

// Stop recording and get video
const videoBlob = await supportHelper.stopRecording();

// Submit report
const ticketId = await supportHelper.report({
  title: 'Bug Report',
  description: 'Something went wrong...',
});

// Upload video
await supportHelper.uploadVideo(ticketId, videoBlob);
```

## API Reference

### SupportHelper Class

#### Constructor

```typescript
new SupportHelper(config: SupportHelperConfig)
```

**Config Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `sdkKey` | `string` | Yes | Your SDK key from the dashboard |
| `apiUrl` | `string` | Yes | Support Helper API URL |
| `customContext` | `object` | No | Additional context to include |

#### Methods

##### `startRecording(): Promise<void>`

Start screen recording. Prompts user to select screen/window/tab.

```typescript
try {
  await supportHelper.startRecording();
} catch (error) {
  if (error.message === 'Permission denied to capture screen') {
    // User denied permission
  }
}
```

##### `stopRecording(): Promise<Blob>`

Stop recording and return video blob.

```typescript
const videoBlob = await supportHelper.stopRecording();
console.log('Size:', videoBlob.size);
console.log('Type:', videoBlob.type); // video/webm
```

##### `pauseRecording(): Promise<void>`

Pause the current recording.

##### `resumeRecording(): Promise<void>`

Resume a paused recording.

##### `isRecording(): boolean`

Check if currently recording.

```typescript
if (supportHelper.isRecording()) {
  console.log('Recording in progress');
}
```

##### `report(options: ReportOptions): Promise<string>`

Submit a bug report.

```typescript
const ticketId = await supportHelper.report({
  title: 'Login button broken',
  description: 'Clicking login does nothing',
});
```

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `title` | `string` | Yes | Report title |
| `description` | `string` | Yes | Detailed description |

**Returns:** Ticket ID (string)

##### `reportWithVideo(options: ReportWithVideoOptions): Promise<string | null>`

Submit a bug report with a pre-recorded video in a single API call, without
using the widget. User context (OS, browser, viewport, URL) is captured
automatically.

When the browser is offline or the network request fails, the report is
automatically saved to IndexedDB and retried with exponential backoff when
connectivity returns. In that case, the method returns `null` instead of a
ticket ID.

```typescript
// 1. Record with the built-in recorder
await supportHelper.startRecording();
// ... user reproduces the bug ...
const videoBlob = await supportHelper.stopRecording();

// 2. Submit everything in one call
const ticketId = await supportHelper.reportWithVideo({
  title: 'Login button broken',
  description: 'Clicking login does nothing on Chrome 124',
  videoBlob,
});

if (ticketId) {
  console.log('Submitted — ticket ID:', ticketId);
} else {
  console.log('Offline — report queued for later submission');
}
```

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `title` | `string` | Yes | Report title |
| `description` | `string` | Yes | Detailed description |
| `videoBlob` | `Blob` | Yes | Pre-recorded video blob |

**Returns:** Ticket ID (string) when submitted, `null` when queued offline.

##### `uploadVideo(ticketId: string, videoBlob: Blob): Promise<void>`

Upload video to a ticket.

```typescript
await supportHelper.uploadVideo(ticketId, videoBlob);
```

#### Static Methods

##### `SupportHelper.initialize(config, buttonSelector?): SupportHelper`

Initialize SDK with optional button binding.

```typescript
const sdk = SupportHelper.initialize(
  { sdkKey: '...', apiUrl: '...' },
  '#report-button'  // Optional: auto-bind to button
);
```

### VideoRecorder Class

Low-level video recording control.

```typescript
import { VideoRecorder } from '@support-helper/sdk-web';

const recorder = new VideoRecorder({
  mimeType: 'video/webm',
  audioTracks: true,
  videoBitsPerSecond: 2500000,
});

await recorder.start();
// ... recording ...
const blob = await recorder.stop();
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mimeType` | `string` | `'video/webm'` | Video format |
| `audioTracks` | `boolean` | `true` | Include audio |
| `videoBitsPerSecond` | `number` | `2500000` | Video quality |

### ContextCapture Class

Capture browser and system context.

```typescript
import { ContextCapture } from '@support-helper/sdk-web';

const context = ContextCapture.captureContext({
  userId: 'user-123',  // Custom fields
});

// Returns:
// {
//   os: 'Windows 11',
//   browser: 'Chrome 120.0.0',
//   viewport: { width: 1920, height: 1080 },
//   url: 'https://example.com/page',
//   language: 'en-US',
//   timestamp: '2024-01-15T10:30:00Z',
//   userId: 'user-123'
// }
```

### APIClient Class

Direct API access.

```typescript
import { APIClient } from '@support-helper/sdk-web';

const api = new APIClient({
  baseUrl: 'https://api.support-helper.com',
  sdkKey: 'sk_live_...',
  timeout: 30000,
});

// Create ticket
const { id } = await api.createTicket({
  title: 'Bug',
  description: '...',
  userContext: { ... },
});

// Get upload URL
const upload = await api.getUploadUrl({
  ticketId: id,
  type: 'video',
  filename: 'recording.webm',
  size: 5000000,
  contentType: 'video/webm',
});

// Upload file directly to S3
await api.uploadFile(upload.uploadUrl, videoBlob);

// Confirm upload
await api.confirmUpload(upload.mediaId);
```

## 🔧 Framework Examples

### Programmatic API (no widget)

Use `reportWithVideo()` when you want full control over the recording UX
without embedding the `<support-helper>` widget.

```typescript
import { SupportHelper } from '@support-helper/sdk-web';

const sdk = new SupportHelper({
  sdkKey: 'sk_live_your_sdk_key',
  apiUrl: 'https://api.support-helper.com',
  // Optional: attach custom fields to every report
  customContext: { userId: 'usr_123', plan: 'pro' },
});

async function recordAndReport(title: string, description: string): Promise<void> {
  // Start screen capture
  await sdk.startRecording();

  // ... user reproduces the bug, then clicks "Stop" ...
  const videoBlob = await sdk.stopRecording();

  // Submit in one call — context captured automatically
  const ticketId = await sdk.reportWithVideo({ title, description, videoBlob });

  if (ticketId) {
    console.log('Report submitted, ticket:', ticketId);
  } else {
    // Network was unavailable — the report is saved locally and will be
    // retried automatically when connectivity returns.
    console.log('Report queued — will retry when online');
  }
}
```

### React

```tsx
// hooks/useSupportHelper.ts
import { useState, useCallback } from 'react';
import { SupportHelper } from '@support-helper/sdk-web';

const sdk = new SupportHelper({
  sdkKey: process.env.NEXT_PUBLIC_SDK_KEY!,
  apiUrl: process.env.NEXT_PUBLIC_API_URL!,
});

export function useSupportHelper() {
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async () => {
    await sdk.startRecording();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async () => {
    const blob = await sdk.stopRecording();
    setIsRecording(false);
    return blob;
  }, []);

  const submitReport = useCallback(async (
    title: string,
    description: string,
    video?: Blob
  ) => {
    const ticketId = await sdk.report({ title, description });
    if (video) {
      await sdk.uploadVideo(ticketId, video);
    }
    return ticketId;
  }, []);

  return { isRecording, startRecording, stopRecording, submitReport };
}

// Component
function ReportButton() {
  const { isRecording, startRecording, stopRecording } = useSupportHelper();

  return (
    <button onClick={isRecording ? stopRecording : startRecording}>
      {isRecording ? 'Stop' : 'Report Bug'}
    </button>
  );
}
```

### Vue 3

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { SupportHelper } from '@support-helper/sdk-web';

const sdk = new SupportHelper({
  sdkKey: import.meta.env.VITE_SDK_KEY,
  apiUrl: import.meta.env.VITE_API_URL,
});

const isRecording = ref(false);

async function toggleRecording() {
  if (isRecording.value) {
    const blob = await sdk.stopRecording();
    isRecording.value = false;
    // Handle blob...
  } else {
    await sdk.startRecording();
    isRecording.value = true;
  }
}
</script>

<template>
  <button @click="toggleRecording">
    {{ isRecording ? 'Stop' : 'Report Bug' }}
  </button>
</template>
```

### Angular

```typescript
// support-helper.service.ts
import { Injectable, signal } from '@angular/core';
import { SupportHelper } from '@support-helper/sdk-web';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupportHelperService {
  private sdk = new SupportHelper({
    sdkKey: environment.sdkKey,
    apiUrl: environment.apiUrl,
  });

  isRecording = signal(false);
  private videoBlob: Blob | null = null;

  async startRecording(): Promise<void> {
    await this.sdk.startRecording();
    this.isRecording.set(true);
  }

  async stopRecording(): Promise<Blob> {
    this.videoBlob = await this.sdk.stopRecording();
    this.isRecording.set(false);
    return this.videoBlob;
  }

  async submitReport(title: string, description: string): Promise<string> {
    const ticketId = await this.sdk.report({ title, description });
    if (this.videoBlob) {
      await this.sdk.uploadVideo(ticketId, this.videoBlob);
      this.videoBlob = null;
    }
    return ticketId;
  }
}

// report-button.component.ts
import { Component, inject } from '@angular/core';
import { SupportHelperService } from './support-helper.service';

@Component({
  selector: 'app-report-button',
  standalone: true,
  template: `
    <button (click)="toggleRecording()">
      {{ supportHelper.isRecording() ? 'Stop' : 'Report Bug' }}
    </button>
  `,
})
export class ReportButtonComponent {
  supportHelper = inject(SupportHelperService);

  async toggleRecording() {
    if (this.supportHelper.isRecording()) {
      await this.supportHelper.stopRecording();
    } else {
      await this.supportHelper.startRecording();
    }
  }
}
```

### Vanilla JavaScript

```html
<button id="report-btn">Report Bug</button>

<script type="module">
  import { SupportHelper } from '@support-helper/sdk-web';

  const sdk = new SupportHelper({
    sdkKey: 'sk_live_...',
    apiUrl: 'https://api.support-helper.com',
  });

  let videoBlob = null;

  document.getElementById('report-btn').addEventListener('click', async () => {
    if (sdk.isRecording()) {
      videoBlob = await sdk.stopRecording();
      // Show form to submit report
    } else {
      await sdk.startRecording();
    }
  });
</script>
```

## TypeScript Types

```typescript
export interface SupportHelperConfig {
  sdkKey: string;
  apiUrl: string;
  customContext?: Record<string, unknown>;
}

export interface ReportOptions {
  title: string;
  description: string;
  includeVideo?: boolean;
}

export interface ReportWithVideoOptions {
  title: string;
  description: string;
  /** Pre-recorded video blob. Use stopRecording() or MediaRecorder directly. */
  videoBlob: Blob;
}

export interface VideoRecorderOptions {
  mimeType?: string;
  audioTracks?: boolean;
  videoBitsPerSecond?: number;
}

export interface UserContext {
  os: string;
  browser: string;
  viewport: { width: number; height: number };
  url: string;
  language: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface UploadUrlRequest {
  ticketId: string;
  type: string;
  filename: string;
  size: number;
  contentType: string;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  mediaId: string;
  storageKey: string;
  expiresAt: string;
}
```

## Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 72+ |
| Firefox | 66+ |
| Safari | 13+ |
| Edge | 79+ |

**Note:** Screen capture requires HTTPS in production.

## Error Handling

```typescript
try {
  await supportHelper.startRecording();
} catch (error) {
  switch (error.message) {
    case 'Permission denied to capture screen':
      // User denied screen sharing
      break;
    case 'Recording already in progress':
      // Already recording
      break;
    default:
      console.error('Recording failed:', error);
  }
}
```

## Best Practices

1. **Initialize once** - Create a single SDK instance
2. **Handle errors** - Always wrap in try/catch
3. **Check recording state** - Use `isRecording()` before actions
4. **Optimize video size** - Lower bitrate for longer recordings
5. **Test locally** - Use test SDK key in development

## 🔨 Development

```bash
# Install dependencies
pnpm install

# Development mode (watch)
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm type-check
```

## 🔗 Related Documentation

- [Root README](../../README.md) - Project overview
- [SDK Guide](../../docs/SDK.md) - Complete SDK documentation
- [API Reference](../../docs/API.md) - Backend API documentation
- [Architecture](../../docs/ARCHITECTURE.md) - System design

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
