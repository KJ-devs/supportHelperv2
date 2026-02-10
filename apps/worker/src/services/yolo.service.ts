import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getErrorMessage } from '../utils/error.utils';

export interface YoloDetection {
  class: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface YoloBatchResult {
  detections: YoloDetection[][];
  totalDetections: number;
  averageConfidence: number;
}

/**
 * YOLO v11 UI Detection Service
 *
 * Handles UI element detection on images:
 * - Button, input, checkbox detection
 * - Modal and dialog detection
 * - Error/warning message detection
 *
 * Note: This is a placeholder implementation.
 * In production, this would call a YOLO inference server
 * or use a Node.js ONNX runtime.
 */
@Injectable()
export class YoloService {
  private readonly logger = new Logger(YoloService.name);
  private readonly config: any;
  private initialized = false;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get('yolo');
  }

  /**
   * Initialize YOLO model
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.log('Initializing YOLO v11 UI detection service');

    // In production, this would:
    // 1. Load ONNX model
    // 2. Connect to inference server
    // 3. Warm up model

    this.initialized = true;
    this.logger.log('YOLO service initialized');
  }

  /**
   * Detect UI elements in a single image
   */
  async detect(imagePath: string): Promise<YoloDetection[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.debug(`Detecting UI elements in ${imagePath}`);

    try {
      // In production, this would call YOLO inference
      // For now, return mock data indicating no detections
      // This prevents blocking the pipeline while YOLO integration is pending

      return this.mockDetection(imagePath);
    } catch (error) {
      this.logger.error(`YOLO detection failed: ${getErrorMessage(error)}`);
      return [];
    }
  }

  /**
   * Batch detect UI elements in multiple images
   */
  async detectBatch(imagePaths: string[]): Promise<YoloDetection[][]> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.log(`Batch detecting UI elements in ${imagePaths.length} images`);

    const results: YoloDetection[][] = [];

    // Process in batches
    const batchSize = this.config?.preprocessing?.batchSize || 10;

    for (let i = 0; i < imagePaths.length; i += batchSize) {
      const batch = imagePaths.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(path => this.detect(path)));
      results.push(...batchResults);
    }

    const totalDetections = results.reduce((sum, detections) => sum + detections.length, 0);

    this.logger.log(`Detected ${totalDetections} UI elements across ${imagePaths.length} images`);

    return results;
  }

  /**
   * Get detection summary
   */
  async detectBatchWithSummary(imagePaths: string[]): Promise<YoloBatchResult> {
    const detections = await this.detectBatch(imagePaths);

    const allDetections = detections.flat();
    const totalDetections = allDetections.length;
    const averageConfidence =
      totalDetections > 0
        ? allDetections.reduce((sum, d) => sum + d.confidence, 0) / totalDetections
        : 0;

    return {
      detections,
      totalDetections,
      averageConfidence,
    };
  }

  /**
   * Mock detection for development
   * Returns plausible UI element detections
   */
  private mockDetection(_imagePath: string): YoloDetection[] {
    // In production, replace with actual YOLO inference
    // Return empty for now to indicate "no UI elements detected"
    // which is valid for many screenshot types

    // Uncomment below for testing with mock data:
    /*
    return [
      {
        class: 'button',
        confidence: 0.92,
        bbox: { x: 100, y: 200, width: 80, height: 30 },
      },
      {
        class: 'input',
        confidence: 0.88,
        bbox: { x: 100, y: 250, width: 200, height: 25 },
      },
    ];
    */

    return [];
  }

  /**
   * Filter detections by confidence threshold
   */
  filterByConfidence(detections: YoloDetection[], minConfidence?: number): YoloDetection[] {
    const threshold = minConfidence || this.config?.detection?.confidence || 0.25;
    return detections.filter(d => d.confidence >= threshold);
  }

  /**
   * Group detections by class
   */
  groupByClass(detections: YoloDetection[]): Record<string, YoloDetection[]> {
    return detections.reduce(
      (groups, detection) => {
        const cls = detection.class;
        if (!groups[cls]) {
          groups[cls] = [];
        }
        groups[cls].push(detection);
        return groups;
      },
      {} as Record<string, YoloDetection[]>
    );
  }

  /**
   * Check if detection contains error/warning indicators
   */
  hasErrorIndicators(detections: YoloDetection[]): boolean {
    const errorClasses = ['alert', 'notification', 'modal'];
    return detections.some(d => errorClasses.includes(d.class));
  }
}
