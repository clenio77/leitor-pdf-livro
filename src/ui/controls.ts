export interface ControlsCallbacks {
  onPrevPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleSpread?: () => void;
  onToggleReadingMode?: () => void;
  onIncreaseFontSize?: () => void;
  onDecreaseFontSize?: () => void;
  onToggleThumbnails: () => void;
  onToggleFocusMode: () => void;
  onToggleFullscreen: () => void;
  onOpenNewPdf: () => void;
  onToggleTheme?: () => void;
  onToggleSound?: () => void;
}

export class Controls {
  private container: HTMLElement;
  private callbacks: ControlsCallbacks;
  private hideTimer: number | null = null;
  private isFocusMode = false;
  private isSecondaryOpen = false;
  private currentPage = 1;
  private totalPages = 1;
  private readingMode: 'original' | 'reflow' = 'original';
  private fontSize = 18;

  constructor(container: HTMLElement, callbacks: ControlsCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public render(): void {
    this.container.innerHTML = `
      <div class="reader-controls-wrapper" id="reader-controls">
        <!-- Progress bar above controls -->
        <div class="reading-progress-track">
          <div class="reading-progress-fill" id="reading-progress-fill" style="width: 0%;"></div>
        </div>

        <!-- Pill Secundária (expande acima) -->
        <div class="controls-pill controls-pill-secondary" id="controls-secondary">
          <!-- Modo Foco -->
          <button type="button" class="ctrl-btn" id="btn-focus-mode" title="Modo Foco (Escurecer Escrivaninha)" aria-label="Modo Foco">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          </button>

          <!-- Fullscreen -->
          <button type="button" class="ctrl-btn" id="btn-fullscreen" title="Tela Cheia" aria-label="Tela Cheia">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>

          <!-- Tema -->
          <button type="button" class="ctrl-btn" id="btn-toggle-theme" title="Alternar Tema (Noturno / Diurno)" aria-label="Alternar Tema">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>

          <!-- Som -->
          <button type="button" class="ctrl-btn" id="btn-toggle-sound" title="Som de Folheamento" aria-label="Alternar Som">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/>
              <line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          </button>

          <div class="ctrl-divider"></div>

          <!-- Zoom controles na barra secundária -->
          <button type="button" class="ctrl-btn" id="btn-zoom-out-sec" title="Diminuir Zoom" aria-label="Diminuir Zoom">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>

          <button type="button" class="ctrl-btn" id="btn-zoom-in-sec" title="Aumentar Zoom" aria-label="Aumentar Zoom">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>

          <div class="ctrl-divider"></div>

          <!-- Trocar Livro -->
          <button type="button" class="ctrl-btn btn-action-open" id="btn-open-other" title="Abrir outro PDF" aria-label="Abrir outro PDF">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <span class="btn-text-desktop">Trocar Livro</span>
          </button>
        </div>

        <!-- Pill Primária (sempre visível) -->
        <div class="controls-pill controls-pill-primary">
          <!-- Page navigation -->
          <button type="button" class="ctrl-btn" id="btn-prev-page" title="Página Anterior (Seta Esquerda)" aria-label="Página Anterior">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>

          <div class="page-selector-box" id="page-selector-box" title="Clique para digitar o número da página">
            <span class="lbl-page-prefix">Pág.</span>
            <input type="number" class="input-current-page" id="input-page-num" min="1" value="1" />
            <span class="lbl-page-separator">de</span>
            <span class="lbl-total-pages" id="lbl-total-pages">1</span>
          </div>

          <button type="button" class="ctrl-btn" id="btn-next-page" title="Próxima Página (Seta Direita)" aria-label="Próxima Página">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>

          <div class="ctrl-divider"></div>

          <!-- Alternar Modo de Leitura: Original (PDF) ou Leitura Fluida (Reflow) -->
          <button type="button" class="ctrl-btn ctrl-btn-mode-toggle" id="btn-toggle-reading-mode" title="Alternar entre Livro Original e Modo Leitura Fluida (Fonte Adaptável)" aria-label="Modo de Leitura">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              <line x1="9" y1="7" x2="15" y2="7"/>
              <line x1="9" y1="11" x2="15" y2="11"/>
            </svg>
          </button>

          <!-- Controles de Tamanho de Fonte (A- / Aa px / A+) -->
          <div class="font-controls-group" id="font-controls-group">
            <button type="button" class="ctrl-btn ctrl-btn-font" id="btn-font-dec" title="Diminuir Tamanho da Fonte (A-)" aria-label="Diminuir Fonte">
              <span class="font-btn-text">A-</span>
            </button>

            <button type="button" class="ctrl-btn ctrl-btn-font-badge" id="btn-font-badge" title="Tamanho atual da fonte / Alternar leitura fluida" aria-label="Tamanho da fonte">
              <span id="font-badge-text" class="font-badge-text">18px</span>
            </button>

            <button type="button" class="ctrl-btn ctrl-btn-font" id="btn-font-inc" title="Aumentar Tamanho da Fonte (A+)" aria-label="Aumentar Fonte">
              <span class="font-btn-text">A+</span>
            </button>
          </div>

          <div class="ctrl-divider"></div>

          <!-- Alternar 1 Página / 2 Páginas -->
          <button type="button" class="ctrl-btn" id="btn-toggle-spread" title="Alternar entre 1 e 2 páginas" aria-label="Alternar entre 1 e 2 páginas">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="3" width="12" height="18" rx="2"/>
              <line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="9" y1="12" x2="15" y2="12"/>
              <line x1="9" y1="16" x2="13" y2="16"/>
            </svg>
          </button>

          <div class="ctrl-divider"></div>

          <!-- Thumbnails -->
          <button type="button" class="ctrl-btn" id="btn-thumbnails" title="Miniaturas de Páginas" aria-label="Miniaturas">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
          </button>

          <div class="ctrl-divider"></div>

          <!-- Expand secondary -->
          <button type="button" class="ctrl-btn" id="btn-expand-controls" title="Mais opções" aria-label="Mais opções">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="5" r="1.5"/>
              <circle cx="12" cy="12" r="1.5"/>
              <circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    this.bindEvents();
    this.startInactivityTimer();
  }

  public updatePage(current: number, total: number): void {
    this.currentPage = current;
    this.totalPages = total;

    const inputPage = this.container.querySelector<HTMLInputElement>('#input-page-num');
    const lblTotal = this.container.querySelector<HTMLElement>('#lbl-total-pages');
    const fill = this.container.querySelector<HTMLElement>('#reading-progress-fill');

    if (inputPage) {
      inputPage.value = current.toString();
      inputPage.max = total.toString();
    }
    if (lblTotal) {
      lblTotal.textContent = total.toString();
    }
    if (fill) {
      const pct = Math.round((current / total) * 100);
      fill.style.width = `${pct}%`;
    }
  }

  public setReadingMode(mode: 'original' | 'reflow', fontSize: number): void {
    this.readingMode = mode;
    this.fontSize = fontSize;

    const btnMode = this.container.querySelector<HTMLButtonElement>('#btn-toggle-reading-mode');
    const badgeText = this.container.querySelector<HTMLElement>('#font-badge-text');

    if (btnMode) {
      btnMode.classList.toggle('active', mode === 'reflow');
      btnMode.title = mode === 'reflow'
        ? 'Modo Leitura Fluida Ativo (clique para alternar para Livro Original)'
        : 'Modo Original Fiel ao PDF (clique para alternar para Leitura Fluida)';
    }

    if (badgeText) {
      badgeText.textContent = `${fontSize}px`;
    }
  }

  public setFontSize(fontSize: number): void {
    this.fontSize = fontSize;
    const badgeText = this.container.querySelector<HTMLElement>('#font-badge-text');
    if (badgeText) {
      badgeText.textContent = `${fontSize}px`;
    }
  }

  public setFocusMode(active: boolean): void {
    this.isFocusMode = active;
    const btn = this.container.querySelector<HTMLButtonElement>('#btn-focus-mode');
    if (btn) {
      btn.classList.toggle('active', active);
    }
  }

  public setSoundActive(active: boolean): void {
    const btn = this.container.querySelector<HTMLButtonElement>('#btn-toggle-sound');
    if (btn) {
      btn.classList.toggle('active', active);
      btn.innerHTML = active
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>`;
    }
  }

