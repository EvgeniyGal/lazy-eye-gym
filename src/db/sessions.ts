import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

import {
  computePlaytimeByGame,
  computeTrainingStats,
  type GamePlaytime,
  type GameSession,
  type TrainingStats,
} from './sessionTypes';

export type { GamePlaytime, GameSession } from './sessionTypes';
export { formatDuration } from './sessionTypes';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('lazyeye.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY NOT NULL,
          gameId TEXT NOT NULL,
          startedAt TEXT NOT NULL,
          endedAt TEXT NOT NULL,
          score INTEGER NOT NULL,
          bestMetric INTEGER NOT NULL,
          durationSec INTEGER NOT NULL,
          settingsJson TEXT NOT NULL,
          profileSnapshotJson TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS sessions_game_idx ON sessions(gameId);
        CREATE INDEX IF NOT EXISTS sessions_ended_idx ON sessions(endedAt);
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function insertSession(
  input: Omit<GameSession, 'id'> & { id?: string },
): Promise<GameSession> {
  const db = await getDb();
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
  await db.runAsync(
    `INSERT INTO sessions
      (id, gameId, startedAt, endedAt, score, bestMetric, durationSec, settingsJson, profileSnapshotJson)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.gameId,
    session.startedAt,
    session.endedAt,
    session.score,
    session.bestMetric,
    session.durationSec,
    session.settingsJson,
    session.profileSnapshotJson,
  );
  return session;
}

export async function listSessionsForGame(gameId: string, limit = 50): Promise<GameSession[]> {
  const db = await getDb();
  return db.getAllAsync<GameSession>(
    `SELECT * FROM sessions WHERE gameId = ? ORDER BY endedAt DESC LIMIT ?`,
    gameId,
    limit,
  );
}

export async function getBestScore(gameId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ best: number | null }>(
    `SELECT MAX(score) as best FROM sessions WHERE gameId = ?`,
    gameId,
  );
  return row?.best ?? 0;
}

export async function getBestMetric(gameId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ best: number | null }>(
    `SELECT MAX(bestMetric) as best FROM sessions WHERE gameId = ?`,
    gameId,
  );
  return row?.best ?? 0;
}

export async function getRecentSessions(limit = 20): Promise<GameSession[]> {
  const db = await getDb();
  return db.getAllAsync<GameSession>(
    `SELECT * FROM sessions ORDER BY endedAt DESC LIMIT ?`,
    limit,
  );
}

export async function getTrainingStats(): Promise<TrainingStats> {
  const db = await getDb();
  const rows = await db.getAllAsync<GameSession>(`SELECT * FROM sessions`);
  return computeTrainingStats(rows);
}

export async function getPlaytimeByGame(): Promise<GamePlaytime[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<GameSession>(`SELECT * FROM sessions`);
  return computePlaytimeByGame(rows);
}
