import { useCallback, useState } from 'react';

import { ocrService, type OCRResult } from '@/services/ocr/ocrService';

type OCRPhase = 'idle' | 'processing' | 'done' | 'error';

export const useOCR = () => {
  const [phase, setPhase] = useState<OCRPhase>('idle');
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognizeFromUri = useCallback(async (uri: string) => {
    setPhase('processing');
    setError(null);
    setResult(null);

    try {
      const ocrResult = await ocrService.recognizeFromUri(uri);

      if (ocrResult.blocks.length === 0) {
        setPhase('error');
        setError('No text detected in this image. Try a clearer photo with printed text.');
        return null;
      }

      setResult(ocrResult);
      setPhase('done');
      return ocrResult;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'OCR failed. Use a native development build.';
      setPhase('error');
      setError(message);
      return null;
    }
  }, []);

  const resetOCR = useCallback(() => {
    setPhase('idle');
    setResult(null);
    setError(null);
  }, []);

  return {
    phase,
    result,
    error,
    recognizeFromUri,
    resetOCR,
  };
};

export type { OCRPhase };
