import { Stack } from 'expo-router';

import { useColors } from '@/src/theme/ThemeProvider';

export default function SettingsLayout() {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="optical" />
      <Stack.Screen name="intensity" />
      <Stack.Screen name="reminders" />
      <Stack.Screen name="engine" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="language" />
      <Stack.Screen name="support" />
    </Stack>
  );
}
