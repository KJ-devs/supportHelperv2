/**
 * Vue Wrapper for Support Helper Widget
 *
 * Usage:
 * <script setup>
 * import { SupportHelperWidget } from '@support-helper/sdk-web/vue';
 * </script>
 * <template>
 *   <SupportHelperWidget sdk-key="sk_xxx" api-url="https://..." @submit="onSubmit" />
 * </template>
 */

import type { ReportResponse, WidgetPosition } from '../widget/widget-types';

// Ensure the custom element is registered
import '../widget/index';

export interface SubmitEventData {
  ticketId: string;
  aiAnalysis?: ReportResponse['aiAnalysis'];
}

export interface RecordingStopEventData {
  duration: number;
  size: number;
}

export interface ErrorEventData {
  message: string;
}

// Minimal Vue types for when vue is not installed
interface VueRef<T> {
  value: T;
}

type VueEmit = (event: string, ...args: unknown[]) => void;
type VueExpose = (exposed: Record<string, unknown>) => void;

/**
 * Get Vue dynamically - avoids compile-time dependency
 */
function getVue(): {
  defineComponent: (options: Record<string, unknown>) => unknown;
  ref: <T>(value: T) => VueRef<T>;
  onMounted: (fn: () => void) => void;
  onBeforeUnmount: (fn: () => void) => void;
  h: (type: string, props: Record<string, unknown>) => unknown;
} | null {
  try {
    // Check for globally available Vue (CDN or pre-bundled)
    const g = globalThis as Record<string, unknown>;
    if (g.Vue) return g.Vue as ReturnType<typeof getVue>;

    // In bundled environments, the consuming app provides Vue as a peer dependency.
    // We avoid eval/require to stay CSP-safe and bundler-compatible.
    return null;
  } catch {
    return null;
  }
}

/**
 * Props interface for the component
 */
export interface SupportHelperWidgetProps {
  /** SDK Key for authentication */
  sdkKey: string;
  /** API URL endpoint */
  apiUrl: string;
  /** Position of the floating button */
  position?: WidgetPosition;
  /** Primary theme color */
  primaryColor?: string;
  /** Z-index for the widget */
  zIndex?: number;
}

/**
 * Support Helper Widget Vue Component
 *
 * This component wraps the <support-helper> custom element for Vue
 */
export const SupportHelperWidget = /* @__PURE__ */ (() => {
  const Vue = getVue();
  if (!Vue) {
    // Return a stub component when Vue is not available
    return {
      name: 'SupportHelperWidget',
      render(): null {
        console.error('[SupportHelper] Vue is required for this component');
        return null;
      },
    };
  }

  const { defineComponent, ref, onMounted, onBeforeUnmount, h } = Vue;

  return defineComponent({
    name: 'SupportHelperWidget',

    props: {
      sdkKey: {
        type: String,
        required: true,
      },
      apiUrl: {
        type: String,
        required: true,
      },
      position: {
        type: String as () => WidgetPosition,
        default: 'bottom-right',
      },
      primaryColor: {
        type: String,
        default: undefined,
      },
      zIndex: {
        type: Number,
        default: undefined,
      },
    },

    emits: ['open', 'close', 'recording-start', 'recording-stop', 'submit', 'error'],

    setup(props: SupportHelperWidgetProps, { emit, expose }: { emit: VueEmit; expose: VueExpose }) {
      const elementRef = ref<HTMLElement | null>(null);

      // Event handlers
      const handleOpen = (): void => emit('open');
      const handleClose = (): void => emit('close');
      const handleRecordingStart = (): void => emit('recording-start');
      const handleRecordingStop = (e: Event): void => {
        const detail = (e as CustomEvent<RecordingStopEventData>).detail;
        emit('recording-stop', detail);
      };
      const handleSubmit = (e: Event): void => {
        const detail = (e as CustomEvent<SubmitEventData>).detail;
        emit('submit', detail);
      };
      const handleError = (e: Event): void => {
        const detail = (e as CustomEvent<ErrorEventData>).detail;
        emit('error', detail);
      };

      onMounted(() => {
        const el = elementRef.value;
        if (!el) return;

        el.addEventListener('sh:open', handleOpen);
        el.addEventListener('sh:close', handleClose);
        el.addEventListener('sh:recording-start', handleRecordingStart);
        el.addEventListener('sh:recording-stop', handleRecordingStop);
        el.addEventListener('sh:submit', handleSubmit);
        el.addEventListener('sh:error', handleError);
      });

      onBeforeUnmount(() => {
        const el = elementRef.value;
        if (!el) return;

        el.removeEventListener('sh:open', handleOpen);
        el.removeEventListener('sh:close', handleClose);
        el.removeEventListener('sh:recording-start', handleRecordingStart);
        el.removeEventListener('sh:recording-stop', handleRecordingStop);
        el.removeEventListener('sh:submit', handleSubmit);
        el.removeEventListener('sh:error', handleError);
      });

      // Expose methods
      expose({
        open: (): void => {
          const el = elementRef.value as (HTMLElement & { open?: () => void }) | null;
          if (el && typeof el.open === 'function') {
            el.open();
          }
        },
        close: (): void => {
          const el = elementRef.value as (HTMLElement & { close?: () => void }) | null;
          if (el && typeof el.close === 'function') {
            el.close();
          }
        },
        reset: (): void => {
          const el = elementRef.value as (HTMLElement & { reset?: () => void }) | null;
          if (el && typeof el.reset === 'function') {
            el.reset();
          }
        },
      });

      return (): unknown => {
        const attrs: Record<string, string | number> = {
          'sdk-key': props.sdkKey,
          'api-url': props.apiUrl,
          position: props.position || 'bottom-right',
        };

        if (props.primaryColor) {
          attrs['primary-color'] = props.primaryColor;
        }
        if (props.zIndex !== undefined) {
          attrs['z-index'] = props.zIndex;
        }

        return h('support-helper', {
          ref: elementRef,
          ...attrs,
        });
      };
    },
  });
})();

/**
 * Composable to programmatically control the widget
 */
export function useSupportHelper(elementRef: VueRef<HTMLElement | null>): {
  open: () => void;
  close: () => void;
  reset: () => void;
} {
  return {
    open: (): void => {
      const el = elementRef.value as (HTMLElement & { open?: () => void }) | null;
      if (el && typeof el.open === 'function') {
        el.open();
      }
    },
    close: (): void => {
      const el = elementRef.value as (HTMLElement & { close?: () => void }) | null;
      if (el && typeof el.close === 'function') {
        el.close();
      }
    },
    reset: (): void => {
      const el = elementRef.value as (HTMLElement & { reset?: () => void }) | null;
      if (el && typeof el.reset === 'function') {
        el.reset();
      }
    },
  };
}

export default SupportHelperWidget;
