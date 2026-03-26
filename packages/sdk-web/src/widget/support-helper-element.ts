/**
 * Support Helper Custom Element
 * <support-helper sdk-key="..." api-url="..."></support-helper>
 */

import type {
  WidgetConfig,
  WidgetState,
  WidgetEventMap,
  ReportResponse,
  AnalyzingContext,
  CropRegion,
} from './widget-types';
import { DEFAULT_CONFIG, parseAttributeConfig } from './widget-config';
import { ConsoleCapture } from '../context/console-capture';
import { ErrorCapture } from '../context/error-capture';
import { NetworkCapture } from '../context/network-capture';
import { WidgetStateMachine } from './widget-state-machine';
import { createWidgetStyles } from './widget-styles';
import { renderFAB, renderModal, renderRecordingBar, getViewForState } from './widget-templates';
import { submitReport, getOfflineQueue, pollTicketStatus } from './widget-api';
import { getWidgetTranslations, detectLocale } from './i18n';
import type { WidgetTranslations } from './i18n';
import { VideoRecorder } from '../recorder/video-recorder';
import { ContextCapture } from '../context/context-capture';
import { KeyboardManager } from './keyboard-manager';
import { ScreenReaderAnnouncer } from './screen-reader-announcer';
import type { QueueFlushedDetail, QueueErrorDetail } from '../offline-queue';
import { CropManager } from './crop-overlay';

/**
 * Support Helper Web Component
 */
export class SupportHelperElement extends HTMLElement {
  private shadow: ShadowRoot;
  private stateMachine: WidgetStateMachine;
  private config: WidgetConfig;
  private videoRecorder: VideoRecorder | null = null;
  private videoBlob: Blob | null = null;
  private screenshotBlob: Blob | null = null;
  private videoUrl: string | null = null;
  private videoDuration = 0;
  private videoSize = 0;
  private recordingStartTime = 0;
  private recordingTimer: number | null = null;
  private isRecordingPaused = false;
  private lastReportResponse: ReportResponse | null = null;
  private errorMessage = '';
  private formData: { title: string; description: string } = { title: '', description: '' };

  // Locks to prevent race conditions
  private isStartingRecording = false;
  private isStoppingRecording = false;

  // Flag to prevent duplicate event listeners
  private clickHandlerAttached = false;

  // Theme detection
  private prefersDarkMediaQuery: MediaQueryList | null = null;
  private hostMutationObserver: MutationObserver | null = null;
  private resolvedTheme: 'light' | 'dark' = 'light';

  // Keyboard and accessibility
  private keyboardManager!: KeyboardManager;
  private announcer!: ScreenReaderAnnouncer;

  // Offline-queue listeners (stored so they can be removed on disconnect).
  // Typed as the specific detail types so the `on()` overload resolves correctly;
  // cast to the union type when calling `off()`.
  private queueFlushedListener: ((detail: QueueFlushedDetail) => void) | null = null;
  private queueErrorListener: ((detail: QueueErrorDetail) => void) | null = null;

  // Translations
  private translations: WidgetTranslations = getWidgetTranslations('en');

  // Attention pulse timer
  private attentionPulseTimer: number | null = null;
  private attentionPulseDelay = 5000; // 5 seconds

  // Crop state
  private cropManager: CropManager | null = null;
  private cropMode: 'video' | 'screenshot' | null = null;
  private cropImageDataUrl: string | null = null;
  private cropStream: MediaStream | null = null;
  private cropAnimFrameId: number | null = null;
  private cropSourceVideo: HTMLVideoElement | null = null;

  // AI polling state
  private pollStop: (() => void) | null = null;
  private pollingStartTime = 0;
  private pollingElapsed = 0;
  private pollingTimedOut = false;
  private pollingResult: AnalyzingContext['aiResult'] | null = null;
  private pollingTicketId = '';
  private pollingTickTimer: number | null = null;

  static get observedAttributes(): string[] {
    return [
      'sdk-key',
      'api-url',
      'position',
      'primary-color',
      'z-index',
      'theme',
      'locale',
      'capture-network',
    ];
  }

  constructor() {
    super();

    // Create shadow DOM
    this.shadow = this.attachShadow({ mode: 'open' });

    // Initialize state machine
    this.stateMachine = new WidgetStateMachine();

    // Default config (will be updated when connected)
    this.config = { ...DEFAULT_CONFIG, sdkKey: '', apiUrl: '' };

    // Initialize keyboard manager
    this.keyboardManager = new KeyboardManager({
      onEscape: () => this.handleClose(),
      getShadowRoot: () => this.shadow,
      getIsModalOpen: () => this.stateMachine.getState() !== 'idle',
    });

    // Initialize screen reader announcer
    this.announcer = new ScreenReaderAnnouncer(this.shadow);

    // Listen to state changes
    this.stateMachine.onChange((newState, prevState) => {
      this.onStateChange(newState, prevState);
    });
  }

