import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import objectivesData from '../data/objectives.json';
import questionsData from '../data/questions.json';
import { storage, STORAGE_KEYS } from '../utils/storage.ts';
import { getDomainColor } from '../utils/colors.ts';
import type { ObjectivesData, Question, ObjectiveProgress, AppSettings } from '../types/index.ts';

const data = objectivesData as ObjectivesData;
const allQuestions = questionsData as Question[];

type Phase = 'welcome' | 'quiz' | 'results';

interface DomainResult {
  domainId: string;
  domainName: string;
  exam: string;
  correct: number;
  total: number;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle option positions so the correct answer isn't always in the same slot */
function shuffleOptions(q: Question): Question {
  const entries = Object.entries(q.options);
  const shuffled = shuffleArray(entries);
  const keys = ['A', 'B', 'C', 'D'];
  const newOptions: Record<string, string> = {};
  let newCorrect = q.correct;

  shuffled.forEach(([origKey, value], i) => {
    newOptions[keys[i]] = value;
    if (origKey === q.correct) newCorrect = keys[i];
  });

  return { ...q, options: newOptions, correct: newCorrect };
}

function selectDiagnosticQuestions(): Question[] {
  const selected: Question[] = [];

  for (const exam of data.exams) {
    for (const domain of exam.domains) {
      const domainPrefix = domain.id.replace('.0', '.');
      const domainQuestions = allQuestions.filter(
        q => q.exam === exam.exam && q.objectiveId.startsWith(domainPrefix)
      );

      const easy = shuffleArray(domainQuestions.filter(q => q.difficulty === 'easy'));
      const medium = shuffleArray(domainQuestions.filter(q => q.difficulty === 'medium'));

      if (easy.length > 0) selected.push(easy[0]);
      if (medium.length > 0) selected.push(medium[0]);

      // Fallback: if we couldn't get 1 easy + 1 medium, fill from available
      if (easy.length === 0 && medium.length > 0 && medium.length > 1) selected.push(medium[1]);
      if (medium.length === 0 && easy.length > 0 && easy.length > 1) selected.push(easy[1]);
    }
  }

  // Shuffle option positions so the correct answer varies across A/B/C/D
  return selected.map(shuffleOptions);
}

function completeOnboarding(skipped: boolean) {
  const settings = storage.load<AppSettings>(STORAGE_KEYS.SETTINGS, {}) ?? {};
  storage.save<AppSettings>(STORAGE_KEYS.SETTINGS, {
    ...settings,
    onboardingCompleted: true,
    onboardingSkipped: skipped,
  });
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('welcome');

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: string; correct: boolean }[]>([]);

  const startDiagnostic = () => {
    const qs = selectDiagnosticQuestions();
    setQuestions(qs);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setAnswers([]);
    setPhase('quiz');
  };

  const handleSkip = () => {
    completeOnboarding(true);
    navigate('/', { replace: true });
  };

  const handleAnswer = (key: string) => {
    if (showExplanation) return;
    setSelectedAnswer(key);
    setShowExplanation(true);
  };

