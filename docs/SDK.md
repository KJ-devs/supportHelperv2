# SDK Documentation

Complete guide for integrating the Support Helper SDK into your web applications.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Framework Integrations](#framework-integrations)
- [TypeScript Types](#typescript-types)
- [Advanced Usage](#advanced-usage)
- [Troubleshooting](#troubleshooting)

## Installation

### npm / yarn / pnpm

```bash
# npm
npm install @support-helper/sdk-web

# yarn
yarn add @support-helper/sdk-web

# pnpm
pnpm add @support-helper/sdk-web
```

### CDN

```html
<script src="https://cdn.support-helper.com/sdk/v1/support-helper.min.js"></script>
```

## Quick Start

### Basic Integration

```typescript
import { SupportHelper } from '@support-helper/sdk-web';

// Initialize the SDK
const supportHelper = new SupportHelper({
  sdkKey: 'sk_live_your_sdk_key_here',
  apiUrl: 'https://api.support-helper.com',
});

// Start recording when user clicks report button
document.getElementById('report-btn').addEventListener('click', async () => {
  await supportHelper.startRecording();
});

// Stop and submit report
document.getElementById('submit-btn').addEventListener('click', async () => {
  const videoBlob = await supportHelper.stopRecording();

  const ticketId = await supportHelper.report({
    title: 'Bug Report',
    description: 'Description of the issue...',
  });

  // Upload video to the ticket
  await supportHelper.uploadVideo(ticketId, videoBlob);

  console.log('Report submitted:', ticketId);
});
```

### One-Line Setup

```typescript
// Auto-attach to a button element
const supportHelper = SupportHelper.initialize({
  sdkKey: 'sk_live_your_sdk_key',
  apiUrl: 'https://api.support-helper.com',
}, '#report-button');
```

## Configuration

### Configuration Options

```typescript
interface SupportHelperConfig {
  // Required: Your SDK key from the dashboard
  sdkKey: string;

  // Required: API endpoint URL
  apiUrl: string;

  // Optional: Custom context to include with reports
  customContext?: Record<string, unknown>;
}
```

### Getting Your SDK Key

1. Log in to your Support Helper Dashboard
2. Go to **Settings** → **Applications**
3. Create or select an application
4. Copy the SDK Key

### Environment-Specific Keys

```typescript
const config = {
  sdkKey: process.env.NODE_ENV === 'production'
    ? 'sk_live_production_key'
    : 'sk_test_development_key',
  apiUrl: process.env.NODE_ENV === 'production'
    ? 'https://api.support-helper.com'
    : 'http://localhost:3001',
};
```

## API Reference

### SupportHelper Class

#### Constructor

```typescript
new SupportHelper(config: SupportHelperConfig)
```

#### Methods

##### `startRecording(): Promise<void>`

Start screen recording.

```typescript
await supportHelper.startRecording();
```

**Behavior:**
- Prompts user to select screen/window/tab to share
- Begins video capture
- Throws if recording already in progress

##### `stopRecording(): Promise<Blob>`

Stop recording and get video blob.

```typescript
const videoBlob = await supportHelper.stopRecording();
console.log('Video size:', videoBlob.size);
```

**Returns:** `Blob` - The recorded video in WebM format

##### `pauseRecording(): Promise<void>`

Pause the current recording.

```typescript
await supportHelper.pauseRecording();
```

##### `resumeRecording(): Promise<void>`

Resume a paused recording.

```typescript
await supportHelper.resumeRecording();
```

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
interface ReportOptions {
  title: string;        // Required: Report title
  description: string;  // Required: Detailed description
  includeVideo?: boolean; // Optional: Include video (default: false)
}

const ticketId = await supportHelper.report({
  title: 'Login button not working',
  description: 'When I click the login button, nothing happens.',
});
```

**Returns:** `string` - The created ticket ID

##### `uploadVideo(ticketId: string, videoBlob: Blob): Promise<void>`

Upload video to an existing ticket.

```typescript
const videoBlob = await supportHelper.stopRecording();
await supportHelper.uploadVideo(ticketId, videoBlob);
```

#### Static Methods

##### `SupportHelper.initialize(config, buttonSelector?): SupportHelper`

Initialize SDK and optionally attach to a button.

```typescript
const sdk = SupportHelper.initialize(
  { sdkKey: 'sk_live_...', apiUrl: '...' },
  '#report-button'
);
```

### VideoRecorder Class

Low-level video recording control.

```typescript
import { VideoRecorder } from '@support-helper/sdk-web';

const recorder = new VideoRecorder({
  mimeType: 'video/webm',
  audioTracks: true,
  videoBitsPerSecond: 2500000, // 2.5 Mbps
});

await recorder.start();
// ... recording ...
const blob = await recorder.stop();
```

### ContextCapture Class

Capture browser/system context.

```typescript
import { ContextCapture } from '@support-helper/sdk-web';

const context = ContextCapture.captureContext({
  customField: 'custom value',
});

console.log(context);
// {
//   os: 'Windows 11',
//   browser: 'Chrome 120.0.0',
//   viewport: { width: 1920, height: 1080 },
//   url: 'https://example.com/page',
//   language: 'en-US',
//   timestamp: '2024-01-15T10:30:00Z',
//   customField: 'custom value'
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
const ticket = await api.createTicket({
  title: 'Bug Report',
  description: '...',
  userContext: { ... },
  sessionId: 'session_123',
});

// Get upload URL
const upload = await api.getUploadUrl({
  ticketId: ticket.id,
  type: 'video',
  filename: 'recording.webm',
  size: 5000000,
  contentType: 'video/webm',
});

// Upload file
await api.uploadFile(upload.uploadUrl, videoBlob);

// Confirm upload
await api.confirmUpload(upload.mediaId);
```

## Framework Integrations

### React

```tsx
// hooks/useSupportHelper.ts
import { useState, useEffect, useCallback } from 'react';
import { SupportHelper } from '@support-helper/sdk-web';

const supportHelper = new SupportHelper({
  sdkKey: process.env.NEXT_PUBLIC_SDK_KEY!,
  apiUrl: process.env.NEXT_PUBLIC_API_URL!,
});

export function useSupportHelper() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      await supportHelper.startRecording();
      setIsRecording(true);
    } catch (err) {
      setError(err as Error);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      const blob = await supportHelper.stopRecording();
      setIsRecording(false);
      return blob;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const submitReport = useCallback(async (
    title: string,
    description: string,
    videoBlob?: Blob
  ) => {
    try {
      const ticketId = await supportHelper.report({ title, description });
      if (videoBlob) {
        await supportHelper.uploadVideo(ticketId, videoBlob);
      }
      return ticketId;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    isRecording,
    error,
    startRecording,
    stopRecording,
    submitReport,
  };
}

// components/ReportButton.tsx
import { useSupportHelper } from '../hooks/useSupportHelper';

export function ReportButton() {
  const { isRecording, startRecording, stopRecording, submitReport } = useSupportHelper();
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);

  const handleClick = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      setVideoBlob(blob);
      // Show modal to submit report
    } else {
      await startRecording();
    }
  };

  return (
    <button onClick={handleClick}>
      {isRecording ? 'Stop Recording' : 'Report Issue'}
    </button>
  );
}
```

### Vue 3

```vue
<!-- composables/useSupportHelper.ts -->
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { SupportHelper } from '@support-helper/sdk-web';

const supportHelper = ref<SupportHelper | null>(null);
const isRecording = ref(false);
const error = ref<Error | null>(null);

onMounted(() => {
  supportHelper.value = new SupportHelper({
    sdkKey: import.meta.env.VITE_SDK_KEY,
    apiUrl: import.meta.env.VITE_API_URL,
  });
});

async function startRecording() {
  try {
    error.value = null;
    await supportHelper.value?.startRecording();
    isRecording.value = true;
  } catch (err) {
    error.value = err as Error;
  }
}

async function stopRecording() {
  try {
    const blob = await supportHelper.value?.stopRecording();
    isRecording.value = false;
    return blob;
  } catch (err) {
    error.value = err as Error;
    throw err;
  }
}

async function submitReport(title: string, description: string, videoBlob?: Blob) {
  const ticketId = await supportHelper.value?.report({ title, description });
  if (videoBlob && ticketId) {
    await supportHelper.value?.uploadVideo(ticketId, videoBlob);
  }
  return ticketId;
}
</script>

<!-- ReportButton.vue -->
<template>
  <button @click="handleClick">
    {{ isRecording ? 'Stop Recording' : 'Report Issue' }}
  </button>
</template>

<script setup lang="ts">
import { useSupportHelper } from '../composables/useSupportHelper';

const { isRecording, startRecording, stopRecording } = useSupportHelper();

async function handleClick() {
  if (isRecording.value) {
    await stopRecording();
  } else {
    await startRecording();
  }
}
</script>
```

### Angular

```typescript
// support-helper.service.ts
import { Injectable } from '@angular/core';
import { SupportHelper } from '@support-helper/sdk-web';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupportHelperService {
  private sdk: SupportHelper;
  private _isRecording = new BehaviorSubject<boolean>(false);

  isRecording$ = this._isRecording.asObservable();

  constructor() {
    this.sdk = new SupportHelper({
      sdkKey: environment.sdkKey,
      apiUrl: environment.apiUrl,
    });
  }

  async startRecording(): Promise<void> {
    await this.sdk.startRecording();
    this._isRecording.next(true);
  }

  async stopRecording(): Promise<Blob> {
    const blob = await this.sdk.stopRecording();
    this._isRecording.next(false);
    return blob;
  }

  async submitReport(title: string, description: string, video?: Blob): Promise<string> {
    const ticketId = await this.sdk.report({ title, description });
    if (video) {
      await this.sdk.uploadVideo(ticketId, video);
    }
    return ticketId;
  }
}

// report-button.component.ts
import { Component } from '@angular/core';
import { SupportHelperService } from './support-helper.service';

@Component({
  selector: 'app-report-button',
  template: `
    <button (click)="handleClick()">
      {{ (supportHelper.isRecording$ | async) ? 'Stop Recording' : 'Report Issue' }}
    </button>
  `
})
export class ReportButtonComponent {
  constructor(public supportHelper: SupportHelperService) {}

  async handleClick() {
    if (await this.supportHelper.isRecording$.toPromise()) {
      await this.supportHelper.stopRecording();
    } else {
      await this.supportHelper.startRecording();
    }
  }
}
```

### Vanilla JavaScript

```html
<!DOCTYPE html>
<html>
<head>
  <title>Support Helper Demo</title>
</head>
<body>
  <button id="record-btn">Start Recording</button>
  <button id="submit-btn" disabled>Submit Report</button>

  <dialog id="report-dialog">
    <form method="dialog">
      <h2>Submit Bug Report</h2>
      <input type="text" id="title" placeholder="Title" required>
      <textarea id="description" placeholder="Description" required></textarea>
      <button type="submit">Submit</button>
      <button type="button" onclick="this.closest('dialog').close()">Cancel</button>
    </form>
  </dialog>

  <script src="https://cdn.support-helper.com/sdk/v1/support-helper.min.js"></script>
  <script>
    const supportHelper = new SupportHelper({
      sdkKey: 'sk_live_your_key',
      apiUrl: 'https://api.support-helper.com',
    });

    let videoBlob = null;

    document.getElementById('record-btn').addEventListener('click', async function() {
      if (supportHelper.isRecording()) {
        videoBlob = await supportHelper.stopRecording();
        this.textContent = 'Start Recording';
        document.getElementById('submit-btn').disabled = false;
        document.getElementById('report-dialog').showModal();
      } else {
        await supportHelper.startRecording();
        this.textContent = 'Stop Recording';
      }
    });

    document.getElementById('report-dialog').addEventListener('close', async function() {
      if (this.returnValue === 'submit') {
        const title = document.getElementById('title').value;
        const description = document.getElementById('description').value;

        const ticketId = await supportHelper.report({ title, description });
        if (videoBlob) {
          await supportHelper.uploadVideo(ticketId, videoBlob);
        }

        alert('Report submitted! ID: ' + ticketId);
        videoBlob = null;
      }
    });
  </script>
</body>
</html>
```

## TypeScript Types

```typescript
// Full type definitions

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

export interface VideoRecorderOptions {
  mimeType?: string;
  audioTracks?: boolean;
  videoBitsPerSecond?: number;
}

export interface UserContext {
  os: string;
  browser: string;
  viewport: {
    width: number;
    height: number;
  };
  url: string;
  language: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface APIClientOptions {
  baseUrl: string;
  sdkKey: string;
  timeout?: number;
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

## Advanced Usage

### Custom Context

```typescript
const supportHelper = new SupportHelper({
  sdkKey: 'sk_live_...',
  apiUrl: '...',
  customContext: {
    userId: currentUser.id,
    userEmail: currentUser.email,
    appVersion: '2.3.1',
    environment: 'production',
  },
});
```

### Error Handling

```typescript
try {
  await supportHelper.startRecording();
} catch (error) {
  if (error.message === 'Permission denied to capture screen') {
    // User denied screen sharing permission
    showNotification('Please allow screen sharing to record.');
  } else if (error.message === 'Recording already in progress') {
    // Already recording
  } else {
    // Handle other errors
    console.error('Recording failed:', error);
  }
}
```

### Offline Support (Coming Soon)

```typescript
// Future feature: offline queue
const supportHelper = new SupportHelper({
  sdkKey: 'sk_live_...',
  apiUrl: '...',
  offline: {
    enabled: true,
    maxQueueSize: 10,
    retryInterval: 30000,
  },
});
```

### Recording Options

```typescript
import { VideoRecorder } from '@support-helper/sdk-web';

const recorder = new VideoRecorder({
  // Video format
  mimeType: 'video/webm;codecs=vp9',

  // Include system audio
  audioTracks: true,

  // Video quality (bits per second)
  videoBitsPerSecond: 5000000, // 5 Mbps for high quality
});
```

## Troubleshooting

### Common Issues

**"Permission denied to capture screen"**
- User clicked "Cancel" on screen sharing prompt
- Browser doesn't support screen capture
- Page not served over HTTPS

**"Recording not in progress"**
- Called `stopRecording()` without `startRecording()`
- Recording was already stopped

**"Invalid SDK key"**
- Check SDK key is correct
- Ensure using production key in production

**"Network error"**
- Check API URL is correct
- Verify CORS is configured
- Check internet connection

### Browser Support

| Browser | Minimum Version | Notes |
|---------|-----------------|-------|
| Chrome | 72+ | Full support |
| Firefox | 66+ | Full support |
| Safari | 13+ | Limited audio support |
| Edge | 79+ | Full support |

### Debug Mode

```typescript
// Enable console logging
localStorage.setItem('SUPPORT_HELPER_DEBUG', 'true');

// View captured context
const context = ContextCapture.captureContext();
console.log('Context:', context);
```

### File Size Limits

- Maximum video size: 100MB
- Maximum recording duration: 10 minutes
- Recommended: Keep recordings under 2 minutes

### Performance Tips

1. Use lower bitrate for longer recordings
2. Compress videos client-side if needed
3. Use web workers for heavy processing
4. Implement chunked uploads for large files
