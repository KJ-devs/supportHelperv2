import { vi, beforeEach, afterEach } from 'vitest';

// Mock MediaRecorder API
class MockMediaRecorder {
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(
    public stream: MediaStream,
    public options?: MediaRecorderOptions
  ) {}

  start() {
    this.state = 'recording';
    // Simulate data available after a short delay
    setTimeout(() => {
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(['mock video data'], { type: 'video/webm' }) });
      }
    }, 10);
  }

  stop() {
    this.state = 'inactive';
    setTimeout(() => {
      if (this.onstop) {
        this.onstop();
      }
    }, 10);
  }

  pause() {
    this.state = 'paused';
  }

  resume() {
    this.state = 'recording';
  }

  static isTypeSupported(mimeType: string): boolean {
    return ['video/webm', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9'].includes(mimeType);
  }
}

// Mock MediaStream and MediaStreamTrack
class MockMediaStreamTrack {
  kind: 'video' | 'audio' = 'video';
  enabled = true;
  readyState: 'live' | 'ended' = 'live';
  onended: (() => void) | null = null;

  stop() {
    this.readyState = 'ended';
    // Don't call onended here - it causes infinite loops in tests
  }

  clone() {
    return new MockMediaStreamTrack();
  }
}

class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [];

  constructor() {
    this.tracks = [new MockMediaStreamTrack()];
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks.filter(t => t.kind === 'video');
  }

  getAudioTracks() {
    return this.tracks.filter(t => t.kind === 'audio');
  }

  addTrack(track: MockMediaStreamTrack) {
    this.tracks.push(track);
  }
}

// Setup global mocks
beforeEach(() => {
  // @ts-ignore
  global.MediaRecorder = MockMediaRecorder;
  // @ts-ignore
  global.MediaStream = MockMediaStream;
  // @ts-ignore
  global.MediaStreamTrack = MockMediaStreamTrack;

  // Mock navigator.mediaDevices
  Object.defineProperty(global.navigator, 'mediaDevices', {
    writable: true,
    value: {
      getDisplayMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
      getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream()),
    },
  });

  // Mock fetch
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.clearAllMocks();
});

// Export mocks for tests to use
export { MockMediaRecorder, MockMediaStream, MockMediaStreamTrack };
