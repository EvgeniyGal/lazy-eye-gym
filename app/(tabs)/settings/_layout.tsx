import { Stack } from 'expo-router';

import { colors } from '@/src/theme/tokens';

export default function SettingsLayout() {
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
      <Stack.Screen name="language" />
    </Stack>
  );
}
