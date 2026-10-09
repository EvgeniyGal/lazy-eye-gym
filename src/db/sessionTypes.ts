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

export type TrainingStats = {
  sessionCount: number;
  totalMinutes: number;
  scoreSum: number;
  streak: number;
  todaySeconds: number;
};

export type GamePlaytime = {
  gameId: string;
  durationSec: number;
  sessionCount: number;
  todaySeconds: number;
};

export function computePlaytimeByGame(sessions: GameSession[]): GamePlaytime[] {
  const todayKey = new Date().toISOString().slice(0, 10);
  const map = new Map<string, GamePlaytime>();

  for (const session of sessions) {
    const current = map.get(session.gameId) ?? {
      gameId: session.gameId,
      durationSec: 0,
      sessionCount: 0,
      todaySeconds: 0,
    };
    current.durationSec += session.durationSec;
    current.sessionCount += 1;
    if (session.endedAt.startsWith(todayKey)) {
      current.todaySeconds += session.durationSec;
    }
    map.set(session.gameId, current);
  }

  return [...map.values()].sort((a, b) => b.durationSec - a.durationSec);
}

export function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

export function computeTrainingStats(sessions: GameSession[]): TrainingStats {
  const sessionCount = sessions.length;
  const totalSeconds = sessions.reduce((sum, s) => sum + s.durationSec, 0);
  const scoreSum = sessions.reduce((sum, s) => sum + s.score, 0);

  const daySet = new Set(sessions.map((s) => s.endedAt.slice(0, 10)));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 60; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (daySet.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else if (i === 0) {
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySeconds = sessions
    .filter((s) => s.endedAt.startsWith(todayKey))
    .reduce((sum, s) => sum + s.durationSec, 0);

  return {
    sessionCount,
    totalMinutes: Math.round(totalSeconds / 60),
    scoreSum,
    streak,
    todaySeconds,
  };
}
