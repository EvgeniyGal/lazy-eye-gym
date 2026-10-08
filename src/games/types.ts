import type { DichopticPalette } from '@/src/anaglyph/types';
import type { GameId } from './catalog';

export type GameResult = {
  score: number;
  bestMetric: number;
  durationSec: number;
};

export type GameSceneProps = {
  gameId: GameId;
  width: number;
  height: number;
  palette: DichopticPalette;
  settings: Record<string, string | number | boolean>;
  paused: boolean;
  onScore: (score: number, metric: number) => void;
  onGameOver: (result: GameResult) => void;
};