  connectedCallback(): void {
    ConsoleCapture.install(50);
    ErrorCapture.install(20);

    // Parse config from attributes
    const attrConfig = parseAttributeConfig(this);
    this.config = {
      ...DEFAULT_CONFIG,
      ...attrConfig,
      sdkKey: attrConfig.sdkKey || '',
      apiUrl: attrConfig.apiUrl || '',
    };

    // Install network capture if opted in
    if (this.config.captureNetwork && this.config.apiUrl) {
      NetworkCapture.install(this.config.apiUrl);
    }

    // Validate required attributes
    if (!this.config.sdkKey) {
      console.warn('[SupportHelper] sdk-key attribute is required');
    }
    if (!this.config.apiUrl) {
      console.warn('[SupportHelper] api-url attribute is required');
    }

    // Initialize translations
    const locale = this.config.locale ?? detectLocale();
    this.translations = getWidgetTranslations(locale);

    // Initialize theme detection
    this.initializeThemeDetection();

    // Render initial state
    this.render();

    // Attach event listeners
    this.attachEventListeners();

    // Initialize keyboard manager
    this.keyboardManager.attach();

    // Initialize screen reader announcer
    this.announcer.initialize();

    // Start attention pulse timer for FAB
    this.startAttentionPulseTimer();

    // Wire offline-queue events (lazy init — does not block rendering)
    this.initializeOfflineQueue();
  }

  disconnectedCallback(): void {
    ConsoleCapture.uninstall();
    ErrorCapture.uninstall();
    NetworkCapture.uninstall();
    // Cleanup
    this.stopRecordingTimer();
    this.stopAttentionPulseTimer();
    this.stopPolling();
    this.cleanupVideoUrl();
    this.cleanupCrop();
    if (this.videoRecorder?.isActive()) {
      this.videoRecorder.stop().catch(() => {});
    }
    // Cleanup theme detection
    this.cleanupThemeDetection();
    // Reset so event listeners re-attach on reconnect
    this.clickHandlerAttached = false;

    // Cleanup keyboard manager and announcer
    this.keyboardManager.detach();
    this.announcer.destroy();

    // Detach offline-queue listeners
    this.teardownOfflineQueue();
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;

    switch (name) {
      case 'sdk-key':
        this.config.sdkKey = newValue || '';
        break;
      case 'api-url':
        this.config.apiUrl = newValue || '';
        break;
      case 'position':
        this.config.position = (newValue as WidgetConfig['position']) || 'bottom-right';
        this.render();
        break;
      case 'primary-color':
        this.config.primaryColor = newValue || DEFAULT_CONFIG.primaryColor;
        this.render();
        break;
      case 'z-index':
        this.config.zIndex = newValue ? parseInt(newValue, 10) : DEFAULT_CONFIG.zIndex;
        this.render();
        break;
      case 'theme':
        this.config.theme = (newValue as WidgetConfig['theme']) || 'auto';
        this.cleanupThemeDetection();
        this.initializeThemeDetection();
        this.render();
        break;
      case 'locale':
        if (newValue === 'en' || newValue === 'fr') {
          this.config.locale = newValue;
          this.translations = getWidgetTranslations(newValue);
        } else {
          this.config.locale = undefined;
          this.translations = getWidgetTranslations(detectLocale());
        }
        this.render();
        break;
    }
  }

  /**
   * Programmatic API
   */
  open(): void {
    if (this.stateMachine.canTransition('OPEN')) {
      // Save focus before opening
      this.keyboardManager.saveFocus();
      this.stateMachine.dispatch('OPEN');
    }
  }

  close(): void {
    this.handleClose();
  }

  reset(): void {
    this.stateMachine.reset();
    this.cleanupRecording();
    this.formData = { title: '', description: '' };
    this.lastReportResponse = null;
    this.errorMessage = '';
  }