  public setThemeIcon(isDark: boolean): void {
    const btn = this.container.querySelector<HTMLButtonElement>('#btn-toggle-theme');
    if (btn) {
      btn.innerHTML = isDark
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
          </svg>`;
    }
  }

  public setZoom(zoom: number): void {
    // Zoom atual
  }

  public setSpreadMode(isSinglePage: boolean): void {
    const btn = this.container.querySelector<HTMLButtonElement>('#btn-toggle-spread');
    if (btn) {
      btn.title = isSinglePage ? 'Modo 1 Página (clique para ver 2 páginas)' : 'Modo 2 Páginas (clique para ver 1 página)';
      btn.setAttribute('aria-label', btn.title);
      btn.innerHTML = isSinglePage
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="3" width="12" height="18" rx="2"/>
            <line x1="9" y1="8" x2="15" y2="8"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>`;
    }
  }

  private toggleSecondary(): void {
    this.isSecondaryOpen = !this.isSecondaryOpen;
    const secondary = this.container.querySelector<HTMLElement>('#controls-secondary');
    const expandBtn = this.container.querySelector<HTMLElement>('#btn-expand-controls');
    if (secondary) {
      secondary.classList.toggle('secondary-visible', this.isSecondaryOpen);
    }
    if (expandBtn) {
      expandBtn.classList.toggle('active', this.isSecondaryOpen);
    }
  }

