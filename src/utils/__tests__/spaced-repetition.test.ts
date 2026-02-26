import { describe, it, expect } from 'vitest';
import { calculateNextReview, createNewCardSchedule, Quality } from '../spaced-repetition';

describe('SM-2 Spaced Repetition', () => {
  describe('createNewCardSchedule', () => {
    it('creates schedule with default values', () => {
      const schedule = createNewCardSchedule('fc-001');
      expect(schedule.cardId).toBe('fc-001');
      expect(schedule.easeFactor).toBe(2.5);
      expect(schedule.interval).toBe(0);
      expect(schedule.repetitions).toBe(0);
    });
  });

  describe('calculateNextReview', () => {
    it('resets on Again (quality 0)', () => {
      const schedule = createNewCardSchedule('fc-001');
      schedule.repetitions = 3;
      schedule.interval = 10;
      const result = calculateNextReview(schedule, Quality.Again);
      expect(result.repetitions).toBe(0);
      expect(result.interval).toBe(1);
    });

    it('sets interval to 1 on first Good review', () => {
      const schedule = createNewCardSchedule('fc-001');
      const result = calculateNextReview(schedule, Quality.Good);
      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
    });

    it('sets interval to 6 on second Good review', () => {
      const schedule = createNewCardSchedule('fc-001');
      const after1 = calculateNextReview(schedule, Quality.Good);
      const after2 = calculateNextReview(after1, Quality.Good);
      expect(after2.interval).toBe(6);
      expect(after2.repetitions).toBe(2);
    });

    it('multiplies interval by ease factor on subsequent reviews', () => {
      const schedule = createNewCardSchedule('fc-001');
      const after1 = calculateNextReview(schedule, Quality.Good);
      const after2 = calculateNextReview(after1, Quality.Good);
      const after3 = calculateNextReview(after2, Quality.Good);
      // After 3rd Good review, interval should be > 6 (previous interval * EF)
      expect(after3.interval).toBeGreaterThan(6);
      expect(after3.repetitions).toBe(3);
    });

    it('decreases ease factor on Hard (quality 2)', () => {
      const schedule = createNewCardSchedule('fc-001');
      const result = calculateNextReview(schedule, Quality.Hard);
      expect(result.easeFactor).toBeLessThan(2.5);
      expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('increases ease factor on Easy (quality 5)', () => {
      const schedule = createNewCardSchedule('fc-001');
      const result = calculateNextReview(schedule, Quality.Easy);
      expect(result.easeFactor).toBeGreaterThan(2.5);
    });

    it('never lets ease factor drop below 1.3', () => {
      let schedule = createNewCardSchedule('fc-001');
      for (let i = 0; i < 20; i++) {
        schedule = calculateNextReview(schedule, Quality.Hard);
      }
      expect(schedule.easeFactor).toBeGreaterThanOrEqual(1.3);
    });

    it('sets nextReview date correctly', () => {
      const schedule = createNewCardSchedule('fc-001');
      const result = calculateNextReview(schedule, Quality.Good);
      const nextDate = new Date(result.nextReview);
      const today = new Date();
      const diffDays = Math.round((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(1);
    });
  });
});
