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

import { ref, onMounted, onBeforeUnmount, defineComponent, h } from 'vue';
import type { ReportResponse, WidgetPosition, WidgetTheme } from '../widget/widget-types';

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
  /** Theme: light, dark, or auto (default: auto) */
  theme?: WidgetTheme;
}

/**
 * Support Helper Widget Vue Component
 *
 * This component wraps the <support-helper> custom element for Vue
 */
export const SupportHelperWidget = defineComponent({
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
    theme: {
      type: String as () => WidgetTheme,
      default: 'auto',
    },
  },

  emits: ['open', 'close', 'recording-start', 'recording-stop', 'submit', 'error'],

  setup(props: SupportHelperWidgetProps, { emit, expose }) {
    const elementRef = ref<HTMLElement | null>(null);

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

    return (): ReturnType<typeof h> => {
      const attrs: Record<string, string | number> = {
        'sdk-key': props.sdkKey,
        'api-url': props.apiUrl,
        position: props.position || 'bottom-right',
        theme: props.theme || 'auto',
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

/**
 * Composable to programmatically control the widget
 */
export function useSupportHelper(elementRef: ReturnType<typeof ref<HTMLElement | null>>): {
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
