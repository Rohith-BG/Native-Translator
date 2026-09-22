# Native-Translator — Agent Guidelines

> **Local-first, on-device language translation app** powered by **Gemma 4 E2B** via **LiteRT-LM**.
> Android-first, iOS to follow. No cloud APIs. All AI runs on the user's device.

---

## 1. Project Overview

**Native-Translator** is a cross-platform mobile application that translates text, voice, images, and documents — entirely on-device. It uses the **Gemma 4 E2B** model running locally through **LiteRT-LM** for all translation tasks. The app prioritizes **privacy**, **offline capability**, and **zero cloud dependency** for inference.

### Core Translation Modes

| Mode | Input | Output | Key Tech |
|---|---|---|---|
| **Text → Text** | Typed text | Translated text | LiteRT-LM (Gemma 4 E2B) |
| **Voice → Voice** | Spoken audio | Spoken translated audio | `expo-speech-recognition` → LiteRT-LM → `expo-speech` (TTS) |
| **Image → Text** | Camera / gallery image | Extracted + translated text | `expo-mlkit-ocr` → LiteRT-LM |
| **Document → Text** | Uploaded document (PDF, DOCX, etc.) | Translated document content | Document parser → LiteRT-LM |

### Supported Languages

All languages supported by the **Gemma 4 E2B** model. The model supports **55+ languages** via its TranslateGemma training lineage. Do NOT hardcode a language list — query the model's capabilities or maintain a configurable list that can be updated.

---

## 2. Tech Stack

### Core Framework

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Framework** | React Native + Expo | RN **0.86** / Expo SDK **57** | Managed workflow with development builds (NOT Expo Go) |
| **Language** | TypeScript | **5.x** (bundled with Expo SDK 57) | Strict mode enabled. No `any` types unless absolutely necessary |
| **React** | React | **19.2** | Bundled with Expo SDK 57 |
| **Min Android SDK** | 26 | — | Required by LiteRT-LM |
| **Target Android SDK** | 35 | — | Required by Google Play as of 2026 |
| **Min iOS Version** | 15.0 | — | Required for Metal GPU acceleration |

### Version Pinning (Critical — Do NOT Deviate)

> **Always verify versions before starting a new project.** Mismatched versions are the #1 cause of build failures.

| Dependency | Pinned Version | Why |
|---|---|---|
| Expo SDK | **57** | Latest stable (released June 2026). SDK 58 is beta — do NOT use it. |
| React Native | **0.86** | Bundled with Expo SDK 57. Do NOT manually upgrade to 0.87. |
| React | **19.2** | Bundled with Expo SDK 57. |
| Android Gradle Plugin (AGP) | **9.4.0** | Latest stable (Sep 2026). Requires Gradle 9.6+. |
| Gradle | **9.6.0+** | Required by AGP 9.4.0. Set in `gradle-wrapper.properties`. |
| SDK Build Tools | **36.0.0** | Required by AGP 9.4.0. |
| Java/JDK | **21** | Required for AGP 9.x. Use Temurin or Corretto. |
| Node.js | **20 LTS** or **22 LTS** | Required by Expo CLI. |

**To verify your dependencies match Expo SDK 57 after install:**
```bash
npx expo install --fix   # Auto-fix all dependency versions to SDK 57 compatible
npx expo-doctor          # Diagnose any version mismatches
```

### Key Dependencies

```
react-native-litert-lm     — On-device Gemma 4 E2B inference via JSI/Nitro Modules
react-native-nitro-modules — High-performance native bridge (zero-copy buffers)
expo-speech-recognition     — Native STT (SFSpeechRecognizer on iOS, SpeechRecognizer on Android)
expo-speech                 — Native TTS for reading translations aloud
expo-mlkit-ocr              — On-device OCR (Google ML Kit on Android, Apple Vision on iOS)
expo-document-picker        — Document selection from device storage
expo-camera                 — Camera access for image capture
expo-image-picker           — Gallery image selection
react-native-reanimated     — High-performance animations (Reanimated 4.x for SDK 57)
```

