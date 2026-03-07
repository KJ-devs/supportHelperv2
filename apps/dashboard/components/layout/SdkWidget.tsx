'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

interface SdkWindow extends Window {
  SupportHelper?: { init: (opts: Record<string, unknown>) => HTMLElement };
}

const SDK_KEY = 'sk_GojA7oEFJRpK0Dj22VsO2LyO913baczo';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function SdkWidget() {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const widgetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!scriptLoaded || widgetRef.current) return;

    const win = window as SdkWindow;
    if (!win.SupportHelper) return;

    const element = win.SupportHelper.init({
      sdkKey: SDK_KEY,
      apiUrl: API_URL,
      position: 'bottom-right',
      theme: 'auto',
    });

    widgetRef.current = element;

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [scriptLoaded]);

  return (
    <Script src="/sdk.iife.js" strategy="afterInteractive" onLoad={() => setScriptLoaded(true)} />
  );
}
