export interface GestureCallbacks {
  onPrev: () => void;
  onNext: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onEscape: () => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  isZoomed?: () => boolean;
}

export class GestureHandler {
  private callbacks: GestureCallbacks;
  private touchStartX = 0;
  private touchStartY = 0;
  private minSwipeDistance = 45;

  constructor(callbacks: GestureCallbacks) {
    this.callbacks = callbacks;
    this.initKeyboard();
    this.initTouch();
    this.initWheelZoom();
  }

  private initKeyboard(): void {
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ': // Spacebar
          e.preventDefault();
          this.callbacks.onNext();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          this.callbacks.onPrev();
          break;
        case 'Home':
          e.preventDefault();
          this.callbacks.onFirstPage();
          break;
        case 'End':
          e.preventDefault();
          this.callbacks.onLastPage();
          break;
        case 'Escape':
          this.callbacks.onEscape();
          break;
      }
    });
  }

  private initTouch(): void {
    window.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          this.touchStartX = e.touches[0].clientX;
          this.touchStartY = e.touches[0].clientY;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchend',
      (e) => {
        if (e.changedTouches.length === 1) {
          // Se estiver com zoom ativo, o toque/arrasto é para navegar pelo texto (pan), não para folhear
          if (this.callbacks.isZoomed?.()) {
            return;
          }

          const deltaX = e.changedTouches[0].clientX - this.touchStartX;
          const deltaY = e.changedTouches[0].clientY - this.touchStartY;

          // Check if predominantly horizontal swipe
          if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > this.minSwipeDistance) {
            if (deltaX < 0) {
              // Swipe to left -> Next page
              this.callbacks.onNext();
            } else {
              // Swipe to right -> Prev page
              this.callbacks.onPrev();
            }
          }
        }
      },
      { passive: true }
    );
  }

  private initWheelZoom(): void {
    window.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            this.callbacks.onZoomIn();
          } else {
            this.callbacks.onZoomOut();
          }
        }
      },
      { passive: false }
    );
  }
}
