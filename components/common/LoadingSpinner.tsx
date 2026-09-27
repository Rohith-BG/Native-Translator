import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { darkTheme } from '@/constants/theme';

interface LoadingSpinnerProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 28,
  color = darkTheme.secondary,
  strokeWidth = 3,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(rotation);
    };
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const innerSize = size - strokeWidth * 2;

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          animatedStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: 'rgba(255,255,255,0.1)',
            borderTopColor: color,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
