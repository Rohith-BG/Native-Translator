import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { darkTheme } from '@/constants/theme';

interface VoiceWaveformProps {
  active: boolean;
  volumeDb: number;
  color?: string;
}

const BAR_COUNT = 5;
const BAR_WIDTH = 4;
const BAR_GAP = 5;
const MIN_BAR_HEIGHT = 6;
const MAX_BAR_HEIGHT = 40;

const WaveBar: React.FC<{ index: number; active: boolean; volumeDb: number; color: string }> = ({
  index,
  active,
  volumeDb,
  color,
}) => {
  const height = useSharedValue(MIN_BAR_HEIGHT);

  useEffect(() => {
    if (!active) {
      cancelAnimation(height);
      height.value = withTiming(MIN_BAR_HEIGHT, { duration: 200 });
      return;
    }

    // Volume-based height with per-bar variation
    const normVolume = Math.max(0, Math.min(1, (volumeDb + 60) / 60));
    const variation = 0.5 + Math.sin(index * 1.3) * 0.5;
    const target =
      MIN_BAR_HEIGHT + (MAX_BAR_HEIGHT - MIN_BAR_HEIGHT) * normVolume * (0.4 + variation * 0.6);

    height.value = withSpring(target, {
      damping: 12,
      stiffness: 180,
      mass: 0.6,
    });
  }, [active, volumeDb, height, index]);

  // Idle pulse when active but no volume data
  useEffect(() => {
    if (active && volumeDb <= -60) {
      const delay = index * 120;
      const baseHeight = MIN_BAR_HEIGHT + 8;
      height.value = withRepeat(
        withSequence(
          withTiming(baseHeight + 10, {
            duration: 400 + delay,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(baseHeight, {
            duration: 400 + delay,
            easing: Easing.inOut(Easing.ease),
          }),
        ),
        -1,
        true,
      );
    }
  }, [active, volumeDb, height, index]);

  const barStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          width: BAR_WIDTH,
          backgroundColor: color,
          borderRadius: BAR_WIDTH / 2,
        },
        barStyle,
      ]}
    />
  );
};

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  active,
  volumeDb,
  color = darkTheme.secondary,
}) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <WaveBar key={i} index={i} active={active} volumeDb={volumeDb} color={color} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BAR_GAP,
    height: MAX_BAR_HEIGHT + 4,
  },
  bar: {
    // Dynamic height set via animated style
  },
});
