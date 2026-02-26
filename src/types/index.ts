// Data types (match JSON schemas)
export interface Exam {
  exam: string;
  examCode: string;
  passingScore: number;
  maxScore: number;
  totalQuestions: number;
  timeMinutes: number;
  domains: Domain[];
}

export interface Domain {
  id: string;
  name: string;
  weight: number;
  objectives: Objective[];
}

export interface Objective {
  id: string;
  title: string;
  subtopics: string[];
  studyNotes: string;
}

export interface ObjectivesData {
  exams: Exam[];
}

export interface Flashcard {
  id: string;
  exam: string;
  domain: string;
  objectiveId: string;
  question: string;
  answer: string;
  explanation: string;
  tags: string[];
}

export interface Question {
  id: string;
  exam: string;
  domain: string;
  objectiveId: string;
  type: 'concept' | 'scenario' | 'comparison' | 'troubleshooting';
  question: string;
  options: Record<string, string>;
  correct: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface GlossaryTerm {
  term: string;
  fullName: string;
  definition: string;
  exam: string;
  domain: string;
  category: string;
}

// User progress types
export interface CardSchedule {
  cardId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string; // ISO date
  lastReview: string; // ISO date
}

export interface QuizResult {
  id: string;
  date: string;
  exam: string;
  domain?: string;
  objectiveId?: string;
  totalQuestions: number;
  correctAnswers: number;
  score: number;
  questionResults: QuestionResult[];
}

export interface QuestionResult {
  questionId: string;
  selectedAnswer: string;
  correct: boolean;
}

export interface ExamResult extends QuizResult {
  timeSpent: number;
  passed: boolean;
  domainScores: Record<string, { correct: number; total: number }>;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: string;
}

export interface ObjectiveProgress {
  objectiveId: string;
  exam: string;
  mastery: 'not_started' | 'in_progress' | 'mastered';
  quizScores: number[];
  flashcardsReviewed: number;
  lastStudied: string;
}

export interface AppSettings {
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
  pwaInstallDismissed?: boolean;
}
