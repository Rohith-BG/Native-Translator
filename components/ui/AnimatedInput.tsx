import React, { useCallback, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { darkTheme, motion, radii, type as typeScale } from '@/constants/theme';

interface AnimatedInputProps extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export const AnimatedInput: React.FC<AnimatedInputProps> = ({
  value,
  onChangeText,
  style,
  ...rest
}) => {
  const focus = useSharedValue(0);

  const onFocus = useCallback(() => {
    focus.value = withTiming(1, { duration: motion.duration });
  }, [focus]);

  const onBlur = useCallback(() => {
    focus.value = withTiming(0, { duration: motion.duration });
  }, [focus]);

  const glowStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      focus.value,
      [0, 1],
      ['rgba(255,255,255,0.06)', 'rgba(0,217,255,0.45)'],
    );
    return {
      borderColor,
      shadowOpacity: focus.value * 0.35,
    };
  });

  return (
    <Animated.View style={[styles.wrapper, glowStyle]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholderTextColor={darkTheme.textMuted}
        selectionColor={darkTheme.secondary}
        cursorColor={darkTheme.secondary}
        style={[styles.input, style]}
        textAlignVertical="top"
        {...rest}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 12,
    shadowColor: darkTheme.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    shadowOpacity: 0,
    elevation: 0,
  },
  input: {
    minHeight: 120,
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
    padding: 0,
  },
});
