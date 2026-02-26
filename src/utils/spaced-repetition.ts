import type { CardSchedule } from '../types';

export enum Quality {
  Again = 0,
  Hard = 2,
  Good = 3,
  Easy = 5,
}

export function createNewCardSchedule(cardId: string): CardSchedule {
  const now = new Date().toISOString();
  return {
    cardId,
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: now,
    lastReview: now,
  };
}

export function calculateNextReview(schedule: CardSchedule, quality: Quality): CardSchedule {
  const now = new Date();
  let { easeFactor, interval, repetitions } = schedule;

  // Update ease factor using SM-2 formula
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  if (quality < Quality.Good) {
    // Failed: reset repetitions
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    cardId: schedule.cardId,
    easeFactor,
    interval,
    repetitions,
    nextReview: nextReview.toISOString(),
    lastReview: now.toISOString(),
  };
}

export function isDueForReview(schedule: CardSchedule): boolean {
  return new Date(schedule.nextReview) <= new Date();
}

export function getDueCards(schedules: CardSchedule[]): CardSchedule[] {
  return schedules.filter(isDueForReview);
}
