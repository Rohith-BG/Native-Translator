/**
 * Speech-to-Text service wrapper around expo-speech-recognition.
 *
 * Like modelManager.ts, we use a safe import so the UI still renders in
 * Expo Go (which lacks native STT bindings).
 */

type STTCallbacks = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: Error) => void;
  onVolumeChange?: (db: number) => void;
};

let ExpoSpeechRecognition: {
  start: (options: Record<string, unknown>) => Promise<void>;
  stop: () => Promise<void>;
  abort: () => Promise<void>;
  isAvailable: () => Promise<boolean>;
  requestPermissions: () => Promise<{ granted: boolean }>;
  addListener: (event: string, cb: (...args: unknown[]) => void) => { remove: () => void };
} | null = null;

let nativeSTTAvailable = true;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognition = mod.ExpoSpeechRecognition ?? mod.default ?? mod;
} catch {
  nativeSTTAvailable = false;
}

class SpeechToTextService {
  private subscriptions: Array<{ remove: () => void }> = [];
  private isListening = false;

  async isAvailable(): Promise<boolean> {
    if (!nativeSTTAvailable || !ExpoSpeechRecognition) {
      return false;
    }
    try {
      return await ExpoSpeechRecognition.isAvailable();
    } catch {
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!ExpoSpeechRecognition) {
      return false;
    }
    try {
      const result = await ExpoSpeechRecognition.requestPermissions();
      return result.granted;
    } catch {
      return false;
    }
  }

  async start(locale: string, callbacks: STTCallbacks): Promise<void> {
    if (!ExpoSpeechRecognition) {
      callbacks.onError(
        new Error('Speech recognition is not available. Use a native development build.'),
      );
      return;
    }

    if (this.isListening) {
      await this.stop();
    }

    this.clearSubscriptions();

    this.subscriptions.push(
      ExpoSpeechRecognition.addListener('result', (event: unknown) => {
        const e = event as { results?: Array<{ transcript: string }>; isFinal?: boolean };
        const transcript = e.results?.[0]?.transcript ?? '';
        if (e.isFinal) {
          callbacks.onFinal(transcript);
        } else {
          callbacks.onPartial(transcript);
        }
      }),
    );

    this.subscriptions.push(
      ExpoSpeechRecognition.addListener('error', (event: unknown) => {
        const e = event as { error?: string; message?: string };
        callbacks.onError(new Error(e.message ?? e.error ?? 'Speech recognition error'));
        this.isListening = false;
      }),
    );

    this.subscriptions.push(
      ExpoSpeechRecognition.addListener('end', () => {
        this.isListening = false;
      }),
    );

    if (callbacks.onVolumeChange) {
      const volumeCb = callbacks.onVolumeChange;
      this.subscriptions.push(
        ExpoSpeechRecognition.addListener('volumechange', (event: unknown) => {
          const e = event as { value?: number };
          volumeCb(e.value ?? 0);
        }),
      );
    }

    try {
      await ExpoSpeechRecognition.start({
        lang: locale,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
      this.isListening = true;
    } catch (error) {
      this.isListening = false;
      callbacks.onError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async stop(): Promise<void> {
    if (!ExpoSpeechRecognition || !this.isListening) {
      return;
    }
    try {
      await ExpoSpeechRecognition.stop();
    } catch {
      // Silence — stop can fail if already stopped.
    }
    this.isListening = false;
  }

  async abort(): Promise<void> {
    if (!ExpoSpeechRecognition) {
      return;
    }
    try {
      await ExpoSpeechRecognition.abort();
    } catch {
      // Silence
    }
    this.isListening = false;
    this.clearSubscriptions();
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  private clearSubscriptions(): void {
    this.subscriptions.forEach((sub) => sub.remove());
    this.subscriptions = [];
  }
}

export const speechToText = new SpeechToTextService();
export type { STTCallbacks };
