import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { darkTheme, motion, radii, type as typeScale } from '@/constants/theme';
import type { ModelStatus } from '@/services/litert/types';

interface ModelStatusBannerProps {
  status: ModelStatus;
  detail?: string;
  progress: number;
  onAction?: () => void;
}

const statusCopy = (status: ModelStatus, progress: number): string => {
  switch (status) {
    case 'ready':
      return 'Model ready · works offline';
    case 'downloading':
      return `Downloading model · ${Math.round(progress * 100)}%`;
    case 'loading':
      return 'Loading Gemma 4 E2B on device…';
    case 'releasing':
      return 'Releasing model from memory…';
    case 'missing':
      return 'Model not loaded · download once, then translate offline';
    case 'error':
      return 'Model needs attention';
    default:
      return 'Checking model…';
  }
};

const PulsingDot: React.FC<{ color: string; active: boolean }> = ({ color, active }) => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (active) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      cancelAnimation(opacity);
      opacity.value = withTiming(1, { duration: motion.duration });
    }
    return () => {
      cancelAnimation(opacity);
    };
  }, [active, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
};

const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(progress, { duration: 400, easing: Easing.out(Easing.quad) });
  }, [progress, width]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.min(width.value * 100, 100)}%`,
  }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, barStyle]} />
    </View>
  );
};

export const ModelStatusBanner: React.FC<ModelStatusBannerProps> = ({
  status,
  detail,
  progress,
  onAction,
}) => {
  const color =
    status === 'ready'
      ? darkTheme.success
      : status === 'error'
        ? darkTheme.error
        : darkTheme.secondary;

  const isPulsing = status === 'loading' || status === 'downloading';

  return (
    <Pressable
      onPress={onAction}
      disabled={!onAction}
      style={styles.row}
      accessibilityRole={onAction ? 'button' : undefined}
    >
      <PulsingDot color={color} active={isPulsing} />
      <View style={styles.copy}>
        <Text style={styles.text}>{statusCopy(status, progress)}</Text>
        {status === 'error' && detail ? <Text style={styles.detail}>{detail}</Text> : null}
        {status === 'downloading' ? <ProgressBar progress={progress} /> : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radii.card,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  copy: {
    flex: 1,
  },
  text: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.caption,
  },
  detail: {
    color: darkTheme.error,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
    marginTop: 2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: darkTheme.secondary,
  },
});
