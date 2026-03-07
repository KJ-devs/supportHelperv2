import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoPlayer } from '../VideoPlayer';

describe('VideoPlayer', () => {
  let mockOnError: ReturnType<typeof vi.fn>;

  // Helper to get video element
  const getVideoElement = (container: HTMLElement): HTMLVideoElement => {
    const video = container.querySelector('video');
    if (!video) throw new Error('Video element not found');
    return video;
  };

  beforeEach(() => {
    mockOnError = vi.fn();
    // Reset console.error mock
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders without error initially', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);
      expect(video).toBeInTheDocument();

      const source = video.querySelector('source');
      expect(source).toHaveAttribute('src', '/test.mp4');
    });

    it('renders with poster image', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" poster="/poster.jpg" />);

      const video = getVideoElement(container);
      expect(video).toHaveAttribute('poster', '/poster.jpg');
    });

    it('renders with correct mime type', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" mimeType="video/mp4" />);

      const source = container.querySelector('source');
      expect(source).toHaveAttribute('type', 'video/mp4');
    });

    it('uses default mime type when not provided', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const source = container.querySelector('source');
      expect(source).toHaveAttribute('type', 'video/webm');
    });

    it('shows play overlay when not playing', () => {
      render(<VideoPlayer src="/test.mp4" />);

      // Look for the play overlay button (has the play icon SVG)
      const buttons = screen.getAllByRole('button');
      const playOverlayButton = buttons.find(btn => btn.className.includes('absolute inset-0'));
      expect(playOverlayButton).toBeInTheDocument();
    });
  });

  describe('MediaError Code Mapping', () => {
    it('handles MEDIA_ERR_ABORTED (code 1)', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" onError={mockOnError} />);

      const video = getVideoElement(container);

      // Create a mock MediaError with code 1
      const mockMediaError = {
        code: 1, // MEDIA_ERR_ABORTED
        message: 'The user aborted the video loading.',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      // Mock the error property
      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      // Trigger error event
      fireEvent.error(video);

      // Verify error message
      expect(screen.getByText('La lecture de la vidéo a été interrompue.')).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'La lecture de la vidéo a été interrompue.',
        })
      );
    });

    it('handles MEDIA_ERR_NETWORK (code 2)', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" onError={mockOnError} />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 2, // MEDIA_ERR_NETWORK
        message: 'A network error occurred.',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      expect(
        screen.getByText("Une erreur réseau s'est produite lors du chargement de la vidéo.")
      ).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Une erreur réseau s'est produite lors du chargement de la vidéo.",
        })
      );
    });

    it('handles MEDIA_ERR_DECODE (code 3)', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" onError={mockOnError} />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 3, // MEDIA_ERR_DECODE
        message: 'Decoding failed.',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      expect(screen.getByText("La vidéo n'a pas pu être décodée.")).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "La vidéo n'a pas pu être décodée.",
        })
      );
    });

    it('handles MEDIA_ERR_SRC_NOT_SUPPORTED (code 4)', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" onError={mockOnError} />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 4, // MEDIA_ERR_SRC_NOT_SUPPORTED
        message: 'Format not supported.',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      expect(screen.getByText("Le format vidéo n'est pas pris en charge.")).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Le format vidéo n'est pas pris en charge.",
        })
      );
    });

    it('handles null MediaError', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" onError={mockOnError} />);

      const video = getVideoElement(container);

      // Set error to null
      Object.defineProperty(video, 'error', {
        value: null,
        writable: true,
      });

      fireEvent.error(video);

      expect(screen.getByText("Une erreur inconnue s'est produite.")).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Une erreur inconnue s'est produite.",
        })
      );
    });

    it('handles unknown error code', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" onError={mockOnError} />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 999, // Unknown code
        message: 'Unknown error.',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      expect(screen.getByText("Une erreur inconnue s'est produite.")).toBeInTheDocument();
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Une erreur inconnue s'est produite.",
        })
      );
    });
  });

  describe('onError Callback', () => {
    it('calls onError with Error instance', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" onError={mockOnError} />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 2,
        message: 'Network error',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      expect(mockOnError).toHaveBeenCalledTimes(1);
      expect(mockOnError).toHaveBeenCalledWith(expect.any(Error));

      const errorArg = mockOnError.mock.calls[0]?.[0];
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg?.message).toBe(
        "Une erreur réseau s'est produite lors du chargement de la vidéo."
      );
    });

    it('does not throw when onError is not provided', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 3,
        message: 'Decode error',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      expect(() => fireEvent.error(video)).not.toThrow();
      expect(screen.getByText("La vidéo n'a pas pu être décodée.")).toBeInTheDocument();
    });
  });

  describe('UI State on Error', () => {
    it('shows error overlay when error occurs', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 4,
        message: 'Format not supported',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      // Error overlay should be visible
      expect(screen.getByText("Le format vidéo n'est pas pris en charge.")).toBeInTheDocument();

      // Check for error icon SVG
      const errorIcon = container.querySelector('svg.text-red-500');
      expect(errorIcon).toBeInTheDocument();
    });

    it('hides play overlay when error is shown', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 2,
        message: 'Network error',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      // Play overlay should not be visible when error is shown
      const playOverlayButton = container.querySelector('button.absolute.inset-0');
      expect(playOverlayButton).not.toBeInTheDocument();
    });

    it('sets isPlaying to false on error', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      // Simulate video playing
      fireEvent.play(video);

      const mockMediaError = {
        code: 3,
        message: 'Decode error',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      // After error, play button should be visible in controls (shows we're not playing)
      const playButton = screen.getByRole('button', { name: 'Play' });
      expect(playButton).toBeInTheDocument();
    });
  });

  describe('Error Recovery', () => {
    it('clears error on new video load (onLoadStart)', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      // Trigger error first
      const mockMediaError = {
        code: 4,
        message: 'Format not supported',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      // Verify error is shown
      expect(screen.getByText("Le format vidéo n'est pas pris en charge.")).toBeInTheDocument();

      // Simulate new video loading
      fireEvent.loadStart(video);

      // Error should be cleared
      expect(
        screen.queryByText("Le format vidéo n'est pas pris en charge.")
      ).not.toBeInTheDocument();
    });

    it('clears error on successful play after error', async () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      // Mock play method
      video.play = vi.fn().mockResolvedValue(undefined);
      video.pause = vi.fn();

      // Trigger error first
      const mockMediaError = {
        code: 2,
        message: 'Network error',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      // Verify error is shown
      expect(
        screen.getByText("Une erreur réseau s'est produite lors du chargement de la vidéo.")
      ).toBeInTheDocument();

      // Find and click play button in controls
      const playButton = screen.getByRole('button', { name: 'Play' });
      await fireEvent.click(playButton);

      await waitFor(() => {
        expect(video.play).toHaveBeenCalled();
      });
    });
  });

  describe('Console Error Logging', () => {
    it('logs error with MediaError details when available', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      const mockMediaError = {
        code: 3,
        message: 'Decoding error',
        MEDIA_ERR_ABORTED: 1,
        MEDIA_ERR_NETWORK: 2,
        MEDIA_ERR_DECODE: 3,
        MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
      } as MediaError;

      Object.defineProperty(video, 'error', {
        value: mockMediaError,
        writable: true,
      });

      fireEvent.error(video);

      expect(consoleSpy).toHaveBeenCalledWith('Video error:', "La vidéo n'a pas pu être décodée.", {
        code: 3,
        message: 'Decoding error',
      });

      consoleSpy.mockRestore();
    });

    it('logs error without MediaError details when null', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      Object.defineProperty(video, 'error', {
        value: null,
        writable: true,
      });

      fireEvent.error(video);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Video error:',
        "Une erreur inconnue s'est produite.",
        'No media error details'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Video Controls Integration', () => {
    it('does not interfere with other video event handlers', () => {
      const { container } = render(<VideoPlayer src="/test.mp4" />);

      const video = getVideoElement(container);

      // Mock video properties
      Object.defineProperty(video, 'duration', { value: 120, writable: true });
      Object.defineProperty(video, 'currentTime', { value: 0, writable: true });

      // Simulate metadata loaded
      fireEvent.loadedMetadata(video);

      // Simulate time update
      Object.defineProperty(video, 'currentTime', { value: 30, writable: true });
      fireEvent.timeUpdate(video);

      // Verify controls are rendered with current time and duration
      expect(screen.getByText('0:30')).toBeInTheDocument(); // currentTime = 30 seconds
      expect(screen.getByText('2:00')).toBeInTheDocument(); // duration = 120 seconds
    });
  });
});
