import type { CropRegion } from './widget-types';

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface DragState {
  type: 'draw' | 'move' | 'resize';
  startX: number;
  startY: number;
  handle?: HandleDir;
  // Snapshot of rect at drag start
  rectX: number;
  rectY: number;
  rectW: number;
  rectH: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_SIZE = 20;

export class CropManager {
  private overlay: HTMLElement | null = null;
  private selection: HTMLElement | null = null;
  private dimensionsEl: HTMLElement | null = null;
  private confirmBtn: HTMLButtonElement | null = null;
  private imageEl: HTMLImageElement | null = null;

  private rect: Rect | null = null;
  private drag: DragState | null = null;

  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;

  constructor() {
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
  }

  attach(shadowRoot: ShadowRoot): void {
    this.overlay = shadowRoot.querySelector('.sh-crop-overlay');
    this.selection = shadowRoot.querySelector('.sh-crop-selection');
    this.dimensionsEl = shadowRoot.querySelector('.sh-crop-dimensions');
    this.confirmBtn = shadowRoot.querySelector('.sh-crop-confirm-btn');
    this.imageEl = shadowRoot.querySelector('.sh-crop-image');

    if (!this.overlay) return;

    this.overlay.addEventListener('pointerdown', this.boundPointerDown);
    this.overlay.addEventListener('pointermove', this.boundPointerMove);
    this.overlay.addEventListener('pointerup', this.boundPointerUp);
    this.overlay.addEventListener('pointercancel', this.boundPointerUp);
  }

  detach(): void {
    if (this.overlay) {
      this.overlay.removeEventListener('pointerdown', this.boundPointerDown);
      this.overlay.removeEventListener('pointermove', this.boundPointerMove);
      this.overlay.removeEventListener('pointerup', this.boundPointerUp);
      this.overlay.removeEventListener('pointercancel', this.boundPointerUp);
    }
    this.overlay = null;
    this.selection = null;
    this.dimensionsEl = null;
    this.confirmBtn = null;
    this.imageEl = null;
    this.rect = null;
    this.drag = null;
  }

  getRegion(): CropRegion | null {
    if (!this.rect || !this.imageEl || !this.overlay) return null;
    if (this.rect.w < MIN_SIZE || this.rect.h < MIN_SIZE) return null;

    const overlayRect = this.overlay.getBoundingClientRect();
    const imgRect = this.imageEl.getBoundingClientRect();

    // Scale from display pixels to source image pixels
    const naturalW = this.imageEl.naturalWidth || imgRect.width;
    const naturalH = this.imageEl.naturalHeight || imgRect.height;
    const scaleX = naturalW / imgRect.width;
    const scaleY = naturalH / imgRect.height;

    // rect coords are relative to overlay; adjust by image offset within overlay
    const offsetX = imgRect.left - overlayRect.left;
    const offsetY = imgRect.top - overlayRect.top;

    return {
      x: Math.round((this.rect.x - offsetX) * scaleX),
      y: Math.round((this.rect.y - offsetY) * scaleY),
      width: Math.round(this.rect.w * scaleX),
      height: Math.round(this.rect.h * scaleY),
    };
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.overlay) return;
    e.preventDefault();

    const target = e.target as HTMLElement;
    const handle = target.dataset.handle as HandleDir | undefined;
    const isInsideSelection = this.rect && this.isPointInRect(e, this.overlay);

    this.overlay.setPointerCapture(e.pointerId);

    const pos = this.getOverlayPos(e);

    if (handle) {
      // Resize
      this.drag = {
        type: 'resize',
        startX: pos.x,
        startY: pos.y,
        handle,
        rectX: this.rect!.x,
        rectY: this.rect!.y,
        rectW: this.rect!.w,
        rectH: this.rect!.h,
      };
    } else if (isInsideSelection) {
      // Move
      this.drag = {
        type: 'move',
        startX: pos.x,
        startY: pos.y,
        rectX: this.rect!.x,
        rectY: this.rect!.y,
        rectW: this.rect!.w,
        rectH: this.rect!.h,
      };
    } else {
      // Draw new rect
      this.drag = {
        type: 'draw',
        startX: pos.x,
        startY: pos.y,
        rectX: pos.x,
        rectY: pos.y,
        rectW: 0,
        rectH: 0,
      };
      this.rect = { x: pos.x, y: pos.y, w: 0, h: 0 };
      this.updateSelectionDisplay();
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.drag || !this.overlay) return;
    e.preventDefault();

    const pos = this.getOverlayPos(e);
    const overlayW = this.overlay.clientWidth;
    const overlayH = this.overlay.clientHeight;

    if (this.drag.type === 'draw') {
      const x = Math.min(pos.x, this.drag.startX);
      const y = Math.min(pos.y, this.drag.startY);
      const w = Math.abs(pos.x - this.drag.startX);
      const h = Math.abs(pos.y - this.drag.startY);
      this.rect = {
        x: Math.max(0, x),
        y: Math.max(0, y),
        w: Math.min(w, overlayW - x),
        h: Math.min(h, overlayH - y),
      };
    } else if (this.drag.type === 'move') {
      const dx = pos.x - this.drag.startX;
      const dy = pos.y - this.drag.startY;
      const newX = Math.max(0, Math.min(this.drag.rectX + dx, overlayW - this.drag.rectW));
      const newY = Math.max(0, Math.min(this.drag.rectY + dy, overlayH - this.drag.rectH));
      this.rect = { x: newX, y: newY, w: this.drag.rectW, h: this.drag.rectH };
    } else if (this.drag.type === 'resize') {
      this.rect = this.applyResize(pos, overlayW, overlayH);
    }

    this.updateSelectionDisplay();
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.drag) return;
    e.preventDefault();
    this.drag = null;

    // Ensure minimum size; discard too-small regions
    if (this.rect && (this.rect.w < MIN_SIZE || this.rect.h < MIN_SIZE)) {
      this.rect = null;
      if (this.selection) this.selection.style.display = 'none';
      this.setConfirm(false);
      this.updateDimensions(null);
    } else {
      this.setConfirm(true);
    }
  }

  private applyResize(pos: { x: number; y: number }, maxW: number, maxH: number): Rect {
    const { handle, rectX, rectY, rectW, rectH } = this.drag!;

    let x = rectX;
    let y = rectY;
    let w = rectW;
    let h = rectH;

    const right = rectX + rectW;
    const bottom = rectY + rectH;

    if (handle!.includes('e')) {
      w = Math.max(MIN_SIZE, Math.min(pos.x - rectX, maxW - rectX));
    }
    if (handle!.includes('w')) {
      const newX = Math.max(0, Math.min(pos.x, right - MIN_SIZE));
      w = right - newX;
      x = newX;
    }
    if (handle!.includes('s')) {
      h = Math.max(MIN_SIZE, Math.min(pos.y - rectY, maxH - rectY));
    }
    if (handle!.includes('n')) {
      const newY = Math.max(0, Math.min(pos.y, bottom - MIN_SIZE));
      h = bottom - newY;
      y = newY;
    }

    return { x, y, w, h };
  }

  private getOverlayPos(e: PointerEvent): { x: number; y: number } {
    const bounds = this.overlay!.getBoundingClientRect();
    return {
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    };
  }

  private isPointInRect(e: PointerEvent, overlay: HTMLElement): boolean {
    if (!this.rect) return false;
    const bounds = overlay.getBoundingClientRect();
    const px = e.clientX - bounds.left;
    const py = e.clientY - bounds.top;
    return (
      px >= this.rect.x &&
      px <= this.rect.x + this.rect.w &&
      py >= this.rect.y &&
      py <= this.rect.y + this.rect.h
    );
  }

  private updateSelectionDisplay(): void {
    if (!this.selection || !this.rect) return;

    const { x, y, w, h } = this.rect;
    this.selection.style.display = w > 0 && h > 0 ? 'block' : 'none';
    this.selection.style.left = `${x}px`;
    this.selection.style.top = `${y}px`;
    this.selection.style.width = `${w}px`;
    this.selection.style.height = `${h}px`;

    this.updateDimensions(w > 0 && h > 0 ? { w, h } : null);
  }

  private updateDimensions(size: { w: number; h: number } | null): void {
    if (!this.dimensionsEl) return;
    if (!size) {
      this.dimensionsEl.textContent = '';
      return;
    }

    const region = this.getRegion();
    if (region) {
      this.dimensionsEl.textContent = `${region.width} x ${region.height}`;
    } else {
      this.dimensionsEl.textContent = `${Math.round(size.w)} x ${Math.round(size.h)}`;
    }
  }

  private setConfirm(enabled: boolean): void {
    if (!this.confirmBtn) return;
    this.confirmBtn.disabled = !enabled;
  }
}
