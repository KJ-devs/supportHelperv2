export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export type WidgetState =
  | 'idle'
  | 'open'
  | 'recording'
  | 'preview'
  | 'editing'
  | 'submitting'
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
  | 'ERROR'
  | 'RESET';

export interface WidgetConfig {
  sdkKey: string;
  apiUrl: string;
  position: WidgetPosition;
  primaryColor: string;
  zIndex: number;
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

export interface WidgetEventMap {
  'sh:open': CustomEvent<void>;
  'sh:close': CustomEvent<void>;
  'sh:recording-start': CustomEvent<void>;
  'sh:recording-stop': CustomEvent<{ duration: number; size: number }>;
  'sh:submit': CustomEvent<{ ticketId: string; aiAnalysis?: ReportResponse['aiAnalysis'] }>;
  'sh:error': CustomEvent<{ message: string }>;
}