### Build & Development

- **Build System**: EAS Build (`eas build`) for both platforms
- **Development**: `npx expo prebuild` → `npx expo run:android` / `npx expo run:ios`
- **Cannot use Expo Go** — native JSI bindings require development builds
- **New Architecture**: Enabled by default in RN 0.86+ (TurboModules / Nitro Modules)
- **Model Format**: `.litertlm` (sourced from Hugging Face `litert-community` repos)

---

## 3. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Native UI                       │
│              (TypeScript + Expo Components)               │
├──────────┬──────────┬──────────────┬────────────────────┤
│  Text    │  Voice   │    Image     │    Document        │
│  Input   │  Input   │    Input     │    Input           │
│          │          │              │                    │
│          │  STT     │   OCR        │   Doc Parser       │
│          │ (expo-   │ (expo-       │ (custom parser     │
│          │ speech-  │  mlkit-ocr)  │  for PDF/DOCX)     │
│          │ recogn.) │              │                    │
├──────────┴──────────┴──────────────┴────────────────────┤
│              Translation Service Layer                    │
│         (Prompt construction + language routing)          │
├─────────────────────────────────────────────────────────┤
│                   LiteRT-LM Engine                       │
│            (react-native-litert-lm via JSI)              │
│                  Gemma 4 E2B Model                       │
│          GPU: Metal (iOS) / OpenCL (Android)             │
├─────────────────────────────────────────────────────────┤
│                 Device Hardware                          │
│           CPU / GPU / NPU (auto-detected)                │
└─────────────────────────────────────────────────────────┘
```

### Directory Structure

```
Native-Translator/
├── app/                        # Expo Router screens
│   ├── (tabs)/                 # Tab-based navigation
│   │   ├── text.tsx            # Text translation screen
│   │   ├── voice.tsx           # Voice translation screen
│   │   ├── camera.tsx          # Image/camera translation screen
│   │   └── document.tsx        # Document translation screen
│   ├── _layout.tsx             # Root layout with tab navigator
│   └── settings.tsx            # Language preferences, model management
├── components/                 # Reusable UI components
│   ├── ui/                     # Design system primitives
│   │   ├── GlassCard.tsx       # Glassmorphism card component
│   │   ├── GradientButton.tsx  # Gradient-styled buttons
│   │   ├── AnimatedInput.tsx   # Animated text input
│   │   └── LanguagePicker.tsx  # Language selection dropdown
│   ├── translation/            # Translation-specific components
│   │   ├── TranslationResult.tsx
│   │   ├── VoiceWaveform.tsx   # Audio visualization
│   │   └── OCROverlay.tsx      # Image text highlight overlay
│   └── common/                 # Shared components
│       ├── LoadingSpinner.tsx
│       └── ErrorBoundary.tsx
├── services/                   # Core business logic
│   ├── litert/                 # LiteRT-LM wrapper
│   │   ├── modelManager.ts     # Model loading, memory, lifecycle
│   │   ├── translationEngine.ts # Prompt templates + inference calls
│   │   └── types.ts            # LiteRT-LM type definitions
│   ├── speech/                 # Voice pipeline
│   │   ├── speechToText.ts     # STT service wrapper
│   │   └── textToSpeech.ts     # TTS service wrapper
│   ├── ocr/                    # Image text extraction
│   │   └── ocrService.ts       # ML Kit OCR wrapper
│   └── document/               # Document parsing
│       └── documentParser.ts   # PDF/DOCX text extraction
├── hooks/                      # Custom React hooks
│   ├── useTranslation.ts       # Translation state management
│   ├── useModelStatus.ts       # Model loading/readiness hook
│   ├── useSpeechRecognition.ts # Voice input hook
│   └── useOCR.ts               # OCR hook
├── constants/                  # App-wide constants
│   ├── languages.ts            # Supported language definitions
│   ├── theme.ts                # Design tokens (colors, spacing, etc.)
│   └── prompts.ts              # Translation prompt templates
├── utils/                      # Utility functions
│   ├── languageDetect.ts       # Auto-detect source language
│   └── textChunker.ts          # Split long text for model context limits
├── assets/                     # Static assets (fonts, icons, images)
├── app.json                    # Expo configuration
├── tsconfig.json               # TypeScript configuration
├── eas.json                    # EAS Build configuration
└── AGENTS.md                   # This file
```

---

## 4. Design System

### Visual Identity

- **Design Language**: Glassmorphism with modern trendy aesthetics
- **Theme**: Dark mode primary, light mode secondary
- **Typography**: Google Fonts — `Inter` for body, `Outfit` for headings
- **Border Radius**: Generous (16px–24px for cards, 12px for buttons)
- **Shadows**: Soft, layered shadows for depth
- **Animations**: Smooth micro-animations on all interactions (300ms ease-out default)

### Color Palette

```typescript
// Dark theme (primary)
const darkTheme = {
  background: '#0A0A0F',           // Near-black with blue tint
  surface: 'rgba(255,255,255,0.05)', // Glass surface
  surfaceBorder: 'rgba(255,255,255,0.1)',
  primary: '#6C63FF',              // Vibrant purple
  primaryGlow: 'rgba(108,99,255,0.3)',
  secondary: '#00D9FF',            // Cyan accent
  success: '#00E676',              // Translation complete
  error: '#FF5252',                // Error state
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
};
```

### Glassmorphism Implementation

All card-like containers must use:
- `backgroundColor: 'rgba(255, 255, 255, 0.05)'`
- `backdropFilter: 'blur(20px)'` (where supported, else use `@react-native-community/blur`)
- `borderWidth: 1` with `borderColor: 'rgba(255, 255, 255, 0.1)'`
- Subtle gradient overlays for visual richness

### Animation Guidelines

- Use `react-native-reanimated` for all animations
- Translation results should animate in with a slide-up + fade
- Voice waveform should be a real-time animated visualization
- Language picker should have a smooth dropdown transition
- Loading states should use skeleton screens, not spinners (except for active translation)

---

## 5. Feature Specifications

### 5.1 Text-to-Text Translation

**Priority**: P0 (Build first)

**Flow**:
1. User selects source language (or "Auto-detect")
2. User selects target language
3. User types or pastes text
4. App sends prompt to Gemma 4 E2B via LiteRT-LM
5. Translated text streams in token-by-token
6. User can copy result or swap languages

**Prompt Template**:
```
Translate the following text from {sourceLang} to {targetLang}. 
Output ONLY the translation, nothing else.

