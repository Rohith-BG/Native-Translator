import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { FileText, Settings, Upload, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
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
import { AppBackground } from '@/components/ui/AppBackground';
import { GlassCard } from '@/components/ui/GlassCard';
import { GradientButton } from '@/components/ui/GradientButton';
import { LanguagePicker } from '@/components/ui/LanguagePicker';
import { darkTheme, radii, type as typeScale } from '@/constants/theme';
import { useModelStatus } from '@/hooks/useModelStatus';
import { usePreferences } from '@/hooks/usePreferences';
import { useDocumentTranslation, type ChunkProgress } from '@/hooks/useDocumentTranslation';
import {
  documentParser,
  type DocumentInfo,
  type ParsedDocument,
} from '@/services/document/documentParser';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const DOC_TYPE_LABELS: Record<string, string> = {
  txt: 'Plain Text',
  pdf: 'PDF Document',
  docx: 'Word Document',
  unknown: 'Unknown',
};

const ProgressIndicator: React.FC<{ progress: ChunkProgress; isTranslating: boolean }> = ({
  progress,
  isTranslating,
}) => {
  if (!isTranslating || progress.total <= 0) return null;

  const pct = Math.round((progress.current / progress.total) * 100);

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}>
        <LoadingSpinner size={16} color={darkTheme.secondary} />
        <Text style={styles.progressText}>
          Translating chunk {progress.current} of {progress.total}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: `${pct}%` }]}
        />
      </View>
    </View>
  );
};

const DocumentScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sourceLang, targetLang, setSourceLang, setTargetLang } = usePreferences();
  const { status, detail, progress: modelProgress, isReady, load } = useModelStatus();
  const {
    output,
    isTranslating,
    progress: chunkProgress,
    error: translationError,
    translateDocument,
    cancel,
    reset,
  } = useDocumentTranslation();

  const [docInfo, setDocInfo] = useState<DocumentInfo | null>(null);
  const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showFullExtracted, setShowFullExtracted] = useState(false);

  const clearDocument = useCallback(() => {
    setDocInfo(null);
    setParsedDoc(null);
    setParseError(null);
    setIsParsing(false);
    setShowFullExtracted(false);
    reset();
  }, [reset]);

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/plain',
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];
      clearDocument();

      const info = documentParser.buildDocumentInfo(
        asset.uri,
        asset.name,
        asset.size ?? 0,
        asset.mimeType ?? undefined,
      );
      setDocInfo(info);

      // Auto-parse
      setIsParsing(true);
      setParseError(null);

      try {
        const parsed = await documentParser.parse(info);
        setParsedDoc(parsed);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Failed to extract text from this file.';
        setParseError(message);
      } finally {
        setIsParsing(false);
      }
    } catch {
      setParseError('Could not open document picker.');
    }
  }, [clearDocument]);

  const onTranslate = useCallback(() => {
    if (!parsedDoc) return;
    if (!isReady) {
      void load();
      return;
    }
    void translateDocument(parsedDoc.text, sourceLang, targetLang);
  }, [parsedDoc, isReady, load, translateDocument, sourceLang, targetLang]);

  const error = parseError || translationError;

  // Truncated preview of extracted text
  const extractedPreview =
    parsedDoc && !showFullExtracted && parsedDoc.text.length > 600
      ? parsedDoc.text.slice(0, 600) + '…'
      : parsedDoc?.text ?? '';

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
            <Text style={styles.title}>Documents</Text>
            <Text style={styles.subtitle}>On-device · Chunk Translation</Text>
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
          progress={modelProgress}
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

        {/* File Picker */}
        {!docInfo ? (
          <Animated.View entering={FadeInUp.duration(250)}>
            <GlassCard>
              <Text style={styles.sectionTitle}>Choose a document</Text>
              <Text style={styles.sectionBody}>
                Pick a .txt, .pdf, or .docx file. Text will be extracted and translated in
                chunks to handle large documents.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pick a document"
                onPress={pickDocument}
                style={styles.pickButton}
              >
                <View style={styles.pickIconWrap}>
                  <Upload color={darkTheme.primary} size={28} />
                </View>
                <Text style={styles.pickLabel}>Choose File</Text>
                <Text style={styles.pickHint}>.txt · .pdf · .docx</Text>
              </Pressable>
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Document Info Card */}
        {docInfo ? (
          <Animated.View entering={FadeInDown.duration(250)}>
            <GlassCard>
              <View style={styles.docHeader}>
                <View style={styles.docIconWrap}>
                  <FileText color={darkTheme.secondary} size={24} />
                </View>
                <View style={styles.docMeta}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {docInfo.name}
                  </Text>
                  <Text style={styles.docDetail}>
                    {DOC_TYPE_LABELS[docInfo.docType] ?? 'Unknown'} · {formatFileSize(docInfo.size)}
                    {parsedDoc ? ` · ~${parsedDoc.pageCount} page${parsedDoc.pageCount !== 1 ? 's' : ''}` : ''}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove document"
                  onPress={clearDocument}
                  style={styles.clearButton}
                >
                  <X color={darkTheme.textMuted} size={18} />
                </Pressable>
              </View>

              {isParsing ? (
                <View style={styles.parsingRow}>
                  <LoadingSpinner size={18} color={darkTheme.secondary} />
                  <Text style={styles.parsingText}>Extracting text…</Text>
                </View>
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Extracted Text Preview */}
        {parsedDoc ? (
          <Animated.View entering={FadeInDown.duration(280)}>
            <GlassCard>
              <View style={styles.extractedHeader}>
                <Text style={styles.extractedTitle}>Extracted Text</Text>
                <Text style={styles.extractedCount}>
                  {parsedDoc.text.length.toLocaleString()} chars
                </Text>
              </View>
              <Text style={styles.extractedBody}>{extractedPreview}</Text>
              {parsedDoc.text.length > 600 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowFullExtracted((prev) => !prev)}
                  style={styles.showMore}
                >
                  <Text style={styles.showMoreText}>
                    {showFullExtracted ? 'Show less' : 'Show full text'}
                  </Text>
                </Pressable>
              ) : null}
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Translate / Cancel Button */}
        {parsedDoc && !isTranslating ? (
          <GradientButton
            label={isReady ? 'Translate document' : 'Load model to translate'}
            onPress={onTranslate}
            loading={status === 'loading' || status === 'downloading'}
          />
        ) : null}

        {isTranslating ? (
          <GradientButton label="Cancel translation" onPress={cancel} />
        ) : null}

        {/* Progress Indicator */}
        <ProgressIndicator progress={chunkProgress} isTranslating={isTranslating} />

        {/* Error */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Translation Output */}
        {output ? (
          <Animated.View entering={FadeInDown.duration(280)}>
            <GlassCard>
              <View style={styles.outputHeader}>
                <Text style={styles.outputTitle}>Translation</Text>
                {chunkProgress.total > 1 ? (
                  <Text style={styles.outputChunkInfo}>
                    {chunkProgress.current}/{chunkProgress.total} chunks
                  </Text>
                ) : null}
              </View>
              <Text style={styles.outputBody}>{output}</Text>
            </GlassCard>
          </Animated.View>
        ) : null}

        {/* Pick Another */}
        {docInfo ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose another document"
            onPress={pickDocument}
            style={styles.newDocButton}
          >
            <Upload color={darkTheme.secondary} size={18} />
            <Text style={styles.newDocLabel}>Choose another file</Text>
          </Pressable>
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
  pickButton: {
    alignItems: 'center',
    padding: 28,
    backgroundColor: darkTheme.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    borderStyle: 'dashed',
  },
  pickIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: darkTheme.primaryGlow,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pickLabel: {
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: typeScale.body,
    marginBottom: 4,
  },
  pickHint: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  docIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 217, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docMeta: {
    flex: 1,
  },
  docName: {
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: typeScale.body,
  },
  docDetail: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
    marginTop: 2,
  },
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: darkTheme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parsingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  parsingText: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.label,
  },
  extractedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  extractedTitle: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.heading,
  },
  extractedCount: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
  },
  extractedBody: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 22,
  },
  showMore: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  showMoreText: {
    color: darkTheme.secondary,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.label,
  },
  progressWrap: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.label,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: darkTheme.secondary,
  },
  error: {
    color: darkTheme.error,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.label,
    textAlign: 'center',
  },
  outputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  outputTitle: {
    color: darkTheme.textPrimary,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: typeScale.heading,
  },
  outputChunkInfo: {
    color: darkTheme.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.caption,
  },
  outputBody: {
    color: darkTheme.textPrimary,
    fontFamily: 'Inter_400Regular',
    fontSize: typeScale.body,
    lineHeight: 24,
  },
  newDocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.control,
    backgroundColor: darkTheme.surface,
    borderWidth: 1,
    borderColor: darkTheme.surfaceBorder,
    alignSelf: 'center',
  },
  newDocLabel: {
    color: darkTheme.textSecondary,
    fontFamily: 'Inter_500Medium',
    fontSize: typeScale.label,
  },
});

export default DocumentScreen;
