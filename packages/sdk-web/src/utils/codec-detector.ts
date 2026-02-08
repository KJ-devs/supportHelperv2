/**
 * Codec Detection Utility
 * Automatically detects the best supported video codec for MediaRecorder
 */

export interface CodecInfo {
  mimeType: string;
  displayName: string;
  quality: 'high' | 'medium' | 'low';
}

/**
 * List of codecs in order of preference (best quality first)
 */
const CODEC_PRIORITY: CodecInfo[] = [
  {
    mimeType: 'video/webm;codecs=vp9,opus',
    displayName: 'VP9 with Opus',
    quality: 'high',
  },
  {
    mimeType: 'video/webm;codecs=vp8,opus',
    displayName: 'VP8 with Opus',
    quality: 'medium',
  },
  {
    mimeType: 'video/webm;codecs=h264,opus',
    displayName: 'H.264 with Opus',
    quality: 'medium',
  },
  {
    mimeType: 'video/webm;codecs=vp9',
    displayName: 'VP9',
    quality: 'high',
  },
  {
    mimeType: 'video/webm;codecs=vp8',
    displayName: 'VP8',
    quality: 'medium',
  },
  {
    mimeType: 'video/webm',
    displayName: 'WebM (default)',
    quality: 'medium',
  },
  {
    mimeType: 'video/mp4',
    displayName: 'MP4',
    quality: 'low',
  },
];

export class CodecDetector {
  private static cachedCodec: CodecInfo | null = null;

  /**
   * Get the best supported codec for the current browser
   */
  static getBestSupportedCodec(): CodecInfo {
    // Return cached result if available
    if (this.cachedCodec) {
      return this.cachedCodec;
    }

    // Check if MediaRecorder is supported
    if (!this.isMediaRecorderSupported()) {
      throw new Error('MediaRecorder is not supported in this browser');
    }

    // Find the first supported codec
    for (const codec of CODEC_PRIORITY) {
      if (this.isCodecSupported(codec.mimeType)) {
        this.cachedCodec = codec;
        console.log(`[CodecDetector] Selected codec: ${codec.displayName} (${codec.mimeType})`);
        return codec;
      }
    }

    // Fallback to generic WebM
    const fallback: CodecInfo = {
      mimeType: 'video/webm',
      displayName: 'WebM (fallback)',
      quality: 'medium',
    };

    this.cachedCodec = fallback;
    console.warn('[CodecDetector] No optimal codec found, using fallback');
    return fallback;
  }

  /**
   * Check if a specific codec is supported
   */
  static isCodecSupported(mimeType: string): boolean {
    if (!this.isMediaRecorderSupported()) {
      return false;
    }

    try {
      return MediaRecorder.isTypeSupported(mimeType);
    } catch (error) {
      console.error(`[CodecDetector] Error checking codec support: ${mimeType}`, error);
      return false;
    }
  }

  /**
   * Check if MediaRecorder API is available
   */
  static isMediaRecorderSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function';
  }

  /**
   * Get all supported codecs on this browser
   */
  static getAllSupportedCodecs(): CodecInfo[] {
    if (!this.isMediaRecorderSupported()) {
      return [];
    }

    return CODEC_PRIORITY.filter(codec => this.isCodecSupported(codec.mimeType));
  }

  /**
   * Get browser capabilities report
   */
  static getBrowserCapabilities(): {
    mediaRecorderSupported: boolean;
    supportedCodecs: CodecInfo[];
    recommendedCodec: CodecInfo | null;
  } {
    const mediaRecorderSupported = this.isMediaRecorderSupported();

    if (!mediaRecorderSupported) {
      return {
        mediaRecorderSupported: false,
        supportedCodecs: [],
        recommendedCodec: null,
      };
    }

    return {
      mediaRecorderSupported: true,
      supportedCodecs: this.getAllSupportedCodecs(),
      recommendedCodec: this.getBestSupportedCodec(),
    };
  }

  /**
   * Clear cached codec (useful for testing)
   */
  static clearCache(): void {
    this.cachedCodec = null;
  }
}
