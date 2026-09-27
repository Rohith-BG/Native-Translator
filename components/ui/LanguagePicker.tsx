import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDown } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AUTO_DETECT, SUPPORTED_LANGUAGES, type Language } from '@/constants/languages';
import { darkTheme, motion, radii, type as typeScale } from '@/constants/theme';

interface LanguagePickerProps {
  label: string;
  selectedCode: string;
  onSelect: (code: string) => void;
  includeAutoDetect?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  label,
  selectedCode,
  onSelect,
  includeAutoDetect = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const chevronRotation = useSharedValue(0);

  useEffect(() => {
    chevronRotation.value = withTiming(open ? 180 : 0, { duration: motion.duration });
  }, [open, chevronRotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const options = useMemo(() => {
    const base = includeAutoDetect ? [AUTO_DETECT, ...SUPPORTED_LANGUAGES] : SUPPORTED_LANGUAGES;
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return base;
    }
    return base.filter(
      (language) =>
        language.name.toLowerCase().includes(normalized) ||
        language.nativeName.toLowerCase().includes(normalized) ||
        language.code.includes(normalized),
    );
  }, [includeAutoDetect, query]);

  const selected = useMemo(() => {
    if (selectedCode === AUTO_DETECT.code) {
      return AUTO_DETECT;
    }
    return SUPPORTED_LANGUAGES.find((language) => language.code === selectedCode);
  }, [selectedCode]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.name ?? 'Choose language'}`}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <View>
          <Text style={styles.triggerLabel}>{label}</Text>
          <Text style={styles.triggerValue} numberOfLines={1}>
            {selected?.name ?? 'Choose'}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <ChevronDown color={darkTheme.secondary} size={18} />
        </Animated.View>
      </Pressable>

      <Modal animationType="none" transparent visible={open} onRequestClose={close}>
        <View style={styles.modalRoot}>
          {/* Animated backdrop */}
          <AnimatedPressable
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={[StyleSheet.absoluteFill, styles.backdrop]}
            onPress={close}
            accessibilityLabel="Dismiss"
          />

          {/* Animated sheet */}
          <Animated.View
            entering={SlideInDown.duration(320).easing(Easing.out(Easing.cubic))}
            exiting={SlideOutDown.duration(220)}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search languages"
              placeholderTextColor={darkTheme.textMuted}
              selectionColor={darkTheme.secondary}
              style={styles.search}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={options}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }: { item: Language }) => {
                const active = item.code === selectedCode;
                return (
                  <Pressable
                    onPress={() => {
                      onSelect(item.code);
                      close();
                    }}
                    style={[styles.row, active && styles.rowActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowNative}>{item.nativeName}</Text>
                  </Pressable>
                );
              }}
            />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    backgroundColor: darkTheme.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  triggerLabel: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.caption,
    marginBottom: 2,
  },
  triggerValue: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.body,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: darkTheme.overlay,
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: '#12121A',
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: darkTheme.textMuted,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetTitle: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.title,
    marginBottom: 12,
  },
  search: {
    minHeight: 48,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    backgroundColor: darkTheme.surface,
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  row: {
    minHeight: 52,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: darkTheme.surfaceBorder,
  },
  rowActive: {
    backgroundColor: darkTheme.primaryGlow,
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: radii.control,
  },
  rowName: {
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: typeScale.body,
  },
  rowNative: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
    marginTop: 2,
  },
});
