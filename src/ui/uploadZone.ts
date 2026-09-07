import { getCachedPdf, getSettings } from '../core/storage';

export interface UploadZoneCallbacks {
  onFileSelected: (file: File) => void;
  onResumeCached: (buffer: ArrayBuffer, fileName: string, startPage: number) => void;
}

export class UploadZone {
  private container: HTMLElement;
  private callbacks: UploadZoneCallbacks;

  constructor(container: HTMLElement, callbacks: UploadZoneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
  }

  public async render(): Promise<void> {
    const cached = await getCachedPdf();
    const settings = getSettings();

    this.container.innerHTML = `
      <div class="desk-welcome-card" id="drop-zone">
        <div class="desk-lamp-cone"></div>
        <div class="welcome-leather-journal">
          <div class="journal-crease"></div>
          <div class="journal-badge">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d49b42" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              <line x1="9" y1="7" x2="16" y2="7"/>
              <line x1="9" y1="11" x2="14" y2="11"/>
            </svg>
          </div>

          <h1 class="welcome-title">Leitor da Escrivaninha</h1>
          <p class="welcome-subtitle">Sua biblioteca particular e aconchegante</p>

          <div class="upload-drop-area" id="drop-area">
            <div class="drop-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p class="drop-label">Arraste seu arquivo PDF aqui</p>
            <span class="drop-or">ou</span>
            <button type="button" class="btn-open-pdf" id="btn-browse-file">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Abrir PDF
            </button>
            <input type="file" id="file-input" accept=".pdf,application/pdf" style="display: none;" />
          </div>

          ${
            cached
              ? `
            <div class="resume-banner" id="resume-banner">
              <div class="resume-info">
                <span class="resume-tag">Leitura Recente</span>
                <p class="resume-filename" title="${cached.meta.fileName}">${cached.meta.fileName}</p>
                <span class="resume-page">Página ${settings.currentPage} de ${cached.meta.totalPages}</span>
              </div>
              <button type="button" class="btn-resume" id="btn-resume-reading">
                Continuar Leitura
              </button>
            </div>
          `
              : ''
          }

          <div class="privacy-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Seu documento permanece localmente no seu dispositivo e não é enviado para nenhum servidor.</span>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(cached, settings.currentPage);
  }

  private bindEvents(cached: { buffer: ArrayBuffer; meta: any } | null, savedPage: number): void {
    const fileInput = this.container.querySelector<HTMLInputElement>('#file-input');
    const browseBtn = this.container.querySelector<HTMLButtonElement>('#btn-browse-file');
    const dropArea = this.container.querySelector<HTMLElement>('#drop-area');
    const resumeBtn = this.container.querySelector<HTMLButtonElement>('#btn-resume-reading');

    browseBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files[0]) {
        this.callbacks.onFileSelected(target.files[0]);
      }
    });

    // Drag and drop handlers
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropArea?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropArea?.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropArea.classList.remove('drag-active');
      });
    });

    dropArea?.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) {
        const file = dt.files[0];
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          this.callbacks.onFileSelected(file);
        } else {
          alert('Por favor, selecione um arquivo no formato PDF válido.');
        }
      }
    });

    resumeBtn?.addEventListener('click', () => {
      if (cached) {
        this.callbacks.onResumeCached(cached.buffer, cached.meta.fileName, savedPage);
      }
    });
  }
}
