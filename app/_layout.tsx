import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { I18nProvider } from '@/src/i18n/I18nProvider';
import { AppProvider, useAppStore } from '@/src/state/AppStore';
import { AppThemeProvider, useColors } from '@/src/theme/ThemeProvider';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function Bootstrap({ children }: { children: React.ReactNode }) {
  const { ready } = useAppStore();
  const colors = useColors();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (ready && !hidden) {
      SplashScreen.hideAsync();
      setHidden(true);
    }
  }, [hidden, ready]);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

function RootStack() {
  const colors = useColors();
  return (
    <Bootstrap>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="game/[id]"
          options={{ animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack>
    </Bootstrap>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProvider>
        <I18nProvider>
          <AppThemeProvider>
            <RootStack />
          </AppThemeProvider>
        </I18nProvider>
      </AppProvider>
    </GestureHandlerRootView>
  );
}
