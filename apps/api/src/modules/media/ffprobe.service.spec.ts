import { Test, TestingModule } from '@nestjs/testing';
import { FFprobeService, VideoMetadata } from './ffprobe.service';
import ffmpeg from 'fluent-ffmpeg';

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg');
jest.mock('@ffmpeg-installer/ffmpeg', () => ({ path: '/path/to/ffmpeg' }));
jest.mock('@ffprobe-installer/ffprobe', () => ({ path: '/path/to/ffprobe' }));

describe('FFprobeService', () => {
  let service: FFprobeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FFprobeService],
    }).compile();

    service = module.get<FFprobeService>(FFprobeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractMetadata', () => {
    it('should extract video metadata successfully', async () => {
      const mockMetadata = {
        format: {
          duration: 120.5,
          bit_rate: 2500000,
          format_name: 'mp4',
          size: 50000000,
        },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            avg_frame_rate: '30/1',
            r_frame_rate: '30/1',
          },
          {
            codec_type: 'audio',
            codec_name: 'aac',
          },
        ],
      };

      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(null, mockMetadata);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      const result = await service.extractMetadata('test-video.mp4');

      expect(result).toEqual<VideoMetadata>({
        duration: 120.5,
        width: 1920,
        height: 1080,
        codec: 'h264',
        bitrate: 2500000,
        fps: 30,
        format: 'mp4',
        size: 50000000,
      });
      expect(mockFfprobe).toHaveBeenCalledWith(
        'test-video.mp4',
        expect.any(Function),
      );
    });

    it('should handle videos with fractional frame rate', async () => {
      const mockMetadata = {
        format: { duration: 60 },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'vp9',
            width: 1280,
            height: 720,
            avg_frame_rate: '24000/1001', // 23.976 fps
          },
        ],
      };

      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(null, mockMetadata);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      const result = await service.extractMetadata('test-video.webm');

      expect(result.fps).toBeCloseTo(23.98, 1);
    });

    it('should return empty object if no video stream found', async () => {
      const mockMetadata = {
        format: { duration: 60 },
        streams: [
          {
            codec_type: 'audio',
            codec_name: 'aac',
          },
        ],
      };

      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(null, mockMetadata);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      const result = await service.extractMetadata('audio-only.mp3');

      expect(result).toEqual({});
    });

    it('should reject on ffprobe error', async () => {
      const mockError = new Error('FFprobe failed');
      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(mockError, null);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      await expect(service.extractMetadata('invalid-file.mp4')).rejects.toThrow(
        'FFprobe failed',
      );
    });

    it('should handle missing optional metadata fields', async () => {
      const mockMetadata = {
        format: {},
        streams: [
          {
            codec_type: 'video',
            codec_name: 'vp8',
          },
        ],
      };

      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(null, mockMetadata);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      const result = await service.extractMetadata('minimal-video.webm');

      expect(result).toHaveProperty('codec', 'vp8');
      expect(result.duration).toBeUndefined();
      expect(result.width).toBeUndefined();
    });

    it('should use r_frame_rate if avg_frame_rate not available', async () => {
      const mockMetadata = {
        format: {},
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            r_frame_rate: '60/1',
          },
        ],
      };

      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(null, mockMetadata);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      const result = await service.extractMetadata('video.mp4');

      expect(result.fps).toBe(60);
    });
  });

  describe('isVideo', () => {
    it('should return true for valid video file', async () => {
      const mockMetadata = {
        format: {},
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
          },
        ],
      };

      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(null, mockMetadata);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      const result = await service.isVideo('video.mp4');

      expect(result).toBe(true);
    });

    it('should return false for audio-only file', async () => {
      const mockMetadata = {
        format: {},
        streams: [
          {
            codec_type: 'audio',
            codec_name: 'mp3',
          },
        ],
      };

      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(null, mockMetadata);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      const result = await service.isVideo('audio.mp3');

      expect(result).toBe(false);
    });

    it('should return false on ffprobe error', async () => {
      const mockFfprobe = jest.fn((filePath, callback) => {
        callback(new Error('Invalid file'), null);
      });
      (ffmpeg.ffprobe as jest.Mock) = mockFfprobe;

      const result = await service.isVideo('invalid.file');

      expect(result).toBe(false);
    });
  });

  describe('extractThumbnail', () => {
    it('should extract thumbnail successfully', async () => {
      const mockScreenshots = jest.fn().mockReturnThis();
      const mockOn: jest.Mock<any, any> = jest.fn((event, callback) => {
        if (event === 'end') {
          callback();
        }
        return mockFfmpeg;
      });

      const mockFfmpeg: any = {
        screenshots: mockScreenshots,
        on: mockOn,
      };

      (ffmpeg as unknown as jest.Mock).mockReturnValue(mockFfmpeg);

      const result = await service.extractThumbnail(
        'video.mp4',
        'thumb.jpg',
        5,
      );

      expect(result).toBe('thumb.jpg');
      expect(mockScreenshots).toHaveBeenCalledWith({
        timestamps: [5],
        filename: 'thumb.jpg',
        size: '1280x720',
      });
    });

    it('should use default timestamp if not provided', async () => {
      const mockScreenshots = jest.fn().mockReturnThis();
      const mockOn: jest.Mock<any, any> = jest.fn((event, callback) => {
        if (event === 'end') {
          callback();
        }
        return mockFfmpeg;
      });

      const mockFfmpeg: any = {
        screenshots: mockScreenshots,
        on: mockOn,
      };

      (ffmpeg as unknown as jest.Mock).mockReturnValue(mockFfmpeg);

      await service.extractThumbnail('video.mp4', 'thumb.jpg');

      expect(mockScreenshots).toHaveBeenCalledWith({
        timestamps: [1],
        filename: 'thumb.jpg',
        size: '1280x720',
      });
    });

    it('should reject on extraction error', async () => {
      const mockScreenshots = jest.fn().mockReturnThis();
      const mockOn: jest.Mock<any, any> = jest.fn((event, callback) => {
        if (event === 'error') {
          callback(new Error('Extraction failed'));
        }
        return mockFfmpeg;
      });

      const mockFfmpeg: any = {
        screenshots: mockScreenshots,
        on: mockOn,
      };

      (ffmpeg as unknown as jest.Mock).mockReturnValue(mockFfmpeg);

      await expect(
        service.extractThumbnail('video.mp4', 'thumb.jpg'),
      ).rejects.toThrow('Extraction failed');
    });
  });
});
