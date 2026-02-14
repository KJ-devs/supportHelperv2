import { Injectable, Logger } from '@nestjs/common';
import ffmpeg from 'fluent-ffmpeg';
import * as ffmpegPath from '@ffmpeg-installer/ffmpeg';
import * as ffprobePath from '@ffprobe-installer/ffprobe';

// Configure ffmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

export interface VideoMetadata {
  duration?: number; // Duration in seconds
  width?: number; // Video width in pixels
  height?: number; // Video height in pixels
  codec?: string; // Video codec (h264, vp8, vp9, etc.)
  bitrate?: number; // Bitrate in bits per second
  fps?: number; // Frames per second
  format?: string; // Container format (mp4, webm, etc.)
  size?: number; // File size in bytes
}

/**
 * FFprobe service for extracting video metadata
 */
@Injectable()
export class FFprobeService {
  private readonly logger = new Logger(FFprobeService.name);

  /**
   * Extract metadata from video file
   * @param filePath Path to video file (can be local or URL)
   */
  async extractMetadata(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          this.logger.error(`FFprobe error for ${filePath}:`, err);
          return reject(err);
        }

        try {
          const videoStream = metadata.streams.find(
            (s) => s.codec_type === 'video',
          );

          if (!videoStream) {
            this.logger.warn(`No video stream found in ${filePath}`);
            return resolve({});
          }

          const result: VideoMetadata = {
            duration: metadata.format.duration
              ? parseFloat(metadata.format.duration.toString())
              : undefined,
            width: videoStream.width,
            height: videoStream.height,
            codec: videoStream.codec_name,
            bitrate: metadata.format.bit_rate
              ? parseInt(metadata.format.bit_rate.toString(), 10)
              : undefined,
            fps: this.calculateFPS(videoStream),
            format: metadata.format.format_name,
            size: metadata.format.size
              ? parseInt(metadata.format.size.toString(), 10)
              : undefined,
          };

          this.logger.debug(
            `Extracted metadata from ${filePath}:`,
            JSON.stringify(result, null, 2),
          );

          resolve(result);
        } catch (error) {
          this.logger.error('Error parsing metadata:', error);
          reject(error);
        }
      });
    });
  }

  /**
   * Calculate FPS from video stream
   */
  private calculateFPS(stream: any): number | undefined {
    if (stream.avg_frame_rate) {
      const [num, den] = stream.avg_frame_rate.split('/').map(Number);
      if (den && den !== 0) {
        return Math.round((num / den) * 100) / 100; // Round to 2 decimals
      }
    }

    if (stream.r_frame_rate) {
      const [num, den] = stream.r_frame_rate.split('/').map(Number);
      if (den && den !== 0) {
        return Math.round((num / den) * 100) / 100;
      }
    }

    return undefined;
  }

  /**
   * Check if file is a video
   */
  async isVideo(filePath: string): Promise<boolean> {
    try {
      const metadata = await this.extractMetadata(filePath);
      return !!metadata.codec;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract thumbnail from video at specific time
   * @param filePath Path to video file
   * @param outputPath Where to save thumbnail
   * @param timeInSeconds Time in video to extract frame (default: 1s)
   */
  async extractThumbnail(
    filePath: string,
    outputPath: string,
    timeInSeconds: number = 1,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .screenshots({
          timestamps: [timeInSeconds],
          filename: outputPath,
          size: '1280x720',
        })
        .on('end', () => {
          this.logger.log(`Thumbnail extracted: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err: Error) => {
          this.logger.error(`Thumbnail extraction failed:`, err);
          reject(err);
        });
    });
  }
}