  private bindEvents(): void {
    this.container.querySelector('#btn-prev-page')?.addEventListener('click', () => this.callbacks.onPrevPage());
    this.container.querySelector('#btn-next-page')?.addEventListener('click', () => this.callbacks.onNextPage());
    this.container.querySelector('#btn-toggle-spread')?.addEventListener('click', () => this.callbacks.onToggleSpread?.());
    this.container.querySelector('#btn-toggle-reading-mode')?.addEventListener('click', () => this.callbacks.onToggleReadingMode?.());
    this.container.querySelector('#btn-font-dec')?.addEventListener('click', () => this.callbacks.onDecreaseFontSize?.());
    this.container.querySelector('#btn-font-inc')?.addEventListener('click', () => this.callbacks.onIncreaseFontSize?.());
    this.container.querySelector('#btn-font-badge')?.addEventListener('click', () => this.callbacks.onToggleReadingMode?.());
    this.container.querySelector('#btn-thumbnails')?.addEventListener('click', () => this.callbacks.onToggleThumbnails());
    this.container.querySelector('#btn-focus-mode')?.addEventListener('click', () => this.callbacks.onToggleFocusMode());
    this.container.querySelector('#btn-fullscreen')?.addEventListener('click', () => this.callbacks.onToggleFullscreen());
    this.container.querySelector('#btn-open-other')?.addEventListener('click', () => this.callbacks.onOpenNewPdf());
    this.container.querySelector('#btn-expand-controls')?.addEventListener('click', () => this.toggleSecondary());
    this.container.querySelector('#btn-toggle-theme')?.addEventListener('click', () => this.callbacks.onToggleTheme?.());
    this.container.querySelector('#btn-toggle-sound')?.addEventListener('click', () => this.callbacks.onToggleSound?.());

    // Zoom secundário
    this.container.querySelector('#btn-zoom-in-sec')?.addEventListener('click', () => this.callbacks.onZoomIn());
    this.container.querySelector('#btn-zoom-out-sec')?.addEventListener('click', () => this.callbacks.onZoomOut());

    const pageInput = this.container.querySelector<HTMLInputElement>('#input-page-num');
    pageInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = parseInt(pageInput.value, 10);
        if (!isNaN(val) && val >= 1 && val <= this.totalPages) {
          this.callbacks.onGoToPage(val);
          pageInput.blur();
        }
      }
    });

    // Inactivity detection
    const handleActivity = () => {
      this.showControls();
      this.startInactivityTimer();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
  }

  private showControls(): void {
    const controls = this.container.querySelector<HTMLElement>('#reader-controls');
    if (controls) {
      controls.classList.remove('controls-hidden');
    }
  }

  private startInactivityTimer(): void {
    if (this.hideTimer) {
      window.clearTimeout(this.hideTimer);
    }
    this.hideTimer = window.setTimeout(() => {
      const controls = this.container.querySelector<HTMLElement>('#reader-controls');
      if (controls && this.isFocusMode) {
        controls.classList.add('controls-hidden');
      }
    }, 3500);
  }
}
