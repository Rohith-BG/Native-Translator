import { useCallback, useEffect, useRef, useState } from 'react';

import { speechToText } from '@/services/speech/speechToText';
import { textToSpeech } from '@/services/speech/textToSpeech';

type VoicePhase = 'idle' | 'listening' | 'processing' | 'speaking';

/**
 * Identifies which speaker is active in conversation mode.
 * 'left' = Person A (source language), 'right' = Person B (target language).
 */
type ActiveSpeaker = 'left' | 'right' | null;

interface UseSpeechRecognitionOptions {
  onRecognized?: (text: string, speaker: ActiveSpeaker) => void;
}

export const useSpeechRecognition = (options?: UseSpeechRecognitionOptions) => {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [activeSpeaker, setActiveSpeaker] = useState<ActiveSpeaker>(null);
  const [interimText, setInterimText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [volumeDb, setVolumeDb] = useState(0);
  const phaseRef = useRef<VoicePhase>('idle');

  // Keep ref in sync for callbacks that close over stale state
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const startListening = useCallback(
    async (languageCode: string, speaker: ActiveSpeaker) => {
      setError(null);
      setInterimText('');
      setFinalText('');
      setActiveSpeaker(speaker);

      const permitted = await speechToText.requestPermission();
      if (!permitted) {
        setError(
          'Microphone permission is required. Please grant it in your device settings under App Permissions.',
        );
        return;
      }

      // Android SpeechRecognizer needs a BCP-47 locale (e.g. 'en-US'),
      // not a bare ISO-639 code ('en'). Map common codes to locales.
      const bcp47Map: Record<string, string> = {
        af: 'af-ZA', sq: 'sq-AL', am: 'am-ET', ar: 'ar-SA', hy: 'hy-AM',
        az: 'az-AZ', eu: 'eu-ES', be: 'be-BY', bn: 'bn-IN', bs: 'bs-BA',
        bg: 'bg-BG', ca: 'ca-ES', zh: 'zh-CN', hr: 'hr-HR', cs: 'cs-CZ',
        da: 'da-DK', nl: 'nl-NL', en: 'en-US', et: 'et-EE', fi: 'fi-FI',
        fr: 'fr-FR', gl: 'gl-ES', ka: 'ka-GE', de: 'de-DE', el: 'el-GR',
        gu: 'gu-IN', he: 'he-IL', hi: 'hi-IN', hu: 'hu-HU', is: 'is-IS',
        id: 'id-ID', it: 'it-IT', ja: 'ja-JP', kn: 'kn-IN', kk: 'kk-KZ',
        ko: 'ko-KR', lv: 'lv-LV', lt: 'lt-LT', mk: 'mk-MK', ms: 'ms-MY',
        ml: 'ml-IN', mr: 'mr-IN', ne: 'ne-NP', no: 'nb-NO', fa: 'fa-IR',
        pl: 'pl-PL', pt: 'pt-BR', pa: 'pa-IN', ro: 'ro-RO', ru: 'ru-RU',
        sr: 'sr-RS', sk: 'sk-SK', sl: 'sl-SI', es: 'es-ES', sw: 'sw-KE',
        sv: 'sv-SE', ta: 'ta-IN', te: 'te-IN', th: 'th-TH', tr: 'tr-TR',
        uk: 'uk-UA', ur: 'ur-PK', vi: 'vi-VN', cy: 'cy-GB',
      };

      // If the code is already a BCP-47 (e.g. 'en-US'), use it as-is.
      // Otherwise map from our ISO-639 code, falling back to 'en-US'.
      const locale = languageCode.includes('-')
        ? languageCode
        : (bcp47Map[languageCode] ?? 'en-US');

      setPhase('listening');

      await speechToText.start(locale, {
        onPartial: (text) => {
          setInterimText(text);
        },
        onFinal: (text) => {
          setFinalText(text);
          setInterimText('');
          setPhase('idle');
          options?.onRecognized?.(text, speaker);
        },
        onError: (err) => {
          setError(err.message);
          setPhase('idle');
          setActiveSpeaker(null);
        },
        onVolumeChange: (db) => {
          setVolumeDb(db);
        },
      });
    },
    [options],
  );


  const stopListening = useCallback(async () => {
    await speechToText.stop();
    setPhase('idle');
  }, []);

  const abort = useCallback(async () => {
    await speechToText.abort();
    await textToSpeech.stop();
    setPhase('idle');
    setActiveSpeaker(null);
    setInterimText('');
    setVolumeDb(0);
  }, []);

  const speakText = useCallback(async (text: string, language: string) => {
    setPhase('speaking');
    await textToSpeech.speak(text, language, {
      onDone: () => {
        setPhase('idle');
        setActiveSpeaker(null);
      },
      onError: () => {
        setPhase('idle');
        setActiveSpeaker(null);
      },
    });
  }, []);

  const setProcessing = useCallback(() => {
    setPhase('processing');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void speechToText.abort();
      void textToSpeech.stop();
    };
  }, []);

  return {
    phase,
    activeSpeaker,
    interimText,
    finalText,
    error,
    volumeDb,
    startListening,
    stopListening,
    abort,
    speakText,
    setProcessing,
    setError,
  };
};
