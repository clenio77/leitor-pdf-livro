import * as pdfjsLib from 'pdfjs-dist';

export type ContentBlockType = 'heading' | 'paragraph' | 'image';

export interface ContentBlock {
  type: ContentBlockType;
  text?: string;
  level?: number;
  imageSrc?: string;
  imageWidth?: number;
  imageHeight?: number;
  originalPage: number;
  yOrder: number;
}

export interface ExtractedPage {
  originalPageNumber: number;
  blocks: ContentBlock[];
}

interface ImageTransformInfo {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ContentExtractor {
  public static async extractAll(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<ContentBlock[]> {
    const allBlocks: ContentBlock[] = [];

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      try {
        const page = await pdfDoc.getPage(p);
        const pageBlocks = await this.extractPage(page, p);
        allBlocks.push(...pageBlocks.blocks);
      } catch (err) {
        console.warn(`Erro ao extrair conteúdo da página ${p}:`, err);
      }
    }

    return allBlocks;
  }

  public static async extractPage(page: pdfjsLib.PDFPageProxy, pageNumber: number): Promise<ExtractedPage> {
    const blocks: ContentBlock[] = [];
    const viewport = page.getViewport({ scale: 1.0 });

    // 1. Extrair informações de imagem e suas transformações de coordenadas
    const imageInfoList = await this.detectImageTransforms(page, viewport);

    // 2. Extrair texto estruturado com posições verticais (Y)
    const textBlocks = await this.extractTextWithPositions(page, pageNumber, viewport);

    // 3. Renderizar imagens (via objs.get ou recorte de alta resolução do canvas da página)
    let imageBlocks: ContentBlock[] = [];
    if (imageInfoList.length > 0) {
      imageBlocks = await this.extractImagesFromPage(page, imageInfoList, pageNumber, viewport);
    }

    // Se a página não tiver nenhum texto legível (ex: capa gráfica ou digitalização pura)
    if (textBlocks.length === 0) {
      if (imageBlocks.length > 0) {
        blocks.push(...imageBlocks);
      } else {
        const fullPageImg = await this.renderPageAsImage(page);
        if (fullPageImg) {
          blocks.push({
            type: 'image',
            imageSrc: fullPageImg,
            originalPage: pageNumber,
            yOrder: 0
          });
        }
      }
    } else {
      // Intercala texto e imagens com base na coordenada vertical yOrder (de cima para baixo)
      const combined = [...textBlocks, ...imageBlocks];
      combined.sort((a, b) => a.yOrder - b.yOrder);
      blocks.push(...combined);
    }

    return {
      originalPageNumber: pageNumber,
      blocks
    };
  }

  private static async detectImageTransforms(
    page: pdfjsLib.PDFPageProxy,
    viewport: pdfjsLib.PageViewport
  ): Promise<ImageTransformInfo[]> {
    const results: ImageTransformInfo[] = [];
    try {
      const ops = await page.getOperatorList();
      let currentTransform = [1, 0, 0, 1, 0, 0];
      const transformStack: number[][] = [];

      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        const args = ops.argsArray[i];

        if (fn === pdfjsLib.OPS.save) {
          transformStack.push([...currentTransform]);
        } else if (fn === pdfjsLib.OPS.restore) {
          if (transformStack.length > 0) {
            currentTransform = transformStack.pop()!;
          }
        } else if (fn === pdfjsLib.OPS.transform) {
          currentTransform = args;
        } else if (
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintInlineImageXObject
        ) {
          const imgId = args && args[0] ? String(args[0]) : `inline_${i}`;
          const w = Math.abs(currentTransform[0]);
          const h = Math.abs(currentTransform[3]);
          const x = currentTransform[4];
          const y = currentTransform[5];

          // Converter para coordenadas de tela (topo para baixo)
          const screenY = viewport.height - (y + h);

          // Ignorar ícones microscópicos menores que 16px ou ruídos decorativos invisíveis
          if (w >= 20 && h >= 20) {
            results.push({
              id: imgId,
              x: Math.max(0, x),
              y: Math.max(0, screenY),
              width: w,
              height: h
            });
          }
        }
      }
    } catch (err) {
      console.warn('Aviso: falha ao detectar transformações de imagem:', err);
    }
    return results;
  }

