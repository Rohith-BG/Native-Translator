import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts as useInter } from '@expo-google-fonts/inter';
import { Outfit_600SemiBold, Outfit_700Bold, useFonts as useOutfit } from '@expo-google-fonts/outfit';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { darkTheme } from '@/constants/theme';
import { PreferencesProvider } from '@/hooks/usePreferences';
import { modelManager } from '@/services/litert/modelManager';

void SplashScreen.preventAutoHideAsync();

const RootLayout = () => {
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [outfitLoaded] = useOutfit({
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  const fontsReady = interLoaded && outfitLoaded;

  useEffect(() => {
    modelManager.ensureLifecycleWatch();
  }, []);

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: darkTheme.background }}>
      <ErrorBoundary>
        <PreferencesProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: darkTheme.background },
            }}
          >
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="settings"
              options={{
                headerShown: true,
                title: 'Settings',
                headerStyle: { backgroundColor: darkTheme.background },
                headerTintColor: darkTheme.textPrimary,
                headerTitleStyle: { fontFamily: 'Outfit_600SemiBold' },
                presentation: 'card',
              }}
            />
          </Stack>
        </PreferencesProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
