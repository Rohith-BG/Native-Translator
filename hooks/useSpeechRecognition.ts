import { useCallback, useEffect, useRef, useState } from 'react';

import { speechToText } from '@/services/speech/speechToText';
import { textToSpeech } from '@/services/speech/textToSpeech';
import { getLanguageByCode } from '@/constants/languages';

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
        setError('Microphone permission was denied. Grant it in system settings.');
        return;
      }

      // Map language code to a BCP-47 locale (e.g. 'en' → 'en-US')
      const lang = getLanguageByCode(languageCode);
      const locale = lang ? languageCode : 'en';

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
