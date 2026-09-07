import './styles/index.css';
import { PDFManager } from './core/pdfManager';
import { BookEngine } from './core/bookEngine';
import { PageSound } from './core/pageSound';
import { savePdfToCache, saveSettings, getSettings } from './core/storage';
import { UploadZone } from './ui/uploadZone';
import { Controls } from './ui/controls';
import { ThumbnailDrawer } from './ui/thumbnailDrawer';
import { GestureHandler } from './ui/gestures';
import { PanZoomController } from './ui/panZoom';
import { DustParticles } from './ui/dustParticles';
import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker for 100% offline capability
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Nova versão do leitor disponível offline.');
  },
  onOfflineReady() {
    console.log('Aplicativo pronto para uso 100% offline.');
  }
});

class App {
  private pdfManager = new PDFManager();
  private bookEngine: BookEngine | null = null;
  private panZoom: PanZoomController | null = null;
  private pageSound = new PageSound();
  private dustParticles: DustParticles;
  private uploadZone: UploadZone;
  private controls: Controls;
  private thumbnailDrawer: ThumbnailDrawer | null = null;
  private currentZoom = 1.0;
  private isFocusMode = false;
  private isDarkTheme = true;
  private isReading = false;
  private resizeTimeout: number | null = null;

  private appEl = document.getElementById('app') as HTMLElement;
  private welcomeView = document.getElementById('welcome-view') as HTMLElement;
  private readerView = document.getElementById('reader-view') as HTMLElement;
  private bookContainer = document.getElementById('book-container') as HTMLElement;
  private controlsRoot = document.getElementById('controls-root') as HTMLElement;
  private thumbnailsRoot = document.getElementById('thumbnails-root') as HTMLElement;
  private loadingOverlay = document.getElementById('loading-overlay') as HTMLElement;
  private loadingText = document.getElementById('loading-text') as HTMLElement;
  private errorToast = document.getElementById('error-toast') as HTMLElement;
  private errorMessage = document.getElementById('error-message') as HTMLElement;

  constructor() {
    const saved = getSettings();
    this.currentZoom = saved.zoom || 1.0;
    this.isFocusMode = saved.isFocusMode || false;

    // Restore theme preference
    const savedTheme = localStorage.getItem('reader-theme');
    if (savedTheme === 'morning') {
      this.isDarkTheme = false;
      document.documentElement.setAttribute('data-theme', 'morning');
    }

    this.uploadZone = new UploadZone(this.welcomeView, {
      onFileSelected: (file) => this.handleFile(file),
      onResumeCached: (buf, name, page) => this.loadPdfBuffer(buf, name, page)
    });

    this.controls = new Controls(this.controlsRoot, {
      onPrevPage: () => this.bookEngine?.turnPrev(),
      onNextPage: () => this.bookEngine?.turnNext(),
      onGoToPage: (page) => this.bookEngine?.goToPage(page),
      onZoomIn: () => this.changeZoom(0.2),
      onZoomOut: () => this.changeZoom(-0.2),
      onZoomReset: () => this.resetZoom(),
      onToggleThumbnails: () => this.thumbnailDrawer?.toggle(),
      onToggleFocusMode: () => this.toggleFocusMode(),
      onToggleFullscreen: () => this.toggleFullscreen(),
      onOpenNewPdf: () => this.showWelcomeView(),
      onToggleTheme: () => this.toggleTheme(),
      onToggleSound: () => this.toggleSound()
    });

    new GestureHandler({
      onPrev: () => this.bookEngine?.turnPrev(),
      onNext: () => this.bookEngine?.turnNext(),
      onZoomIn: () => this.changeZoom(0.15),
      onZoomOut: () => this.changeZoom(-0.15),
      onEscape: () => {
        if (this.thumbnailDrawer) this.thumbnailDrawer.close();
        if (this.isFocusMode) this.toggleFocusMode();
      },
      onFirstPage: () => this.bookEngine?.goToPage(1),
      onLastPage: () => {
        const total = this.pdfManager.getTotalPages();
        if (total > 0) this.bookEngine?.goToPage(total);
      }
    });

    // Dust particles
    this.dustParticles = new DustParticles(this.appEl);
    this.dustParticles.setVisible(this.isDarkTheme);
    this.dustParticles.start();

    // Dynamic shadow (parallax) — desktop only
    this.initDynamicShadow();

    window.addEventListener('resize', () => this.handleResize());
  }

  public async init(): Promise<void> {
    await this.uploadZone.render();
  }

  private async handleFile(file: File): Promise<void> {
    this.showLoading('Abrindo seu livro...');
    try {
      const buffer = await file.arrayBuffer();
      await this.loadPdfBuffer(buffer, file.name, 1);
    } catch (err: any) {
      console.error(err);
      this.hideLoading();
      this.showError('Não foi possível abrir este documento. Verifique se o arquivo é um PDF válido.');
    }
  }

