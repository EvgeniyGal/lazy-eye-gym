import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppProvider, useAppStore } from '@/src/state/AppStore';
import { colors } from '@/src/theme/tokens';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    primary: colors.primary,
    text: colors.onSurface,
    border: colors.outlineVariant,
  },
};

function Bootstrap({ children }: { children: React.ReactNode }) {
  const { ready } = useAppStore();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (ready && !hidden) {
      SplashScreen.hideAsync();
      setHidden(true);
    }
  }, [hidden, ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <ThemeProvider value={navTheme}>
          <Bootstrap>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="game/[id]" options={{ animation: 'fade' }} />
            </Stack>
          </Bootstrap>
        </ThemeProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