Text: {inputText}
```

**Critical Requirements**:
- Always use streaming API for token-by-token output (responsive UX)
- Auto-detect source language when "Auto-detect" is selected
- Swap button to reverse source ↔ target languages
- Copy-to-clipboard for translated output
- Character count with model context limit warning

### 5.2 Voice-to-Voice Translation

**Priority**: P1

**Flow**:
1. User taps mic button → starts recording
2. `expo-speech-recognition` converts speech to text (STT)
3. Recognized text displayed in source panel
4. Text sent to Gemma 4 E2B for translation
5. Translated text displayed in target panel
6. `expo-speech` reads the translation aloud (TTS)

**Critical Requirements**:
- Real-time waveform visualization during recording
- Interim/partial STT results shown while speaking
- Auto-stop recording after silence detection
- TTS should use the target language's native voice
- Clear visual states: Idle → Listening → Processing → Speaking

### 5.3 Image-to-Text Translation

**Priority**: P1

**Flow**:
1. User captures photo or selects from gallery
2. `expo-mlkit-ocr` extracts text from image (on-device)
3. Extracted text shown with bounding box overlay on image
4. Extracted text sent to Gemma 4 E2B for translation
5. Translated text displayed below

**Critical Requirements**:
- Support both camera capture and gallery selection
- Show OCR bounding boxes overlaid on the original image
- Handle multi-line and multi-block text extraction
- Graceful error if no text detected in image
- Support for printed text (handwriting recognition is best-effort)

### 5.4 Document Translation

**Priority**: P2

**Flow**:
1. User picks a document (PDF, DOCX, TXT)
2. App extracts text content from the document
3. Text is chunked to fit model context window
4. Each chunk translated sequentially via Gemma 4 E2B
5. Full translated document displayed with progress indicator

**Critical Requirements**:
- Support at minimum: `.txt`, `.pdf`, `.docx`
- Chunk long documents to fit model context limits (use overlap for coherence)
- Show translation progress (e.g., "Translating page 3 of 12...")
- Handle large documents without OOM — translate chunk by chunk, don't load all at once

---

## 6. LiteRT-LM Integration Rules

### Model Lifecycle

```typescript
// Initialization pattern — follow this exactly
import { LiteRTLM } from 'react-native-litert-lm';

