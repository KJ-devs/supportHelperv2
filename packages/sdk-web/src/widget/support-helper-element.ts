/**
 * Support Helper Custom Element
 * <support-helper sdk-key="..." api-url="..."></support-helper>
 */

import type { WidgetConfig, WidgetState, WidgetEventMap, ReportResponse } from './widget-types';
import { DEFAULT_CONFIG, parseAttributeConfig } from './widget-config';
import { WidgetStateMachine } from './widget-state-machine';
import { createWidgetStyles } from './widget-styles';
import { renderFAB, renderModal, renderRecordingBar, getViewForState } from './widget-templates';
import { submitReport } from './widget-api';
import { VideoRecorder } from '../recorder/video-recorder';
import { ContextCapture } from '../context/context-capture';
import { KeyboardManager } from './keyboard-manager';
import { ScreenReaderAnnouncer } from './screen-reader-announcer';

/**
 * Support Helper Web Component
 */
export class SupportHelperElement extends HTMLElement {
  private shadow: ShadowRoot;
  private stateMachine: WidgetStateMachine;
  private config: WidgetConfig;
  private videoRecorder: VideoRecorder | null = null;
  private videoBlob: Blob | null = null;
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

  // Keyboard and accessibility
  private keyboardManager: KeyboardManager;
  private announcer: ScreenReaderAnnouncer;

  static get observedAttributes(): string[] {
    return ['sdk-key', 'api-url', 'position', 'primary-color', 'z-index'];
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
    // Parse config from attributes
    const attrConfig = parseAttributeConfig(this);
    this.config = {
      ...DEFAULT_CONFIG,
      ...attrConfig,
      sdkKey: attrConfig.sdkKey || '',
      apiUrl: attrConfig.apiUrl || '',
    };

    // Validate required attributes
    if (!this.config.sdkKey) {
      console.warn('[SupportHelper] sdk-key attribute is required');
    }
    if (!this.config.apiUrl) {
      console.warn('[SupportHelper] api-url attribute is required');
    }

    // Render initial state
    this.render();

    // Attach event listeners
    this.attachEventListeners();

    // Initialize keyboard manager
    this.keyboardManager.attach();

    // Initialize screen reader announcer
    this.announcer.initialize();
  }

  disconnectedCallback(): void {
    // Cleanup
    this.stopRecordingTimer();
    this.cleanupVideoUrl();
    if (this.videoRecorder?.isActive()) {
      this.videoRecorder.stop().catch(() => {});
    }
    // Reset so event listeners re-attach on reconnect
    this.clickHandlerAttached = false;

    // Cleanup keyboard manager and announcer
    this.keyboardManager.detach();
    this.announcer.destroy();
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
      this.config.position
    );

    // Set data-state attribute on host for CSS state-based selectors
    this.setAttribute('data-state', state);

    let html = `<style>${styles}</style>`;

    // Always render FAB
    html += renderFAB('Report an issue');

    // During recording: show minimal floating bar instead of modal+backdrop
    if (state === 'recording') {
      html += renderRecordingBar(this.videoDuration, this.isRecordingPaused);
    }

    // Render modal if not idle and not recording
    if (state !== 'idle' && state !== 'recording') {
      const viewContent = getViewForState(state, {
        videoUrl: this.videoUrl || undefined,
        duration: this.videoDuration,
        size: this.videoSize,
        isPaused: this.isRecordingPaused,
        ticketId: this.lastReportResponse?.ticket.id,
        aiAnalysis: this.lastReportResponse?.aiAnalysis,
        dashboardUrl: undefined, // Could be constructed from config
        errorMessage: this.errorMessage,
      });
      html += renderModal('Report an Issue', viewContent);
    }

    this.shadow.innerHTML = html;
    this.attachEventListeners();
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

      this.videoRecorder = new VideoRecorder({
        mimeType: 'video/webm',
        audioTracks: true,
      });

      await this.videoRecorder.start();

      this.recordingStartTime = Date.now();
      this.isRecordingPaused = false;
      this.startRecordingTimer();

      // Transition to recording state
      this.stateMachine.dispatch('START');

      // Announce to screen readers
      this.announcer.announce('Recording started', 'polite');

      this.emit('sh:recording-start', undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start recording';
      this.errorMessage = message;

      // Announce error to screen readers
      this.announcer.announce(`Error: ${message}`, 'assertive');

      this.emit('sh:error', { message });
      console.error('[SupportHelper] Start recording error:', error);
      // Cleanup on failure
      this.cleanupRecording();
    } finally {
      this.isStartingRecording = false;
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
      const descInput = this.shadow.querySelector('#sh-input-description') as HTMLTextAreaElement | null;

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
   * Submit the report
   */
  private async doSubmit(): Promise<void> {
    try {
      const userContext = ContextCapture.captureContext();

      const response = await submitReport(this.config.apiUrl, this.config.sdkKey, {
        title: this.formData.title,
        description: this.formData.description,
        videoBlob: this.videoBlob,
        userContext,
      });

      this.lastReportResponse = response;

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
    } else if (newState === 'idle' && prevState !== 'idle') {
      this.emit('sh:close', undefined);

      // Restore focus when closing
      this.keyboardManager.restoreFocus();

      // Cleanup on close
      this.cleanupRecording();
      this.formData = { title: '', description: '' };
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