  private static async extractImagesFromPage(
    page: pdfjsLib.PDFPageProxy,
    imageInfos: ImageTransformInfo[],
    pageNumber: number,
    viewport: pdfjsLib.PageViewport
  ): Promise<ContentBlock[]> {
    const imageBlocks: ContentBlock[] = [];

    // Renderiza a página em canvas de alta resolução para recorte de imagens seguras
    const scale = 1.5;
    const scaledViewport = page.getViewport({ scale });
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = Math.floor(scaledViewport.width);
    fullCanvas.height = Math.floor(scaledViewport.height);
    const fullCtx = fullCanvas.getContext('2d');

    let pageRendered = false;
    if (fullCtx) {
      try {
        fullCtx.fillStyle = '#ffffff';
        fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
        await page.render({
          canvas: fullCanvas,
          canvasContext: fullCtx,
          viewport: scaledViewport
        }).promise;
        pageRendered = true;
      } catch (err) {
        console.warn('Erro ao renderizar canvas para recorte de imagem:', err);
      }
    }

    for (const info of imageInfos) {
      let imageSrc: string | null = null;

      // 1. Tentar recorte cristalino do canvas renderizado
      if (pageRendered && fullCtx) {
        try {
          const cropX = Math.floor(info.x * scale);
          const cropY = Math.floor(info.y * scale);
          const cropW = Math.floor(info.width * scale);
          const cropH = Math.floor(info.height * scale);

          if (cropW > 10 && cropH > 10 && cropX + cropW <= fullCanvas.width + 10 && cropY + cropH <= fullCanvas.height + 10) {
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = cropW;
            cropCanvas.height = cropH;
            const cropCtx = cropCanvas.getContext('2d');
            if (cropCtx) {
              cropCtx.drawImage(
                fullCanvas,
                cropX, cropY, cropW, cropH,
                0, 0, cropW, cropH
              );
              imageSrc = cropCanvas.toDataURL('image/jpeg', 0.88);
            }
          }
        } catch (cropErr) {
          console.warn('Erro ao recortar imagem:', cropErr);
        }
      }

      // 2. Fallback: tentar page.objs.get(id) caso o recorte não tenha ocorrido
      if (!imageSrc && info.id) {
        imageSrc = await new Promise<string | null>((resolve) => {
          let resolved = false;
          try {
            page.objs.get(info.id, (imgObj: any) => {
              if (resolved) return;
              resolved = true;
              resolve(this.convertImgObjToDataUrl(imgObj));
            });
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve(null);
              }
            }, 500);
          } catch {
            resolve(null);
          }
        });
      }

      if (imageSrc) {
        imageBlocks.push({
          type: 'image',
          imageSrc,
          imageWidth: info.width,
          imageHeight: info.height,
          originalPage: pageNumber,
          yOrder: info.y
        });
      }
    }

    return imageBlocks;
  }

  private static convertImgObjToDataUrl(imgObj: any): string | null {
    if (!imgObj) return null;
    try {
      if (typeof ImageBitmap !== 'undefined' && imgObj instanceof ImageBitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = imgObj.width;
        canvas.height = imgObj.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(imgObj, 0, 0);
        return canvas.toDataURL('image/jpeg', 0.88);
      }
      if (imgObj instanceof HTMLImageElement) {
        return imgObj.src;
      }
      if (imgObj instanceof HTMLCanvasElement) {
        return imgObj.toDataURL('image/jpeg', 0.88);
      }
      if (imgObj.data && imgObj.width && imgObj.height) {
        const canvas = document.createElement('canvas');
        canvas.width = imgObj.width;
        canvas.height = imgObj.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        const dataLen = imgObj.data.length;
        const expectedRgba = imgObj.width * imgObj.height * 4;
        const expectedRgb = imgObj.width * imgObj.height * 3;

        if (dataLen === expectedRgba) {
          const imgData = new ImageData(new Uint8ClampedArray(imgObj.data), imgObj.width, imgObj.height);
          ctx.putImageData(imgData, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.88);
        } else if (dataLen === expectedRgb) {
          const clamped = new Uint8ClampedArray(expectedRgba);
          let j = 0;
          for (let i = 0; i < dataLen; i += 3) {
            clamped[j++] = imgObj.data[i];
            clamped[j++] = imgObj.data[i + 1];
            clamped[j++] = imgObj.data[i + 2];
            clamped[j++] = 255;
          }
          const imgData = new ImageData(clamped, imgObj.width, imgObj.height);
          ctx.putImageData(imgData, 0, 0);
          return canvas.toDataURL('image/jpeg', 0.88);
        }
      }
    } catch (err) {
      console.warn('Erro ao converter objeto de imagem para DataURL:', err);
    }
    return null;
  }

  private static async renderPageAsImage(page: pdfjsLib.PDFPageProxy): Promise<string | null> {
    try {
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#fdfbf7';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvas,
        canvasContext: ctx,
        viewport
      }).promise;

      return canvas.toDataURL('image/jpeg', 0.88);
    } catch {
      return null;
    }
  }

  private static async extractTextWithPositions(
    page: pdfjsLib.PDFPageProxy,
    pageNumber: number,
    viewport: pdfjsLib.PageViewport
  ): Promise<ContentBlock[]> {
    const blocks: ContentBlock[] = [];
    const textContent = await page.getTextContent();
    if (!textContent || textContent.items.length === 0) return blocks;

    let totalHeight = 0;
    let textItemCount = 0;
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim().length > 0) {
        totalHeight += Math.abs(item.transform[0]);
        textItemCount++;
      }
    }
    const avgHeight = textItemCount > 0 ? totalHeight / textItemCount : 12;

    interface LineGroup {
      screenY: number;
      fontSize: number;
      text: string;
    }
    const lines: LineGroup[] = [];
    let currentLineY: number | null = null;
    let currentLineParts: string[] = [];
    let currentLineFontSize = avgHeight;

    for (const rawItem of textContent.items) {
      if (!('str' in rawItem)) continue;
      const str = rawItem.str.trim();
      if (!str) continue;

      const pdfY = rawItem.transform[5];
      const screenY = Math.round(viewport.height - pdfY);
      const itemHeight = Math.abs(rawItem.transform[0]);

      if (currentLineY !== null && Math.abs(screenY - currentLineY) > 6) {
        if (currentLineParts.length > 0) {
          lines.push({
            screenY: currentLineY,
            fontSize: currentLineFontSize,
            text: currentLineParts.join(' ')
          });
          currentLineParts = [];
        }
      }

      currentLineY = screenY;
      currentLineFontSize = itemHeight;
      currentLineParts.push(str);
    }

    if (currentLineParts.length > 0 && currentLineY !== null) {
      lines.push({
        screenY: currentLineY,
        fontSize: currentLineFontSize,
        text: currentLineParts.join(' ')
      });
    }

    // Agrupa linhas em parágrafos ou títulos
    let paragraphBuffer: string[] = [];
    let paragraphStartY = 0;

    const flushParagraph = () => {
      if (paragraphBuffer.length > 0) {
        const text = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
        if (text.length > 0) {
          blocks.push({
            type: 'paragraph',
            text,
            originalPage: pageNumber,
            yOrder: paragraphStartY
          });
        }
        paragraphBuffer = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTitle = line.fontSize > avgHeight * 1.22 && line.text.length < 140;

      if (isTitle) {
        flushParagraph();
        blocks.push({
          type: 'heading',
          level: line.fontSize > avgHeight * 1.45 ? 1 : 2,
          text: line.text,
          originalPage: pageNumber,
          yOrder: line.screenY
        });
      } else {
        if (paragraphBuffer.length === 0) {
          paragraphStartY = line.screenY;
        }
        paragraphBuffer.push(line.text);
        const endsWithPunctuation = /[.:!?]$/.test(line.text);
        const nextLine = lines[i + 1];
        const gapToNext = nextLine ? Math.abs(nextLine.screenY - line.screenY) : 0;
        if (endsWithPunctuation && gapToNext > avgHeight * 1.6) {
          flushParagraph();
        }
      }
    }

    flushParagraph();
    return blocks;
  }
}
