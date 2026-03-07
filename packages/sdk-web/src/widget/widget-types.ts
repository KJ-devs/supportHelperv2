export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export type WidgetTheme = 'light' | 'dark' | 'auto';

export type WidgetState =
  | 'idle'
  | 'open'
  | 'recording'
  | 'preview'
  | 'editing'
  | 'submitting'
  | 'analyzing'
  | 'success'
  | 'error';

export type WidgetAction =
  | 'OPEN'
  | 'CLOSE'
  | 'START'
  | 'STOP'
  | 'PAUSE'
  | 'RESUME'
  | 'ACCEPT'
  | 'RE_RECORD'
  | 'SUBMIT'
  | 'SUCCESS'
  | 'ANALYZE'
  | 'ANALYSIS_DONE'
  | 'ANALYSIS_TIMEOUT'
  | 'ERROR'
  | 'RESET';

export interface WidgetConfig {
  sdkKey: string;
  apiUrl: string;
  position: WidgetPosition;
  primaryColor: string;
  zIndex: number;
  theme: WidgetTheme;
  locale?: 'en' | 'fr';
}

export interface ReportPayload {
  title: string;
  description: string;
  videoBlob: Blob | null;
  userContext: Record<string, unknown>;
}

export interface ReportResponse {
  ticket: {
    id: string;
    status: string;
  };
  video?: {
    received: boolean;
    filename: string;
    size: number;
  };
  aiAnalysis?: {
    summary: string;
    severity: string;
    severityConfidence: number;
    type: string;
    typeConfidence: number;
    keywords: string[];
    enrichedDescription?: string;
  };
}

/**
 * Response shape from GET /api/sdk/tickets/:id
 */
export interface TicketStatusResponse {
  id: string;
  title: string;
  status: string;
  aiSummary: string | null;
  aiAnalysis: string | null;
  severity: string | null;
  type: string | null;
}

/**
 * Context passed to the analyzing view template.
 */
export interface AnalyzingContext {
  ticketId: string;
  /** Elapsed seconds since polling started (used for progress display). */
  elapsedSeconds: number;
  /** Whether the polling timed out without receiving results. */
  timedOut: boolean;
  /** AI results once received. */
  aiResult?: {
    summary: string;
    severity: string | null;
    type: string | null;
  };
}

export interface WidgetEventMap {
  'sh:open': CustomEvent<void>;
  'sh:close': CustomEvent<void>;
  'sh:recording-start': CustomEvent<void>;
  'sh:recording-stop': CustomEvent<{ duration: number; size: number }>;
  'sh:submit': CustomEvent<{ ticketId: string; aiAnalysis?: ReportResponse['aiAnalysis'] }>;
  'sh:error': CustomEvent<{ message: string }>;
  /** Emitted when queued reports are successfully flushed to the server. */
  'sh:queue-flushed': CustomEvent<{ submitted: number; failed: number }>;
  /** Emitted when a queued report fails to submit (with retry info). */
  'sh:queue-error': CustomEvent<{ entryId: number; message: string; attempts: number }>;
  /** Emitted when a report is queued offline instead of sent immediately. */
  'sh:queued': CustomEvent<{ reason: string }>;
}
