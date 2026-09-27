export const TRANSLATION_PROMPT = `Translate the following text from {sourceLang} to {targetLang}.
Output ONLY the translation, nothing else.

Text: {inputText}`;

export const AUTO_TRANSLATION_PROMPT = `Detect the language of the following text, then translate it to {targetLang}.
Output ONLY the translation, nothing else.

Text: {inputText}`;

export const DETECT_LANGUAGE_PROMPT = `Identify the language of the following text.
Reply with ONLY the ISO 639-1 language code (two lowercase letters), nothing else.

Text: {inputText}`;
