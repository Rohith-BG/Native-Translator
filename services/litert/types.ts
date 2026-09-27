export type LanguageCode = string;

export type TranslationMode = 'text' | 'voice' | 'image' | 'document';

export type ModelStatus =
  | 'missing'
  | 'downloading'
  | 'loading'
  | 'ready'
  | 'releasing'
  | 'error';

export interface TranslationRequest {
  sourceText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}
