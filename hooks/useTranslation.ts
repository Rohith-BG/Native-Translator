import { useCallback, useRef, useState } from 'react';

import { TranslationService } from '@/services/litert/translationEngine';
import {
  ModelNotLoadedError,
  OutOfMemoryError,
  TranslationError,
} from '@/services/litert/errors';
import type { LanguageCode } from '@/services/litert/types';

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

export const useTranslation = () => {
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const runId = useRef(0);

  const translate = useCallback(
    async (sourceText: string, sourceLang: LanguageCode, targetLang: LanguageCode) => {
      const id = ++runId.current;
      setError(null);
      setOutput('');
      setIsStreaming(true);

      try {
        await TranslationService.translate(
          { sourceText, sourceLang, targetLang },
          {
            onToken: (token) => {
              if (id !== runId.current) {
                return;
              }
              setOutput((current) => current + token);
            },
            onComplete: (fullText) => {
              if (id !== runId.current) {
                return;
              }
              setOutput(fullText);
              setIsStreaming(false);
            },
            onError: (caught) => {
              if (id !== runId.current) {
                return;
              }
              setIsStreaming(false);
              setError(toUserMessage(caught));
            },
          },
        );
      } catch (caught) {
        if (id !== runId.current) {
          return;
        }
        setIsStreaming(false);
        setError(toUserMessage(caught));
      }
    },
    [],
  );

  const reset = useCallback(() => {
    runId.current += 1;
    setOutput('');
    setError(null);
    setIsStreaming(false);
  }, []);

  return { output, isStreaming, error, translate, reset, setOutput };
};
