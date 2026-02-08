'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { ReactNode, useEffect } from 'react';

// Analytics event types (mirror backend events)
export enum AnalyticsEvent {
  // Page views
  PAGE_VIEW = '$pageview',

  // Ticket events
  TICKET_VIEWED = 'ticket_viewed',
  TICKET_CREATED = 'ticket_created',
  TICKET_UPDATED = 'ticket_updated',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_RESOLVED = 'ticket_resolved',
  TICKET_FILTERED = 'ticket_filtered',
  TICKET_SEARCHED = 'ticket_searched',

  // User events
  USER_SIGNED_UP = 'user_signed_up',
  USER_LOGGED_IN = 'user_logged_in',
  USER_LOGGED_OUT = 'user_logged_out',
  USER_PROFILE_UPDATED = 'user_profile_updated',

  // Dashboard events
  DASHBOARD_VIEWED = 'dashboard_viewed',
  ANALYTICS_EXPORTED = 'analytics_exported',
  SETTINGS_CHANGED = 'settings_changed',

  // Application events
  APPLICATION_CREATED = 'application_created',
  SDK_KEY_COPIED = 'sdk_key_copied',
  SDK_KEY_REGENERATED = 'sdk_key_regenerated',

  // Integration events
  GITHUB_CONNECTED = 'github_connected',
  GITHUB_ISSUE_CREATED = 'github_issue_created',

  // AI events
  AI_AGENT_STARTED = 'ai_agent_started',
  AI_FEEDBACK_SUBMITTED = 'ai_feedback_submitted',

  // Video events
  VIDEO_PLAYED = 'video_played',
  VIDEO_DOWNLOADED = 'video_downloaded',
}

let posthogInitialized = false;

export function initPostHog() {
  if (typeof window === 'undefined') return;
  if (posthogInitialized) return;

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

  if (!apiKey) {
    console.log('[PostHog] Disabled - No API key configured');
    return;
  }

  posthog.init(apiKey, {
    api_host: host,
    capture_pageview: false, // We'll handle this manually for more control
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: {
      dom_event_allowlist: ['click', 'submit'],
      url_allowlist: ['.*'],
      element_allowlist: ['button', 'a', 'form'],
    },
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: '[data-mask]',
    },
    loaded: (ph) => {
      // Disable in development unless explicitly enabled
      if (process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_POSTHOG_DEV) {
        ph.opt_out_capturing();
      }
    },
  });

  posthogInitialized = true;
  console.log('[PostHog] Initialized successfully');
}

// PostHog Provider component
export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

// Capture event
export function capture(
  event: AnalyticsEvent | string,
  properties?: Record<string, unknown>,
) {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.capture(event, {
    ...properties,
    $lib: 'support-helper-dashboard',
  });
}

// Identify user
export function identify(
  userId: string,
  properties?: {
    email?: string;
    name?: string;
    tenantId?: string;
    role?: string;
    plan?: string;
  },
) {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.identify(userId, properties);
}

// Set user properties
export function setPersonProperties(properties: Record<string, unknown>) {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.people.set(properties);
}

// Associate user with a group (tenant)
export function setGroup(groupType: string, groupKey: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.group(groupType, groupKey, properties);
}

// Reset (on logout)
export function reset() {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.reset();
}

// Page view tracking
export function capturePageView(url?: string) {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.capture('$pageview', {
    $current_url: url || window.location.href,
  });
}

// Feature flags
export async function isFeatureEnabled(featureKey: string): Promise<boolean> {
  if (typeof window === 'undefined' || !posthogInitialized) return false;

  return posthog.isFeatureEnabled(featureKey) ?? false;
}

export function getFeatureFlag(featureKey: string): boolean | string | undefined {
  if (typeof window === 'undefined' || !posthogInitialized) return undefined;

  return posthog.getFeatureFlag(featureKey);
}

export function getFeatureFlagPayload(featureKey: string): unknown {
  if (typeof window === 'undefined' || !posthogInitialized) return null;

  return posthog.getFeatureFlagPayload(featureKey);
}

// Reload feature flags
export function reloadFeatureFlags() {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.reloadFeatureFlags();
}

// Opt out of tracking
export function optOut() {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.opt_out_capturing();
}

// Opt in to tracking
export function optIn() {
  if (typeof window === 'undefined' || !posthogInitialized) return;

  posthog.opt_in_capturing();
}

// Check if opted out
export function hasOptedOut(): boolean {
  if (typeof window === 'undefined' || !posthogInitialized) return true;

  return posthog.has_opted_out_capturing();
}

// Convenience methods
export const analytics = {
  capture,
  identify,
  setPersonProperties,
  setGroup,
  reset,
  capturePageView,
  isFeatureEnabled,
  getFeatureFlag,
  getFeatureFlagPayload,
  reloadFeatureFlags,
  optOut,
  optIn,
  hasOptedOut,
};

export default analytics;
