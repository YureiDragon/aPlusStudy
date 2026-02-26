import { useState, useMemo } from 'react';
import objectivesData from '../data/objectives.json';
import questionsData from '../data/questions.json';
import { storage, STORAGE_KEYS } from '../utils/storage.ts';
import { updateStreak } from '../utils/scoring.ts';
import { getDomainColor } from '../utils/colors.ts';
import type { ObjectivesData, Question, QuizResult, QuestionResult, StreakData } from '../types/index.ts';

const data = objectivesData as ObjectivesData;
const allQuestions = questionsData as Question[];

type Phase = 'setup' | 'quiz' | 'results';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizEngine() {
  const [phase, setPhase] = useState<Phase>('setup');

  // Setup state
  const [examChoice, setExamChoice] = useState('');
  const [domainChoice, setDomainChoice] = useState('');
  const [objectiveChoice, setObjectiveChoice] = useState('');
  const [questionCount, setQuestionCount] = useState(10);

  // Quiz state
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [results, setResults] = useState<QuestionResult[]>([]);

  // Filter options
  const domains = useMemo(() => {
    if (!examChoice) return [];
    const exam = data.exams.find(e => e.exam === examChoice);
    return exam?.domains ?? [];
  }, [examChoice]);

  const objectives = useMemo(() => {
    if (!domainChoice) return [];
    const exam = data.exams.find(e => e.exam === examChoice);
    const domain = exam?.domains.find(d => d.id === domainChoice);
    return domain?.objectives ?? [];
  }, [examChoice, domainChoice]);

  const availableCount = useMemo(() => {
    let qs = allQuestions;
    if (examChoice) qs = qs.filter(q => q.exam === examChoice);
    if (domainChoice) qs = qs.filter(q => q.objectiveId.startsWith(domainChoice.replace('.0', '.')));
    if (objectiveChoice) qs = qs.filter(q => q.objectiveId === objectiveChoice);
    return qs.length;
  }, [examChoice, domainChoice, objectiveChoice]);

  const startQuiz = (questionsToUse?: Question[]) => {
    let qs = questionsToUse ?? allQuestions;
    if (!questionsToUse) {
      if (examChoice) qs = qs.filter(q => q.exam === examChoice);
      if (domainChoice) qs = qs.filter(q => q.objectiveId.startsWith(domainChoice.replace('.0', '.')));
      if (objectiveChoice) qs = qs.filter(q => q.objectiveId === objectiveChoice);
      qs = shuffleArray(qs).slice(0, questionCount);
    }

    setQuizQuestions(qs);
    setCurrentIdx(0);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setResults([]);
    setPhase('quiz');
  };

  const handleAnswer = (answer: string) => {
    if (showExplanation) return;
    setSelectedAnswer(answer);
    setShowExplanation(true);
  };

  const handleNext = () => {
    const q = quizQuestions[currentIdx];
    const result: QuestionResult = {
      questionId: q.id,
      selectedAnswer: selectedAnswer ?? '',
      correct: selectedAnswer === q.correct,
    };

    const newResults = [...results, result];
    setResults(newResults);

    if (currentIdx < quizQuestions.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      // Save result
      const correct = newResults.filter(r => r.correct).length;
      const score = Math.round((correct / newResults.length) * 100);
      const quizResult: QuizResult = {
        id: `quiz-${Date.now()}`,
        date: new Date().toISOString(),
        exam: examChoice || 'Mixed',
        domain: domainChoice || undefined,
        objectiveId: objectiveChoice || undefined,
        totalQuestions: newResults.length,
        correctAnswers: correct,
        score,
        questionResults: newResults,
      };

      const history = storage.load<QuizResult[]>(STORAGE_KEYS.QUIZ_HISTORY, []) ?? [];
      history.push(quizResult);
      storage.save(STORAGE_KEYS.QUIZ_HISTORY, history);

      // Update streak
      const currentStreak = storage.load<StreakData>(STORAGE_KEYS.STREAK);
      storage.save(STORAGE_KEYS.STREAK, updateStreak(currentStreak));

      setPhase('results');
    }
  };

  const retryMissed = () => {
    const missedIds = results.filter(r => !r.correct).map(r => r.questionId);
    const missedQuestions = shuffleArray(quizQuestions.filter(q => missedIds.includes(q.id)));
    if (missedQuestions.length > 0) {
      startQuiz(missedQuestions);
    }
  };

  // SETUP PHASE
  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
          <h2 className="text-xl font-bold text-gray-100">Quiz Setup</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Exam</label>
              <select
                value={examChoice}
                onChange={e => { setExamChoice(e.target.value); setDomainChoice(''); setObjectiveChoice(''); }}
                className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 min-h-[44px]"
              >
                <option value="">All Exams</option>
                {data.exams.map(e => <option key={e.exam} value={e.exam}>{e.exam}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Domain (optional)</label>
              <select
                value={domainChoice}
                onChange={e => { setDomainChoice(e.target.value); setObjectiveChoice(''); }}
                className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 min-h-[44px]"
                disabled={!examChoice}
              >
                <option value="">All Domains</option>
                {domains.map(d => <option key={d.id} value={d.id}>{d.id} - {d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Objective (optional)</label>
              <select
                value={objectiveChoice}
                onChange={e => setObjectiveChoice(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 min-h-[44px]"
                disabled={!domainChoice}
              >
                <option value="">All Objectives</option>
                {objectives.map(o => <option key={o.id} value={o.id}>{o.id} - {o.title.substring(0, 60)}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Number of Questions</label>
              <div className="flex gap-3">
                {[10, 25, 50].map(n => (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      questionCount === n
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-sm text-gray-500">
              {availableCount} question{availableCount !== 1 ? 's' : ''} available
            </span>
            <button
              onClick={() => startQuiz()}
              disabled={availableCount === 0}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors min-h-[44px]"
            >
              Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // QUIZ PHASE
  if (phase === 'quiz') {
    const q = quizQuestions[currentIdx];
    const progress = ((currentIdx) / quizQuestions.length) * 100;
    const domainId = q.objectiveId.split('.')[0] + '.0';
    const color = getDomainColor(domainId, q.exam);

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-400">
            <span>Question {currentIdx + 1} of {quizQuestions.length}</span>
            <span>{q.exam} / {q.objectiveId}</span>
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
              {currentIdx < quizQuestions.length - 1 ? 'Next' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // RESULTS PHASE
  const correct = results.filter(r => r.correct).length;
  const score = results.length > 0 ? Math.round((correct / results.length) * 100) : 0;
  const missed = results.filter(r => !r.correct);

  // Domain breakdown
  const domainBreakdown = useMemo(() => {
    const breakdown: Record<string, { correct: number; total: number; name: string; exam: string; domainId: string }> = {};
    for (const r of results) {
      const q = quizQuestions.find(qq => qq.id === r.questionId);
      if (!q) continue;
      const key = `${q.exam}-${q.domain}`;
      if (!breakdown[key]) {
        breakdown[key] = { correct: 0, total: 0, name: q.domain, exam: q.exam, domainId: q.objectiveId.split('.')[0] + '.0' };
      }
      breakdown[key].total++;
      if (r.correct) breakdown[key].correct++;
    }
    return Object.values(breakdown);
  }, [results, quizQuestions]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Score */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Quiz Results</h2>
        <div className="text-5xl font-bold my-4" style={{ color: score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444' }}>
          {score}%
        </div>
        <p className="text-gray-400">{correct} of {results.length} correct</p>
      </div>

      {/* Domain Breakdown */}
      {domainBreakdown.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Domain Breakdown</h3>
          <div className="space-y-3">
            {domainBreakdown.map(d => {
              const pct = Math.round((d.correct / d.total) * 100);
              const color = getDomainColor(d.domainId, d.exam);
              return (
                <div key={d.name} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-gray-300">{d.name}</span>
                    </div>
                    <span className="text-gray-400">{d.correct}/{d.total} ({pct}%)</span>
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
      )}

      {/* Missed Questions */}
      {missed.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Missed Questions ({missed.length})
          </h3>
          <div className="space-y-4">
            {missed.map(r => {
              const q = quizQuestions.find(qq => qq.id === r.questionId);
              if (!q) return null;
              return (
                <div key={r.questionId} className="bg-gray-900 rounded-lg p-4 border border-gray-700/50">
                  <p className="text-sm text-gray-200 mb-2">{q.question}</p>
                  <p className="text-sm text-red-400">Your answer: {r.selectedAnswer} - {q.options[r.selectedAnswer]}</p>
                  <p className="text-sm text-green-400">Correct: {q.correct} - {q.options[q.correct]}</p>
                  <p className="text-xs text-gray-400 mt-2">{q.explanation}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        {missed.length > 0 && (
          <button
            onClick={retryMissed}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
          >
            Retry Missed ({missed.length})
          </button>
        )}
        <button
          onClick={() => setPhase('setup')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
        >
          New Quiz
        </button>
      </div>
    </div>
  );
}
