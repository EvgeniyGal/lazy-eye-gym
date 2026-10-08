import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { GameShell } from '@/src/games/shared/GameShell';
import type { GameId } from '@/src/games/catalog';
import { getGame } from '@/src/games/catalog';
import { colors, spacing } from '@/src/theme/tokens';

const VALID: GameId[] = ['2048', 'pong', 'maze', 'breaker', 'snake'];

export default function GameSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = String(id) as GameId;

  if (!VALID.includes(gameId) || !getGame(gameId)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl }}>
        <Text style={{ color: colors.onSurface }}>Unknown game.</Text>
      </View>
    );
  }

  return <GameShell gameId={gameId} />;
}