// 1. Load model (do this ONCE, ideally on app launch or first use)
const model = await LiteRTLM.loadModel({
  modelPath: '/path/to/gemma-4-e2b.litertlm',
  maxTokens: 2048,
  // GPU acceleration is auto-detected — do NOT manually configure delegates
});

// 2. Use streaming for all inference
const stream = model.streamGenerate({
  prompt: translationPrompt,
  temperature: 0.1,  // Low temperature for translation accuracy
  topK: 40,
  topP: 0.95,
});

for await (const token of stream) {
  // Update UI token-by-token
}

// 3. Release model when app backgrounds (prevent OS kill)
AppState.addEventListener('change', (state) => {
  if (state === 'background') model.release();
  if (state === 'active') model.reload();
});
```

### Memory Management Rules

- **ALWAYS** release the model when the app goes to background
- **NEVER** load multiple models simultaneously
- **ALWAYS** use streaming API — never block the JS thread waiting for full generation
- Monitor memory usage — if RSS exceeds 70% of device RAM, warn the user
- Model download should happen on first launch with a clear progress UI

### Model Download Strategy

- Models are **NOT bundled** in the app binary (too large)
- On first launch, prompt user to download the Gemma 4 E2B model
- Download from Hugging Face `litert-community` repos
- Store in app's local documents directory
- Show download progress with size estimate
- Allow resumable downloads for poor network conditions

---

## 7. Offline Behavior

- **Translation**: Works fully offline once model is downloaded
- **STT (Speech-to-Text)**: Works offline (uses OS-native speech recognition)
- **TTS (Text-to-Speech)**: Works offline (uses OS-native speech synthesis)
- **OCR**: Works offline (ML Kit / Apple Vision run on-device)
- **Model Download**: Requires internet (one-time download)
- **App Updates**: Require internet (via Expo OTA or store updates)

The app must clearly communicate to the user:
- Whether the model is downloaded and ready
- If a feature requires internet (only model download)
- Current model status (loading, ready, error)

---

## 8. Coding Conventions

### TypeScript Standards

```typescript
// ✅ DO: Use explicit types, interfaces for all data structures
interface TranslationRequest {
  sourceText: string;
  sourceLang: LanguageCode;
  targetLang: LanguageCode;
}

// ✅ DO: Use enums or union types for fixed sets
type TranslationMode = 'text' | 'voice' | 'image' | 'document';

// ❌ DON'T: Use `any` — use `unknown` if the type is truly unknown
// ❌ DON'T: Use default exports — use named exports everywhere
export { TranslationService };  // ✅
export default TranslationService;  // ❌
```

### Component Patterns

```typescript
// ✅ DO: Functional components with typed props
interface Props {
  sourceText: string;
  onTranslate: (result: string) => void;
}

export const TranslationInput: React.FC<Props> = ({ sourceText, onTranslate }) => {
  // ...
};

