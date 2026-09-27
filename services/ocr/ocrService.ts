/**
 * On-device OCR service wrapper around expo-mlkit-ocr.
 *
 * Extracts text from images with bounding-box information for overlay
 * rendering. Safe import for Expo Go compatibility.
 *
 * expo-mlkit-ocr v0.2.x public API:
 *   recognizeText(uri: string) → Promise<RecognitionResult>
 *   isSupported() → boolean
 *
 * RecognitionResult = { text: string; blocks: TextBlock[] }
 * TextBlock = { text: string; boundingBox: { x, y, width, height }; lines: TextLine[] }
 * TextLine = { text: string; boundingBox: { x, y, width, height }; elements: TextElement[] }
 */

export interface OCRBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OCRBlock {
  text: string;
  boundingBox: OCRBoundingBox;
  lines: Array<{
    text: string;
    boundingBox: OCRBoundingBox;
  }>;
}

export interface OCRResult {
  blocks: OCRBlock[];
  fullText: string;
}

/* -------------------------------------------------------------------------- */
/*  Safe import – the native module only exists in a development build.       */
/* -------------------------------------------------------------------------- */

let recognizeTextFn: ((uri: string) => Promise<{
  text: string;
  blocks: Array<{
    text: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    lines: Array<{
      text: string;
      boundingBox: { x: number; y: number; width: number; height: number };
    }>;
  }>;
}>) | null = null;

let isSupportedFn: (() => boolean) | null = null;
let nativeOCRAvailable = true;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-mlkit-ocr');
  // expo-mlkit-ocr exports { recognizeText, isSupported } as named exports
  recognizeTextFn = mod.recognizeText ?? null;
  isSupportedFn = mod.isSupported ?? null;
} catch {
  nativeOCRAvailable = false;
}

/* -------------------------------------------------------------------------- */
/*  Service                                                                    */
/* -------------------------------------------------------------------------- */

class OcrService {
  isAvailable(): boolean {
    if (!nativeOCRAvailable || !recognizeTextFn) {
      return false;
    }
    try {
      return isSupportedFn ? isSupportedFn() : true;
    } catch {
      return false;
    }
  }

  async recognizeFromUri(imageUri: string): Promise<OCRResult> {
    if (!recognizeTextFn) {
      throw new Error('OCR is not available. Use a native development build.');
    }

    // recognizeText returns { text: string; blocks: TextBlock[] }
    const result = await recognizeTextFn(imageUri);

    if (!result || !result.blocks || result.blocks.length === 0) {
      return { blocks: [], fullText: '' };
    }

    const blocks: OCRBlock[] = result.blocks.map((block) => {
      const lines = (block.lines ?? []).map((line) => ({
        text: line.text ?? '',
        boundingBox: {
          x: line.boundingBox?.x ?? 0,
          y: line.boundingBox?.y ?? 0,
          width: line.boundingBox?.width ?? 0,
          height: line.boundingBox?.height ?? 0,
        },
      }));

      return {
        text: block.text ?? '',
        boundingBox: {
          x: block.boundingBox?.x ?? 0,
          y: block.boundingBox?.y ?? 0,
          width: block.boundingBox?.width ?? 0,
          height: block.boundingBox?.height ?? 0,
        },
        lines,
      };
    });

    // Use the top-level `text` from RecognitionResult if available,
    // otherwise join block texts
    const fullText = result.text || blocks.map((b) => b.text).join('\n');

    return { blocks, fullText };
  }
}

export const ocrService = new OcrService();
