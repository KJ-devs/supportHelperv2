/**
 * CropManager unit tests.
 *
 * CropManager is tightly coupled to the DOM — it queries elements from a
 * ShadowRoot and uses pointer events and getBoundingClientRect(). jsdom (the
 * Vitest default environment) does not implement layout, so
 * getBoundingClientRect() always returns zeros and pointer capture is absent.
 *
 * Strategy:
 *  - Tests that only exercise public API contracts (attach/detach, getRegion
 *    returning null before interaction) are run directly against a real jsdom
 *    element tree (no shadow root needed — we pass a fake shadow root object).
 *  - Tests that require layout (scale, offset calculations) drive the private
 *    state via simulated PointerEvents and mock getBoundingClientRect.
 *  - Tests that require pointer capture mock setPointerCapture on the element.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CropManager } from '../src/widget/crop-overlay';

// jsdom does not implement PointerEvent — polyfill it so pointer-driven tests work.
if (typeof PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = PointerEventPolyfill;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

function makeButton(): HTMLButtonElement {
  return document.createElement('button');
}

interface FakeShadowRoot {
  querySelector: (sel: string) => Element | null;
}

/**
 * Build a fake shadow root that returns pre-created elements for the selectors
 * CropManager.attach() queries.
 */
function makeFakeShadowRoot(
  overrides: {
    overlay?: HTMLElement | null;
    selection?: HTMLElement | null;
    dimensions?: HTMLElement | null;
    confirmBtn?: HTMLButtonElement | null;
    image?: HTMLImageElement | null;
  } = {}
): FakeShadowRoot {
  const overlay = overrides.overlay !== undefined ? overrides.overlay : makeElement('div');
  const selection = overrides.selection !== undefined ? overrides.selection : makeElement('div');
  const dimensions =
    overrides.dimensions !== undefined ? overrides.dimensions : makeElement('span');
  const confirmBtn = overrides.confirmBtn !== undefined ? overrides.confirmBtn : makeButton();
  const image =
    overrides.image !== undefined
      ? overrides.image
      : (document.createElement('img') as HTMLImageElement);

  // Provide setPointerCapture so attach() doesn't blow up when pointerdown fires
  if (overlay) {
    (overlay as HTMLElement & { setPointerCapture?: (id: number) => void }).setPointerCapture =
      vi.fn();
  }

  return {
    querySelector(sel: string): Element | null {
      if (sel === '.sh-crop-overlay') return overlay;
      if (sel === '.sh-crop-selection') return selection;
      if (sel === '.sh-crop-dimensions') return dimensions;
      if (sel === '.sh-crop-confirm-btn') return confirmBtn;
      if (sel === '.sh-crop-image') return image;
      return null;
    },
  };
}

