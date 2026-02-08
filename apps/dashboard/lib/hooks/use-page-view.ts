'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { capturePageView } from '@/lib/monitoring/posthog';

/**
 * Hook to track page views with PostHog
 * Add this to your layout or page components
 */
export function usePageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (pathname) {
      const url = searchParams?.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;

      capturePageView(window.location.origin + url);
    }
  }, [pathname, searchParams]);
}
