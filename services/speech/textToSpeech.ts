/**
 * Text-to-Speech service wrapper around expo-speech.
 *
 * Safe import for Expo Go compatibility.
 */

type TTSCallbacks = {
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
};

let Speech: {
  speak: (text: string, options?: Record<string, unknown>) => void;
  stop: () => Promise<void>;
  isSpeakingAsync: () => Promise<boolean>;
} | null = null;

let nativeTTSAvailable = true;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Speech = require('expo-speech');
} catch {
  nativeTTSAvailable = false;
}

class TextToSpeechService {
  private isSpeaking = false;

  async isAvailable(): Promise<boolean> {
    return nativeTTSAvailable && Speech !== null;
  }

  async speak(text: string, language: string, callbacks?: TTSCallbacks): Promise<void> {
    if (!Speech) {
      callbacks?.onError?.(
        new Error('Text-to-speech is not available. Use a native development build.'),
      );
      return;
    }

    // Stop any current utterance first
    await this.stop();

    return new Promise<void>((resolve) => {
      Speech!.speak(text, {
        language,
        rate: 0.95,
        pitch: 1.0,
        onStart: () => {
          this.isSpeaking = true;
          callbacks?.onStart?.();
        },
        onDone: () => {
          this.isSpeaking = false;
          callbacks?.onDone?.();
          resolve();
        },
        onError: (error: unknown) => {
          this.isSpeaking = false;
          callbacks?.onError?.(
            error instanceof Error ? error : new Error(String(error)),
          );
          resolve();
        },
        onStopped: () => {
          this.isSpeaking = false;
          resolve();
        },
      });
    });
  }

  async stop(): Promise<void> {
    if (!Speech) {
      return;
    }
    try {
      await Speech.stop();
    } catch {
      // Silence
    }
    this.isSpeaking = false;
  }

  async getIsSpeaking(): Promise<boolean> {
    if (!Speech) {
      return false;
    }
    try {
      return await Speech.isSpeakingAsync();
    } catch {
      return false;
    }
  }
}

export const textToSpeech = new TextToSpeechService();
export type { TTSCallbacks };
