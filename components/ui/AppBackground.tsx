import React from 'react';
import { StyleSheet, View } from 'react-native';

import { darkTheme } from '@/constants/theme';

export const AppBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <View style={styles.root}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: darkTheme.background,
  },
});
