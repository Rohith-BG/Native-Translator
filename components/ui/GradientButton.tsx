import React, { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { darkTheme, motion, radii, type as typeScale } from '@/constants/theme';

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const GradientButton: React.FC<GradientButtonProps> = ({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
}) => {
  const inactive = disabled || loading;
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    if (!inactive) {
      scale.value = withTiming(0.97, { duration: motion.duration / 2 });
    }
  }, [inactive, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: motion.duration });
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.pressable, style, animatedStyle]}
    >
      <LinearGradient
        colors={inactive ? ['#3A3A55', '#2C2C40'] : [darkTheme.primary, '#4F46E5']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {loading ? (
          <LoadingSpinner size={22} color={darkTheme.textPrimary} />
        ) : (
          <View>
            <Text style={styles.label}>{label}</Text>
          </View>
        )}
      </LinearGradient>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    minHeight: 52,
    borderRadius: radii.control,
    overflow: 'hidden',
  },
  gradient: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.heading,
  },
});
