/**
 * On-device OCR service wrapper around expo-mlkit-ocr.
 *
 * Extracts text from images with bounding-box information for overlay
 * rendering. Safe import for Expo Go compatibility.
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

let MlKitOcr: {
  detectFromUri: (uri: string) => Promise<unknown[]>;
} | null = null;

let nativeOCRAvailable = true;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-mlkit-ocr');
  MlKitOcr = mod.default ?? mod;
} catch {
  nativeOCRAvailable = false;
}

const mapBoundingBox = (frame: Record<string, unknown> | undefined): OCRBoundingBox => {
  if (!frame) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: Number(frame.x ?? frame.left ?? 0),
    y: Number(frame.y ?? frame.top ?? 0),
    width: Number(frame.width ?? 0),
    height: Number(frame.height ?? 0),
  };
};

class OcrService {
  async isAvailable(): Promise<boolean> {
    return nativeOCRAvailable && MlKitOcr !== null;
  }

  async recognizeFromUri(imageUri: string): Promise<OCRResult> {
    if (!MlKitOcr) {
      throw new Error('OCR is not available. Use a native development build.');
    }

    const rawBlocks = await MlKitOcr.detectFromUri(imageUri);

    if (!rawBlocks || rawBlocks.length === 0) {
      return { blocks: [], fullText: '' };
    }

    const blocks: OCRBlock[] = (rawBlocks as Array<Record<string, unknown>>).map((block) => {
      const rawLines = (block.lines ?? []) as Array<Record<string, unknown>>;
      const lines = rawLines.map((line) => ({
        text: String(line.text ?? ''),
        boundingBox: mapBoundingBox(line.frame as Record<string, unknown> | undefined),
      }));

      return {
        text: String(block.text ?? ''),
        boundingBox: mapBoundingBox(block.frame as Record<string, unknown> | undefined),
        lines,
      };
    });

    const fullText = blocks.map((b) => b.text).join('\n');

    return { blocks, fullText };
  }
}

export const ocrService = new OcrService();
