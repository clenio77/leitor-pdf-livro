import { PageFlip } from 'page-flip';
import { PDFManager } from './pdfManager';

export interface BookEngineEvents {
  onPageChange: (currentPage: number, totalPages: number) => void;
  onFlipStateChange: (state: string) => void;
}

export class BookEngine {
  private container: HTMLElement;
  private pdfManager: PDFManager;
  private pageFlip: PageFlip | null = null;
  private events: BookEngineEvents;
  private pageElements: HTMLElement[] = [];
  private renderedPages = new Set<number>();
  private isRendering = false;
  private currentPageIndex = 0;
  private pageWidth = 500;
  private pageHeight = 700;
  private isMobileMode = false;

  constructor(container: HTMLElement, pdfManager: PDFManager, events: BookEngineEvents) {
    this.container = container;
    this.pdfManager = pdfManager;
    this.events = events;
  }

  public async init(startPage = 1): Promise<void> {
    this.destroy();
    this.container.innerHTML = '';

    const meta = this.pdfManager.getMetadata();
    if (!meta) throw new Error('Metadados do PDF ausentes.');

    const totalPages = meta.totalPages;
    this.calculateDimensions(meta.aspectRatio);

    // Book wrapper element for PageFlip
    const bookWrapper = document.createElement('div');
    bookWrapper.className = `book-wrapper ${this.isMobileMode ? 'is-portrait-mode' : 'is-landscape-mode'}`;
    bookWrapper.id = 'book-wrapper';
    this.container.appendChild(bookWrapper);

    this.pageElements = [];
    this.renderedPages.clear();

    // Create page nodes
    for (let i = 1; i <= totalPages; i++) {
      const pageEl = document.createElement('div');
      pageEl.className = `book-page ${i % 2 === 0 ? 'page-left' : 'page-right'}`;
      pageEl.dataset.pageNumber = i.toString();

      pageEl.innerHTML = `
        <div class="page-inner">
          <div class="page-canvas-wrapper">
            <div class="page-loading-skeleton">
              <div class="skeleton-shimmer"></div>
            </div>
            <canvas class="page-canvas" id="canvas-page-${i}"></canvas>
          </div>
          <div class="page-spine-shadow"></div>
          <div class="page-edge-highlight"></div>
          <div class="page-footer">
            <span class="page-num-label">${i}</span>
          </div>
        </div>
      `;

      bookWrapper.appendChild(pageEl);
      this.pageElements.push(pageEl);
    }

    // Initialize PageFlip instance
    this.pageFlip = new PageFlip(bookWrapper, {
      width: this.pageWidth,
      height: this.pageHeight,
      size: 'fixed',
      minWidth: 280,
      maxWidth: 1200,
      minHeight: 380,
      maxHeight: 1600,
      maxShadowOpacity: 0.5,
      showCover: false,
      mobileScrollSupport: false,
      usePortrait: this.isMobileMode,
      flippingTime: 650,
      drawShadow: true,
      swipeDistance: 30
    });

    this.pageFlip.loadFromHTML(this.pageElements);

    // Page flip event listener
    this.pageFlip.on('flip', (e: { data: number }) => {
      this.currentPageIndex = e.data;
      const pageNum = this.currentPageIndex + 1;
      this.events.onPageChange(pageNum, totalPages);
      this.renderVisiblePagesBuffer(pageNum);
    });

    this.pageFlip.on('changeState', (e: { data: string }) => {
      this.events.onFlipStateChange(e.data);
    });

    // Jump to initial page if specified
    const initialIndex = Math.max(0, Math.min(startPage - 1, totalPages - 1));
    if (initialIndex > 0) {
      this.pageFlip.turnToPage(initialIndex);
      this.currentPageIndex = initialIndex;
    }

    this.events.onPageChange(this.currentPageIndex + 1, totalPages);
    await this.renderVisiblePagesBuffer(this.currentPageIndex + 1);
  }

  private calculateDimensions(aspectRatio: number): void {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Detect if we should use 1-page portrait or 2-page landscape
    this.isMobileMode = winW < 820 || (winW / winH < 1.18);

    // Padding reserves space for margins and bottom controls (never let the book overlap controls)
    const paddingX = this.isMobileMode ? 20 : 48;
    const paddingY = this.isMobileMode ? 104 : 110;

    const availW = Math.max(260, winW - paddingX);
    const availH = Math.max(340, winH - paddingY);

    let maxW: number;
    let maxH = availH;

    if (this.isMobileMode) {
      // 1 Page (Portrait)
      maxW = Math.min(availW, 700);
    } else {
      // 2 Pages (Landscape)
      maxW = Math.min(availW / 2, 600);
    }

    // Fit strictly to bounding box preserving aspect ratio
    let targetW = maxW;
    let targetH = targetW / aspectRatio;

    if (targetH > maxH) {
      targetH = maxH;
      targetW = targetH * aspectRatio;
    }

    this.pageWidth = Math.floor(Math.max(240, targetW));
    this.pageHeight = Math.floor(Math.max(320, targetH));
  }

  public async renderVisiblePagesBuffer(centerPage: number): Promise<void> {
    if (this.isRendering) return;
    this.isRendering = true;

    try {
      const totalPages = this.pdfManager.getTotalPages();
      // Render visible pages and pre-load adjacent +/- 2 pages
      const rangeStart = Math.max(1, centerPage - 2);
      const rangeEnd = Math.min(totalPages, centerPage + 3);

      for (let p = rangeStart; p <= rangeEnd; p++) {
        if (!this.renderedPages.has(p)) {
          await this.renderSinglePage(p);
        }
      }
    } finally {
      this.isRendering = false;
    }
  }

  private async renderSinglePage(pageNumber: number): Promise<void> {
    const pageEl = this.pageElements[pageNumber - 1];
    if (!pageEl) return;

    const canvas = pageEl.querySelector<HTMLCanvasElement>('.page-canvas');
    const skeleton = pageEl.querySelector<HTMLElement>('.page-loading-skeleton');
    if (!canvas) return;

    try {
      // Reserve 28px for the page footer to guarantee zero vertical clipping
      const canvasHeight = Math.max(100, this.pageHeight - 28);
      await this.pdfManager.renderPageToCanvas(pageNumber, canvas, this.pageWidth, canvasHeight);
      this.renderedPages.add(pageNumber);
      if (skeleton) {
        skeleton.style.display = 'none';
      }
    } catch (err) {
      console.warn(`Erro ao renderizar página ${pageNumber}:`, err);
    }
  }

  public turnNext(): void {
    if (this.pageFlip) {
      this.pageFlip.flipNext('bottom');
    }
  }

  public turnPrev(): void {
    if (this.pageFlip) {
      this.pageFlip.flipPrev('bottom');
    }
  }

  public goToPage(pageNumber: number): void {
    if (this.pageFlip) {
      const targetIndex = Math.max(0, Math.min(pageNumber - 1, this.pageElements.length - 1));
      this.pageFlip.turnToPage(targetIndex);
    }
  }

  public getCurrentPage(): number {
    return this.currentPageIndex + 1;
  }

  public isPortrait(): boolean {
    return this.isMobileMode;
  }

  public destroy(): void {
    if (this.pageFlip) {
      try {
        this.pageFlip.destroy();
      } catch {
        // Safe destroy
      }
      this.pageFlip = null;
    }
    this.renderedPages.clear();
    this.pageElements = [];
  }
}
