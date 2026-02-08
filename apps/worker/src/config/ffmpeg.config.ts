import { registerAs } from '@nestjs/config';

/**
 * FFmpeg Configuration
 */
export default registerAs('ffmpeg', () => ({
  // Keyframe extraction settings
  keyframes: {
    fps: 1, // Extract 1 frame per second
    format: 'png',
    quality: 90,
    scale: 1920, // Max width (maintain aspect ratio)
  },

  // Video processing
  video: {
    maxDuration: 600, // 10 minutes max
    maxFileSize: 500 * 1024 * 1024, // 500MB
    supportedFormats: ['mp4', 'webm', 'mov'],
  },

  // Thumbnail generation
  thumbnail: {
    width: 1280,
    height: 720,
    timestamp: 1, // 1 second into video
  },

  // Parallel processing
  parallel: {
    maxWorkers: 4,
    chunkSize: 10, // Process 10 frames at a time
  },
}));
