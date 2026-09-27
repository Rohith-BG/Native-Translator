import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Check, Copy } from 'lucide-react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { darkTheme, type as typeScale } from '@/constants/theme';

interface TranslationResultProps {
  text: string;
  isStreaming: boolean;
}

export const TranslationResult: React.FC<TranslationResultProps> = ({
  text,
  isStreaming,
}) => {
  const [copied, setCopied] = React.useState(false);

  // Don't render when there's nothing to show
  if (!text && !isStreaming) {
    return null;
  }

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    if (!text) {
      return;
    }
    await Clipboard.setStringAsync(text);
    setCopied(true);
  };

  return (
    <Animated.View entering={FadeInDown.duration(280).damping(18)}>
      <GlassCard>
        <View style={styles.header}>
          <Text style={styles.title}>Translation</Text>
          <View style={styles.headerActions}>
            {isStreaming ? (
              <LoadingSpinner size={16} color={darkTheme.secondary} />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copied ? 'Copied' : 'Copy translation'}
              disabled={!text}
              hitSlop={8}
              onPress={() => {
                void copy();
              }}
              style={styles.copyButton}
            >
              {copied ? (
                <Check color={darkTheme.success} size={18} />
              ) : (
                <Copy color={text ? darkTheme.secondary : darkTheme.textMuted} size={18} />
              )}
            </Pressable>
          </View>
        </View>
        <Text style={[styles.body, !text && styles.placeholder]}>
          {text || 'Streaming…'}
        </Text>
      </GlassCard>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.heading,
  },
  copyButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
    minHeight: 48,
  },
  placeholder: {
    color: darkTheme.textMuted,
  },
});
