import {
  AUTO_TRANSLATION_PROMPT,
  TRANSLATION_PROMPT,
} from '@/constants/prompts';
import { getLanguageLabel } from '@/constants/languages';
import { modelManager } from '@/services/litert/modelManager';
import { TranslationError } from '@/services/litert/errors';
import type { StreamCallbacks, TranslationRequest } from '@/services/litert/types';
import { buildDetectPrompt, normalizeDetectedCode } from '@/utils/languageDetect';

export const TranslationService = {
  buildPrompt(request: TranslationRequest): string {
    if (request.sourceLang === 'auto') {
      return AUTO_TRANSLATION_PROMPT.replace(
        '{targetLang}',
        getLanguageLabel(request.targetLang),
      ).replace('{inputText}', request.sourceText);
    }

    return TRANSLATION_PROMPT.replace('{sourceLang}', getLanguageLabel(request.sourceLang))
      .replace('{targetLang}', getLanguageLabel(request.targetLang))
      .replace('{inputText}', request.sourceText);
  },

  async translate(
    request: TranslationRequest,
    callbacks: StreamCallbacks,
  ): Promise<void> {
    const prompt = this.buildPrompt(request);
    await modelManager.streamGenerate(prompt, callbacks);
  },

  async detectLanguage(sourceText: string): Promise<string | null> {
    return new Promise((resolve, reject) => {
      void modelManager.streamGenerate(buildDetectPrompt(sourceText), {
        onToken: () => undefined,
        onComplete: (fullText) => {
          resolve(normalizeDetectedCode(fullText));
        },
        onError: (error) => {
          reject(error instanceof Error ? error : new TranslationError());
        },
      });
    });
  },
};
