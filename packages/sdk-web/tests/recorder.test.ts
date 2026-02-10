import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VideoRecorder } from '../src/recorder/video-recorder';

describe('VideoRecorder', () => {
  let recorder: VideoRecorder;

  beforeEach(() => {
    vi.useFakeTimers();
    recorder = new VideoRecorder();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with default options', () => {
      expect(recorder).toBeDefined();
      expect(recorder.isActive()).toBe(false);
    });

    it('should accept custom options', () => {
      const customRecorder = new VideoRecorder({
        mimeType: 'video/webm;codecs=vp9',
        audioTracks: false,
        videoBitsPerSecond: 5000000,
      });

      expect(customRecorder).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start recording successfully', async () => {
      const startPromise = recorder.start();
      await vi.runAllTimersAsync();
      await startPromise;

      expect(recorder.isActive()).toBe(true);
      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
    });

    it('should request screen with cursor visible', async () => {
      const startPromise = recorder.start();
      await vi.runAllTimersAsync();
      await startPromise;

      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            cursor: 'always',
          }),
        })
      );
    });

    it('should request audio when audioTracks is true', async () => {
      const recorderWithAudio = new VideoRecorder({ audioTracks: true });
      const startPromise = recorderWithAudio.start();
      await vi.runAllTimersAsync();
      await startPromise;

      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: true,
        })
      );
    });

    it('should not request audio when audioTracks is false', async () => {
      const recorderNoAudio = new VideoRecorder({ audioTracks: false });
      const startPromise = recorderNoAudio.start();
      await vi.runAllTimersAsync();
      await startPromise;

      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith(
        expect.objectContaining({
          audio: false,
        })
      );
    });

    it('should throw if already recording', async () => {
      const startPromise = recorder.start();
      await vi.runAllTimersAsync();
      await startPromise;

      await expect(recorder.start()).rejects.toThrow('Recording already in progress');
    });

    it('should handle permission denied error', async () => {
      const permissionError = new Error('Not allowed');
      (permissionError as any).name = 'NotAllowedError';

      vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(permissionError);

      await expect(recorder.start()).rejects.toThrow('Permission denied to capture screen');
    });
  });

  describe('stop', () => {
    it('should stop recording and return blob', async () => {
      // Start recording
      const startPromise = recorder.start();
      await vi.runAllTimersAsync();
      await startPromise;

      // Stop recording
      const stopPromise = recorder.stop();
      await vi.runAllTimersAsync();
      const blob = await stopPromise;

      expect(blob).toBeInstanceOf(Blob);
      expect(recorder.isActive()).toBe(false);
    });

    it('should throw if not recording', async () => {
      await expect(recorder.stop()).rejects.toThrow('No recording in progress');
    });

    it('should stop all media tracks', async () => {
      // Start recording
      const startPromise = recorder.start();
      await vi.runAllTimersAsync();
      await startPromise;

      // Stop recording
      const stopPromise = recorder.stop();
      await vi.runAllTimersAsync();
      await stopPromise;

      expect(recorder.isActive()).toBe(false);
    });
  });

  describe('isActive', () => {
    it('should return false initially', () => {
      expect(recorder.isActive()).toBe(false);
    });

    it('should return true when recording', async () => {
      const startPromise = recorder.start();
      await vi.runAllTimersAsync();
      await startPromise;

      expect(recorder.isActive()).toBe(true);
    });

    it('should return false after stopping', async () => {
      // Start
      const startPromise = recorder.start();
      await vi.runAllTimersAsync();
      await startPromise;

      // Stop
      const stopPromise = recorder.stop();
      await vi.runAllTimersAsync();
      await stopPromise;

      expect(recorder.isActive()).toBe(false);
    });
  });
});
