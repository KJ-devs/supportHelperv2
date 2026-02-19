/**
 * Keyboard Manager - Handles keyboard navigation and focus management
 */

export interface KeyboardManagerOptions {
  onEscape: () => void;
  onEnter?: (target: HTMLElement) => void;
  getShadowRoot: () => ShadowRoot;
  getIsModalOpen: () => boolean;
}

/**
 * Manages keyboard navigation and focus trapping for the widget
 */
export class KeyboardManager {
  private options: KeyboardManagerOptions;
  private previouslyFocusedElement: HTMLElement | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(options: KeyboardManagerOptions) {
    this.options = options;
  }

  /**
   * Start listening to keyboard events
   */
  attach(): void {
    if (this.keydownHandler) return; // Already attached

    this.keydownHandler = (e: KeyboardEvent) => {
      this.handleKeydown(e);
    };

    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Stop listening to keyboard events
   */
  detach(): void {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
  }

  /**
   * Handle keydown events
   */
  private handleKeydown(e: KeyboardEvent): void {
    const isModalOpen = this.options.getIsModalOpen();

    // Escape key - close modal/cancel recording
    if (e.key === 'Escape' && isModalOpen) {
      e.preventDefault();
      this.options.onEscape();
      return;
    }

    // Tab key - trap focus in modal if open
    if (e.key === 'Tab' && isModalOpen) {
      this.handleTabKey(e);
      return;
    }

    // Enter/Space - activate focused element
    if ((e.key === 'Enter' || e.key === ' ') && isModalOpen) {
      const target = e.target as HTMLElement;
      const shadowRoot = this.options.getShadowRoot();

      // Check if target is inside our shadow DOM
      if (this.isInsideShadowDOM(target, shadowRoot)) {
        // Let form elements handle their own Enter/Space
        if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
          return;
        }

        // For buttons with data-action, trigger click
        const actionEl = target.closest('[data-action]') as HTMLElement | null;
        if (actionEl) {
          e.preventDefault();
          actionEl.click();
        }
      }
    }
  }

  /**
   * Handle Tab key for focus trapping
   */
  private handleTabKey(e: KeyboardEvent): void {
    const shadowRoot = this.options.getShadowRoot();
    const focusableElements = this.getFocusableElements(shadowRoot);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // If Shift+Tab on first element, focus last
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
      return;
    }

    // If Tab on last element, focus first
    if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
      return;
    }

    // Check if focus is inside shadow DOM
    const activeElement = shadowRoot.activeElement || document.activeElement;
    if (!this.isInsideShadowDOM(activeElement as HTMLElement, shadowRoot)) {
      // Focus escaped, bring it back
      e.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Get all focusable elements in the shadow DOM
   */
  private getFocusableElements(shadowRoot: ShadowRoot): HTMLElement[] {
    const focusableSelectors = [
      'button:not(:disabled)',
      'a[href]',
      'input:not(:disabled)',
      'textarea:not(:disabled)',
      'select:not(:disabled)',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    const elements = shadowRoot.querySelectorAll<HTMLElement>(focusableSelectors);
    return Array.from(elements).filter(el => {
      // Filter out hidden elements
      return el.offsetParent !== null &&
             getComputedStyle(el).visibility !== 'hidden' &&
             getComputedStyle(el).display !== 'none';
    });
  }

  /**
   * Check if element is inside the shadow DOM
   */
  private isInsideShadowDOM(element: HTMLElement | null, shadowRoot: ShadowRoot): boolean {
    if (!element) return false;

    let current: Node | null = element;
    while (current) {
      if (current === shadowRoot) return true;
      current = current.parentNode;
    }
    return false;
  }

  /**
   * Save currently focused element before opening modal
   */
  saveFocus(): void {
    this.previouslyFocusedElement = document.activeElement as HTMLElement;
  }

  /**
   * Restore focus to previously focused element
   */
  restoreFocus(): void {
    if (this.previouslyFocusedElement && typeof this.previouslyFocusedElement.focus === 'function') {
      this.previouslyFocusedElement.focus();
      this.previouslyFocusedElement = null;
    }
  }

  /**
   * Focus first element in modal
   */
  focusFirstElement(): void {
    const shadowRoot = this.options.getShadowRoot();
    const focusableElements = this.getFocusableElements(shadowRoot);

    if (focusableElements.length > 0) {
      // Skip the close button, focus the first interactive element
      const firstNonCloseButton = focusableElements.find(
        el => !el.classList.contains('sh-close-btn')
      ) ?? focusableElements[0];

      if (firstNonCloseButton) {
        firstNonCloseButton.focus();
      }
    }
  }
}
