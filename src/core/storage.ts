import { get, set, del } from 'idb-keyval';
import { PDFDocMetadata, ReaderSettings } from '../types';

const STORAGE_KEYS = {
  PDF_BUFFER: 'leitor_cached_pdf_buffer',
  DOC_METADATA: 'leitor_cached_doc_meta',
  SETTINGS: 'leitor_reader_settings'
};

const DEFAULT_SETTINGS: ReaderSettings = {
  currentPage: 1,
  zoom: 1.0,
  isFocusMode: false,
  twoPageView: true
};

export async function savePdfToCache(buffer: ArrayBuffer, meta: PDFDocMetadata): Promise<void> {
  try {
    await set(STORAGE_KEYS.PDF_BUFFER, buffer);
    await set(STORAGE_KEYS.DOC_METADATA, meta);
  } catch (err) {
    console.warn('Falha ao salvar PDF no cache IndexedDB:', err);
  }
}

export async function getCachedPdf(): Promise<{ buffer: ArrayBuffer; meta: PDFDocMetadata } | null> {
  try {
    const buffer = await get<ArrayBuffer>(STORAGE_KEYS.PDF_BUFFER);
    const meta = await get<PDFDocMetadata>(STORAGE_KEYS.DOC_METADATA);
    if (buffer && meta) {
      return { buffer, meta };
    }
  } catch (err) {
    console.warn('Falha ao recuperar PDF do cache IndexedDB:', err);
  }
  return null;
}

export async function clearCachedPdf(): Promise<void> {
  try {
    await del(STORAGE_KEYS.PDF_BUFFER);
    await del(STORAGE_KEYS.DOC_METADATA);
  } catch (err) {
    console.warn('Falha ao limpar cache IndexedDB:', err);
  }
}

export function saveSettings(settings: Partial<ReaderSettings>): void {
  try {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  } catch (err) {
    console.warn('Falha ao salvar configurações no localStorage:', err);
  }
}

export function getSettings(): ReaderSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.warn('Falha ao carregar configurações do localStorage:', err);
  }
  return DEFAULT_SETTINGS;
}
