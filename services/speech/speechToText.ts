/**
 * Speech-to-Text service wrapper around expo-speech-recognition.
 *
 * Uses the ExpoSpeechRecognitionModule native module which provides:
 *  - requestPermissionsAsync() for RECORD_AUDIO permission
 *  - isRecognitionAvailable() to check if STT is ready
 *  - start(options) / stop() / abort() for recognition lifecycle
 *  - NativeModule event emitter for result / error / end / volumechange events
 */

import type { EventSubscription } from 'expo-modules-core';

type STTCallbacks = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: Error) => void;
  onVolumeChange?: (db: number) => void;
};

/* -------------------------------------------------------------------------- */
/*  Safe import – the native module only exists in a development build.       */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SpeechModule: any = null;
let nativeSTTAvailable = true;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('expo-speech-recognition');
  // The library exports { ExpoSpeechRecognitionModule } from its index
  SpeechModule = mod.ExpoSpeechRecognitionModule ?? null;
} catch {
  nativeSTTAvailable = false;
}

/* -------------------------------------------------------------------------- */
/*  Service                                                                    */
/* -------------------------------------------------------------------------- */

class SpeechToTextService {
  private subscriptions: EventSubscription[] = [];
  private isListening = false;

  /** Check whether native STT is available on this device. */
  isAvailable(): boolean {
    if (!nativeSTTAvailable || !SpeechModule) {
      return false;
    }
    try {
      // isRecognitionAvailable() is synchronous in expo-speech-recognition
      return SpeechModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  }

  /** Request microphone + speech recognition permission. */
  async requestPermission(): Promise<boolean> {
    if (!SpeechModule) {
      return false;
    }
    try {
      // The correct method name is requestPermissionsAsync (returns PermissionResponse)
      const result = await SpeechModule.requestPermissionsAsync();
      return result.granted === true || result.status === 'granted';
    } catch {
      return false;
    }
  }

  /** Start listening with the given BCP-47 locale (e.g. "en-US", "hi-IN"). */
  async start(locale: string, callbacks: STTCallbacks): Promise<void> {
    if (!SpeechModule) {
      callbacks.onError(
        new Error('Speech recognition is not available. Use a native development build.'),
      );
      return;
    }

    if (this.isListening) {
      await this.stop();
    }

    this.clearSubscriptions();

    /* ---- Wire up event listeners via NativeModule.addListener() ---- */

    this.subscriptions.push(
      SpeechModule.addListener('result', (event: { isFinal?: boolean; results?: Array<{ transcript: string }> }) => {
        const transcript = event.results?.[0]?.transcript ?? '';
        if (event.isFinal) {
          callbacks.onFinal(transcript);
        } else {
          callbacks.onPartial(transcript);
        }
      }),
    );

    this.subscriptions.push(
      SpeechModule.addListener('error', (event: { error?: string; message?: string }) => {
        callbacks.onError(new Error(event.message ?? event.error ?? 'Speech recognition error'));
        this.isListening = false;
      }),
    );

    this.subscriptions.push(
      SpeechModule.addListener('end', () => {
        this.isListening = false;
      }),
    );

    if (callbacks.onVolumeChange) {
      const volumeCb = callbacks.onVolumeChange;
      this.subscriptions.push(
        SpeechModule.addListener('volumechange', (event: { value?: number }) => {
          volumeCb(event.value ?? 0);
        }),
      );
    }

    /* ---- Start recognition ---- */
    try {
      // ExpoSpeechRecognitionModule.start() accepts ExpoSpeechRecognitionOptions
      // requiresOnDeviceRecognition is set to false so Android can fall back
      // to network-based STT when the on-device language model is not downloaded.
      // The translation itself is still fully on-device via LiteRT-LM.
      SpeechModule.start({
        lang: locale,
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
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
    if (!SpeechModule || !this.isListening) {
      return;
    }
    try {
      SpeechModule.stop();
    } catch {
      // Silence — stop can fail if already stopped.
    }
    this.isListening = false;
  }

  async abort(): Promise<void> {
    if (!SpeechModule) {
      return;
    }
    try {
      SpeechModule.abort();
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
