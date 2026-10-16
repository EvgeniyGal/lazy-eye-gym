import { Stack } from 'expo-router';
import { useMemo } from 'react';

import { useColors } from '@/src/theme/ThemeProvider';

export default function GamesLayout() {
  const colors = useColors();
  const screenOptions = useMemo(
    () => ({
      headerShown: false as const,
      contentStyle: { backgroundColor: colors.background },
    }),
    [colors],
  );

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
