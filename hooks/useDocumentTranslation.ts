import { useCallback, useRef, useState } from 'react';

import { TranslationService } from '@/services/litert/translationEngine';
import {
  ModelNotLoadedError,
  OutOfMemoryError,
  TranslationError,
} from '@/services/litert/errors';
import { chunkText } from '@/utils/textChunker';
import { CONTEXT_CHAR_SOFT_LIMIT } from '@/constants/model';
import type { LanguageCode } from '@/services/litert/types';

interface ChunkProgress {
  current: number;
  total: number;
}

const toUserMessage = (error: unknown): string => {
  if (error instanceof ModelNotLoadedError) {
    return 'Download and load the model in Settings before translating.';
  }
  if (error instanceof OutOfMemoryError) {
    return 'This phone is low on memory. Close other apps, then reload the model.';
  }
  if (error instanceof TranslationError) {
    return error.message;
  }
  return 'Translation failed. Check the model status and try again.';
};

/**
 * Hook for translating long documents by splitting into chunks,
 * translating each sequentially, and concatenating results.
 */
export const useDocumentTranslation = () => {
  const [output, setOutput] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState<ChunkProgress>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const runId = useRef(0);

  const translateDocument = useCallback(
    async (
      fullText: string,
      sourceLang: LanguageCode,
      targetLang: LanguageCode,
    ) => {
      const id = ++runId.current;
      cancelRef.current = false;
      setError(null);
      setOutput('');
      setIsTranslating(true);

      const chunks = chunkText(fullText, CONTEXT_CHAR_SOFT_LIMIT);
      const totalChunks = chunks.length;
      setProgress({ current: 0, total: totalChunks });

      const translatedParts: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        if (cancelRef.current || id !== runId.current) {
          break;
        }

        setProgress({ current: i + 1, total: totalChunks });

        try {
          const chunkResult = await new Promise<string>((resolve, reject) => {
            let accumulated = '';
            void TranslationService.translate(
              {
                sourceText: chunks[i],
                sourceLang,
                targetLang,
              },
              {
                onToken: (token) => {
                  if (id !== runId.current) return;
                  accumulated += token;
                  // Show live progress: already-translated parts + current streaming chunk
                  setOutput(
                    [...translatedParts, accumulated].join('\n\n'),
                  );
                },
                onComplete: (text) => {
                  resolve(text);
                },
                onError: (err) => {
                  reject(err);
                },
              },
            );
          });

          translatedParts.push(chunkResult);
          setOutput(translatedParts.join('\n\n'));
        } catch (caught) {
          if (id !== runId.current) break;
          setError(toUserMessage(caught));
          setIsTranslating(false);
          return;
        }
      }

      if (id === runId.current) {
        setIsTranslating(false);
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
    runId.current += 1;
    setIsTranslating(false);
  }, []);

  const reset = useCallback(() => {
    runId.current += 1;
    cancelRef.current = true;
    setOutput('');
    setError(null);
    setIsTranslating(false);
    setProgress({ current: 0, total: 0 });
  }, []);

  return {
    output,
    isTranslating,
    progress,
    error,
    translateDocument,
    cancel,
    reset,
  };
};

export type { ChunkProgress };
