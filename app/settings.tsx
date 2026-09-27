import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Shield } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModelStatusBanner } from '@/components/common/ModelStatusBanner';
import { AppBackground } from '@/components/ui/AppBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { MODEL_DISPLAY_NAME, MODEL_FILE_SIZE_BYTES } from '@/constants/model';
import { darkTheme, radii, type as typeScale } from '@/constants/theme';
import { useModelStatus } from '@/hooks/useModelStatus';
import { usePreferences } from '@/hooks/usePreferences';

const sizeLabel = `${(MODEL_FILE_SIZE_BYTES / 1e9).toFixed(2)} GB`;

const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const { status, detail, progress, isReady, load, release } = useModelStatus();
  const { sourceLang, targetLang, setSourceLang, setTargetLang } = usePreferences();

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      >
        <Text style={styles.lede}>
          Translation never leaves this phone. The only download is the {MODEL_DISPLAY_NAME} model.
        </Text>

        <GlassCard>
          <Text style={styles.sectionTitle}>On-device model</Text>
          <Text style={styles.body}>
            {MODEL_DISPLAY_NAME} ({sizeLabel}) runs through LiteRT-LM. Download once, then work offline.
          </Text>
          <View style={styles.bannerWrap}>
            <ModelStatusBanner status={status} detail={detail} progress={progress} />
          </View>
          {isReady ? (
            <GradientButton label="Release from memory" onPress={release} />
          ) : (
            <GradientButton
              label={status === 'error' ? 'Retry download and load' : 'Download and load model'}
              onPress={() => {
                void load();
              }}
              loading={status === 'loading' || status === 'downloading'}
            />
          )}
        </GlassCard>

        <GlassCard>
          <Text style={styles.sectionTitle}>Default languages</Text>
          <View style={styles.langCol}>
            <LanguagePicker
              label="Default source"
              selectedCode={sourceLang}
              onSelect={setSourceLang}
              includeAutoDetect
            />
            <LanguagePicker label="Default target" selectedCode={targetLang} onSelect={setTargetLang} />
          </View>
        </GlassCard>

        {/* Privacy note */}
        <View style={styles.privacyRow}>
          <Shield color={darkTheme.textMuted} size={16} />
          <Text style={styles.privacyText}>
            All translation runs on-device via Gemma 4 E2B. No data is sent to any server.
          </Text>
        </View>

        <Text style={styles.version}>Native Translator v1.0.0</Text>
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  lede: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
  },
  sectionTitle: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.heading,
    marginBottom: 8,
  },
  body: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
    marginBottom: 16,
  },
  bannerWrap: {
    marginBottom: 16,
  },
  langCol: {
    gap: 12,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  privacyText: {
    flex: 1,
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  version: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 8,
  },
});

export default SettingsScreen;