// ✅ DO: Keep components focused — one responsibility per component
// ✅ DO: Extract business logic into hooks (hooks/) or services (services/)
// ✅ DO: Use React.memo() for expensive list items
// ❌ DON'T: Put API/inference calls directly in components
```

### Error Handling

```typescript
// ✅ DO: Wrap all LiteRT-LM calls in try-catch
try {
  const result = await translationEngine.translate(request);
} catch (error) {
  if (error instanceof ModelNotLoadedError) {
    // Prompt user to download/load model
  } else if (error instanceof OutOfMemoryError) {
    // Release model, show memory warning
  } else {
    // Generic error with user-friendly message
  }
}

// ✅ DO: Define custom error classes in a central errors.ts
// ❌ DON'T: Silently swallow errors
// ❌ DON'T: Show raw error messages to users
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `GlassCard.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useTranslation.ts`)
- Services: `camelCase.ts` (e.g., `translationEngine.ts`)
- Constants: `camelCase.ts` (e.g., `languages.ts`)
- Types/Interfaces: `PascalCase` within files, co-located or in `types.ts`

### Import Order

```typescript
// 1. React / React Native
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 2. Third-party libraries
import Animated, { useSharedValue } from 'react-native-reanimated';

// 3. Internal modules (absolute paths via tsconfig aliases)
import { TranslationService } from '@/services/litert/translationEngine';
import { useTranslation } from '@/hooks/useTranslation';

// 4. Components
import { GlassCard } from '@/components/ui/GlassCard';

// 5. Constants, types, utils
import { darkTheme } from '@/constants/theme';
import type { TranslationRequest } from '@/services/litert/types';
```

---

## 9. Testing Strategy

### Unit Tests
- Test all service layer functions (translation engine, OCR service, document parser)
- Test custom hooks with `@testing-library/react-hooks`
- Test utility functions (language detection, text chunking)
- Mock `react-native-litert-lm` for unit tests

### Integration Tests
- Test full translation flow: input → LiteRT-LM → output
- Test voice pipeline: STT → translate → TTS
- Test OCR pipeline: image → OCR → translate
- Use the example app pattern from `react-native-litert-lm` for hardware testing

### On-Device Testing
- **ALWAYS** test on real devices — emulators lack GPU acceleration
- Test on low-end Android devices (4GB RAM) to verify memory management
- Test with airplane mode enabled to verify offline functionality

---

## 10. Performance Guidelines

- **Streaming is mandatory**: All LiteRT-LM inference must use streaming output
- **Lazy load screens**: Only load heavy components (camera, OCR) when navigated to
- **Debounce text input**: Don't trigger translation on every keystroke — debounce 500ms
- **Chunk large documents**: Never send more than the model's context window at once
- **Image compression**: Compress images before OCR to reduce processing time
- **Background model release**: Always release the model when app backgrounds
- **Skeleton screens**: Show skeleton loading states, not blank screens
- **Measure cold start**: App should be usable within 2 seconds (excluding model load)

---

## 11. Platform-Specific Notes

### Android (Primary Target)
- Min SDK: 26
- GPU acceleration via OpenCL (auto-detected by LiteRT-LM)
- Use `expo-mlkit-ocr` with Google ML Kit for OCR
- STT via Android `SpeechRecognizer`
- TTS via Android `TextToSpeech`

### iOS (Secondary Target — Future)
- Min iOS: 15.0
- GPU acceleration via Metal/MPS (auto-detected by LiteRT-LM)
- OCR via Apple Vision framework
- STT via `SFSpeechRecognizer`
- TTS via `AVSpeechSynthesizer`

---

## 12. Security & Privacy

- **No data leaves the device** — all inference is local
- **No analytics** that capture translated content
- **No cloud APIs** for translation — the app works without internet (post model download)
- Camera and microphone permissions must be requested just-in-time with clear explanations
- Model files stored in the app's private documents directory (not accessible to other apps)

---

## 13. Common Pitfalls — Avoid These

