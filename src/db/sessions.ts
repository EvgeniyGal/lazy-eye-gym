import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';

export type GameSession = {
  id: string;
  gameId: string;
  startedAt: string;
  endedAt: string;
  score: number;
  bestMetric: number;
  durationSec: number;
  settingsJson: string;
  profileSnapshotJson: string;
};

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

export async function getTrainingStats() {
  const db = await getDb();
  const totals = await db.getFirstAsync<{
    sessions: number;
    minutes: number;
    scoreSum: number;
  }>(
    `SELECT COUNT(*) as sessions,
            COALESCE(SUM(durationSec), 0) / 60.0 as minutes,
            COALESCE(SUM(score), 0) as scoreSum
     FROM sessions`,
  );

  const days = await db.getAllAsync<{ day: string }>(
    `SELECT DISTINCT substr(endedAt, 1, 10) as day
     FROM sessions
     ORDER BY day DESC
     LIMIT 60`,
  );

  let streak = 0;
  const daySet = new Set(days.map((d) => d.day));
  const cursor = new Date();
  for (let i = 0; i < 60; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    } else {
      break;
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const today = await db.getFirstAsync<{ seconds: number }>(
    `SELECT COALESCE(SUM(durationSec), 0) as seconds
     FROM sessions WHERE substr(endedAt, 1, 10) = ?`,
    todayKey,
  );

  return {
    sessionCount: totals?.sessions ?? 0,
    totalMinutes: Math.round(totals?.minutes ?? 0),
    scoreSum: totals?.scoreSum ?? 0,
    streak,
    todaySeconds: today?.seconds ?? 0,
  };
}
