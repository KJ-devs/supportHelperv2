import { registerAs } from '@nestjs/config';

/**
 * Tesseract OCR Configuration
 */
export default registerAs('ocr', () => ({
  // Tesseract settings
  tesseract: {
    lang: 'eng', // English language
    oem: 1, // LSTM OCR Engine Mode
    psm: 3, // Fully automatic page segmentation
  },

  // Parallel processing
  parallel: {
    workers: 4, // 4 parallel OCR workers
    maxConcurrent: 4,
  },

  // Image preprocessing
  preprocessing: {
    grayscale: true,
    contrast: 1.5,
    brightness: 1.2,
    denoise: true,
  },

  // Text extraction
  extraction: {
    minConfidence: 60, // Minimum OCR confidence (0-100)
    removeWhitespace: true,
    lowercase: false,
  },

  // Output format
  output: {
    includeCoordinates: true,
    includeConfidence: true,
    groupByBlock: true,
  },
}));
