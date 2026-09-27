import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/GlassCard';
import { darkTheme, type as typeScale } from '@/constants/theme';

interface ComingSoonProps {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  body: string;
}

export const ComingSoon: React.FC<ComingSoonProps> = ({ icon: Icon, title, body }) => {
  return (
    <View style={styles.wrap}>
      <GlassCard>
        <View style={styles.iconWrap}>
          <Icon color={darkTheme.secondary} size={28} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </GlassCard>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: darkTheme.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.title,
    marginBottom: 8,
  },
  body: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
  },
});
