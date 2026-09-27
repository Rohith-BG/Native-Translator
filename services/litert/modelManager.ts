import { AppState, type AppStateStatus, Platform } from 'react-native';

// --- Safe import for Expo Go compatibility ---
// react-native-litert-lm requires a native development build (JSI).
// When running in Expo Go the native module is missing, so we provide
// harmless stubs so the rest of the UI can still be previewed.

type LiteRTLMInstance = {
  loadModel: (...args: unknown[]) => Promise<void>;
  execute: (...args: unknown[]) => Promise<string>;
  unload: () => Promise<void>;
  setMemoryWarningCallback?: (cb: (level: string) => void) => void;
};

let createLLM: (opts: Record<string, unknown>) => LiteRTLMInstance;
let GEMMA_4_E2B_IT: string;
let isMemoryError: (err: unknown) => boolean;
let nativeAvailable = true;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const litert = require('react-native-litert-lm');
  createLLM = litert.createLLM;
  GEMMA_4_E2B_IT = litert.GEMMA_4_E2B_IT ?? 'gemma-4-e2b-it';
  isMemoryError = litert.isMemoryError ?? (() => false);
} catch {
  nativeAvailable = false;
  createLLM = () => {
    throw new Error('LiteRT-LM native module is not available (Expo Go?).');
  };
  GEMMA_4_E2B_IT = 'gemma-4-e2b-it';
  isMemoryError = () => false;
}

import {
  MODEL_MAX_OUTPUT_TOKENS,
  MODEL_MAX_TOKENS,
} from '@/constants/model';
import {
  ModelNotLoadedError,
  OutOfMemoryError,
} from '@/services/litert/errors';
import type { ModelStatus, StreamCallbacks } from '@/services/litert/types';

type Listener = (status: ModelStatus, detail?: string) => void;
type ProgressListener = (progress: number) => void;

class ModelManager {
  private llm: LiteRTLMInstance | null = null;
  private status: ModelStatus = 'missing';
  private detail: string | undefined;
  private downloadProgress = 0;
  private shouldReloadOnActive = false;
  private listeners = new Set<Listener>();
  private progressListeners = new Set<ProgressListener>();
  private appStateSubscription: { remove: () => void } | null = null;
  private modelRef: string = GEMMA_4_E2B_IT;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.detail);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    listener(this.downloadProgress);
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  getStatus(): ModelStatus {
    return this.status;
  }

  getDetail(): string | undefined {
    return this.detail;
  }

  getProgress(): number {
    return this.downloadProgress;
  }

  isReady(): boolean {
    return this.status === 'ready' && this.llm !== null;
  }

  ensureLifecycleWatch(): void {
    if (this.appStateSubscription || Platform.OS === 'web') {
      return;
    }
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppState);
  }

  async load(modelPath?: string): Promise<void> {
    if (Platform.OS === 'web' || !nativeAvailable) {
      this.setStatus(
        'error',
        'On-device translation requires a native development build. Expo Go can preview the UI only.',
      );
      return;
    }

    this.ensureLifecycleWatch();

    if (this.status === 'ready' && this.llm) {
      return;
    }

    this.setStatus('loading');
    const path = modelPath ?? this.modelRef;
    this.modelRef = path;

    try {
      const llm = createLLM({
        enableMemoryTracking: true,
        memoryBudget: {
          warnAtFraction: 0.7,
          criticalAtFraction: 0.9,
          onBudgetExceeded: (level: string) => {
            if (level === 'critical') {
              this.release();
              this.setStatus(
                'error',
                'Memory pressure is high. The model was released to keep the app alive.',
              );
            }
          },
        },
      });

      llm.setMemoryWarningCallback?.((level) => {
        if (level === 'critical') {
          this.release();
          this.setStatus(
            'error',
            'The system asked us to free memory. Reload the model from Settings.',
          );
        }
      });

      this.llm = llm;
      await llm.loadModel(
        path,
        {
          backend: 'cpu',
          temperature: 0.1,
          topK: 40,
          topP: 0.95,
          maxContextTokens: MODEL_MAX_TOKENS,
          maxOutputTokens: MODEL_MAX_OUTPUT_TOKENS,
          activationDataType: 'f16',
          thinking: { enabled: false },
          forceLoad: true,
        },
        (progress: number) => {
          this.downloadProgress = progress;
          this.emitProgress();
          if (progress < 1) {
            this.setStatus('downloading');
          }
        },
      );

      this.downloadProgress = 1;
      this.emitProgress();
      this.setStatus('ready');
    } catch (error) {
      this.llm = null;
      const mapped = this.mapError(error);
      this.setStatus('error', mapped.message);
      throw mapped;
    }
  }

  release(): void {
    if (!this.llm) {
      if (this.status === 'ready') {
        this.setStatus('missing');
      }
      return;
    }

    this.setStatus('releasing');
    const llm = this.llm;
    this.llm = null;
    void llm.unload().catch(() => undefined);
    this.setStatus('missing');
  }

  async reload(): Promise<void> {
    this.release();
    await this.load(this.modelRef);
  }

  async streamGenerate(prompt: string, callbacks: StreamCallbacks): Promise<void> {
    if (!this.llm || this.status !== 'ready') {
      callbacks.onError(new ModelNotLoadedError());
      return;
    }

    let assembled = '';
    let completed = false;

    const onToken = (token: string, done: boolean) => {
      if (token) {
        assembled += token;
        callbacks.onToken(token);
      }
      if (done) {
        completed = true;
        callbacks.onComplete(assembled.trim());
      }
    };

    try {
      const result = await this.llm.execute(
        [{ type: 'text', text: prompt }],
        onToken,
        { maxOutputTokens: MODEL_MAX_OUTPUT_TOKENS, thinking: { enabled: false } },
      );
      if (!completed) {
        callbacks.onComplete((result || assembled).trim());
      }
    } catch (error) {
      callbacks.onError(this.mapError(error));
    }
  }

  private handleAppState = (state: AppStateStatus): void => {
    if (state === 'background') {
      if (this.llm) {
        this.shouldReloadOnActive = true;
        this.release();
      }
      return;
    }

    if (state === 'active' && this.shouldReloadOnActive) {
      this.shouldReloadOnActive = false;
      void this.load(this.modelRef);
    }
  };

  private mapError(error: unknown): Error {
    if (isMemoryError(error)) {
      const memErr = error as { estimate?: { recommendation?: string }; message?: string };
      return new OutOfMemoryError(memErr.estimate?.recommendation || memErr.message);
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(String(error));
  }

  private setStatus(status: ModelStatus, detail?: string): void {
    this.status = status;
    this.detail = detail;
    this.listeners.forEach((listener) => listener(status, detail));
  }

  private emitProgress(): void {
    this.progressListeners.forEach((listener) => listener(this.downloadProgress));
  }
}

export const modelManager = new ModelManager();
