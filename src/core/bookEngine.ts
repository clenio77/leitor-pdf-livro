import { PageFlip } from 'page-flip';
import { PDFManager } from './pdfManager';
import { ReflowPaginator } from './reflowPaginator';
import { ContentBlock } from './contentExtractor';

export interface BookEngineEvents {
  onPageChange: (currentPage: number, totalPages: number) => void;
  onFlipStateChange: (state: string) => void;
  onModeChange?: (mode: 'original' | 'reflow', fontSize: number) => void;
  onLoadingProgress?: (message: string) => void;
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
  private isSinglePage = false;

  // Estado do Modo de Leitura Adaptável (Reflow)
  private viewMode: 'original' | 'reflow' = 'original';
  private fontSize = 18; // Tamanho padrão confortável para leitura móvel
  private reflowTotalPages = 1;
  private contentBlocks: ContentBlock[] | null = null;
  private isExtracting = false;

  constructor(
    container: HTMLElement,
    pdfManager: PDFManager,
    events: BookEngineEvents,
    initialSinglePage?: boolean,
    initialMode: 'original' | 'reflow' = 'original'
  ) {
    this.container = container;
    this.pdfManager = pdfManager;
    this.events = events;
    this.viewMode = initialMode;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const isSmallScreen = winW < 850 || (winW / winH < 1.25);

    if (initialSinglePage !== undefined) {
      this.isSinglePage = initialSinglePage;
    } else {
      this.isSinglePage = isSmallScreen;
    }

    // Em telas pequenas, se a fonte foi definida para um tamanho padrão, ajusta para 18px
    if (isSmallScreen) {
      this.fontSize = 19;
    }
  }

  public isSinglePageView(): boolean {
    return this.isSinglePage;
  }

  public getReadingMode(): 'original' | 'reflow' {
    return this.viewMode;
  }

  public getFontSize(): number {
    return this.fontSize;
  }

  public getTotalPages(): number {
    if (this.viewMode === 'reflow') {
      return this.reflowTotalPages;
    }
    return this.pdfManager.getTotalPages();
  }

  public async toggleSpread(): Promise<boolean> {
    this.isSinglePage = !this.isSinglePage;
    const currentPage = this.getCurrentPage();
    await this.init(currentPage);
    return this.isSinglePage;
  }

  public async toggleReadingMode(): Promise<'original' | 'reflow'> {
    const newMode = this.viewMode === 'original' ? 'reflow' : 'original';
    await this.setReadingMode(newMode);
    return this.viewMode;
  }

  public async setReadingMode(mode: 'original' | 'reflow'): Promise<void> {
    if (this.viewMode === mode) return;

    // Calcula a proporção atual de leitura para manter o leitor no mesmo trecho
    const oldTotal = this.getTotalPages();
    const progress = oldTotal > 0 ? (this.currentPageIndex / oldTotal) : 0;

    this.viewMode = mode;
    this.events.onModeChange?.(this.viewMode, this.fontSize);

    // Se estiver alternando para reflow e os blocos ainda não tiverem sido extraídos
    if (this.viewMode === 'reflow' && !this.contentBlocks) {
      await this.ensureContentExtracted();
    }

    // Inicializa o leitor no novo modo
    await this.init(1);

    // Pula para a página aproximada correspondente ao progresso
    const newTotal = this.getTotalPages();
    const targetPage = Math.max(1, Math.min(newTotal, Math.round(progress * newTotal) + 1));
    this.goToPage(targetPage);
  }

  public async increaseFontSize(): Promise<number> {
    const nextSize = Math.min(32, this.fontSize + 2);
    if (nextSize !== this.fontSize || this.viewMode === 'original') {
      this.fontSize = nextSize;
      if (this.viewMode === 'original') {
        this.viewMode = 'reflow';
        this.events.onModeChange?.(this.viewMode, this.fontSize);
        await this.ensureContentExtracted();
      }
      await this.repaginateAndReload();
    }
    return this.fontSize;
  }

  public async decreaseFontSize(): Promise<number> {
    const nextSize = Math.max(13, this.fontSize - 2);
    if (nextSize !== this.fontSize || this.viewMode === 'original') {
      this.fontSize = nextSize;
      if (this.viewMode === 'original') {
        this.viewMode = 'reflow';
        this.events.onModeChange?.(this.viewMode, this.fontSize);
        await this.ensureContentExtracted();
      }
      await this.repaginateAndReload();
    }
    return this.fontSize;
  }

  public async setFontSize(size: number): Promise<number> {
    const validSize = Math.min(32, Math.max(13, size));
    this.fontSize = validSize;
    if (this.viewMode === 'original') {
      this.viewMode = 'reflow';
      this.events.onModeChange?.(this.viewMode, this.fontSize);
      await this.ensureContentExtracted();
    }
    await this.repaginateAndReload();
    return this.fontSize;
  }

  private async ensureContentExtracted(): Promise<void> {
    if (this.contentBlocks || this.isExtracting) return;
    this.isExtracting = true;
    this.events.onLoadingProgress?.('Extraindo textos e imagens do livro...');

    try {
      this.contentBlocks = await this.pdfManager.extractContentBlocks((cur, total) => {
        const pct = Math.round((cur / total) * 100);
        this.events.onLoadingProgress?.(`Processando imagens e diagramas (${pct}%)...`);
      });
    } catch (err) {
      console.warn('Falha na extração de blocos, utilizando fallback:', err);
      this.contentBlocks = [];
    } finally {
      this.isExtracting = false;
      this.events.onLoadingProgress?.('');
    }
  }

