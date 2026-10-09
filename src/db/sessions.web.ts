import * as Crypto from 'expo-crypto';

import { getJSON, hydrateStorage, setJSON } from '@/src/storage/mmkv';
import {
  computePlaytimeByGame,
  computeTrainingStats,
  type GamePlaytime,
  type GameSession,
  type TrainingStats,
} from './sessionTypes';

export type { GamePlaytime, GameSession } from './sessionTypes';
export { formatDuration } from './sessionTypes';

const SESSIONS_KEY = 'lazyeye.sessions';

async function readAll(): Promise<GameSession[]> {
  await hydrateStorage();
  return getJSON<GameSession[]>(SESSIONS_KEY, []);
}

async function writeAll(sessions: GameSession[]) {
  await hydrateStorage();
  setJSON(SESSIONS_KEY, sessions);
}

export async function insertSession(
  input: Omit<GameSession, 'id'> & { id?: string },
): Promise<GameSession> {
  const session: GameSession = {
    id: input.id ?? Crypto.randomUUID(),
    gameId: input.gameId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    score: input.score,
    bestMetric: input.bestMetric,
    durationSec: input.durationSec,
    settingsJson: input.settingsJson,
    profileSnapshotJson: input.profileSnapshotJson,
  };
  const all = await readAll();
  all.unshift(session);
  await writeAll(all);
  return session;
}

export async function listSessionsForGame(gameId: string, limit = 50): Promise<GameSession[]> {
  const all = await readAll();
  return all
    .filter((s) => s.gameId === gameId)
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))
    .slice(0, limit);
}

export async function getBestScore(gameId: string): Promise<number> {
  const all = await readAll();
  return all.filter((s) => s.gameId === gameId).reduce((best, s) => Math.max(best, s.score), 0);
}

export async function getBestMetric(gameId: string): Promise<number> {
  const all = await readAll();
  return all
    .filter((s) => s.gameId === gameId)
    .reduce((best, s) => Math.max(best, s.bestMetric), 0);
}

export async function getRecentSessions(limit = 20): Promise<GameSession[]> {
  const all = await readAll();
  return [...all].sort((a, b) => b.endedAt.localeCompare(a.endedAt)).slice(0, limit);
}

export async function getTrainingStats(): Promise<TrainingStats> {
  return computeTrainingStats(await readAll());
}

export async function getPlaytimeByGame(): Promise<GamePlaytime[]> {
  return computePlaytimeByGame(await readAll());
}
