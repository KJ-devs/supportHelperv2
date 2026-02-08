import { registerAs } from '@nestjs/config';

/**
 * YOLO v11 UI Detection Configuration
 */
export default registerAs('yolo', () => ({
  // Model configuration
  model: {
    version: 'yolov11',
    variant: 'n', // nano (fastest), s, m, l, x
    weightsPath: process.env.YOLO_WEIGHTS_PATH || './models/yolov11n.pt',
  },

  // Detection settings
  detection: {
    confidence: 0.25, // Minimum confidence threshold
    iou: 0.45, // IoU threshold for NMS
    maxDetections: 100,
  },

  // UI element classes to detect
  classes: [
    'button',
    'input',
    'checkbox',
    'radio',
    'dropdown',
    'menu',
    'icon',
    'text',
    'image',
    'link',
    'form',
    'modal',
    'tooltip',
    'alert',
    'notification',
  ],

  // Image preprocessing
  preprocessing: {
    size: 640, // Input size (640x640)
    normalize: true,
    augmentation: false, // Disable for inference
  },

  // Post-processing
  postprocessing: {
    nms: true, // Non-maximum suppression
    groupSimilar: true,
    filterOverlapping: true,
  },

  // Output format
  output: {
    includeBoxes: true,
    includeLabels: true,
    includeConfidence: true,
    drawAnnotations: false, // Set to true for debugging
  },
}));