  const handleNext = () => {
    const q = questions[currentIdx];
    const isCorrect = selectedAnswer === q.correct;
    const newAnswers = [...answers, { questionId: q.id, correct: isCorrect }];
    setAnswers(newAnswers);

    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      setPhase('results');
    }
  };

  // Compute domain results for the results screen
  const domainResults = useMemo<DomainResult[]>(() => {
    if (phase !== 'results') return [];

    const map: Record<string, DomainResult> = {};
    for (const a of answers) {
      const q = questions.find(qq => qq.id === a.questionId);
      if (!q) continue;
      const domainId = q.objectiveId.split('.')[0] + '.0';
      const key = `${q.exam}-${domainId}`;
      if (!map[key]) {
        const exam = data.exams.find(e => e.exam === q.exam);
        const domain = exam?.domains.find(d => d.id === domainId);
        map[key] = {
          domainId,
          domainName: domain?.name ?? q.domain,
          exam: q.exam,
          correct: 0,
          total: 0,
        };
      }
      map[key].total++;
      if (a.correct) map[key].correct++;
    }
    return Object.values(map);
  }, [phase, answers, questions]);

  const finishOnboarding = () => {
    // Seed ObjectiveProgress from diagnostic results
    const progressMap: Record<string, ObjectiveProgress> = {};

    for (const a of answers) {
      const q = questions.find(qq => qq.id === a.questionId);
      if (!q) continue;
      const key = `${q.exam}-${q.objectiveId}`;
      if (!progressMap[key]) {
        progressMap[key] = {
          objectiveId: q.objectiveId,
          exam: q.exam,
          mastery: 'not_started',
          quizScores: [],
          flashcardsReviewed: 0,
          lastStudied: new Date().toISOString(),
        };
      }
      // Conservative: correct = 50 (could be a guess). Wrong = -15
      // penalty, but only if there's existing progress to subtract from.
      if (a.correct) {
        progressMap[key].quizScores.push(50);
      } else {
        const avg = progressMap[key].quizScores.length > 0
          ? progressMap[key].quizScores.reduce((a, b) => a + b, 0) / progressMap[key].quizScores.length
          : 0;
        if (avg > 0) {
          progressMap[key].quizScores.push(Math.max(0, avg - 15));
        }
      }
      progressMap[key].mastery = 'in_progress';
    }

    storage.save<ObjectiveProgress[]>(STORAGE_KEYS.PROGRESS, Object.values(progressMap));
    completeOnboarding(false);
    navigate('/', { replace: true });
  };

  // WELCOME PHASE
  if (phase === 'welcome') {
    return (
      <div className="max-w-lg mx-auto flex flex-col items-center justify-center min-h-[70vh] px-4">
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <span className="text-4xl font-extrabold text-white tracking-tight">A+</span>
          </div>
          <div className="absolute -inset-4 bg-blue-500/10 rounded-3xl blur-xl -z-10" />
        </div>

        <h1 className="text-3xl font-bold text-gray-100 mb-3 text-center">
          Welcome to A+ Study
        </h1>
        <p className="text-gray-400 text-center max-w-sm mb-8 leading-relaxed">
          Take a quick diagnostic quiz to find your strengths and weaknesses across all exam domains. It only takes a few minutes.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={startDiagnostic}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors min-h-[44px] shadow-lg shadow-blue-600/20"
          >
            Start Diagnostic
          </button>
          <button
            onClick={handleSkip}
            className="w-full py-3 text-gray-500 hover:text-gray-300 text-sm font-medium transition-colors min-h-[44px]"
          >
            Skip for now
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-6 text-center">
          18 questions &middot; ~5 minutes &middot; 2 per domain
        </p>
      </div>
    );
  }

  // QUIZ PHASE
  if (phase === 'quiz') {
    const q = questions[currentIdx];
    const progress = (currentIdx / questions.length) * 100;
    const domainId = q.objectiveId.split('.')[0] + '.0';
    const color = getDomainColor(domainId, q.exam);

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Question {currentIdx + 1} of {questions.length}</span>
            <span>{q.exam} / {q.domain}</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500">{q.domain}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">{q.difficulty}</span>
          </div>
          <p className="text-lg text-gray-100 leading-relaxed">{q.question}</p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {Object.entries(q.options).map(([key, value]) => {
            let optionClass = 'bg-gray-800 border-gray-700 hover:border-gray-500';

            if (showExplanation) {
              if (key === q.correct) {
                optionClass = 'bg-green-900/30 border-green-600';
              } else if (key === selectedAnswer && key !== q.correct) {
                optionClass = 'bg-red-900/30 border-red-600';
              } else {
                optionClass = 'bg-gray-800 border-gray-700 opacity-50';
              }
            } else if (key === selectedAnswer) {
              optionClass = 'bg-blue-900/30 border-blue-600';
            }

            return (
              <button
                key={key}
                onClick={() => handleAnswer(key)}
                disabled={showExplanation}
                className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-colors min-h-[44px] ${optionClass}`}
              >
                <span className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
                  {key}
                </span>
                <span className="text-sm text-gray-200 pt-1">{value}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-2">
              {selectedAnswer === q.correct ? (
                <span className="text-green-400 font-semibold">Correct!</span>
              ) : (
                <span className="text-red-400 font-semibold">Incorrect - Answer: {q.correct}</span>
              )}
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">{q.explanation}</p>
          </div>
        )}

        {/* Next Button */}
        {showExplanation && (
          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
            >
              {currentIdx < questions.length - 1 ? 'Next' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // RESULTS PHASE
  const totalCorrect = answers.filter(a => a.correct).length;
  const totalScore = answers.length > 0 ? Math.round((totalCorrect / answers.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Score */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Diagnostic Results</h2>
        <div
          className="text-5xl font-bold my-4"
          style={{ color: totalScore >= 80 ? '#10B981' : totalScore >= 60 ? '#F59E0B' : '#EF4444' }}
        >
          {totalScore}%
        </div>
        <p className="text-gray-400">{totalCorrect} of {answers.length} correct</p>
      </div>

      {/* Domain Breakdown */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Domain Breakdown</h3>
        <div className="space-y-3">
          {domainResults.map(d => {
            const pct = d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0;
            const color = getDomainColor(d.domainId, d.exam);
            return (
              <div key={`${d.exam}-${d.domainId}`} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-gray-300">{d.exam} - {d.domainName}</span>
                  </div>
                  <span className="text-gray-400">
                    {d.correct}/{d.total} ({pct}%)
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="flex justify-center">
        <button
          onClick={finishOnboarding}
          className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors min-h-[44px] shadow-lg shadow-blue-600/20"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
