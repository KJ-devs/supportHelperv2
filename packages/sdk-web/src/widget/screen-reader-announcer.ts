/**
 * Screen Reader Announcer - Manages aria-live regions for screen reader announcements
 */

export type AnnouncementPriority = 'polite' | 'assertive';

/**
 * Creates and manages aria-live regions for screen reader announcements
 */
export class ScreenReaderAnnouncer {
  private politeRegion: HTMLElement | null = null;
  private assertiveRegion: HTMLElement | null = null;
  private shadowRoot: ShadowRoot;

  constructor(shadowRoot: ShadowRoot) {
    this.shadowRoot = shadowRoot;
  }

  /**
   * Initialize aria-live regions
   */
  initialize(): void {
    // Create polite region if it doesn't exist
    if (!this.politeRegion) {
      this.politeRegion = this.createLiveRegion('polite');
      this.shadowRoot.appendChild(this.politeRegion);
    }

    // Create assertive region if it doesn't exist
    if (!this.assertiveRegion) {
      this.assertiveRegion = this.createLiveRegion('assertive');
      this.shadowRoot.appendChild(this.assertiveRegion);
    }
  }

  /**
   * Create an aria-live region element
   */
  private createLiveRegion(priority: AnnouncementPriority): HTMLElement {
    const region = document.createElement('div');
    region.setAttribute('aria-live', priority);
    region.setAttribute('aria-atomic', 'true');
    region.className = 'sh-sr-only';
    return region;
  }

  /**
   * Announce a message to screen readers
   */
  announce(message: string, priority: AnnouncementPriority = 'polite'): void {
    const region = priority === 'assertive' ? this.assertiveRegion : this.politeRegion;

    if (!region) {
      console.warn('[ScreenReaderAnnouncer] Live region not initialized');
      return;
    }

    // Clear previous message
    region.textContent = '';

    // Use setTimeout to ensure the change is detected
    setTimeout(() => {
      region.textContent = message;
    }, 100);
  }

  /**
   * Cleanup - remove regions
   */
  destroy(): void {
    if (this.politeRegion && this.politeRegion.parentNode) {
      this.politeRegion.parentNode.removeChild(this.politeRegion);
    }
    if (this.assertiveRegion && this.assertiveRegion.parentNode) {
      this.assertiveRegion.parentNode.removeChild(this.assertiveRegion);
    }
    this.politeRegion = null;
    this.assertiveRegion = null;
  }
}