/** Fire a PointerEvent on an element with given clientX/Y. */
function firePointer(
  el: HTMLElement,
  type: string,
  clientX: number,
  clientY: number,
  pointerId = 1
): void {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    pointerId,
  });
  el.dispatchEvent(event);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CropManager', () => {
  let manager: CropManager;

  beforeEach(() => {
    manager = new CropManager();
  });

  // --- Instantiation ---

  it('constructs without throwing', () => {
    expect(manager).toBeDefined();
  });

  // --- getRegion before any interaction ---

  it('getRegion returns null before attach', () => {
    expect(manager.getRegion()).toBeNull();
  });

  it('getRegion returns null after attach but before any pointer interaction', () => {
    const shadow = makeFakeShadowRoot();
    manager.attach(shadow as unknown as ShadowRoot);
    expect(manager.getRegion()).toBeNull();
  });

  // --- attach ---

  it('attach does not throw when all elements exist', () => {
    const shadow = makeFakeShadowRoot();
    expect(() => manager.attach(shadow as unknown as ShadowRoot)).not.toThrow();
  });

  it('attach does not throw when overlay is missing (graceful no-op)', () => {
    const shadow = makeFakeShadowRoot({ overlay: null });
    expect(() => manager.attach(shadow as unknown as ShadowRoot)).not.toThrow();
  });

  it('attach does not throw when optional elements are missing', () => {
    const shadow = makeFakeShadowRoot({
      selection: null,
      dimensions: null,
      confirmBtn: null,
      image: null,
    });
    expect(() => manager.attach(shadow as unknown as ShadowRoot)).not.toThrow();
  });

  // --- detach ---

  it('detach does not throw before attach', () => {
    expect(() => manager.detach()).not.toThrow();
  });

  it('detach does not throw after attach', () => {
    const shadow = makeFakeShadowRoot();
    manager.attach(shadow as unknown as ShadowRoot);
    expect(() => manager.detach()).not.toThrow();
  });

  it('getRegion returns null after detach', () => {
    const shadow = makeFakeShadowRoot();
    manager.attach(shadow as unknown as ShadowRoot);
    manager.detach();
    expect(manager.getRegion()).toBeNull();
  });

  // --- Multiple attach/detach cycles ---

  it('can attach, detach, then attach again without throwing', () => {
    const shadowA = makeFakeShadowRoot();
    const shadowB = makeFakeShadowRoot();
    manager.attach(shadowA as unknown as ShadowRoot);
    manager.detach();
    expect(() => manager.attach(shadowB as unknown as ShadowRoot)).not.toThrow();
  });

  it('second detach after first detach does not throw', () => {
    const shadow = makeFakeShadowRoot();
    manager.attach(shadow as unknown as ShadowRoot);
    manager.detach();
    expect(() => manager.detach()).not.toThrow();
  });

  // --- Event listener registration (no duplicates) ---

  it('attach registers exactly one set of pointer listeners on the overlay', () => {
    const overlay = makeElement('div');
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();

    const addSpy = vi.spyOn(overlay, 'addEventListener');
    const shadow = makeFakeShadowRoot({ overlay });

    manager.attach(shadow as unknown as ShadowRoot);

    // Expects pointerdown, pointermove, pointerup, pointercancel
    const types = addSpy.mock.calls.map(c => c[0]);
    expect(types).toContain('pointerdown');
    expect(types).toContain('pointermove');
    expect(types).toContain('pointerup');
    expect(types).toContain('pointercancel');
    expect(types.filter(t => t === 'pointerdown')).toHaveLength(1);
  });

  it('detach removes all pointer listeners from the overlay', () => {
    const overlay = makeElement('div');
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();

    const removeSpy = vi.spyOn(overlay, 'removeEventListener');
    const shadow = makeFakeShadowRoot({ overlay });

    manager.attach(shadow as unknown as ShadowRoot);
    manager.detach();

    const types = removeSpy.mock.calls.map(c => c[0]);
    expect(types).toContain('pointerdown');
    expect(types).toContain('pointermove');
    expect(types).toContain('pointerup');
    expect(types).toContain('pointercancel');
  });

  // --- getRegion minimum size enforcement ---

  it('getRegion returns null when drawn rect is smaller than 20x20', () => {
    const overlay = makeElement('div');
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();

    // getBoundingClientRect for overlay and image: both at origin, no natural size
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const image = document.createElement('img') as HTMLImageElement;
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const shadow = makeFakeShadowRoot({ overlay, image });
    manager.attach(shadow as unknown as ShadowRoot);

    // Draw a tiny rect: 10x10 (below MIN_SIZE=20)
    firePointer(overlay, 'pointerdown', 10, 10);
    firePointer(overlay, 'pointermove', 15, 15);
    firePointer(overlay, 'pointerup', 15, 15);

    // onPointerUp discards rects smaller than MIN_SIZE — getRegion returns null
    expect(manager.getRegion()).toBeNull();
  });

  it('getRegion returns a region when drawn rect meets the 20x20 minimum', () => {
    const overlay = makeElement('div');
    Object.defineProperty(overlay, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(overlay, 'clientHeight', { value: 300, configurable: true });
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();

    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const image = document.createElement('img') as HTMLImageElement;
    // naturalWidth/Height 0 → falls back to imgRect.width/height (400x300)
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const shadow = makeFakeShadowRoot({
      overlay,
      image,
      selection: null,
      dimensions: null,
      confirmBtn: null,
    });
    manager.attach(shadow as unknown as ShadowRoot);

    // Draw a 100x100 rect
    firePointer(overlay, 'pointerdown', 50, 50);
    firePointer(overlay, 'pointermove', 150, 150);
    firePointer(overlay, 'pointerup', 150, 150);

    const region = manager.getRegion();
    expect(region).not.toBeNull();
    expect(region!.width).toBe(100);
    expect(region!.height).toBe(100);
    expect(region!.x).toBe(50);
    expect(region!.y).toBe(50);
  });

  it('getRegion scales coordinates by image natural size', () => {
    const overlay = makeElement('div');
    Object.defineProperty(overlay, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(overlay, 'clientHeight', { value: 300, configurable: true });
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();

    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const image = document.createElement('img') as HTMLImageElement;
    // Image displayed at 400x300 but natural size is 1920x1080 → scale 4.8x / 3.6y
    Object.defineProperty(image, 'naturalWidth', { value: 1920, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 1080, configurable: true });
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const shadow = makeFakeShadowRoot({
      overlay,
      image,
      selection: null,
      dimensions: null,
      confirmBtn: null,
    });
    manager.attach(shadow as unknown as ShadowRoot);

    // Draw 100x100 display-px rect starting at (0,0)
    firePointer(overlay, 'pointerdown', 0, 0);
    firePointer(overlay, 'pointermove', 100, 100);
    firePointer(overlay, 'pointerup', 100, 100);

    const region = manager.getRegion();
    expect(region).not.toBeNull();
    // 100 * (1920/400) = 480; 100 * (1080/300) = 360
    expect(region!.width).toBe(480);
    expect(region!.height).toBe(360);
  });

  it('getRegion accounts for image offset within overlay', () => {
    const overlay = makeElement('div');
    Object.defineProperty(overlay, 'clientWidth', { value: 600, configurable: true });
    Object.defineProperty(overlay, 'clientHeight', { value: 400, configurable: true });
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();

    // Overlay starts at (0,0) in client coords
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 600,
      bottom: 400,
      width: 600,
      height: 400,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const image = document.createElement('img') as HTMLImageElement;
    // Image has a 50px left offset and 25px top offset inside the overlay
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      left: 50,
      top: 25,
      right: 550,
      bottom: 375,
      width: 500,
      height: 350,
      x: 50,
      y: 25,
      toJSON: () => ({}),
    } as DOMRect);
    // No natural size → falls back to display size (500x350)
    Object.defineProperty(image, 'naturalWidth', { value: 0, configurable: true });
    Object.defineProperty(image, 'naturalHeight', { value: 0, configurable: true });

    const shadow = makeFakeShadowRoot({
      overlay,
      image,
      selection: null,
      dimensions: null,
      confirmBtn: null,
    });
    manager.attach(shadow as unknown as ShadowRoot);

    // Draw rect starting at overlay coords (100, 75) — which is (50, 50) in image coords
    firePointer(overlay, 'pointerdown', 100, 75);
    firePointer(overlay, 'pointermove', 200, 175);
    firePointer(overlay, 'pointerup', 200, 175);

    const region = manager.getRegion();
    expect(region).not.toBeNull();
    // x = (100 - 50) * (500/500) = 50
    // y = (75  - 25) * (350/350) = 50
    expect(region!.x).toBe(50);
    expect(region!.y).toBe(50);
    expect(region!.width).toBe(100);
    expect(region!.height).toBe(100);
  });

  // --- confirmBtn disabled state ---

  it('confirm button is disabled before a valid region is drawn', () => {
    const confirmBtn = makeButton();
    confirmBtn.disabled = true;
    const shadow = makeFakeShadowRoot({ confirmBtn });
    manager.attach(shadow as unknown as ShadowRoot);
    // No interaction yet; button remains in its initial disabled state
    expect(confirmBtn.disabled).toBe(true);
  });

  it('confirm button is enabled after drawing a region >= 20x20', () => {
    const overlay = makeElement('div');
    Object.defineProperty(overlay, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(overlay, 'clientHeight', { value: 300, configurable: true });
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const confirmBtn = makeButton();
    confirmBtn.disabled = true;

    const shadow = makeFakeShadowRoot({
      overlay,
      confirmBtn,
      selection: null,
      dimensions: null,
      image: null,
    });
    manager.attach(shadow as unknown as ShadowRoot);

    firePointer(overlay, 'pointerdown', 0, 0);
    firePointer(overlay, 'pointermove', 100, 100);
    firePointer(overlay, 'pointerup', 100, 100);

    expect(confirmBtn.disabled).toBe(false);
  });

  it('confirm button stays disabled after drawing a rect smaller than 20x20', () => {
    const overlay = makeElement('div');
    Object.defineProperty(overlay, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(overlay, 'clientHeight', { value: 300, configurable: true });
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const confirmBtn = makeButton();
    confirmBtn.disabled = true;

    const shadow = makeFakeShadowRoot({
      overlay,
      confirmBtn,
      selection: null,
      dimensions: null,
      image: null,
    });
    manager.attach(shadow as unknown as ShadowRoot);

    firePointer(overlay, 'pointerdown', 0, 0);
    firePointer(overlay, 'pointermove', 10, 10);
    firePointer(overlay, 'pointerup', 10, 10);

    expect(confirmBtn.disabled).toBe(true);
  });

  // --- selection display ---

  it('selection element is hidden after a too-small draw', () => {
    const overlay = makeElement('div');
    Object.defineProperty(overlay, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(overlay, 'clientHeight', { value: 300, configurable: true });
    (overlay as HTMLElement & { setPointerCapture: (id: number) => void }).setPointerCapture =
      vi.fn();
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 400,
      bottom: 300,
      width: 400,
      height: 300,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const selection = makeElement('div');

    const shadow = makeFakeShadowRoot({
      overlay,
      selection,
      dimensions: null,
      confirmBtn: null,
      image: null,
    });
    manager.attach(shadow as unknown as ShadowRoot);

    firePointer(overlay, 'pointerdown', 0, 0);
    firePointer(overlay, 'pointermove', 5, 5);
    firePointer(overlay, 'pointerup', 5, 5);

    expect(selection.style.display).toBe('none');
  });

  // --- no-overlay guard ---

  it('getRegion returns null when overlay is missing (attach was a no-op)', () => {
    const shadow = makeFakeShadowRoot({ overlay: null });
    manager.attach(shadow as unknown as ShadowRoot);
    expect(manager.getRegion()).toBeNull();
  });
});