| Pitfall | Why It's Wrong | Do This Instead |
|---|---|---|
| Using Expo Go for development | JSI/Nitro bindings don't work in Expo Go | Use `npx expo run:android` dev builds |
| Bundling model in APK/IPA | Model is too large (2GB+) | Download on first launch |
| Blocking JS thread during inference | UI freezes | Always use streaming API |
| Loading model on every translation | Slow, wasteful | Load once, keep in memory |
| Hardcoding language list | Model may support more/fewer | Use configurable list |
| Using `any` types | Defeats TypeScript's purpose | Use proper types or `unknown` |
| Ignoring memory pressure | OS will kill the app | Monitor + release on background |
| Testing only on emulator | No GPU = unrealistic perf | Always test on real devices |

---

## 14. Version Compatibility & Build Configuration

### Gradle Configuration (Android)

After running `npx expo prebuild`, verify and update these files:

**`android/gradle/wrapper/gradle-wrapper.properties`:**
```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-9.6-bin.zip
```

**`android/build.gradle` (project-level):**
```groovy
buildscript {
    ext {
        minSdkVersion = 26
        targetSdkVersion = 35
        compileSdkVersion = 35
    }
}

plugins {
    id 'com.android.application' version '9.4.0' apply false
}
```

### app.json Configuration

```json
{
  "expo": {
    "name": "Native-Translator",
    "slug": "native-translator",
    "version": "1.0.0",
    "sdkVersion": "57.0.0",
    "newArchEnabled": true,
    "plugins": [
      "react-native-litert-lm",
      "expo-camera",
      "expo-speech-recognition",
      [
        "expo-document-picker",
        { "iCloudContainerEnvironment": "Production" }
      ]
    ],
    "android": {
      "minSdkVersion": 26,
      "targetSdkVersion": 35,
      "compileSdkVersion": 35,
      "package": "com.nativetranslator.app"
    },
    "ios": {
      "bundleIdentifier": "com.nativetranslator.app",
      "supportsTablet": true
    }
  }
}
```

### Troubleshooting Build Failures

| Symptom | Cause | Fix |
|---|---|---|
| `Could not find com.android.tools.build:gradle:X.X.X` | AGP version mismatch | Update AGP to `9.4.0` in `build.gradle` |
| `Unsupported class file major version 65` | Wrong JDK version | Install and use JDK 21 |
| `Execution failed for task ':app:mergeDebugNativeLibs'` | Native lib conflict | Run `cd android && ./gradlew clean` then rebuild |
| `Unable to resolve module 'react-native-litert-lm'` | Missing native code | Run `npx expo prebuild --clean` |
| `SDK version mismatch` | Dependencies pinned to wrong SDK | Run `npx expo install --fix` |
| Duplicate class errors | Outdated dependency cache | Delete `node_modules`, `android/build`, reinstall |

---

## 15. Development Workflow

### Initial Setup
```bash
# 1. Verify prerequisites
node --version    # Must be 20.x or 22.x LTS
java --version    # Must be JDK 21

# 2. Create Expo project (SDK 57 — latest stable)
npx -y create-expo-app@latest ./

# 3. Install core dependencies
npm install react-native-litert-lm react-native-nitro-modules
npm install expo-speech-recognition expo-speech
npm install expo-mlkit-ocr expo-camera expo-image-picker expo-document-picker
npm install react-native-reanimated

# 4. Fix all dependency versions to match SDK 57
npx expo install --fix

# 5. Verify no version mismatches
npx expo-doctor

# 6. Configure app.json (see section above for full config)
# Key: plugins, minSdkVersion: 26, newArchEnabled: true

# 7. Prebuild native projects
npx expo prebuild --clean

# 8. Verify Gradle version (android/gradle/wrapper/gradle-wrapper.properties)
# Must be gradle-9.6-bin.zip or later

# 9. Run on physical device (NOT emulator for GPU testing)
npx expo run:android
```

### Build Order (Features)
1. **Phase 1**: Project setup + design system + text-to-text translation
2. **Phase 2**: Voice-to-voice translation
3. **Phase 3**: Image-to-text translation (camera + OCR)
4. **Phase 4**: Document translation
5. **Phase 5**: Polish, animations, edge cases, performance optimization
