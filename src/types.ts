export interface PDFDocMetadata {
  fileName: string;
  fileSize: number;
  totalPages: number;
  aspectRatio: number; // width / height of first page
  title?: string;
  author?: string;
}

export interface ReaderSettings {
  currentPage: number;
  zoom: number; // 0.8 to 2.0
  isFocusMode: boolean;
  twoPageView: boolean;
}

export interface PageRenderTask {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  scale: number;
}
