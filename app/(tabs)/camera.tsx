import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Camera, ImageIcon, Settings, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModelStatusBanner } from '@/components/common/ModelStatusBanner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { TranslationResult } from '@/components/translation/TranslationResult';
import { OCROverlay } from '@/components/translation/OCROverlay';
import { AppBackground } from '@/components/ui/AppBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { darkTheme, radii, type as typeScale } from '@/constants/theme';
import { useModelStatus } from '@/hooks/useModelStatus';
import { usePreferences } from '@/hooks/usePreferences';
import { useOCR } from '@/hooks/useOCR';
import { useTranslation } from '@/hooks/useTranslation';
import type { OCRResult } from '@/services/ocr/ocrService';

const CameraScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sourceLang, targetLang, setSourceLang, setTargetLang } = usePreferences();
  const { status, detail, progress, isReady, load } = useModelStatus();
  const { output, isStreaming, error: translationError, translate, reset } = useTranslation();
  const { phase: ocrPhase, result: ocrResult, error: ocrError, recognizeFromUri, resetOCR } = useOCR();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [displayDimensions, setDisplayDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const clearImage = useCallback(() => {
    setImageUri(null);
    setImageDimensions(null);
    resetOCR();
    reset();
  }, [resetOCR, reset]);

  const pickFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    clearImage();
    setImageUri(asset.uri);
    setImageDimensions({ width: asset.width, height: asset.height });
    void processImage(asset.uri);
  }, [clearImage]);

  const pickFromGallery = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    clearImage();
    setImageUri(asset.uri);
    setImageDimensions({ width: asset.width, height: asset.height });
    void processImage(asset.uri);
  }, [clearImage]);

  const processImage = async (uri: string) => {
    const ocrData = await recognizeFromUri(uri);
    if (ocrData && ocrData.fullText.trim()) {
      void translateExtractedText(ocrData);
    }
  };

  const translateExtractedText = async (data: OCRResult) => {
    if (!isReady) {
      void load();
      return;
    }
    reset();
    await translate(data.fullText, sourceLang, targetLang);
  };

  const onImageLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
      const { width, height } = event.nativeEvent.layout;
      setDisplayDimensions({ width, height });
    },
    [],
  );

  const retranslate = useCallback(() => {
    if (ocrResult) {
      void translateExtractedText(ocrResult);
    }
  }, [ocrResult, isReady, sourceLang, targetLang]);

  const error = ocrError || translationError;

  return (
    <AppBackground>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: 24 },
        ]}
      >
        {/* Header */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.title}>Image</Text>
            <Text style={styles.subtitle}>On-device OCR + Translation</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => router.push('/settings')}
            style={styles.settingsButton}
          >
            <Settings color={darkTheme.textPrimary} size={22} />
          </Pressable>
        </View>

        <ModelStatusBanner
          status={status}
          detail={detail}
          progress={progress}
          onAction={() => router.push('/settings')}
        />

        {/* Language Selectors */}
        <View style={styles.langRow}>
          <LanguagePicker
            label="From"
            selectedCode={sourceLang}
            onSelect={setSourceLang}
            includeAutoDetect
          />
          <LanguagePicker
            label="To"
            selectedCode={targetLang}
            onSelect={setTargetLang}
          />
        </View>

        {/* Image source buttons */}
        {!imageUri ? (
          <Animated.View entering={FadeInUp.duration(250)}>
            <GlassCard>
              <Text style={styles.sectionTitle}>Choose image source</Text>
              <Text style={styles.sectionBody}>
                Take a photo or pick from your gallery. Text will be extracted on-device and
                translated.
              </Text>
              <View style={styles.sourceButtons}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Take a photo"
                  onPress={pickFromCamera}
                  style={styles.sourceButton}
                >
                  <View style={styles.sourceIconWrap}>
                    <Camera color={darkTheme.primary} size={28} />
                  </View>
                  <Text style={styles.sourceButtonLabel}>Camera</Text>
                  <Text style={styles.sourceButtonHint}>Take a photo</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pick from gallery"
                  onPress={pickFromGallery}
                  style={styles.sourceButton}
                >
                  <View style={[styles.sourceIconWrap, styles.sourceIconGallery]}>
                    <ImageIcon color={darkTheme.secondary} size={28} />
                  </View>
                  <Text style={styles.sourceButtonLabel}>Gallery</Text>
                  <Text style={styles.sourceButtonHint}>Choose a photo</Text>
                </Pressable>
              </View>
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Image Preview with OCR Overlay */}
        {imageUri ? (
          <Animated.View entering={FadeInDown.duration(280)}>
            <GlassCard padding={0}>
              <View style={styles.imageHeader}>
                <Text style={styles.imageHeaderLabel}>
                  {ocrPhase === 'processing'
                    ? 'Extracting text…'
                    : ocrResult
                      ? `${ocrResult.blocks.length} text region${ocrResult.blocks.length !== 1 ? 's' : ''} found`
                      : 'Image'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove image"
                  onPress={clearImage}
                  style={styles.clearButton}
                >
                  <X color={darkTheme.textMuted} size={18} />
                </Pressable>
              </View>
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: imageUri }}
                  style={styles.image}
                  resizeMode="contain"
                  onLayout={onImageLayout}
                />
                {ocrResult && imageDimensions ? (
                  <OCROverlay
                    blocks={ocrResult.blocks}
                    imageWidth={imageDimensions.width}
                    imageHeight={imageDimensions.height}
                    displayWidth={displayDimensions.width}
                    displayHeight={displayDimensions.height}
                  />
                ) : null}
                {ocrPhase === 'processing' ? (
                  <View style={styles.ocrLoadingOverlay}>
                    <LoadingSpinner size={32} color={darkTheme.secondary} />
                    <Text style={styles.ocrLoadingText}>Running OCR…</Text>
                  </View>
                ) : null}
              </View>
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Extracted Text */}
        {ocrResult ? (
          <Animated.View entering={FadeInDown.duration(280)}>
            <GlassCard>
              <Text style={styles.extractedTitle}>Extracted Text</Text>
              <Text style={styles.extractedBody}>{ocrResult.fullText}</Text>
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Translate Button */}
        {ocrResult && !output ? (
          <GradientButton
            label={isReady ? 'Translate extracted text' : 'Load model to translate'}
            onPress={retranslate}
            loading={isStreaming || status === 'loading' || status === 'downloading'}
          />
        ) : null}

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Translation Result */}
        <TranslationResult text={output} isStreaming={isStreaming} />

        {/* New Image Buttons (after result) */}
        {imageUri ? (
          <View style={styles.newImageRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take another photo"
              onPress={pickFromCamera}
              style={styles.newImageButton}
            >
              <Camera color={darkTheme.secondary} size={18} />
              <Text style={styles.newImageLabel}>New photo</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pick another image"
              onPress={pickFromGallery}
              style={styles.newImageButton}
            >
              <ImageIcon color={darkTheme.secondary} size={18} />
              <Text style={styles.newImageLabel}>Gallery</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </AppBackground>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_700Bold',
    fontSize: 28,
    letterSpacing: -0.4,
  },
  subtitle: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.label,
    marginTop: 4,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.heading,
    marginBottom: 6,
  },
  sectionBody: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 22,
    marginBottom: 20,
  },
  sourceButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sourceButton: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: darkTheme.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
  },
  sourceIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: darkTheme.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sourceIconGallery: {
    backgroundColor: 'rgba(0, 217, 255, 0.15)',
  },
  sourceButtonLabel: {
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: typeScale.body,
    marginBottom: 4,
  },
  sourceButtonHint: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  imageHeaderLabel: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.label,
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: darkTheme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderBottomLeftRadius: radii.card,
    borderBottomRightRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  ocrLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 10, 15, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  ocrLoadingText: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.label,
  },
  extractedTitle: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.heading,
    marginBottom: 8,
  },
  extractedBody: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
  },
  error: {
    color: darkTheme.error,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.label,
    textAlign: 'center',
  },
  newImageRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  newImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.control,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
  },
  newImageLabel: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.label,
  },
});

export default CameraScreen;