  private async repaginateAndReload(): Promise<void> {
    const oldTotal = this.getTotalPages();
    const progress = oldTotal > 0 ? (this.currentPageIndex / oldTotal) : 0;

    await this.init(1);

    const newTotal = this.getTotalPages();
    const targetPage = Math.max(1, Math.min(newTotal, Math.round(progress * newTotal) + 1));
    this.goToPage(targetPage);
  }

  public async init(startPage = 1): Promise<void> {
    this.destroy();
    this.container.innerHTML = '';

    const meta = this.pdfManager.getMetadata();
    if (!meta) throw new Error('Metadados do PDF ausentes.');

    this.calculateDimensions(meta.aspectRatio);

    // Book wrapper element for PageFlip
    const bookWrapper = document.createElement('div');
    bookWrapper.className = `book-wrapper ${this.isSinglePage ? 'is-portrait-mode' : 'is-landscape-mode'} mode-${this.viewMode}`;
    bookWrapper.id = 'book-wrapper';

    const wrapperWidth = this.isSinglePage ? this.pageWidth : this.pageWidth * 2;
    bookWrapper.style.width = `${wrapperWidth}px`;
    bookWrapper.style.minWidth = `${wrapperWidth}px`;
    bookWrapper.style.maxWidth = `${wrapperWidth}px`;
    bookWrapper.style.height = `${this.pageHeight}px`;
    this.container.appendChild(bookWrapper);

    this.pageElements = [];
    this.renderedPages.clear();

    let totalPagesToLoad = meta.totalPages;

    if (this.viewMode === 'reflow') {
      if (!this.contentBlocks) {
        await this.ensureContentExtracted();
      }

      const reflowResult = ReflowPaginator.paginate(this.contentBlocks || [], {
        pageWidth: this.pageWidth,
        pageHeight: this.pageHeight,
        fontSize: this.fontSize,
        isSinglePage: this.isSinglePage,
        bookTitle: meta.title
      });

      this.reflowTotalPages = reflowResult.totalPages;
      totalPagesToLoad = this.reflowTotalPages;

      for (const pageEl of reflowResult.pages) {
        bookWrapper.appendChild(pageEl);
        this.pageElements.push(pageEl);
      }
    } else {
      // Modo Original (Canvas Fixo fiel ao PDF)
      totalPagesToLoad = meta.totalPages;
      for (let i = 1; i <= totalPagesToLoad; i++) {
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
    }

    // Inicializa PageFlip
    this.pageFlip = new PageFlip(bookWrapper, {
      width: this.pageWidth,
      height: this.pageHeight,
      size: 'fixed',
      autoSize: false,
      minWidth: 260,
      maxWidth: 1200,
      minHeight: 340,
      maxHeight: 1600,
      maxShadowOpacity: 0.5,
      showCover: false,
      mobileScrollSupport: false,
      usePortrait: this.isSinglePage,
      flippingTime: 650,
      drawShadow: true,
      swipeDistance: 30
    });

    this.pageFlip.loadFromHTML(this.pageElements);

    // Eventos de virada de página
    this.pageFlip.on('flip', (e: { data: number }) => {
      this.currentPageIndex = e.data;
      const pageNum = this.currentPageIndex + 1;
      this.events.onPageChange(pageNum, totalPagesToLoad);
      if (this.viewMode === 'original') {
        this.renderVisiblePagesBuffer(pageNum);
      }
    });

    this.pageFlip.on('changeState', (e: { data: string }) => {
      this.events.onFlipStateChange(e.data);
    });

    // Pula para página inicial se especificado
    const initialIndex = Math.max(0, Math.min(startPage - 1, totalPagesToLoad - 1));
    if (initialIndex > 0) {
      this.pageFlip.turnToPage(initialIndex);
      this.currentPageIndex = initialIndex;
    }

    this.events.onPageChange(this.currentPageIndex + 1, totalPagesToLoad);
    if (this.viewMode === 'original') {
      await this.renderVisiblePagesBuffer(this.currentPageIndex + 1);
    }
  }

  private calculateDimensions(aspectRatio: number): void {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const isSmallScreen = winW < 850 || (winW / winH < 1.25);

    if (this.isSinglePage) {
      // Modo 1 Página: maximiza a largura disponível
      const paddingX = isSmallScreen ? 8 : 28;
      const paddingY = isSmallScreen ? 64 : 84;

      const availW = Math.max(260, winW - paddingX);
      const availH = Math.max(340, winH - paddingY);

      let targetW = Math.min(availW, 850);
      let targetH = targetW / aspectRatio;

      if (targetH > availH) {
        targetH = availH;
        targetW = targetH * aspectRatio;
      }

      this.pageWidth = Math.floor(Math.max(260, targetW));
      this.pageHeight = Math.floor(Math.max(340, targetH));
    } else {
      // Modo 2 Páginas (Livro aberto clássico para telas amplas)
      const paddingX = 48;
      const paddingY = 110;

      const availW = Math.max(500, winW - paddingX);
      const availH = Math.max(340, winH - paddingY);

      let targetW = Math.min(availW / 2, 600);
      let targetH = targetW / aspectRatio;

      if (targetH > availH) {
        targetH = availH;
        targetW = targetH * aspectRatio;
      }

      this.pageWidth = Math.floor(Math.max(240, targetW));
      this.pageHeight = Math.floor(Math.max(320, targetH));
    }
  }

  public async renderVisiblePagesBuffer(centerPage: number): Promise<void> {
    if (this.isRendering || this.viewMode !== 'original') return;
    this.isRendering = true;

    try {
      const totalPages = this.pdfManager.getTotalPages();
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
      const footerOffset = this.isSinglePage ? 0 : 28;
      const canvasHeight = Math.max(100, this.pageHeight - footerOffset);
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
    return this.isSinglePage;
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
