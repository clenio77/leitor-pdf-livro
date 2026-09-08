import { ContentBlock } from './contentExtractor';

export interface ReflowConfig {
  pageWidth: number;
  pageHeight: number;
  fontSize: number; // em pixels, ex: 16, 18, 20, 22, 24
  isSinglePage: boolean;
  bookTitle?: string;
}

export interface ReflowResult {
  pages: HTMLElement[];
  totalPages: number;
  fontSize: number;
}

export class ReflowPaginator {
  /**
   * Distribui os blocos de conteúdo (títulos, parágrafos e imagens) em páginas virtuais do livro 3D.
   * Conforme o fontSize aumenta, mais páginas são geradas automaticamente.
   */
  public static paginate(blocks: ContentBlock[], config: ReflowConfig): ReflowResult {
    const { pageWidth, pageHeight, fontSize, isSinglePage, bookTitle } = config;

    // Área útil de conteúdo
    const paddingX = isSinglePage ? 20 : 32;
    const paddingTop = 32;
    const paddingBottom = isSinglePage ? 24 : 36;
    const contentWidth = Math.max(200, pageWidth - paddingX * 2);
    const contentHeight = Math.max(260, pageHeight - paddingTop - paddingBottom);

    const lineHeight = fontSize * 1.62;
    // Média de caracteres por linha para fontes serifadas proporcionais
    const charsPerLine = Math.max(20, Math.floor(contentWidth / (fontSize * 0.52)));

    interface PageItem {
      html: string;
      height: number;
    }

    const pagesItems: PageItem[][] = [];
    let currentPage: PageItem[] = [];
    let currentOccupiedHeight = 0;

    const startNewPage = () => {
      if (currentPage.length > 0) {
        pagesItems.push(currentPage);
        currentPage = [];
        currentOccupiedHeight = 0;
      }
    };

    const addItemToCurrentPage = (item: PageItem) => {
      currentPage.push(item);
      currentOccupiedHeight += item.height;
    };

    for (const block of blocks) {
      if (block.type === 'heading') {
        const text = (block.text || '').trim();
        if (!text) continue;

        const headingFontSize = Math.round(fontSize * (block.level === 1 ? 1.4 : 1.2));
        const headingLineHeight = headingFontSize * 1.35;
        const headingLines = Math.ceil(text.length / Math.floor(contentWidth / (headingFontSize * 0.55)));
        const headingMargin = fontSize * 1.2;
        const headingHeight = headingLines * headingLineHeight + headingMargin;

        // Se o título não couber com pelo menos um espaço razoável na página atual, move para a próxima
        if (currentOccupiedHeight + headingHeight + (fontSize * 3) > contentHeight && currentPage.length > 0) {
          startNewPage();
        }

        const tag = block.level === 1 ? 'h2' : 'h3';
        const html = `<${tag} class="reflow-heading reflow-h${block.level || 1}" style="font-size: ${headingFontSize}px; line-height: ${headingLineHeight}px;">${this.escapeHtml(text)}</${tag}>`;

        addItemToCurrentPage({ html, height: headingHeight });
      } else if (block.type === 'image') {
        if (!block.imageSrc) continue;

        // Cálculo de altura da imagem proporcional à largura útil
        let imgDisplayWidth = contentWidth;
        let imgDisplayHeight = Math.floor(contentWidth * 0.6);

        if (block.imageWidth && block.imageHeight && block.imageWidth > 0) {
          const ratio = block.imageHeight / block.imageWidth;
          imgDisplayHeight = Math.floor(contentWidth * ratio);
          // Limitar a altura máxima da imagem a 70% da altura da página para não estourar
          const maxHeightAllowed = Math.floor(contentHeight * 0.72);
          if (imgDisplayHeight > maxHeightAllowed) {
            imgDisplayHeight = maxHeightAllowed;
            imgDisplayWidth = Math.floor(imgDisplayHeight / ratio);
          }
        }

        const imgTotalBlockHeight = imgDisplayHeight + 24; // margem superior e inferior

        // Se a imagem não couber no espaço restante da página atual, abre uma nova
        if (currentOccupiedHeight + imgTotalBlockHeight > contentHeight && currentPage.length > 0) {
          startNewPage();
        }

        const html = `
          <div class="reflow-image-container" style="margin: 12px 0; text-align: center;">
            <img class="reflow-img" src="${block.imageSrc}" style="max-width: ${imgDisplayWidth}px; max-height: ${imgDisplayHeight}px; width: 100%; height: auto;" alt="Ilustração da obra" loading="lazy" />
          </div>
        `;

        addItemToCurrentPage({ html, height: imgTotalBlockHeight });
      } else if (block.type === 'paragraph') {
        const fullText = (block.text || '').trim();
        if (!fullText) continue;

        // Processa o parágrafo podendo dividi-lo entre páginas se for muito longo
        let remainingText = fullText;

        while (remainingText.length > 0) {
          const availableHeight = contentHeight - currentOccupiedHeight;
          const availableLines = Math.floor((availableHeight - fontSize * 0.8) / lineHeight);

          // Se não cabe nem 2 linhas na página atual e ela já tem conteúdo, passa para a próxima página
          if (availableLines < 2 && currentPage.length > 0) {
            startNewPage();
            continue;
          }

          const capacityChars = Math.max(40, (availableLines > 0 ? availableLines : 1) * charsPerLine);

          if (remainingText.length <= capacityChars) {
            // Cabe todo o restante nesta folha
            const lines = Math.ceil(remainingText.length / charsPerLine);
            const pHeight = lines * lineHeight + fontSize * 0.8;
            const html = `<p class="reflow-paragraph" style="font-size: ${fontSize}px; line-height: ${lineHeight}px;">${this.escapeHtml(remainingText)}</p>`;
            addItemToCurrentPage({ html, height: pHeight });
            remainingText = '';
          } else {
            // Quebra o texto no melhor ponto de pontuação ou espaço
            const splitIndex = this.findBestBreakPoint(remainingText, capacityChars);
            const chunk = remainingText.substring(0, splitIndex).trim();
            remainingText = remainingText.substring(splitIndex).trim();

            const lines = Math.ceil(chunk.length / charsPerLine);
            const pHeight = lines * lineHeight + fontSize * 0.4;
            const html = `<p class="reflow-paragraph reflow-paragraph-chunk" style="font-size: ${fontSize}px; line-height: ${lineHeight}px;">${this.escapeHtml(chunk)}</p>`;
            addItemToCurrentPage({ html, height: pHeight });

            // Próxima folha para o restante
            startNewPage();
          }
        }
      }
    }

    if (currentPage.length > 0) {
      pagesItems.push(currentPage);
    }

    // Se o documento estiver vazio, cria pelo menos uma página de placeholder
    if (pagesItems.length === 0) {
      pagesItems.push([{
        html: `<p class="reflow-paragraph" style="font-size: ${fontSize}px; line-height: ${lineHeight}px; text-align: center; font-style: italic; color: #888;">Nenhum conteúdo textual ou visual detectado.</p>`,
        height: 40
      }]);
    }

    // Garante número par de páginas no modo 2 páginas (spread) para o PageFlip não quebrar alinhamento
    if (!isSinglePage && pagesItems.length % 2 !== 0) {
      pagesItems.push([]);
    }

    const totalPages = pagesItems.length;
    const pageElements: HTMLElement[] = [];

    for (let i = 0; i < totalPages; i++) {
      const pageIndex = i + 1;
      const isLeft = pageIndex % 2 === 0;
      const items = pagesItems[i];
      const pageContentHtml = items.map(it => it.html).join('\n');

      const pageEl = document.createElement('div');
      pageEl.className = `book-page reflow-page ${isLeft ? 'page-left' : 'page-right'}`;
      pageEl.dataset.pageNumber = pageIndex.toString();
      pageEl.dataset.reflowTotal = totalPages.toString();

      pageEl.innerHTML = `
        <div class="page-inner">
          <div class="reflow-page-header">
            <span class="reflow-header-title">${bookTitle ? this.escapeHtml(bookTitle) : ''}</span>
          </div>
          <div class="reflow-page-body" style="padding: ${paddingTop}px ${paddingX}px ${paddingBottom}px ${paddingX}px;">
            ${pageContentHtml}
          </div>
          <div class="page-spine-shadow"></div>
          <div class="page-edge-highlight"></div>
          <div class="page-footer">
            <span class="page-num-label">${pageIndex}</span>
          </div>
        </div>
      `;

      pageElements.push(pageEl);
    }

    return {
      pages: pageElements,
      totalPages,
      fontSize
    };
  }

  private static findBestBreakPoint(text: string, idealLimit: number): number {
    const minBreak = Math.floor(idealLimit * 0.7);
    const windowSub = text.substring(minBreak, idealLimit + 20);

    // 1. Procurar fim de sentença (. ! ?)
    const sentenceEndMatch = windowSub.match(/[.!?]\s+/);
    if (sentenceEndMatch && sentenceEndMatch.index !== undefined) {
      return minBreak + sentenceEndMatch.index + 1;
    }

    // 2. Procurar vírgula ou ponto e vírgula
    const clauseMatch = windowSub.match(/[,;]\s+/);
    if (clauseMatch && clauseMatch.index !== undefined) {
      return minBreak + clauseMatch.index + 1;
    }

    // 3. Procurar espaço comum entre palavras
    const lastSpace = text.lastIndexOf(' ', idealLimit);
    if (lastSpace > minBreak) {
      return lastSpace;
    }

    return idealLimit;
  }

  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