  /**
   * Render the widget
   */
  private render(): void {
    const state = this.stateMachine.getState();
    const styles = createWidgetStyles(
      this.config.primaryColor,
      this.config.zIndex,
      this.config.position,
      this.resolvedTheme === 'dark'
    );

    // Set data-state attribute on host for CSS state-based selectors
    this.setAttribute('data-state', state);

    let html = `<style>${styles}</style>`;

    const t = this.translations;

    // Always render FAB
    html += renderFAB(t);

    // During recording: show minimal floating bar instead of modal+backdrop
    if (state === 'recording') {
      html += renderRecordingBar(this.videoDuration, this.isRecordingPaused, t);
    }

    // Render modal if not idle and not recording
    if (state !== 'idle' && state !== 'recording') {
      const modalTitle = state === 'cropping' ? t.cropping.title : t.open.title;
      const viewContent = getViewForState(
        state,
        {
          videoUrl: this.videoUrl || undefined,
          duration: this.videoDuration,
          size: this.videoSize,
          isPaused: this.isRecordingPaused,
          ticketId: this.lastReportResponse?.ticket.id ?? this.pollingTicketId,
          aiAnalysis: this.lastReportResponse?.aiAnalysis,
          dashboardUrl: undefined,
          errorMessage: this.errorMessage,
          analyzingContext:
            state === 'analyzing'
              ? {
                  ticketId: this.pollingTicketId,
                  elapsedSeconds: this.pollingElapsed,
                  timedOut: this.pollingTimedOut,
                  aiResult: this.pollingResult ?? undefined,
                }
              : undefined,
          cropImageDataUrl: this.cropImageDataUrl || undefined,
          cropMode: this.cropMode || undefined,
        },
        t
      );
      html += renderModal(modalTitle, viewContent, t);
    }

    this.shadow.innerHTML = html;
    this.attachEventListeners();

    // Attach crop manager after render when in cropping state
    if (state === 'cropping') {
      if (!this.cropManager) {
        this.cropManager = new CropManager();
      }
      this.cropManager.attach(this.shadow);
    }
  }

