import { VideoRecorder } from './recorder/video-recorder';
import { ContextCapture } from './context/context-capture';
import type { UserContext } from './context/context-capture';
import { APIClient } from './api/api-client';

export type { UserContext };

export interface SupportHelperConfig {
  sdkKey: string;
  apiUrl: string;
  customContext?: Record<string, unknown>;
}

export interface ReportOptions {
  title: string;
  description: string;
  includeVideo?: boolean;
  videoBlob?: Blob;
}

export class SupportHelper {
  private sdkKey: string;
  private apiUrl: string;
  private apiClient: APIClient;
  private videoRecorder: VideoRecorder | null = null;
  private customContext?: Record<string, unknown>;
  private currentTicketId: string | null = null;

  constructor(config: SupportHelperConfig) {
    if (!config.sdkKey) {
      throw new Error('SDK key is required');
    }

    this.sdkKey = config.sdkKey;
    this.apiUrl = config.apiUrl;
    this.customContext = config.customContext;

    this.apiClient = new APIClient({
      baseUrl: this.apiUrl,
      sdkKey: this.sdkKey,
    });

    this.setupGlobalErrorHandler();
  }

  private setupGlobalErrorHandler(): void {
    window.addEventListener('error', event => {
      if (this.currentTicketId && event.error instanceof Error && event.error.message) {
        // Could be extended to automatically attach errors to current ticket
        console.debug('Error captured:', event.error);
      }
    });
  }

  /**
   * Start recording the user's screen
   */
  async startRecording(): Promise<void> {
    if (this.videoRecorder?.isActive()) {
      throw new Error('Recording already in progress');
    }

    this.videoRecorder = new VideoRecorder({
      mimeType: 'video/webm',
      audioTracks: true,
    });

    await this.videoRecorder.start();
  }

  /**
   * Stop the current recording and return the video blob
   */
  async stopRecording(): Promise<Blob> {
    if (!this.videoRecorder) {
      throw new Error('No recording in progress');
    }

    return this.videoRecorder.stop();
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.videoRecorder?.isActive() ?? false;
  }

  /**
   * Report an issue with optional video
   */
  async report(options: ReportOptions): Promise<string> {
    try {
      const context = ContextCapture.captureContext(this.customContext);

      // Create ticket
      const ticketResponse = await this.apiClient.createTicket({
        title: options.title,
        description: options.description,
        userContext: context,
        sessionId: this.generateSessionId(),
      });

      this.currentTicketId = ticketResponse.id;

      // Upload video if provided or if recording was stopped
      if (this.videoRecorder?.isActive()) {
        throw new Error('Stop recording before submitting the report');
      }

      const videoBlob = options.videoBlob;
      if (videoBlob && videoBlob.size > 0) {
        await this.uploadVideo(ticketResponse.id, videoBlob);
      }

      return ticketResponse.id;
    } catch (error) {
      console.error('Failed to create ticket:', error);
      throw error;
    }
  }

  /**
   * Upload video to a ticket
   */
  async uploadVideo(ticketId: string, videoBlob: Blob): Promise<void> {
    try {
      // Get upload URL
      const uploadUrlResponse = await this.apiClient.getUploadUrl({
        ticketId,
        type: 'video',
        filename: `recording_${Date.now()}.webm`,
        size: videoBlob.size,
        contentType: 'video/webm',
      });

      // Upload the video
      await this.apiClient.uploadFile(uploadUrlResponse.uploadUrl, videoBlob);

      // Confirm upload
      await this.apiClient.confirmUpload(uploadUrlResponse.mediaId);
    } catch (error) {
      console.error('Failed to upload video:', error);
      throw error;
    }
  }

  /**
   * Pause recording
   */
  async pauseRecording(): Promise<void> {
    if (!this.videoRecorder?.isActive()) {
      throw new Error('Recording not in progress');
    }

    await this.videoRecorder.pause();
  }

  /**
   * Resume recording
   */
  async resumeRecording(): Promise<void> {
    if (!this.videoRecorder?.isActive()) {
      throw new Error('Recording not in progress');
    }

    await this.videoRecorder.resume();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize SDK with button element
   */
  static initialize(config: SupportHelperConfig, buttonSelector?: string): SupportHelper {
    const sdk = new SupportHelper(config);

    if (buttonSelector) {
      const button = document.querySelector(buttonSelector);
      if (button) {
        button.addEventListener('click', () => {
          // Open report modal or start recording
          if (sdk.isRecording()) {
            // Show modal to submit report
            console.log('Show report submission modal');
          } else {
            // Start recording
            sdk.startRecording().catch(error => {
              console.error('Failed to start recording:', error);
            });
          }
        });
      }
    }

    // Expose SDK globally
    if (typeof window !== 'undefined') {
      (window as Window & { SupportHelper?: SupportHelper }).SupportHelper = sdk;
    }

    return sdk;
  }
}

export { VideoRecorder } from './recorder/video-recorder';
export { ContextCapture } from './context/context-capture';
export { APIClient } from './api/api-client';
export { CodecDetector } from './utils/codec-detector';
export type { CodecInfo } from './utils/codec-detector';

// Widget exports
export { SupportHelperElement, init as initWidget } from './widget/index';
export { WidgetStateMachine } from './widget/widget-state-machine';
export { submitReport } from './widget/widget-api';
export type {
  WidgetConfig,
  WidgetState,
  WidgetPosition,
  WidgetEventMap,
  ReportPayload,
  ReportResponse,
} from './widget/widget-types';
