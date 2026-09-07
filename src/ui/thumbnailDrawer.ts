import { PDFManager } from '../core/pdfManager';

export class ThumbnailDrawer {
  private container: HTMLElement;
  private pdfManager: PDFManager;
  private onSelectPage: (pageNum: number) => void;
  private isOpen = false;
  private observer: IntersectionObserver | null = null;
  private currentPage = 1;

  constructor(container: HTMLElement, pdfManager: PDFManager, onSelectPage: (pageNum: number) => void) {
    this.container = container;
    this.pdfManager = pdfManager;
    this.onSelectPage = onSelectPage;
  }

  public render(): void {
    const totalPages = this.pdfManager.getTotalPages();
    const meta = this.pdfManager.getMetadata();

    this.container.innerHTML = `
      <aside class="thumbnail-drawer" id="thumbnail-drawer" aria-label="Painel de Miniaturas">
        <div class="drawer-header">
          <div class="drawer-title-group">
            <h2 class="drawer-title">Páginas</h2>
            <span class="drawer-subtitle">${meta?.title || 'Documento'} (${totalPages})</span>
          </div>
          <button type="button" class="drawer-close-btn" id="drawer-close-btn" aria-label="Fechar painel">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="drawer-scrollable-list" id="drawer-grid">
          ${Array.from({ length: totalPages }, (_, i) => i + 1)
            .map(
              (p) => `
              <div class="thumb-card ${p === this.currentPage ? 'thumb-active' : ''}" data-page="${p}" id="thumb-item-${p}">
                <div class="thumb-preview-box">
                  <div class="thumb-placeholder">
                    <span class="thumb-num-skeleton">${p}</span>
                  </div>
                  <img class="thumb-img" data-src-page="${p}" alt="Página ${p}" style="display: none;" />
                </div>
                <span class="thumb-label">Página ${p}</span>
              </div>
            `
            )
            .join('')}
        </div>
      </aside>
      <div class="drawer-overlay" id="drawer-overlay"></div>
    `;

    this.bindEvents();
    this.initLazyLoader();
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    this.isOpen = true;
    const drawer = this.container.querySelector('#thumbnail-drawer');
    const overlay = this.container.querySelector('#drawer-overlay');
    drawer?.classList.add('drawer-open');
    overlay?.classList.add('overlay-active');
    this.scrollToActiveThumb();
  }

  public close(): void {
    this.isOpen = false;
    const drawer = this.container.querySelector('#thumbnail-drawer');
    const overlay = this.container.querySelector('#drawer-overlay');
    drawer?.classList.remove('drawer-open');
    overlay?.classList.remove('overlay-active');
  }

  public setActivePage(pageNum: number): void {
    this.currentPage = pageNum;
    const prev = this.container.querySelector('.thumb-active');
    prev?.classList.remove('thumb-active');
    const current = this.container.querySelector(`#thumb-item-${pageNum}`);
    current?.classList.add('thumb-active');
    if (this.isOpen) {
      this.scrollToActiveThumb();
    }
  }

  private scrollToActiveThumb(): void {
    const el = this.container.querySelector(`#thumb-item-${this.currentPage}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  private bindEvents(): void {
    this.container.querySelector('#drawer-close-btn')?.addEventListener('click', () => this.close());
    this.container.querySelector('#drawer-overlay')?.addEventListener('click', () => this.close());

    const grid = this.container.querySelector('#drawer-grid');
    grid?.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.thumb-card');
      if (card && card.dataset.page) {
        const p = parseInt(card.dataset.page, 10);
        this.onSelectPage(p);
        this.close();
      }
    });
  }

  private initLazyLoader(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(async (entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            const pageNum = parseInt(card.dataset.page || '0', 10);
            const img = card.querySelector<HTMLImageElement>('.thumb-img');
            const placeholder = card.querySelector<HTMLElement>('.thumb-placeholder');

            if (pageNum > 0 && img && img.style.display === 'none') {
              try {
                const dataUrl = await this.pdfManager.renderThumbnail(pageNum, 140);
                img.src = dataUrl;
                img.style.display = 'block';
                if (placeholder) placeholder.style.display = 'none';
              } catch (err) {
                console.warn(`Erro na miniatura ${pageNum}:`, err);
              }
            }
            this.observer?.unobserve(card);
          }
        });
      },
      { root: this.container.querySelector('#drawer-grid'), rootMargin: '100px' }
    );

    const cards = this.container.querySelectorAll('.thumb-card');
    cards.forEach((c) => this.observer?.observe(c));
  }
}
