import { useCallback, useRef, useState } from 'react';

import { TranslationService } from '@/services/litert/translationEngine';
import {
  ModelNotLoadedError,
  OutOfMemoryError,
  TranslationError,
} from '@/services/litert/errors';
import { chunkText } from '@/utils/textChunker';
import { DOC_CHUNK_CHAR_LIMIT } from '@/constants/model';
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

const translateSingleChunk = (
  chunk: string,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
  id: number,
  runIdRef: { current: number },
  onTokenChunk: (token: string) => void,
): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    let accumulated = '';
    void TranslationService.translate(
      {
        sourceText: chunk,
        sourceLang,
        targetLang,
      },
      {
        onToken: (token) => {
          if (id !== runIdRef.current) return;
          accumulated += token;
          onTokenChunk(accumulated);
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

      const chunks = chunkText(fullText, DOC_CHUNK_CHAR_LIMIT, 0);
      const totalChunks = chunks.length;
      setProgress({ current: 0, total: totalChunks });

      const translatedParts: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        if (cancelRef.current || id !== runId.current) {
          break;
        }

        setProgress({ current: i + 1, total: totalChunks });

        // Small breather between chunks to let GC clean native buffers
        await new Promise((resolve) => setTimeout(resolve, 60));
        if (cancelRef.current || id !== runId.current) {
          break;
        }

        try {
          let chunkResult = '';
          try {
            chunkResult = await translateSingleChunk(
              chunks[i],
              sourceLang,
              targetLang,
              id,
              runId,
              (accumulated) => {
                setOutput([...translatedParts, accumulated].join('\n\n'));
              },
            );
          } catch (firstErr) {
            // If segment failed (e.g. memory spike), split this chunk in half and retry each half
            if (chunks[i].length > 200) {
              const half = Math.floor(chunks[i].length / 2);
              const partA = chunks[i].slice(0, half);
              const partB = chunks[i].slice(half);

              const resA = await translateSingleChunk(
                partA,
                sourceLang,
                targetLang,
                id,
                runId,
                () => undefined,
              );
              await new Promise((resolve) => setTimeout(resolve, 60));
              const resB = await translateSingleChunk(
                partB,
                sourceLang,
                targetLang,
                id,
                runId,
                () => undefined,
              );
              chunkResult = `${resA} ${resB}`.trim();
            } else {
              throw firstErr;
            }
          }

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
