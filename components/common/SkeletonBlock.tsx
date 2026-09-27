import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { darkTheme, radii } from '@/constants/theme';

interface SkeletonBlockProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width = '100%',
  height = 20,
  borderRadius = radii.control,
}) => {
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [opacity]);

  const shimmer = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.outer, { width: width as number, height, borderRadius }]}>
      <Animated.View
        style={[
          styles.shimmer,
          { borderRadius },
          shimmer,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
    backgroundColor: darkTheme.surface,
  },
  shimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: darkTheme.surfaceElevated,
  },
});