  /**
   * Attach event listeners to shadow DOM elements
   * Uses event delegation - only attach once to the shadow root
   */
  private attachEventListeners(): void {
    // Only attach click handler once
    if (this.clickHandlerAttached) return;
    this.clickHandlerAttached = true;

    // Handle all clicks with data-action using event delegation
    this.shadow.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      const actionEl = target.closest('[data-action]') as HTMLElement | null;
      if (actionEl) {
        e.preventDefault();
        e.stopPropagation();
        const action = actionEl.dataset.action;
        console.log(
          '[SupportHelper] Action clicked:',
          action,
          'Current state:',
          this.stateMachine.getState()
        );
        this.handleAction(action);
      }
    });

    // Handle form submission using event delegation
    this.shadow.addEventListener('submit', e => {
      const form = (e.target as HTMLElement).closest(
        '[data-form="report"]'
      ) as HTMLFormElement | null;
      if (form) {
        e.preventDefault();
        this.handleFormSubmit(form);
      }
    });
  }

  /**
   * Handle actions from templates
   */
  private handleAction(action: string | undefined): void {
    switch (action) {
      case 'open':
        if (this.stateMachine.canTransition('OPEN')) {
          // Save focus before opening
          this.keyboardManager.saveFocus();
          this.stateMachine.dispatch('OPEN');
        }
        break;
      case 'close':
        this.handleClose();
        break;
      case 'start':
        this.handleStartRecording();
        break;
      case 'screenshot':
        this.handleScreenshot();
        break;
      case 'stop':
        this.handleStopRecording();
        break;
      case 'pause':
        this.handlePauseRecording();
        break;
      case 'resume':
        this.handleResumeRecording();
        break;
      case 'accept':
        if (this.stateMachine.canTransition('ACCEPT')) {
          this.stateMachine.dispatch('ACCEPT');
        }
        break;
      case 'crop-confirm':
        void this.handleCropConfirm();
        break;
      case 're-record':
        this.handleReRecord();
        break;
      case 'retry':
        this.handleRetry();
        break;
    }
  }

  /**
   * Handle close - cleanup and reset if needed
   */
  private handleClose(): void {
    const currentState = this.stateMachine.getState();

    // Stop ongoing AI polling when user closes the widget.
    if (currentState === 'analyzing') {
      this.stopPolling();
    }

    // If cropping, cleanup crop and close
    if (currentState === 'cropping') {
      this.cleanupCrop();
      this.stateMachine.dispatch('CLOSE');
      return;
    }

    // If recording, stop it first
    if (currentState === 'recording' && this.videoRecorder?.isActive()) {
      this.videoRecorder
        .stop()
        .then(() => {
          this.cleanupRecording();
          this.stateMachine.dispatch('CLOSE');
        })
        .catch(() => {
          this.cleanupRecording();
          this.stateMachine.dispatch('CLOSE');
        });
    } else {
      this.stateMachine.dispatch('CLOSE');
    }
  }

  /**
   * Handle start recording
   */
  private async handleStartRecording(): Promise<void> {
    // Guard: prevent double-start
    if (this.isStartingRecording) {
      console.warn('[SupportHelper] Recording start already in progress, ignoring');
      return;
    }

    // Guard: check if we can transition to recording state
    if (!this.stateMachine.canTransition('START')) {
      console.warn(
        '[SupportHelper] Cannot start recording from current state:',
        this.stateMachine.getState()
      );
      return;
    }

    // Guard: if already recording
    if (this.videoRecorder?.isActive()) {
      console.warn('[SupportHelper] Already recording, ignoring start');
      return;
    }

    this.isStartingRecording = true;

    try {
      this.cleanupRecording();
      this.cleanupCrop();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: true,
      });

      const dataUrl = await this.captureFrameDataUrl(stream);

      this.cropStream = stream;
      this.cropMode = 'video';
      this.cropImageDataUrl = dataUrl;

      this.stateMachine.dispatch('START');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.isStartingRecording = false;
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      this.errorMessage = message;
      this.announcer.announce(`Error: ${message}`, 'assertive');
      this.emit('sh:error', { message });
      console.error('[SupportHelper] Start recording error:', error);
      this.cleanupRecording();
      this.cleanupCrop();
    } finally {
      this.isStartingRecording = false;
    }
  }

  /**
   * Handle screenshot capture
   */
  private async handleScreenshot(): Promise<void> {
    if (!this.stateMachine.canTransition('SCREENSHOT')) return;

    try {
      this.cleanupCrop();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      const dataUrl = await this.captureFrameDataUrl(stream);

      // Stop stream immediately for screenshots — we have the frame
      stream.getTracks().forEach(t => t.stop());

      this.cropMode = 'screenshot';
      this.cropImageDataUrl = dataUrl;

      this.stateMachine.dispatch('SCREENSHOT');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to capture screenshot';
      this.errorMessage = message;
      this.emit('sh:error', { message });
    }
  }

  /**
   * Handle stop recording
   */
  private async handleStopRecording(): Promise<void> {
    // Guard: prevent double-stop
    if (this.isStoppingRecording) {
      console.warn('[SupportHelper] Recording stop already in progress, ignoring');
      return;
    }

    // Guard: check if we're in recording state
    if (this.stateMachine.getState() !== 'recording') {
      console.warn('[SupportHelper] Not in recording state, ignoring stop');
      return;
    }

    // Guard: check if recorder is active
    if (!this.videoRecorder || !this.videoRecorder.isActive()) {
      console.warn('[SupportHelper] No active recorder, ignoring stop');
      return;
    }

    this.isStoppingRecording = true;
    this.stopRecordingTimer();

    try {
      this.videoBlob = await this.videoRecorder.stop();
      this.videoSize = this.videoBlob.size;
      this.videoDuration = Math.floor((Date.now() - this.recordingStartTime) / 1000);

      // Cleanup cropped recording resources
      if (this.cropAnimFrameId !== null) {
        cancelAnimationFrame(this.cropAnimFrameId);
        this.cropAnimFrameId = null;
      }
      if (this.cropSourceVideo) {
        this.cropSourceVideo.srcObject = null;
        this.cropSourceVideo = null;
      }
      if (this.cropStream) {
        this.cropStream.getTracks().forEach(t => t.stop());
        this.cropStream = null;
      }

      // Create URL for preview
      this.cleanupVideoUrl();
      this.videoUrl = URL.createObjectURL(this.videoBlob);

      // Transition to preview state - this will trigger render()
      this.stateMachine.dispatch('STOP');

      // Announce to screen readers
      this.announcer.announce('Recording stopped. Review your video.', 'polite');

      this.emit('sh:recording-stop', {
        duration: this.videoDuration,
        size: this.videoSize,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop recording';
      this.errorMessage = message;

      // Announce error to screen readers
      this.announcer.announce(`Error: ${message}`, 'assertive');

      this.emit('sh:error', { message });
      console.error('[SupportHelper] Stop recording error:', error);
    } finally {
      this.isStoppingRecording = false;
    }
  }

  /**
   * Handle pause recording
   */
  private async handlePauseRecording(): Promise<void> {
    if (!this.videoRecorder?.isActive()) return;

    try {
      await this.videoRecorder.pause();
      this.isRecordingPaused = true;
      this.stopRecordingTimer();
      this.render();
    } catch (error) {
      console.error('[SupportHelper] Pause recording error:', error);
    }
  }

  /**
   * Handle resume recording
   */
  private async handleResumeRecording(): Promise<void> {
    if (!this.videoRecorder?.isActive()) return;

    try {
      await this.videoRecorder.resume();
      this.isRecordingPaused = false;
      this.startRecordingTimer();
      this.render();
    } catch (error) {
      console.error('[SupportHelper] Resume recording error:', error);
    }
  }

  /**
   * Capture first video frame as a data URL from a MediaStream.
   */
  private async captureFrameDataUrl(stream: MediaStream): Promise<string> {
    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    await video.play();
    await new Promise(resolve => requestAnimationFrame(resolve));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(video, 0, 0);
    video.srcObject = null;

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  /**
   * Handle crop confirm — branches on mode.
   */
  private async handleCropConfirm(): Promise<void> {
    if (!this.cropManager) return;
    const region = this.cropManager.getRegion();
    if (!region) return;

    if (this.cropMode === 'screenshot') {
      await this.cropScreenshotRegion(region);
      this.cleanupCrop();
      this.stateMachine.dispatch('CROP_CONFIRM_SCREENSHOT');
    } else if (this.cropMode === 'video') {
      await this.startCroppedRecording(region);
      this.cleanupCropManager();
      this.stateMachine.dispatch('CROP_CONFIRM_VIDEO');

      this.recordingStartTime = Date.now();
      this.isRecordingPaused = false;
      this.startRecordingTimer();
      this.announcer.announce('Recording started', 'polite');
      this.emit('sh:recording-start', undefined);
    }
  }

  /**
   * Crop the stored screenshot image to the selected region.
   */
  private async cropScreenshotRegion(region: CropRegion): Promise<void> {
    if (!this.cropImageDataUrl) return;

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = region.width;
        canvas.height = region.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        ctx.drawImage(img, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
        canvas.toBlob(blob => {
          if (blob) {
            this.screenshotBlob = blob;
            this.videoBlob = null;
            resolve();
          } else {
            reject(new Error('Failed to crop screenshot'));
          }
        }, 'image/png');
      };
      img.onerror = () => reject(new Error('Failed to load screenshot for cropping'));
      img.src = this.cropImageDataUrl!;
    });
  }

  /**
   * Start a cropped recording by rendering only the selected region to a canvas stream.
   */
  private async startCroppedRecording(region: CropRegion): Promise<void> {
    if (!this.cropStream) throw new Error('No crop stream available');

    const sourceVideo = document.createElement('video');
    sourceVideo.srcObject = this.cropStream;
    sourceVideo.muted = true;
    await sourceVideo.play();

    const canvas = document.createElement('canvas');
    canvas.width = region.width;
    canvas.height = region.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    const drawFrame = (): void => {
      ctx.drawImage(
        sourceVideo,
        region.x, region.y, region.width, region.height,
        0, 0, region.width, region.height
      );
      this.cropAnimFrameId = requestAnimationFrame(drawFrame);
    };
    this.cropAnimFrameId = requestAnimationFrame(drawFrame);
    this.cropSourceVideo = sourceVideo;

    const croppedStream = canvas.captureStream(30);

    // Attach audio tracks from original stream
    this.cropStream.getAudioTracks().forEach(track => {
      croppedStream.addTrack(track);
    });

    this.videoRecorder = new VideoRecorder({
      mimeType: 'video/webm',
      audioTracks: true,
    });
    await this.videoRecorder.startWithStream(croppedStream);
  }

  /**
   * Cleanup only the CropManager (detach + null), leaving stream/image for video recording.
   */
  private cleanupCropManager(): void {
    if (this.cropManager) {
      this.cropManager.detach();
      this.cropManager = null;
    }
    this.cropImageDataUrl = null;
    this.cropMode = null;
  }

  /**
   * Full crop cleanup — manager, image, stream.
   */
  private cleanupCrop(): void {
    this.cleanupCropManager();
    if (this.cropStream) {
      this.cropStream.getTracks().forEach(t => t.stop());
      this.cropStream = null;
    }
    if (this.cropAnimFrameId !== null) {
      cancelAnimationFrame(this.cropAnimFrameId);
      this.cropAnimFrameId = null;
    }
    if (this.cropSourceVideo) {
      this.cropSourceVideo.srcObject = null;
      this.cropSourceVideo = null;
    }
  }

  /**
   * Handle re-record
   */
  private handleReRecord(): void {
    this.cleanupRecording();
    if (this.stateMachine.canTransition('RE_RECORD')) {
      this.stateMachine.dispatch('RE_RECORD');
    }
  }

  /**
   * Handle retry after error
   */
  private handleRetry(): void {
    if (this.stateMachine.canTransition('SUBMIT')) {
      this.stateMachine.dispatch('SUBMIT');
      this.doSubmit();
    } else if (this.stateMachine.canTransition('RESET')) {
      this.stateMachine.dispatch('RESET');
    }
  }

  /**
   * Handle form submission
   */
  private handleFormSubmit(form: HTMLFormElement): void {
    const formData = new FormData(form);
    this.formData = {
      title: (formData.get('title') as string) || '',
      description: (formData.get('description') as string) || '',
    };

    if (!this.formData.title.trim() || !this.formData.description.trim()) {
      // Show validation error instead of silently ignoring
      this.errorMessage = 'Title and description are required.';

      // Mark invalid fields with aria-invalid
      const titleInput = this.shadow.querySelector('#sh-input-title') as HTMLInputElement | null;
      const descInput = this.shadow.querySelector(
        '#sh-input-description'
      ) as HTMLTextAreaElement | null;

      if (titleInput && !this.formData.title.trim()) {
        titleInput.setAttribute('aria-invalid', 'true');
      }
      if (descInput && !this.formData.description.trim()) {
        descInput.setAttribute('aria-invalid', 'true');
      }

      // Announce validation error to screen readers
      this.announcer.announce('Error: Title and description are required.', 'assertive');

      this.render();
      return;
    }
    this.errorMessage = '';

    if (this.stateMachine.canTransition('SUBMIT')) {
      // Announce submission to screen readers
      this.announcer.announce('Sending your report...', 'polite');

      this.stateMachine.dispatch('SUBMIT');
      this.doSubmit();
    }
  }

  /**
   * Submit the report.
   * When offline or on network failure, the report is queued in IndexedDB and
   * the widget transitions to success (with a "queued" indication so the user
   * knows their report was saved).
   */
  private async doSubmit(): Promise<void> {
    try {
      const userContext = ContextCapture.captureContext();

      const response = await submitReport(
        this.config.apiUrl,
        this.config.sdkKey,
        {
          title: this.formData.title,
          description: this.formData.description,
          videoBlob: this.videoBlob,
          screenshotBlob: this.screenshotBlob,
          userContext,
        },
        60000,
        reason => {
          // Report was queued because the network is unavailable.
          this.emit('sh:queued', { reason });
        }
      );

      if (response === null) {
        // Report was queued for later delivery.
        this.lastReportResponse = null;

        if (this.stateMachine.canTransition('SUCCESS')) {
          this.stateMachine.dispatch('SUCCESS');
        }

        this.announcer.announce('Report saved — will be sent when online.', 'polite');
        return;
      }

      this.lastReportResponse = response;

      // If we have a ticket ID, start polling for AI results instead of
      // going directly to success state.
      if (response.ticket.id && this.stateMachine.canTransition('ANALYZE')) {
        this.stateMachine.dispatch('ANALYZE');
        this.startPolling(response.ticket.id);

        this.announcer.announce('Report sent. Analyzing your issue...', 'polite');

        this.emit('sh:submit', {
          ticketId: response.ticket.id,
          aiAnalysis: response.aiAnalysis,
        });
        return;
      }

      if (this.stateMachine.canTransition('SUCCESS')) {
        this.stateMachine.dispatch('SUCCESS');
      }

      // Announce success to screen readers
      this.announcer.announce('Report sent successfully!', 'polite');

      this.emit('sh:submit', {
        ticketId: response.ticket.id,
        aiAnalysis: response.aiAnalysis,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit report';
      this.errorMessage = message;

      if (this.stateMachine.canTransition('ERROR')) {
        this.stateMachine.dispatch('ERROR');
      }

      // Announce error to screen readers
      this.announcer.announce(`Error: ${message}`, 'assertive');

      this.emit('sh:error', { message });
      console.error('[SupportHelper] Submit error:', error);
    }
  }

  /**
   * State change handler
   */
  private onStateChange(newState: WidgetState, prevState: WidgetState): void {
    // Emit events for state changes
    if (newState !== 'idle' && prevState === 'idle') {
      this.emit('sh:open', undefined);

      // Announce modal opened to screen readers
      this.announcer.announce('Support helper opened', 'polite');
      this.stopAttentionPulseTimer();
    } else if (newState === 'idle' && prevState !== 'idle') {
      this.emit('sh:close', undefined);

      // Restore focus when closing
      this.keyboardManager.restoreFocus();

      // Cleanup on close
      this.cleanupRecording();
      this.cleanupCrop();
      this.stopPolling();
      this.formData = { title: '', description: '' };
      // Restart attention pulse timer when returning to idle
      this.startAttentionPulseTimer();
    }

    // Detach crop manager when leaving cropping state
    if (prevState === 'cropping' && newState !== 'cropping') {
      if (this.cropManager) {
        this.cropManager.detach();
        // Keep cropManager instance; it gets set to null in cleanupCropManager/cleanupCrop
      }
    }

    // Re-render
    this.render();

    // Focus first element after render if modal is open
    if (newState !== 'idle' && newState !== 'recording') {
      // Use setTimeout to ensure DOM is updated
      setTimeout(() => {
        this.keyboardManager.focusFirstElement();
      }, 0);
    }
  }

  /**
   * Start the recording timer
   */
  private startRecordingTimer(): void {
    // Clear any existing timer to prevent stacking intervals on pause/resume
    this.stopRecordingTimer();
    this.recordingTimer = window.setInterval(() => {
      if (!this.isRecordingPaused) {
        this.videoDuration = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        // Update just the timer display without full re-render
        const timerEl = this.shadow.querySelector('.sh-timer-time');
        if (timerEl) {
          const mins = Math.floor(this.videoDuration / 60);
          const secs = this.videoDuration % 60;
          timerEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
      }
    }, 1000);
  }

  /**
   * Stop the recording timer
   */
  private stopRecordingTimer(): void {
    if (this.recordingTimer !== null) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  }

  /**
   * Cleanup recording resources
   */
  private cleanupRecording(): void {
    this.stopRecordingTimer();
    this.cleanupVideoUrl();
    this.videoBlob = null;
    this.screenshotBlob = null;
    this.videoDuration = 0;
    this.videoSize = 0;
    this.isRecordingPaused = false;
    this.videoRecorder = null;
    // Reset locks
    this.isStartingRecording = false;
    this.isStoppingRecording = false;
  }

  /**
   * Cleanup video URL
   */
  private cleanupVideoUrl(): void {
    if (this.videoUrl) {
      URL.revokeObjectURL(this.videoUrl);
      this.videoUrl = null;
    }
  }

  /**
   * Initialize theme detection based on config.theme
   */
  private initializeThemeDetection(): void {
    if (this.config.theme === 'light') {
      this.resolvedTheme = 'light';
    } else if (this.config.theme === 'dark') {
      this.resolvedTheme = 'dark';
    } else {
      // Auto mode: detect system preference and host page
      this.resolvedTheme = this.detectTheme();
      this.setupThemeObservers();
    }
  }

  /**
   * Detect theme based on system preference and host page
   */
  private detectTheme(): 'light' | 'dark' {
    // 1. Check host page for dark mode indicators
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      const body = document.body;

      // Check for common dark mode classes
      if (html.classList.contains('dark') || body.classList.contains('dark')) {
        return 'dark';
      }

      // Check for data-theme attribute
      const htmlTheme = html.getAttribute('data-theme');
      const bodyTheme = body.getAttribute('data-theme');
      if (htmlTheme === 'dark' || bodyTheme === 'dark') {
        return 'dark';
      }
    }

    // 2. Check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
      if (prefersDark.matches) {
        return 'dark';
      }
    }

    // Default to light
    return 'light';
  }

  /**
   * Setup theme observers for auto mode
   */
  private setupThemeObservers(): void {
    // 1. Listen to system preference changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.prefersDarkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (_e: MediaQueryListEvent): void => {
        this.resolvedTheme = this.detectTheme();
        this.render();
      };

      // Use addEventListener for modern browsers
      if (this.prefersDarkMediaQuery.addEventListener) {
        this.prefersDarkMediaQuery.addEventListener('change', handleSystemThemeChange);
      }
    }

    // 2. Observe host page changes (html/body class and data-theme changes)
    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      this.hostMutationObserver = new MutationObserver(() => {
        const newTheme = this.detectTheme();
        if (newTheme !== this.resolvedTheme) {
          this.resolvedTheme = newTheme;
          this.render();
        }
      });

      // Observe both html and body
      const observerConfig: MutationObserverInit = {
        attributes: true,
        attributeFilter: ['class', 'data-theme'],
      };

      this.hostMutationObserver.observe(document.documentElement, observerConfig);
      if (document.body) {
        this.hostMutationObserver.observe(document.body, observerConfig);
      }
    }
  }

  /**
   * Cleanup theme observers
   */
  private cleanupThemeDetection(): void {
    if (this.prefersDarkMediaQuery) {
      this.prefersDarkMediaQuery = null;
    }

    if (this.hostMutationObserver) {
      this.hostMutationObserver.disconnect();
      this.hostMutationObserver = null;
    }
  }

  /**
   * Start attention pulse timer - adds pulse animation to FAB after delay
   */
  private startAttentionPulseTimer(): void {
    // Only pulse when in idle state
    if (this.stateMachine.getState() !== 'idle') return;

    this.stopAttentionPulseTimer();
    this.attentionPulseTimer = window.setTimeout(() => {
      const fab = this.shadow.querySelector('.sh-fab');
      if (fab && this.stateMachine.getState() === 'idle') {
        fab.classList.add('sh-attention-pulse');
        // Remove class after animation completes (2s * 3 iterations = 6s)
        setTimeout(() => {
          fab.classList.remove('sh-attention-pulse');
        }, 6000);
      }
    }, this.attentionPulseDelay);
  }

  // ---------------------------------------------------------------------------
  // AI polling
  // ---------------------------------------------------------------------------

  /**
   * Start polling GET /api/sdk/tickets/:id every 5 seconds.
   * Transitions to success (ANALYSIS_DONE) when aiSummary is non-null,
   * or to success (ANALYSIS_TIMEOUT) after 2 minutes.
   */
  private startPolling(ticketId: string): void {
    this.stopPolling(); // guard against duplicate start

    this.pollingTicketId = ticketId;
    this.pollingStartTime = Date.now();
    this.pollingElapsed = 0;
    this.pollingTimedOut = false;
    this.pollingResult = null;

    // Elapsed-seconds counter — updates the progress bar every second.
    this.pollingTickTimer = window.setInterval(() => {
      this.pollingElapsed = Math.floor((Date.now() - this.pollingStartTime) / 1000);
      // Live-update the progress bar / timer text without a full re-render.
      const fill = this.shadow.querySelector('.sh-progress-fill') as HTMLElement | null;
      const timerEl = this.shadow.querySelector('.sh-analyzing-timer');
      if (fill) {
        const pct = Math.min(100, Math.round((this.pollingElapsed / 120) * 100));
        fill.style.width = `${pct}%`;
      }
      if (timerEl) {
        const remaining = Math.max(0, 120 - this.pollingElapsed);
        const t = this.translations;
        timerEl.textContent =
          remaining > 0
            ? t.analyzing.remaining.replace('{seconds}', String(remaining))
            : t.analyzing.almostDone;
      }
    }, 1000);

    const handle = pollTicketStatus(this.config.apiUrl, this.config.sdkKey, ticketId, {
      onResult: ticket => {
        // Stop polling as soon as aiSummary is non-null.
        if (ticket.aiSummary) {
          this.pollingResult = {
            summary: ticket.aiSummary,
            severity: ticket.severity,
            type: ticket.type,
          };
          this.stopPollingTick();

          if (this.stateMachine.canTransition('ANALYSIS_DONE')) {
            this.stateMachine.dispatch('ANALYSIS_DONE');
          }
          this.announcer.announce('AI analysis complete!', 'polite');
          return true; // stop polling
        }
        return false; // keep polling
      },
      onTimeout: () => {
        this.pollingTimedOut = true;
        this.stopPollingTick();

        if (this.stateMachine.canTransition('ANALYSIS_TIMEOUT')) {
          this.stateMachine.dispatch('ANALYSIS_TIMEOUT');
        }
        this.announcer.announce(
          'Analysis is taking longer than expected. Check the dashboard for results.',
          'polite'
        );
      },
    });

    this.pollStop = handle.stop;
  }

  /** Cancel ongoing network polling (but leave tick timer running if needed). */
  private stopPolling(): void {
    if (this.pollStop) {
      this.pollStop();
      this.pollStop = null;
    }
    this.stopPollingTick();
  }

  /** Cancel the elapsed-seconds interval only. */
  private stopPollingTick(): void {
    if (this.pollingTickTimer !== null) {
      clearInterval(this.pollingTickTimer);
      this.pollingTickTimer = null;
    }
  }

  /**
   * Initialize the offline queue and forward its events as custom DOM events
   * on this element so host pages can listen via addEventListener.
   */
  private initializeOfflineQueue(): void {
    getOfflineQueue()
      .then(queue => {
        this.queueFlushedListener = (detail: QueueFlushedDetail) => {
          this.emit('sh:queue-flushed', detail);
        };
        this.queueErrorListener = (detail: QueueErrorDetail) => {
          this.emit('sh:queue-error', detail);
        };
        queue.on('queue:flushed', this.queueFlushedListener);
        queue.on('queue:error', this.queueErrorListener);
      })
      .catch(err => {
        console.warn('[SupportHelper] Could not initialize offline queue:', err);
      });
  }

  /**
   * Remove offline-queue event listeners.
   */
  private teardownOfflineQueue(): void {
    if (!this.queueFlushedListener && !this.queueErrorListener) return;

    getOfflineQueue()
      .then(queue => {
        if (this.queueFlushedListener) {
          // Cast required because TypeScript overload resolution is strict here.
          queue.off('queue:flushed', this.queueFlushedListener as (d: QueueFlushedDetail) => void);
          this.queueFlushedListener = null;
        }
        if (this.queueErrorListener) {
          queue.off('queue:error', this.queueErrorListener as (d: QueueErrorDetail) => void);
          this.queueErrorListener = null;
        }
      })
      .catch(() => {
        // ignore — element is being removed anyway
      });
  }

  /**
   * Stop attention pulse timer
   */
  private stopAttentionPulseTimer(): void {
    if (this.attentionPulseTimer !== null) {
      clearTimeout(this.attentionPulseTimer);
      this.attentionPulseTimer = null;
    }
    // Remove class if present
    const fab = this.shadow.querySelector('.sh-fab');
    if (fab) {
      fab.classList.remove('sh-attention-pulse');
    }
  }

  /**
   * Emit custom event
   */
  private emit<K extends keyof WidgetEventMap>(
    type: K,
    detail: WidgetEventMap[K] extends CustomEvent<infer D> ? D : never
  ): void {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail,
        bubbles: true,
        composed: true, // Cross shadow DOM boundary
      })
    );
  }
}

// Type augmentation for HTMLElementTagNameMap
declare global {
  interface HTMLElementTagNameMap {
    'support-helper': SupportHelperElement;
  }
}
