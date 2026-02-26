import type { ObjectiveProgress, StreakData } from '../types';

export function calculateMastery(scores: number[]): 'not_started' | 'in_progress' | 'mastered' {
  if (scores.length === 0) return 'not_started';
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return avg >= 80 ? 'mastered' : 'in_progress';
}

export function calculateDomainScore(progress: ObjectiveProgress[]): number {
  if (progress.length === 0) return 0;
  const scores = progress
    .filter(p => p.quizScores.length > 0)
    .map(p => p.quizScores.reduce((a, b) => a + b, 0) / p.quizScores.length);
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function calculateReadinessScore(
  domainScores: Record<string, number>,
  domainWeights: Record<string, number>
): number {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [domain, weight] of Object.entries(domainWeights)) {
    const score = domainScores[domain] ?? 0;
    weightedSum += score * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export function updateStreak(current: StreakData | null): StreakData {
  const today = new Date().toISOString().split('T')[0];

  if (!current) {
    return { currentStreak: 1, longestStreak: 1, lastStudyDate: today };
  }

  if (current.lastStudyDate === today) {
    return current;
  }

  const lastDate = new Date(current.lastStudyDate);
  const todayDate = new Date(today);
  const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    const newStreak = current.currentStreak + 1;
    return {
      currentStreak: newStreak,
      longestStreak: Math.max(newStreak, current.longestStreak),
      lastStudyDate: today,
    };
  }

  return {
    currentStreak: 1,
    longestStreak: current.longestStreak,
    lastStudyDate: today,
  };
}
