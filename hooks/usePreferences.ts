import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'native-translator.preferences.v1';

interface Preferences {
  sourceLang: string;
  targetLang: string;
}

interface PreferencesContextValue extends Preferences {
  setSourceLang: (code: string) => void;
  setTargetLang: (code: string) => void;
  swapLanguages: () => void;
}

const DEFAULTS: Preferences = {
  sourceLang: 'auto',
  targetLang: 'en',
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sourceLang, setSourceLangState] = useState(DEFAULTS.sourceLang);
  const [targetLang, setTargetLangState] = useState(DEFAULTS.targetLang);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        if (parsed.sourceLang) {
          setSourceLangState(parsed.sourceLang);
        }
        if (parsed.targetLang) {
          setTargetLangState(parsed.targetLang);
        }
      } catch {
        // Keep defaults if storage is empty or corrupt.
      }
    })();
  }, []);

  const persist = useCallback(async (next: Preferences) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setSourceLang = useCallback(
    (code: string) => {
      setSourceLangState(code);
      void persist({ sourceLang: code, targetLang });
    },
    [persist, targetLang],
  );

  const setTargetLang = useCallback(
    (code: string) => {
      setTargetLangState(code);
      void persist({ sourceLang, targetLang: code });
    },
    [persist, sourceLang],
  );

  const swapLanguages = useCallback(() => {
    const nextSource = targetLang;
    const nextTarget = sourceLang === 'auto' ? 'en' : sourceLang;
    setSourceLangState(nextSource);
    setTargetLangState(nextTarget);
    void persist({ sourceLang: nextSource, targetLang: nextTarget });
  }, [persist, sourceLang, targetLang]);

  const value = useMemo(
    () => ({
      sourceLang,
      targetLang,
      setSourceLang,
      setTargetLang,
      swapLanguages,
    }),
    [setSourceLang, setTargetLang, sourceLang, swapLanguages, targetLang],
  );

  return React.createElement(PreferencesContext.Provider, { value }, children);
};

export const usePreferences = (): PreferencesContextValue => {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return context;
};
