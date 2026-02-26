import { describe, it, expect } from 'vitest';
import {
  calculateMastery,
  calculateDomainScore,
  calculateReadinessScore,
  calculateQuestionScore,
  updateStreak,
} from '../scoring';
import type { ObjectiveProgress, StreakData, QuestionResult } from '../../types';

describe('Scoring utilities', () => {
  describe('calculateMastery', () => {
    it('returns not_started when no scores', () => {
      expect(calculateMastery([])).toBe('not_started');
    });

    it('returns in_progress when average below 80', () => {
      expect(calculateMastery([50, 60, 70])).toBe('in_progress');
    });

    it('returns mastered when average 80 or above', () => {
      expect(calculateMastery([80, 90, 85])).toBe('mastered');
    });
  });

  describe('calculateDomainScore', () => {
    it('returns 0 when no objectives have progress', () => {
      expect(calculateDomainScore([])).toBe(0);
    });

    it('calculates average of objective scores', () => {
      const progress: ObjectiveProgress[] = [
        { objectiveId: '1.1', exam: 'Core 1', mastery: 'mastered', quizScores: [90], flashcardsReviewed: 5, lastStudied: '' },
        { objectiveId: '1.2', exam: 'Core 1', mastery: 'in_progress', quizScores: [70], flashcardsReviewed: 3, lastStudied: '' },
      ];
      expect(calculateDomainScore(progress)).toBe(80);
    });
  });

  describe('calculateReadinessScore', () => {
    it('returns 0 when no scores', () => {
      expect(calculateReadinessScore({}, { '1.0': 25, '2.0': 75 })).toBe(0);
    });

    it('calculates weighted average', () => {
      const scores = { '1.0': 100, '2.0': 50 };
      const weights = { '1.0': 25, '2.0': 75 };
      // (100*25 + 50*75) / 100 = (2500 + 3750) / 100 = 62.5 -> 63
      expect(calculateReadinessScore(scores, weights)).toBe(63);
    });
  });

  describe('calculateQuestionScore', () => {
    it('returns 1 for correct MC answer', () => {
      const result: QuestionResult = {
        questionId: 'q-1',
        questionType: 'multiple-choice',
        selectedAnswer: 'A',
        correct: true,
      };
      expect(calculateQuestionScore(result)).toBe(1);
    });

    it('returns 0 for incorrect MC answer', () => {
      const result: QuestionResult = {
        questionId: 'q-1',
        questionType: 'multiple-choice',
        selectedAnswer: 'B',
        correct: false,
      };
      expect(calculateQuestionScore(result)).toBe(0);
    });

    it('returns 0 for matching with 0/4 correct pairs', () => {
      const result: QuestionResult = {
        questionId: 'q-2',
        questionType: 'matching',
        selectedPairs: [
          { left: 'A', right: '2' },
          { left: 'B', right: '1' },
          { left: 'C', right: '4' },
          { left: 'D', right: '3' },
        ],
        correctPairs: 0,
        totalPairs: 4,
        correct: false,
        partialScore: 0,
      };
      expect(calculateQuestionScore(result)).toBe(0);
    });

    it('returns 0.5 for matching with 2/4 correct pairs', () => {
      const result: QuestionResult = {
        questionId: 'q-2',
        questionType: 'matching',
        selectedPairs: [
          { left: 'A', right: '1' },
          { left: 'B', right: '2' },
          { left: 'C', right: '4' },
          { left: 'D', right: '3' },
        ],
        correctPairs: 2,
        totalPairs: 4,
        correct: false,
        partialScore: 0.5,
      };
      expect(calculateQuestionScore(result)).toBe(0.5);
    });

    it('returns 1 for matching with 4/4 correct pairs', () => {
      const result: QuestionResult = {
        questionId: 'q-2',
        questionType: 'matching',
        selectedPairs: [
          { left: 'A', right: '1' },
          { left: 'B', right: '2' },
          { left: 'C', right: '3' },
          { left: 'D', right: '4' },
        ],
        correctPairs: 4,
        totalPairs: 4,
        correct: true,
        partialScore: 1,
      };
      expect(calculateQuestionScore(result)).toBe(1);
    });
  });

  describe('updateStreak', () => {
    it('starts a new streak', () => {
      const result = updateStreak(null);
      expect(result.currentStreak).toBe(1);
    });

    it('continues streak if studied yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const streak: StreakData = {
        currentStreak: 5,
        longestStreak: 10,
        lastStudyDate: yesterday.toISOString().split('T')[0],
      };
      const result = updateStreak(streak);
      expect(result.currentStreak).toBe(6);
    });

    it('resets streak if more than 1 day gap', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const streak: StreakData = {
        currentStreak: 5,
        longestStreak: 10,
        lastStudyDate: twoDaysAgo.toISOString().split('T')[0],
      };
      const result = updateStreak(streak);
      expect(result.currentStreak).toBe(1);
      expect(result.longestStreak).toBe(10);
    });

    it('does not increment if already studied today', () => {
      const today = new Date().toISOString().split('T')[0];
      const streak: StreakData = {
        currentStreak: 5,
        longestStreak: 10,
        lastStudyDate: today,
      };
      const result = updateStreak(streak);
      expect(result.currentStreak).toBe(5);
    });
  });
});
