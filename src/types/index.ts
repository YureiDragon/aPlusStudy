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

interface QuestionBase {
  id: string;
  exam: string;
  domain: string;
  objectiveId: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface MultipleChoiceQuestion extends QuestionBase {
  questionType: 'multiple-choice';
  type: 'concept' | 'scenario' | 'comparison' | 'troubleshooting';
  question: string;
  options: Record<string, string>;
  correct: string;
}

export interface MatchingQuestion extends QuestionBase {
  questionType: 'matching';
  type: 'matching';
  question: string;
  pairs: { left: string; right: string }[];
  leftLabel: string;
  rightLabel: string;
}

export type Question = MultipleChoiceQuestion | MatchingQuestion;

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

export interface MultipleChoiceResult {
  questionId: string;
  questionType: 'multiple-choice';
  selectedAnswer: string;
  correct: boolean;
}

export interface MatchingResult {
  questionId: string;
  questionType: 'matching';
  selectedPairs: { left: string; right: string }[];
  correctPairs: number;
  totalPairs: number;
  correct: boolean;
  partialScore: number; // 0.0–1.0
}

export type QuestionResult = MultipleChoiceResult | MatchingResult;

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

export interface GlossaryProgress {
  term: string;
  exam: string;
  domain: string;
  correctCount: number;
  attemptCount: number;
  lastStudied: string;
  mastery: 'not_started' | 'in_progress' | 'mastered';
}

export interface AppSettings {
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
  pwaInstallDismissed?: boolean;
}
