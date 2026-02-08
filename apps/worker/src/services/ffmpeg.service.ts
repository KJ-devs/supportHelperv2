import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ffmpeg from 'fluent-ffmpeg';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  bitrate: number;
}

export interface KeyframeResult {
  frames: string[]; // Paths to extracted frames
  metadata: VideoMetadata;
  totalFrames: number;
}

/**
 * FFmpeg Service
 *
 * Handles video processing operations:
 * - Keyframe extraction (1 frame/sec)
 * - Video metadata extraction
 * - Thumbnail generation
 */
@Injectable()
export class FFmpegService {
  private readonly logger = new Logger(FFmpegService.name);
  private readonly config: any;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get('ffmpeg');
  }

  /**
   * Extract keyframes from video at specified FPS
   */
  async extractKeyframes(videoPath: string, outputDir?: string): Promise<KeyframeResult> {
    const outputDirectory = outputDir || (await fs.mkdtemp(path.join(os.tmpdir(), 'keyframes-')));

    this.logger.log(`Extracting keyframes from ${videoPath}`);

    try {
      // First, get video metadata
      const metadata = await this.getMetadata(videoPath);

      // Calculate total frames to extract
      const totalFrames = Math.floor(metadata.duration * this.config.keyframes.fps);

      this.logger.log(
        `Video duration: ${metadata.duration}s, extracting ${totalFrames} frames at ${this.config.keyframes.fps} fps`
      );

      // Extract frames
      await this.extractFrames(videoPath, outputDirectory);

      // Get list of extracted frame files
      const files = await fs.readdir(outputDirectory);
      const frames = files
        .filter(f => f.endsWith('.png'))
        .map(f => path.join(outputDirectory, f))
        .sort();

      this.logger.log(`Extracted ${frames.length} keyframes to ${outputDirectory}`);

      return {
        frames,
        metadata,
        totalFrames: frames.length,
      };
    } catch (error) {
      this.logger.error(`Failed to extract keyframes: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Extract frames using FFmpeg
   */
  private async extractFrames(videoPath: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          `-vf fps=${this.config.keyframes.fps},scale=${this.config.keyframes.scale}:-1`,
          `-q:v ${100 - this.config.keyframes.quality}`, // Quality (lower is better)
        ])
        .output(path.join(outputDir, 'frame-%04d.png'))
        .on('end', () => resolve())
        .on('error', err => reject(err))
        .on('progress', progress => {
          if (progress.percent) {
            this.logger.debug(`Extraction progress: ${progress.percent.toFixed(2)}%`);
          }
        })
        .run();
    });
  }

  /**
   * Get video metadata using FFprobe
   */
  async getMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          return reject(err);
        }

        try {
          const videoStream = metadata.streams.find(s => s.codec_type === 'video');

          if (!videoStream) {
            throw new Error('No video stream found');
          }

          const result: VideoMetadata = {
            duration: metadata.format.duration || 0,
            width: videoStream.width || 0,
            height: videoStream.height || 0,
            fps: this.parseFPS(videoStream.avg_frame_rate || videoStream.r_frame_rate),
            codec: videoStream.codec_name || 'unknown',
            bitrate: metadata.format.bit_rate
              ? parseInt(metadata.format.bit_rate.toString(), 10)
              : 0,
          };

          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Parse FPS from FFmpeg format (e.g., "30/1" or "30000/1001")
   */
  private parseFPS(fpsString: string): number {
    if (!fpsString) return 0;

    const parts = fpsString.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const den = parseFloat(parts[1]);
      return den !== 0 ? Math.round((num / den) * 100) / 100 : 0;
    }

    return parseFloat(fpsString);
  }

  /**
   * Generate thumbnail from video
   */
  async generateThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: number = this.config.thumbnail.timestamp
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: `${this.config.thumbnail.width}x${this.config.thumbnail.height}`,
        })
        .on('end', () => {
          this.logger.log(`Thumbnail generated: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', err => {
          this.logger.error(`Failed to generate thumbnail: ${err.message}`);
          reject(err);
        });
    });
  }

  /**
   * Validate video file
   */
  async validateVideo(videoPath: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(videoPath);

      // Check duration
      if (metadata.duration > this.config.video.maxDuration) {
        throw new Error(
          `Video too long: ${metadata.duration}s (max: ${this.config.video.maxDuration}s)`
        );
      }

      // Check file size
      const stats = await fs.stat(videoPath);
      if (stats.size > this.config.video.maxFileSize) {
        throw new Error(
          `Video too large: ${stats.size} bytes (max: ${this.config.video.maxFileSize} bytes)`
        );
      }

      return true;
    } catch (error) {
      this.logger.error(`Video validation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Cleanup temporary files
   */
  async cleanup(directory: string): Promise<void> {
    try {
      await fs.rm(directory, { recursive: true, force: true });
      this.logger.debug(`Cleaned up directory: ${directory}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup directory ${directory}: ${error.message}`);
    }
  }
}
