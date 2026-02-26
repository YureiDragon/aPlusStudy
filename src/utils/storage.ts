export const STORAGE_KEYS = {
  PROGRESS: 'aplus_progress',
  QUIZ_HISTORY: 'aplus_quiz_history',
  FLASHCARD_SCHEDULE: 'aplus_flashcard_schedule',
  STREAK: 'aplus_streak',
  EXAM_RESULTS: 'aplus_exam_results',
  GLOSSARY_PROGRESS: 'aplus_glossary_progress',
  SETTINGS: 'aplus_settings',
} as const;

export const storage = {
  save<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save to localStorage:', e);
    }
  },

  load<T>(key: string, defaultValue: T | null = null): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
      return defaultValue;
    }
  },

  remove(key: string): void {
    localStorage.removeItem(key);
  },
};
