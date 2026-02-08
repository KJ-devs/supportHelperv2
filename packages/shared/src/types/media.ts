export interface Media {
  id: string;
  ticketId: string;
  type: MediaType;

  // Storage
  storageKey: string;
  storageUrl?: string;
  fileSize?: number;
  mimeType?: string;
  durationMs?: number;

  // Processing
  processingStatus: ProcessingStatus;
  processingError?: string;

  // Metadata
  metadata: MediaMetadata;
  createdAt: Date;
}

export type MediaType = 'video' | 'screenshot' | 'log' | 'attachment';

export type ProcessingStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface MediaMetadata {
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  thumbnail?: string;
  [key: string]: unknown;
}

export interface VideoEvent {
  id: string;
  mediaId: string;
  timestampMs: number;
  eventType: VideoEventType;
  eventData?: Record<string, unknown>;
  screenshotKey?: string;
  ocrText?: string;
  createdAt: Date;
}

export type VideoEventType =
  | 'click'
  | 'scroll'
  | 'input'
  | 'navigation'
  | 'error'
  | 'console_log'
  | 'network_request'
  | 'custom';

export interface UploadUrlRequest {
  ticketId: string;
  type: MediaType;
  filename: string;
  contentType: string;
  size: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  mediaId: string;
  storageKey: string;
  expiresAt: Date;
}

export interface VideoAnalysisResult {
  frames: AnalyzedFrame[];
  summary: string;
  detectedErrors: DetectedError[];
  suggestedTitle?: string;
  suggestedType?: string;
  suggestedSeverity?: string;
  processingTimeMs: number;
}

export interface AnalyzedFrame {
  timestampMs: number;
  screenshotKey: string;
  ocrText?: string;
  detectedUI?: UIElement[];
  description?: string;
}

export interface DetectedError {
  timestampMs: number;
  type: 'ui_error' | 'console_error' | 'network_error' | 'crash';
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  context?: string;
}

export interface UIElement {
  type: string;
  text?: string;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
