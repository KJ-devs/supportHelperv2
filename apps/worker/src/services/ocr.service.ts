import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker, Worker, RecognizeResult } from 'tesseract.js';
import sharp from 'sharp';
import { getErrorMessage } from '../utils/error.utils';

export interface OCRResult {
  text: string;
  confidence: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  blocks: Array<{
    text: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
}

export interface BatchOCRResult {
  results: OCRResult[];
  totalText: string;
  averageConfidence: number;
}

/**
 * OCR Service using Tesseract.js
 *
 * Handles optical character recognition on images:
 * - Parallel processing with worker pool
 * - Image preprocessing
 * - Batch processing
 */
@Injectable()
export class OCRService {
  private readonly logger = new Logger(OCRService.name);
  private readonly config: any;
  private workerPool: Worker[] = [];
  private initialized = false;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get('ocr');
  }

  /**
   * Initialize worker pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.logger.log(`Initializing OCR worker pool (${this.config.parallel.workers} workers)`);

    const workerPromises = [];
    for (let i = 0; i < this.config.parallel.workers; i++) {
      workerPromises.push(this.createWorker());
    }

    this.workerPool = await Promise.all(workerPromises);
    this.initialized = true;

    this.logger.log(`OCR worker pool initialized with ${this.workerPool.length} workers`);
  }

  /**
   * Create and initialize a Tesseract worker
   */
  private async createWorker(): Promise<Worker> {
    const worker = await createWorker(this.config.tesseract.lang, this.config.tesseract.oem);

    await worker.setParameters({
      tessedit_pageseg_mode: this.config.tesseract.psm,
      tessedit_char_whitelist: '', // Allow all characters
    });

    return worker;
  }

  /**
   * Extract text from a single image
   */
  async extractText(imagePath: string): Promise<OCRResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Preprocess image
      const processedImagePath = await this.preprocessImage(imagePath);

      // Get available worker
      const worker = this.getAvailableWorker();

      // Perform OCR
      const result: RecognizeResult = await worker.recognize(processedImagePath);

      // Parse result
      return this.parseOCRResult(result);
    } catch (error) {
      this.logger.error(`OCR failed for ${imagePath}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Extract text from multiple images in parallel
   */
  async extractTextBatch(imagePaths: string[]): Promise<BatchOCRResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.logger.log(`Processing batch of ${imagePaths.length} images`);

    try {
      // Process in chunks to avoid overwhelming the system
      const chunkSize = this.config.parallel.maxConcurrent;
      const results: OCRResult[] = [];

      for (let i = 0; i < imagePaths.length; i += chunkSize) {
        const chunk = imagePaths.slice(i, i + chunkSize);
        const chunkResults = await Promise.all(chunk.map(path => this.extractText(path)));
        results.push(...chunkResults);

        this.logger.debug(
          `Processed chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(imagePaths.length / chunkSize)}`
        );
      }

      // Aggregate results
      const totalText = results
        .map(r => r.text)
        .filter(t => t.length > 0)
        .join('\n\n');

      const averageConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

      this.logger.log(
        `Batch OCR complete: ${results.length} images, avg confidence: ${averageConfidence.toFixed(2)}%`
      );

      return {
        results,
        totalText,
        averageConfidence,
      };
    } catch (error) {
      this.logger.error(`Batch OCR failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Preprocess image to improve OCR accuracy
   */
  private async preprocessImage(imagePath: string): Promise<string> {
    const outputPath = imagePath.replace(/\.(png|jpg|jpeg)$/i, '_processed.png');

    try {
      let pipeline = sharp(imagePath);

      // Convert to grayscale
      if (this.config.preprocessing.grayscale) {
        pipeline = pipeline.grayscale();
      }

      // Adjust contrast and brightness
      pipeline = pipeline
        .normalize()
        .linear(
          this.config.preprocessing.contrast,
          -(128 * this.config.preprocessing.contrast) + 128
        );

      // Denoise
      if (this.config.preprocessing.denoise) {
        pipeline = pipeline.median(3);
      }

      // Save processed image
      await pipeline.toFile(outputPath);

      return outputPath;
    } catch (error) {
      this.logger.warn(`Image preprocessing failed, using original: ${getErrorMessage(error)}`);
      return imagePath;
    }
  }

  /**
   * Parse Tesseract result into our format
   */
  private parseOCRResult(result: RecognizeResult): OCRResult {
    const { data } = result;

    // Extract words
    const words = data.words
      .filter(word => word.confidence >= this.config.extraction.minConfidence)
      .map(word => ({
        text: word.text,
        confidence: word.confidence,
        bbox: {
          x: word.bbox.x0,
          y: word.bbox.y0,
          width: word.bbox.x1 - word.bbox.x0,
          height: word.bbox.y1 - word.bbox.y0,
        },
      }));

    // Extract blocks
    const blocks = (data.blocks || [])
      .filter(block => block.confidence >= this.config.extraction.minConfidence)
      .map(block => ({
        text: block.text,
        confidence: block.confidence,
        bbox: {
          x: block.bbox.x0,
          y: block.bbox.y0,
          width: block.bbox.x1 - block.bbox.x0,
          height: block.bbox.y1 - block.bbox.y0,
        },
      }));

    // Clean text
    let text = data.text;
    if (this.config.extraction.removeWhitespace) {
      text = text.replace(/\s+/g, ' ').trim();
    }

    return {
      text,
      confidence: data.confidence,
      words,
      blocks,
    };
  }

  /**
   * Get next available worker (round-robin)
   */
  private getAvailableWorker(): Worker {
    const worker = this.workerPool.shift();
    if (!worker) {
      throw new Error('No OCR workers available');
    }
    this.workerPool.push(worker); // Move to end for round-robin
    return worker;
  }

  /**
   * Cleanup and terminate all workers
   */
  async terminate(): Promise<void> {
    this.logger.log('Terminating OCR workers');

    await Promise.all(this.workerPool.map(worker => worker.terminate()));
    this.workerPool = [];
    this.initialized = false;

    this.logger.log('OCR workers terminated');
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.terminate();
  }
}
