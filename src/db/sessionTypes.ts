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
