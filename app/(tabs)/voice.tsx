import { useRouter } from 'expo-router';
import { ArrowLeftRight, Mic, Settings, Volume2, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModelStatusBanner } from '@/components/common/ModelStatusBanner';
import { TranslationResult } from '@/components/translation/TranslationResult';
import { VoiceWaveform } from '@/components/translation/VoiceWaveform';
import { AppBackground } from '@/components/ui/AppBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { darkTheme, motion, radii, type as typeScale } from '@/constants/theme';
import { getLanguageLabel } from '@/constants/languages';
import { useModelStatus } from '@/hooks/useModelStatus';
import { usePreferences } from '@/hooks/usePreferences';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useTranslation } from '@/hooks/useTranslation';

const PHASE_LABELS = {
  idle: 'Tap a mic to start a conversation',
  listening: 'Listening…',
  processing: 'Translating…',
  speaking: 'Speaking translation…',
} as const;

const VoiceScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sourceLang, targetLang, setSourceLang, setTargetLang, swapLanguages } = usePreferences();
  const { status, detail, progress, isReady, load } = useModelStatus();
  const { output, isStreaming, error: translationError, translate, reset } = useTranslation();
  const swapAngle = useSharedValue(0);
  const swapCount = useRef(0);

  // Track which panel shows which recognized text
  const [leftRecognized, setLeftRecognized] = useState('');
  const [rightRecognized, setRightRecognized] = useState('');

  const handleRecognized = useCallback(
    (text: string, speaker: 'left' | 'right' | null) => {
      if (!text.trim()) {
        return;
      }

      if (speaker === 'left') {
        setLeftRecognized(text);
        setRightRecognized('');
      } else {
        setRightRecognized(text);
        setLeftRecognized('');
      }
    },
    [],
  );

  const {
    phase,
    activeSpeaker,
    interimText,
    finalText,
    error: sttError,
    volumeDb,
    startListening,
    stopListening,
    abort,
    speakText,
    setProcessing,
    setError: setSttError,
  } = useSpeechRecognition({ onRecognized: handleRecognized });

  // When we get recognized text, translate and speak
  const handleTranslateAndSpeak = useCallback(
    async (text: string, fromLang: string, toLang: string) => {
      setProcessing();
      reset();

      await translate(text, fromLang, toLang);
    },
    [setProcessing, reset, translate],
  );

  // Trigger translation when we have final text
  const prevFinalRef = useRef('');
  if (finalText && finalText !== prevFinalRef.current) {
    prevFinalRef.current = finalText;

    // Determine direction
    if (activeSpeaker === 'left') {
      // Person A spoke source lang → translate to target lang
      void handleTranslateAndSpeak(
        finalText,
        sourceLang === 'auto' ? 'auto' : sourceLang,
        targetLang,
      );
    } else if (activeSpeaker === 'right') {
      // Person B spoke target lang → translate to source lang
      void handleTranslateAndSpeak(
        finalText,
        targetLang,
        sourceLang === 'auto' ? 'en' : sourceLang,
      );
    }
  }

  // When streaming completes, speak the translation
  const prevOutputRef = useRef('');
  if (output && !isStreaming && output !== prevOutputRef.current && phase === 'processing') {
    prevOutputRef.current = output;

    const speakLang = activeSpeaker === 'left' ? targetLang : (sourceLang === 'auto' ? 'en' : sourceLang);
    void speakText(output, speakLang);
  }

  const onSwap = useCallback(() => {
    swapCount.current += 1;
    swapAngle.value = withTiming(swapCount.current * 180, { duration: motion.duration + 80 });
    swapLanguages();
  }, [swapAngle, swapLanguages]);

  const swapAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swapAngle.value}deg` }],
  }));

  const onLeftMicPress = useCallback(() => {
    if (phase !== 'idle') {
      void abort();
      return;
    }
    if (!isReady) {
      void load();
      return;
    }
    const lang = sourceLang === 'auto' ? 'en' : sourceLang;
    void startListening(lang, 'left');
  }, [phase, isReady, sourceLang, startListening, abort, load]);

  const onRightMicPress = useCallback(() => {
    if (phase !== 'idle') {
      void abort();
      return;
    }
    if (!isReady) {
      void load();
      return;
    }
    void startListening(targetLang, 'right');
  }, [phase, isReady, targetLang, startListening, abort, load]);

  const currentError = sttError || translationError;
  const isActive = phase !== 'idle';
  const phaseLabel = PHASE_LABELS[phase];

  // Determine displayed text per panel
  const leftDisplay = activeSpeaker === 'left' ? (interimText || leftRecognized) : leftRecognized;
  const rightDisplay = activeSpeaker === 'right' ? (interimText || rightRecognized) : rightRecognized;

  // Translation result goes to the opposite panel
  const leftTranslation = activeSpeaker === 'right' ? output : '';
  const rightTranslation = activeSpeaker === 'left' ? output : '';

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: 24 },
        ]}
      >
        {/* Header */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Conversation</Text>
            <Text style={styles.subtitle}>On-device · Voice Translation</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Settings color={darkTheme.textPrimary} size={22} />
          </Pressable>
        </View>

        <ModelStatusBanner
          status={status}
          detail={detail}
          progress={progress}
          onAction={() => router.push('/settings')}
        />

        {/* Language Row */}
        <View style={styles.langRow}>
          <LanguagePicker
            label="Person A"
            selectedCode={sourceLang}
            onSelect={setSourceLang}
            includeAutoDetect
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Swap languages"
            onPress={onSwap}
            style={styles.swap}
          >
            <Animated.View style={swapAnimStyle}>
              <ArrowLeftRight color={darkTheme.secondary} size={20} />
            </Animated.View>
          </Pressable>
          <LanguagePicker label="Person B" selectedCode={targetLang} onSelect={setTargetLang} />
        </View>

        {/* Status Indicator */}
        <Animated.View entering={FadeInUp.duration(200)} style={styles.statusRow}>
          {phase === 'speaking' ? (
            <Volume2 color={darkTheme.success} size={16} />
          ) : null}
          <Text
            style={[
              styles.statusText,
              phase === 'listening' && styles.statusActive,
              phase === 'speaking' && styles.statusSpeaking,
            ]}
          >
            {phaseLabel}
          </Text>
        </Animated.View>

        {/* Waveform */}
        {isActive ? (
          <Animated.View entering={FadeInDown.duration(250)} style={styles.waveformWrap}>
            <VoiceWaveform
              active={phase === 'listening'}
              volumeDb={volumeDb}
              color={
                phase === 'speaking'
                  ? darkTheme.success
                  : phase === 'processing'
                    ? darkTheme.warning
                    : darkTheme.secondary
              }
            />
          </Animated.View>
        ) : null}

        {/* Person A Panel */}
        <GlassCard>
          <View style={styles.panelHeader}>
            <Text style={styles.panelLabel}>
              {getLanguageLabel(sourceLang === 'auto' ? 'en' : sourceLang)}
            </Text>
            <Text style={styles.personLabel}>Person A</Text>
          </View>

          {leftDisplay ? (
            <Text style={styles.recognizedText}>{leftDisplay}</Text>
          ) : (
            <Text style={styles.placeholderText}>
              {activeSpeaker === 'left' && phase === 'listening'
                ? 'Listening…'
                : 'Tap the left mic and speak'}
            </Text>
          )}

          {leftTranslation ? (
            <View style={styles.translationBubble}>
              <Text style={styles.translationLabel}>Translation ↓</Text>
              <Text style={styles.translationText}>{leftTranslation}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              activeSpeaker === 'left' && phase === 'listening'
                ? 'Stop listening'
                : `Start listening in ${getLanguageLabel(sourceLang)}`
            }
            onPress={onLeftMicPress}
            style={[
              styles.micButton,
              activeSpeaker === 'left' && phase === 'listening' && styles.micButtonActive,
            ]}
          >
            {activeSpeaker === 'left' && isActive ? (
              <X color={darkTheme.textPrimary} size={24} />
            ) : (
              <Mic
                color={
                  isActive && activeSpeaker !== 'left'
                    ? darkTheme.textMuted
                    : darkTheme.primary
                }
                size={24}
              />
            )}
          </Pressable>
        </GlassCard>

        {/* Person B Panel */}
        <GlassCard>
          <View style={styles.panelHeader}>
            <Text style={styles.panelLabel}>{getLanguageLabel(targetLang)}</Text>
            <Text style={styles.personLabel}>Person B</Text>
          </View>

          {rightDisplay ? (
            <Text style={styles.recognizedText}>{rightDisplay}</Text>
          ) : (
            <Text style={styles.placeholderText}>
              {activeSpeaker === 'right' && phase === 'listening'
                ? 'Listening…'
                : 'Tap the right mic and speak'}
            </Text>
          )}

          {rightTranslation ? (
            <View style={styles.translationBubble}>
              <Text style={styles.translationLabel}>Translation ↓</Text>
              <Text style={styles.translationText}>{rightTranslation}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              activeSpeaker === 'right' && phase === 'listening'
                ? 'Stop listening'
                : `Start listening in ${getLanguageLabel(targetLang)}`
            }
            onPress={onRightMicPress}
            style={[
              styles.micButton,
              activeSpeaker === 'right' && phase === 'listening' && styles.micButtonActive,
            ]}
          >
            {activeSpeaker === 'right' && isActive ? (
              <X color={darkTheme.textPrimary} size={24} />
            ) : (
              <Mic
                color={
                  isActive && activeSpeaker !== 'right'
                    ? darkTheme.textMuted
                    : darkTheme.secondary
                }
                size={24}
              />
            )}
          </Pressable>
        </GlassCard>

        {/* Error Display */}
        {currentError ? (
          <Text style={styles.error}>{currentError}</Text>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_700Bold',
    fontSize: 28,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.label,
    marginTop: 4,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  statusText: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.label,
    textAlign: 'center',
  },
  statusActive: {
    color: darkTheme.secondary,
  },
  statusSpeaking: {
    color: darkTheme.success,
  },
  waveformWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelLabel: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.heading,
  },
  personLabel: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.caption,
    backgroundColor: darkTheme.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  recognizedText: {
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
    minHeight: 48,
  },
  placeholderText: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
    minHeight: 48,
  },
  translationBubble: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: darkTheme.surfaceBorder,
  },
  translationLabel: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.caption,
    marginBottom: 6,
  },
  translationText: {
    color: darkTheme.success,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: darkTheme.surface,
    borderWidth: 1.5,
    borderColor: darkTheme.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
  },
  micButtonActive: {
    borderColor: darkTheme.error,
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
  },
  error: {
    color: darkTheme.error,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.label,
    textAlign: 'center',
  },
});

export default VoiceScreen;
