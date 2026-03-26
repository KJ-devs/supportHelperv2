import { CodecDetector } from '../utils/codec-detector';

export interface VideoRecorderOptions {
  mimeType?: string;
  audioTracks?: boolean;
  videoBitsPerSecond?: number;
  autoDetectCodec?: boolean; // New option to enable auto-detection
}

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private isRecording = false;

  constructor(private options: VideoRecorderOptions = {}) {
    // Auto-detect best codec if enabled (default: true)
    const autoDetect = options.autoDetectCodec !== false;
    const detectedMimeType = autoDetect
      ? CodecDetector.getBestSupportedCodec().mimeType
      : 'video/webm';

    this.options = {
      mimeType: detectedMimeType,
      audioTracks: true,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
      autoDetectCodec: true,
      ...options,
    };
  }

  async start(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    try {
      // Request display stream (screen + optional audio)
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          // cursor is a valid option for getDisplayMedia
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: this.options.audioTracks ? true : false,
      });

      const mediaRecorderOptions: MediaRecorderOptions = {
        mimeType: this.options.mimeType,
      };

      if (this.options.videoBitsPerSecond) {
        mediaRecorderOptions.videoBitsPerSecond = this.options.videoBitsPerSecond;
      }

      this.mediaRecorder = new MediaRecorder(this.stream, mediaRecorderOptions);

      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      // Handle stream stop (user clicked stop in browser dialog)
      this.stream.getTracks().forEach(track => {
        track.onended = () => {
          this.stop();
        };
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('Permission denied to capture screen');
      }
      throw error;
    }
  }

  async startWithStream(stream: MediaStream): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording already in progress');
    }

    this.stream = stream;

    const mediaRecorderOptions: MediaRecorderOptions = {
      mimeType: this.options.mimeType,
    };

    if (this.options.videoBitsPerSecond) {
      mediaRecorderOptions.videoBitsPerSecond = this.options.videoBitsPerSecond;
    }

    this.mediaRecorder = new MediaRecorder(this.stream, mediaRecorderOptions);

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
    this.isRecording = true;

    this.stream.getTracks().forEach(track => {
      track.onended = () => {
        this.stop();
      };
    });
  }

  stop(): Promise<Blob> {
    // If already stopped or not initialized
    if (!this.mediaRecorder || !this.isRecording) {
      // Return existing chunks if we have captured data
      if (this.chunks.length > 0) {
        const blob = new Blob(this.chunks, { type: this.options.mimeType || 'video/webm' });
        this.chunks = [];
        this.isRecording = false;
        return Promise.resolve(blob);
      }
      // No data captured - throw instead of returning empty blob
      this.isRecording = false;
      return Promise.reject(new Error('No recording in progress'));
    }

    return new Promise<Blob>((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'));
        return;
      }

      // Mark as not recording immediately to prevent double-stop
      this.isRecording = false;

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.options.mimeType });
        this.chunks = [];

        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }

        resolve(blob);
      };

      this.mediaRecorder.onerror = (event: Event) => {
        this.chunks = [];
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        const mediaErrorEvent = event as ErrorEvent;
        const errorMessage = mediaErrorEvent.error?.message || mediaErrorEvent.message || 'Unknown error';
        reject(
          new Error('MediaRecorder error: ' + errorMessage)
        );
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        // MediaRecorder.stop() can throw if already stopped
        console.warn('[VideoRecorder] MediaRecorder.stop() threw:', err);
        const blob = new Blob(this.chunks, { type: this.options.mimeType });
        this.chunks = [];
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
        resolve(blob);
      }
    });
  }

  isActive(): boolean {
    return this.isRecording;
  }

  async pause(): Promise<void> {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error('Recording not in progress');
    }
    this.mediaRecorder.pause();
  }

  async resume(): Promise<void> {
    if (!this.mediaRecorder || !this.isRecording) {
      throw new Error('Recording not in progress');
    }
    this.mediaRecorder.resume();
  }
}
