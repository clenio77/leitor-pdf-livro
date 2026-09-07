import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocMetadata } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export class PDFManager {
  private pdfDoc: pdfjsLib.PDFDocumentProxy | null = null;
  private metadata: PDFDocMetadata | null = null;
  private renderedPagesCache = new Map<number, HTMLCanvasElement>();

  public async loadDocument(data: ArrayBuffer | Uint8Array, fileName: string): Promise<PDFDocMetadata> {
    this.renderedPagesCache.clear();
    const loadingTask = pdfjsLib.getDocument({
      data,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/cmaps/',
      cMapPacked: true,
    });

    this.pdfDoc = await loadingTask.promise;
    const totalPages = this.pdfDoc.numPages;

    // Get first page to calculate aspect ratio
    const firstPage = await this.pdfDoc.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1.0 });
    const aspectRatio = viewport.width / viewport.height;

    let title = fileName;
    let author: string | undefined;

    try {
      const meta = await this.pdfDoc.getMetadata();
      const info = meta.info as Record<string, any> | undefined;
      if (info?.Title && typeof info.Title === 'string' && info.Title.trim() !== '') {
        title = info.Title;
      }
      if (info?.Author && typeof info.Author === 'string') {
        author = info.Author;
      }
    } catch {
      // Ignore metadata parsing error
    }

    this.metadata = {
      fileName,
      fileSize: data.byteLength,
      totalPages,
      aspectRatio,
      title,
      author
    };

    return this.metadata;
  }

  public getMetadata(): PDFDocMetadata | null {
    return this.metadata;
  }

  public getTotalPages(): number {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  public async renderPageToCanvas(
    pageNumber: number,
    targetCanvas: HTMLCanvasElement,
    targetWidth: number,
    targetHeight: number
  ): Promise<void> {
    if (!this.pdfDoc) throw new Error('Nenhum documento PDF carregado.');
    if (pageNumber < 1 || pageNumber > this.pdfDoc.numPages) {
      throw new Error(`Página ${pageNumber} fora dos limites.`);
    }

    const page = await this.pdfDoc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    // Calculate scale to fit target dimensions
    const scaleX = targetWidth / unscaledViewport.width;
    const scaleY = targetHeight / unscaledViewport.height;
    const fitScale = Math.min(scaleX, scaleY);

    // Apply devicePixelRatio (minimum 2.0 for razor-sharp text even when zoomed)
    const dpr = Math.max(window.devicePixelRatio || 1, 2.0);
    const scaledViewport = page.getViewport({ scale: fitScale * dpr });

    targetCanvas.width = Math.floor(scaledViewport.width);
    targetCanvas.height = Math.floor(scaledViewport.height);
    targetCanvas.style.width = `${Math.floor(scaledViewport.width / dpr)}px`;
    targetCanvas.style.height = `${Math.floor(scaledViewport.height / dpr)}px`;

    const ctx = targetCanvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Não foi possível obter contexto 2D do Canvas.');

    // Background paper tint
    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);

    const renderContext = {
      canvas: targetCanvas,
      canvasContext: ctx,
      viewport: scaledViewport,
    };

    await page.render(renderContext).promise;
  }

  public async renderThumbnail(pageNumber: number, width = 120): Promise<string> {
    if (!this.pdfDoc) throw new Error('Documento não carregado.');
    const page = await this.pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.0 });
    const scale = width / viewport.width;
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(scaledViewport.width);
    canvas.height = Math.floor(scaledViewport.height);

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#fdfbf7';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvas: canvas,
      canvasContext: ctx,
      viewport: scaledViewport
    }).promise;

    return canvas.toDataURL('image/jpeg', 0.85);
  }

  public async destroy(): Promise<void> {
    if (this.pdfDoc) {
      try {
        await (this.pdfDoc as any).destroy?.();
      } catch {
        // Safe cleanup
      }
      this.pdfDoc = null;
    }
    this.renderedPagesCache.clear();
    this.metadata = null;
  }
}
