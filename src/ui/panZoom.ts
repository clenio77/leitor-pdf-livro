export class PanZoomController {
  private target: HTMLElement;
  private viewport: HTMLElement;
  private zoom = 1.0;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private initialPinchDist = 0;
  private initialPinchZoom = 1.0;
  private onZoomChange?: (zoom: number) => void;

  constructor(target: HTMLElement, viewport: HTMLElement, onZoomChange?: (zoom: number) => void) {
    this.target = target;
    this.viewport = viewport;
    this.onZoomChange = onZoomChange;
    this.bindEvents();
  }

  public getZoom(): number {
    return this.zoom;
  }

  public setZoom(newZoom: number, animate = true): void {
    const clamped = Math.max(1.0, Math.min(3.0, Number(newZoom.toFixed(2))));
    this.zoom = clamped;

    if (this.zoom <= 1.02) {
      this.panX = 0;
      this.panY = 0;
      this.zoom = 1.0;
    } else {
      this.clampPan();
    }

    this.applyTransform(animate);
    this.onZoomChange?.(this.zoom);
  }

  public zoomIn(delta = 0.25): void {
    this.setZoom(this.zoom + delta);
  }

  public zoomOut(delta = 0.25): void {
    this.setZoom(this.zoom - delta);
  }

  public reset(): void {
    this.setZoom(1.0);
  }

  private clampPan(): void {
    const rect = this.target.getBoundingClientRect();
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;

    const scaledW = (rect.width / (rect.width ? 1 : 1)) * this.zoom;
    const scaledH = (rect.height / (rect.height ? 1 : 1)) * this.zoom;

    const maxPanX = Math.max(0, (scaledW - vw) / 2 + 40);
    const maxPanY = Math.max(0, (scaledH - vh) / 2 + 40);

    this.panX = Math.max(-maxPanX, Math.min(maxPanX, this.panX));
    this.panY = Math.max(-maxPanY, Math.min(maxPanY, this.panY));
  }

  private applyTransform(animate = false): void {
    if (animate) {
      this.target.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
      this.target.style.transition = 'none';
    }

    if (this.zoom === 1.0 && this.panX === 0 && this.panY === 0) {
      this.target.style.transform = '';
      this.target.style.cursor = '';
    } else {
      this.target.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
      this.target.style.cursor = this.isDragging ? 'grabbing' : 'grab';
    }
  }

  private bindEvents(): void {
    // Mouse drag for pan when zoomed
    this.viewport.addEventListener('mousedown', (e) => {
      if (this.zoom <= 1.05) return; // allow normal page click when not zoomed
      // If clicking directly on a corner, let page-flip handle it
      const target = e.target as HTMLElement;
      if (target.classList.contains('book-page') || target.closest('.book-page')) {
        this.isDragging = true;
        this.startX = e.clientX - this.panX;
        this.startY = e.clientY - this.panY;
        this.target.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging || this.zoom <= 1.05) return;
      e.preventDefault();
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.clampPan();
      this.applyTransform(false);
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.applyTransform(true);
      }
    });

    // Touch events: Pinch to zoom and 1-finger pan when zoomed
    this.viewport.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 2) {
          // Pinch start
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          this.initialPinchDist = dist;
          this.initialPinchZoom = this.zoom;
        } else if (e.touches.length === 1 && this.zoom > 1.05) {
          // Pan start
          this.isDragging = true;
          this.startX = e.touches[0].clientX - this.panX;
          this.startY = e.touches[0].clientY - this.panY;
        }
      },
      { passive: true }
    );

    this.viewport.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 2 && this.initialPinchDist > 0) {
          // Pinch move
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const scaleChange = dist / this.initialPinchDist;
          this.setZoom(this.initialPinchZoom * scaleChange, false);
        } else if (e.touches.length === 1 && this.isDragging && this.zoom > 1.05) {
          // Pan move
          this.panX = e.touches[0].clientX - this.startX;
          this.panY = e.touches[0].clientY - this.startY;
          this.clampPan();
          this.applyTransform(false);
        }
      },
      { passive: false }
    );

    this.viewport.addEventListener(
      'touchend',
      () => {
        this.isDragging = false;
        this.initialPinchDist = 0;
        this.clampPan();
        this.applyTransform(true);
      },
      { passive: true }
    );

    // Double tap to toggle zoom
    let lastTap = 0;
    this.viewport.addEventListener('touchend', (e) => {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTap;
      if (tapLength < 300 && tapLength > 0 && e.touches.length === 0) {
        // Double tap!
        if (this.zoom > 1.1) {
          this.reset();
        } else {
          this.setZoom(1.6);
        }
      }
      lastTap = currentTime;
    });
  }
}
