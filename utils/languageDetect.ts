import { DETECT_LANGUAGE_PROMPT } from '@/constants/prompts';
import { getLanguageByCode } from '@/constants/languages';
import type { LanguageCode } from '@/services/litert/types';

export const normalizeDetectedCode = (raw: string): LanguageCode | null => {
  const match = raw.trim().toLowerCase().match(/\b([a-z]{2})\b/);
  if (!match) {
    return null;
  }
  const code = match[1];
  return getLanguageByCode(code) ? code : null;
};

export const buildDetectPrompt = (inputText: string): string => {
  return DETECT_LANGUAGE_PROMPT.replace('{inputText}', inputText);
};
