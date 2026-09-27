import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { darkTheme, motion, radii } from '@/constants/theme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  padding?: number;
  animate?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  padding = 20,
  animate = true,
  ...rest
}) => {
  const Wrapper = animate ? Animated.View : View;
  const enterProps = animate
    ? { entering: FadeInUp.duration(motion.duration + 120).damping(20).springify() }
    : {};

  return (
    <Wrapper style={[styles.card, { padding }, style]} {...enterProps} {...rest}>
      {children}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: darkTheme.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
});
