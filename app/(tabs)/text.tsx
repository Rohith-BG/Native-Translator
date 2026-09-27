import { useRouter } from 'expo-router';
import { ArrowLeftRight, Settings } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModelStatusBanner } from '@/components/common/ModelStatusBanner';
import { TranslationResult } from '@/components/translation/TranslationResult';
import { AnimatedInput } from '@/components/ui/AnimatedInput';
import { AppBackground } from '@/components/ui/AppBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { CONTEXT_CHAR_HARD_LIMIT, CONTEXT_CHAR_SOFT_LIMIT } from '@/constants/model';
import { darkTheme, motion, type as typeScale } from '@/constants/theme';
import { useModelStatus } from '@/hooks/useModelStatus';
import { usePreferences } from '@/hooks/usePreferences';
import { useTranslation } from '@/hooks/useTranslation';

const TextScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sourceLang, targetLang, setSourceLang, setTargetLang, swapLanguages } = usePreferences();
  const { status, detail, progress, isReady, load } = useModelStatus();
  const { output, isStreaming, error, translate, reset } = useTranslation();
  const [sourceText, setSourceText] = useState('');
  const swapAngle = useSharedValue(0);
  const swapCount = useRef(0);

  const onSwap = useCallback(() => {
    swapCount.current += 1;
    swapAngle.value = withTiming(swapCount.current * 180, { duration: motion.duration + 80 });
    swapLanguages();
  }, [swapAngle, swapLanguages]);

  const swapAnimStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swapAngle.value}deg` }],
  }));

  const count = sourceText.length;
  const overSoft = count >= CONTEXT_CHAR_SOFT_LIMIT;
  const overHard = count >= CONTEXT_CHAR_HARD_LIMIT;
  const canTranslate = sourceText.trim().length > 0 && !overHard && sourceLang !== targetLang;

  const helper = useMemo(() => {
    if (overHard) {
      return 'This is too long for the model context. Shorten the text.';
    }
    if (overSoft) {
      return 'Approaching the context limit. Shorter text translates more reliably.';
    }
    return `${count} characters`;
  }, [count, overHard, overSoft]);

  const onTranslate = () => {
    if (!isReady) {
      void load();
      return;
    }
    void translate(sourceText.trim(), sourceLang, targetLang);
  };

  return (
    <AppBackground>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 12, paddingBottom: 24 },
          ]}
        >
          <View style={styles.topRow}>
            <View>
              <Text style={styles.title}>Translate</Text>
              <Text style={styles.subtitle}>On-device · Gemma 4 E2B</Text>
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

          <View style={styles.langRow}>
            <LanguagePicker
              label="From"
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
            <LanguagePicker label="To" selectedCode={targetLang} onSelect={setTargetLang} />
          </View>

          <GlassCard>
            <Text style={styles.cardLabel}>Source</Text>
            <AnimatedInput
              value={sourceText}
              onChangeText={(value) => {
                setSourceText(value);
                if (!value) {
                  reset();
                }
              }}
              placeholder="Type or paste text to translate"
              multiline
              maxLength={CONTEXT_CHAR_HARD_LIMIT + 200}
            />
            <Text style={[styles.counter, overSoft && styles.counterWarn, overHard && styles.counterError]}>
              {helper}
            </Text>
          </GlassCard>

          <GradientButton
            label={isReady ? 'Translate' : 'Load model to translate'}
            onPress={onTranslate}
            loading={isStreaming || status === 'loading' || status === 'downloading'}
            disabled={!canTranslate && isReady}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TranslationResult text={output} isStreaming={isStreaming} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  cardLabel: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.caption,
    marginBottom: 8,
  },
  counter: {
    marginTop: 12,
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
  },
  counterWarn: {
    color: darkTheme.warning,
  },
  counterError: {
    color: darkTheme.error,
  },
  error: {
    color: darkTheme.error,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.label,
  },
});

export default TextScreen;