  private async loadPdfBuffer(buffer: ArrayBuffer, fileName: string, startPage = 1): Promise<void> {
    this.showLoading('Preparando as páginas...');
    try {
      // Clona o buffer para evitar DataCloneError quando o worker do PDF.js transfere a propriedade do buffer
      const cacheBuffer = buffer.slice(0);
      const meta = await this.pdfManager.loadDocument(buffer, fileName);
      await savePdfToCache(cacheBuffer, meta);

      this.welcomeView.style.display = 'none';
      this.readerView.style.display = 'flex';
      this.isReading = true;

      this.controls.render();
      this.controls.setThemeIcon(this.isDarkTheme);
      this.controls.setSoundActive(!this.pageSound.getMuted());

      this.thumbnailDrawer = new ThumbnailDrawer(this.thumbnailsRoot, this.pdfManager, (page) => {
        this.bookEngine?.goToPage(page);
      });
      this.thumbnailDrawer.render();

      this.bookEngine = new BookEngine(this.bookContainer, this.pdfManager, {
        onPageChange: (current, total) => {
          this.controls.updatePage(current, total);
          this.thumbnailDrawer?.setActivePage(current);
          saveSettings({ currentPage: current });
        },
        onFlipStateChange: () => {
          this.pageSound.play();
        }
      });

      await this.bookEngine.init(startPage);

      // PanZoomController ensures zoom scales smoothly without clipping/overflow
      this.panZoom = new PanZoomController(this.bookContainer, this.readerView, (z) => {
        this.currentZoom = z;
        saveSettings({ zoom: z });
      });

      this.hideLoading();
    } catch (err: any) {
      console.error(err);
      this.hideLoading();
      this.showError('Não foi possível carregar as páginas do PDF.');
      this.showWelcomeView();
    }
  }

  private showWelcomeView(): void {
    this.isReading = false;
    this.readerView.style.display = 'none';
    this.welcomeView.style.display = 'flex';
    this.controlsRoot.innerHTML = '';
    this.thumbnailsRoot.innerHTML = '';
    this.bookContainer.innerHTML = '';
    this.bookEngine?.destroy();
    this.bookEngine = null;
    this.panZoom = null;
    this.uploadZone.render();
  }

  private changeZoom(delta: number): void {
    if (this.panZoom) {
      if (delta > 0) {
        this.panZoom.zoomIn(Math.abs(delta));
      } else {
        this.panZoom.zoomOut(Math.abs(delta));
      }
    }
  }

  private resetZoom(): void {
    this.panZoom?.reset();
  }

  private toggleFocusMode(): void {
    this.isFocusMode = !this.isFocusMode;
    this.appEl.classList.toggle('focus-mode-active', this.isFocusMode);
    this.controls.setFocusMode(this.isFocusMode);
    saveSettings({ isFocusMode: this.isFocusMode });
  }

  private toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  private toggleTheme(): void {
    this.isDarkTheme = !this.isDarkTheme;
    if (this.isDarkTheme) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('reader-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'morning');
      localStorage.setItem('reader-theme', 'morning');
    }
    this.controls.setThemeIcon(this.isDarkTheme);
    this.dustParticles.setVisible(this.isDarkTheme);
  }

  private toggleSound(): void {
    const isActive = this.pageSound.toggleMute();
    this.controls.setSoundActive(isActive);
  }

  private initDynamicShadow(): void {
    // Only on non-touch devices
    if ('ontouchstart' in window) return;

    let ticking = false;
    window.addEventListener('mousemove', (e) => {
      if (!this.isReading || ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = (e.clientX - cx) / cx; // -1 to 1
        const dy = (e.clientY - cy) / cy; // -1 to 1
        const shadowX = Math.round(dx * -8);
        const shadowY = Math.round(dy * -6) + 20;
        this.bookContainer.style.filter =
          `drop-shadow(${shadowX}px ${shadowY}px 30px rgba(0, 0, 0, 0.60)) drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.35))`;
        ticking = false;
      });
    });
  }

  private handleResize(): void {
    if (!this.isReading || !this.bookEngine) return;
    if (this.resizeTimeout) {
      window.clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = window.setTimeout(async () => {
      this.panZoom?.reset();
      const currentPage = this.bookEngine ? this.bookEngine.getCurrentPage() : 1;
      await this.bookEngine?.init(currentPage);
    }, 250);
  }

  private showLoading(message: string): void {
    this.loadingText.textContent = message;
    this.loadingOverlay.classList.add('loading-active');
  }

  private hideLoading(): void {
    this.loadingOverlay.classList.remove('loading-active');
  }

  private showError(msg: string): void {
    this.errorMessage.textContent = msg;
    this.errorToast.classList.add('toast-visible');
    setTimeout(() => {
      this.errorToast.classList.remove('toast-visible');
    }, 4500);
  }
}

// Iniciar app
const app = new App();
app.init();

