import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import objectivesData from '../data/objectives.json';
import questionsData from '../data/questions.json';
import { storage, STORAGE_KEYS } from '../utils/storage.ts';
import { updateStreak, calculateQuestionScore } from '../utils/scoring.ts';
import { getDomainColor } from '../utils/colors.ts';
import MatchingQuestionView from './MatchingQuestionView.tsx';
import type { ObjectivesData, Question, ExamResult, QuestionResult, StreakData } from '../types/index.ts';

const data = objectivesData as ObjectivesData;
const allQuestions = questionsData as Question[];

type Phase = 'setup' | 'exam' | 'results';

interface ExamAnswer {
  /** MC answer key, or null if unanswered */
  answer: string | null;
  /** Matching pairs, or null if unanswered */
  matchingPairs: { left: string; right: string }[] | null;
  flagged: boolean;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function PracticeExam() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [examChoice, setExamChoice] = useState('Core 1');
  const [showHistory, setShowHistory] = useState(false);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);

  // Exam state
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<ExamAnswer[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(90 * 60);
  const [showConfirm, setShowConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Results state
  const [examResult, setExamResult] = useState<ExamResult | null>(null);

  const examConfig = useMemo(() => {
    return data.exams.find(e => e.exam === examChoice);
  }, [examChoice]);

  const startExam = () => {
    const examQs = allQuestions.filter(q => q.exam === examChoice);
    const count = examConfig?.totalQuestions ?? 90;
    const selected = shuffleArray(examQs).slice(0, count);
    setExamQuestions(selected);
    setAnswers(selected.map(() => ({ answer: null, matchingPairs: null, flagged: false })));
    setCurrentIdx(0);
    setTimeRemaining((examConfig?.timeMinutes ?? 90) * 60);
    setPhase('exam');
  };

  // Timer
  useEffect(() => {
    if (phase !== 'exam') return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          submitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const selectAnswer = (key: string) => {
    setAnswers(prev => {
      const next = [...prev];
      next[currentIdx] = { ...next[currentIdx], answer: key };
      return next;
    });
  };

  const setMatchingPairs = (pairs: { left: string; right: string }[]) => {
    setAnswers(prev => {
      const next = [...prev];
      next[currentIdx] = { ...next[currentIdx], matchingPairs: pairs };
      return next;
    });
  };

  const toggleFlag = () => {
    setAnswers(prev => {
      const next = [...prev];
      next[currentIdx] = { ...next[currentIdx], flagged: !next[currentIdx].flagged };
      return next;
    });
  };

  const isAnswered = (a: ExamAnswer, q: Question): boolean => {
    if (q.questionType === 'matching') {
      return a.matchingPairs !== null && a.matchingPairs.length === q.pairs.length;
    }
    return a.answer !== null;
  };

  const submitExam = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    const questionResults: QuestionResult[] = examQuestions.map((q, i) => {
      if (q.questionType === 'matching') {
        const userPairs = answers[i]?.matchingPairs ?? [];
        const correctCount = userPairs.filter(up =>
          q.pairs.some(cp => cp.left === up.left && cp.right === up.right)
        ).length;
        const total = q.pairs.length;
        return {
          questionId: q.id,
          questionType: 'matching' as const,
          selectedPairs: userPairs,
          correctPairs: correctCount,
          totalPairs: total,
          correct: correctCount === total,
          partialScore: total > 0 ? correctCount / total : 0,
        };
      }
      return {
        questionId: q.id,
        questionType: 'multiple-choice' as const,
        selectedAnswer: answers[i]?.answer ?? '',
        correct: answers[i]?.answer === q.correct,
      };
    });

    const totalScoreSum = questionResults.reduce((sum, r) => sum + calculateQuestionScore(r), 0);
    const correct = questionResults.filter(r => r.correct).length;
    const total = questionResults.length;

    // Domain scores
    const domainScores: Record<string, { correct: number; total: number }> = {};
    examQuestions.forEach((q, i) => {
      const domainKey = q.domain;
      if (!domainScores[domainKey]) domainScores[domainKey] = { correct: 0, total: 0 };
      domainScores[domainKey].total++;
      if (questionResults[i].correct) domainScores[domainKey].correct++;
    });

    // Calculate score on 900-point scale using partial credit
    const rawPct = total > 0 ? totalScoreSum / total : 0;
    const scaledScore = Math.round(100 + rawPct * 800);
    const passingScore = examConfig?.passingScore ?? 675;

    const result: ExamResult = {
      id: `exam-${Date.now()}`,
      date: new Date().toISOString(),
      exam: examChoice,
      totalQuestions: total,
      correctAnswers: correct,
      score: scaledScore,
      questionResults,
      timeSpent: (examConfig?.timeMinutes ?? 90) * 60 - timeRemaining,
      passed: scaledScore >= passingScore,
      domainScores,
    };

    // Save
    const history = storage.load<ExamResult[]>(STORAGE_KEYS.EXAM_RESULTS, []) ?? [];
    history.push(result);
    storage.save(STORAGE_KEYS.EXAM_RESULTS, history);

    const currentStreak = storage.load<StreakData>(STORAGE_KEYS.STREAK);
    storage.save(STORAGE_KEYS.STREAK, updateStreak(currentStreak));

    setExamResult(result);
    setPhase('results');
  }, [examQuestions, answers, timeRemaining, examChoice, examConfig]);

  // SETUP
  if (phase === 'setup') {
    const availableCount = allQuestions.filter(q => q.exam === examChoice).length;
    const neededCount = examConfig?.totalQuestions ?? 90;
    const examHistory = (storage.load<ExamResult[]>(STORAGE_KEYS.EXAM_RESULTS, []) ?? [])
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Tab Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              !showHistory ? 'bg-blue-600 text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            New Exam
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              showHistory ? 'bg-blue-600 text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            History ({examHistory.length})
          </button>
        </div>

        {showHistory ? (
          /* History View */
          <div className="space-y-3">
            {examHistory.length === 0 ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
                <p className="text-gray-400">No exam history yet. Take a practice exam to see results here.</p>
              </div>
            ) : (
              examHistory.map(result => {
                const isExpanded = expandedResult === result.id;
                const date = new Date(result.date);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

                return (
                  <div key={result.id} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                    <button
                      onClick={() => setExpandedResult(isExpanded ? null : result.id)}
                      className="w-full p-4 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            result.passed
                              ? 'bg-green-900/50 text-green-400 border border-green-600/50'
                              : 'bg-red-900/50 text-red-400 border border-red-600/50'
                          }`}>
                            {result.passed ? 'PASS' : 'FAIL'}
                          </span>
                          <span className="text-gray-100 font-medium">{result.exam}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-100 font-bold">{result.score}/900</span>
                          <span className="text-gray-400">{result.correctAnswers}/{result.totalQuestions}</span>
                          <span className="text-gray-500">{formatTime(result.timeSpent)}</span>
                          <span className="text-gray-500 text-xs">{dateStr} {timeStr}</span>
                          <span className="text-gray-500">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                        </div>
                      </div>
                    </button>

                    {isExpanded && result.domainScores && (
                      <div className="px-4 pb-4 border-t border-gray-700 pt-3">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">Domain Breakdown</h4>
                        <div className="space-y-2">
                          {Object.entries(result.domainScores).map(([domainName, score]) => {
                            const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
                            const domainId = domainName.split(' ')[0];
                            const color = getDomainColor(domainId, result.exam);
                            return (
                              <div key={domainName} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                                    <span className="text-gray-300">{domainName}</span>
                                  </div>
                                  <span className="text-gray-400">{score.correct}/{score.total} ({pct}%)</span>
                                </div>
                                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
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
                  </div>
                );
              })
            )}
          </div>
        ) : (
          /* New Exam Setup */
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-5">
            <h2 className="text-xl font-bold text-gray-100">Practice Exam Setup</h2>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Select Exam</label>
              <div className="flex gap-3">
                {data.exams.map(e => (
                  <button
                    key={e.exam}
                    onClick={() => setExamChoice(e.exam)}
                    className={`flex-1 py-3 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      examChoice === e.exam
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {e.exam} ({e.examCode})
                  </button>
                ))}
              </div>
            </div>

            {examConfig && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-gray-400">Questions</div>
                  <div className="text-xl font-bold text-gray-100">{examConfig.totalQuestions}</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-gray-400">Time Limit</div>
                  <div className="text-xl font-bold text-gray-100">{examConfig.timeMinutes} min</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-gray-400">Passing Score</div>
                  <div className="text-xl font-bold text-gray-100">{examConfig.passingScore}/{examConfig.maxScore}</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-3">
                  <div className="text-gray-400">Available Questions</div>
                  <div className="text-xl font-bold text-gray-100">{availableCount}</div>
                </div>
              </div>
            )}

            <button
              onClick={startExam}
              disabled={availableCount === 0}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors min-h-[44px]"
            >
              {availableCount < neededCount
                ? `Start Exam (${availableCount}/${neededCount} questions available)`
                : 'Start Practice Exam'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // EXAM
  if (phase === 'exam') {
    const q = examQuestions[currentIdx];
    const currentAnswer = answers[currentIdx];
    const isWarning = timeRemaining <= 15 * 60;
    const domainId = q.objectiveId.split('.')[0] + '.0';
    const color = getDomainColor(domainId, q.exam);

    const answeredCount = answers.filter((a, i) => isAnswered(a, examQuestions[i])).length;
    const flaggedCount = answers.filter(a => a.flagged).length;

    return (
      <div className="max-w-6xl mx-auto">
        {/* Timer Warning Banner */}
        {isWarning && (
          <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-2 rounded-lg mb-4 text-center text-sm font-medium">
            Warning: Less than 15 minutes remaining!
          </div>
        )}

        <div className="flex gap-6">
          {/* Main Content */}
          <div className="flex-1 space-y-4">
            {/* Timer + Progress */}
            <div className="flex items-center justify-between bg-gray-800 rounded-xl border border-gray-700 px-4 py-3">
              <div className="text-sm text-gray-400">
                Question {currentIdx + 1} of {examQuestions.length}
              </div>
              <div className={`text-xl font-mono font-bold ${isWarning ? 'text-red-400' : 'text-gray-100'}`}>
                {formatTime(timeRemaining)}
              </div>
              <div className="text-sm text-gray-400">
                {answeredCount} answered | {flaggedCount} flagged
              </div>
            </div>

            {/* Question */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs text-gray-500">{q.domain} / {q.objectiveId}</span>
              </div>
              <p className="text-lg text-gray-100 leading-relaxed">{q.question}</p>
            </div>

            {/* Matching or MC Options */}
            {q.questionType === 'matching' ? (
              <MatchingQuestionView
                question={q}
                onAnswer={setMatchingPairs}
                showResult={false}
                disabled={false}
              />
            ) : (
              <div className="space-y-3">
                {Object.entries(q.options).map(([key, value]) => (
                  <button
                    key={key}
                    onClick={() => selectAnswer(key)}
                    className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-colors min-h-[44px] ${
                      currentAnswer?.answer === key
                        ? 'bg-blue-900/30 border-blue-600'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
                      {key}
                    </span>
                    <span className="text-sm text-gray-200 pt-1">{value}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Navigation + Flag */}
            <div className="flex items-center justify-between">
              <button
                onClick={toggleFlag}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                  currentAnswer?.flagged
                    ? 'bg-yellow-600/20 border border-yellow-600/40 text-yellow-400'
                    : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
                }`}
              >
                {currentAnswer?.flagged ? 'Flagged' : 'Flag for Review'}
              </button>

              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
                  disabled={currentIdx === 0}
                  className="px-4 py-2 bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 disabled:opacity-50 rounded-lg text-sm min-h-[44px]"
                >
                  Previous
                </button>
                {currentIdx < examQuestions.length - 1 ? (
                  <button
                    onClick={() => setCurrentIdx(currentIdx + 1)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium min-h-[44px]"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={() => setShowConfirm(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium min-h-[44px]"
                  >
                    Submit Exam
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Question Navigation Grid */}
          <div className="hidden lg:block w-64 shrink-0">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 sticky top-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Questions</h3>
              <div className="grid grid-cols-5 gap-2">
                {examQuestions.map((eq, i) => {
                  const a = answers[i];
                  const answered = isAnswered(a, eq);
                  let bg = 'bg-gray-700 text-gray-400'; // unanswered
                  if (a?.flagged) bg = 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/40';
                  else if (answered) bg = 'bg-blue-600/30 text-blue-400';
                  if (i === currentIdx) bg += ' ring-2 ring-white/50';

                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentIdx(i)}
                      className={`w-10 h-10 rounded-lg text-xs font-medium ${bg} transition-colors`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gray-700" /> Unanswered
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-600/30" /> Answered
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-yellow-600/30" /> Flagged
                </div>
              </div>

              <button
                onClick={() => setShowConfirm(true)}
                className="w-full mt-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium min-h-[44px]"
              >
                Submit Exam
              </button>
            </div>
          </div>
        </div>

        {/* Confirm Dialog */}
        {showConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 max-w-md w-full">
              <h3 className="text-lg font-bold text-gray-100 mb-2">Submit Exam?</h3>
              <p className="text-sm text-gray-400 mb-1">
                You have answered {answeredCount} of {examQuestions.length} questions.
              </p>
              {answeredCount < examQuestions.length && (
                <p className="text-sm text-yellow-400 mb-4">
                  {examQuestions.length - answeredCount} questions are unanswered!
                </p>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm min-h-[44px]"
                >
                  Continue Exam
                </button>
                <button
                  onClick={() => { setShowConfirm(false); submitExam(); }}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium min-h-[44px]"
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // RESULTS
  if (!examResult) return null;

  const passingScore = examConfig?.passingScore ?? 675;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Score Header */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
        <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-4 ${
          examResult.passed
            ? 'bg-green-900/50 text-green-400 border border-green-600'
            : 'bg-red-900/50 text-red-400 border border-red-600'
        }`}>
          {examResult.passed ? 'PASS' : 'FAIL'}
        </div>
        <div className="text-5xl font-bold text-gray-100 mb-2">
          {examResult.score} <span className="text-xl text-gray-400">/ 900</span>
        </div>
        <p className="text-gray-400">
          {examResult.correctAnswers} of {examResult.totalQuestions} correct |
          Passing: {passingScore}/900 |
          Time: {formatTime(examResult.timeSpent)}
        </p>
      </div>

      {/* Domain Breakdown */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Domain Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(examResult.domainScores).map(([domainName, score]) => {
            const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
            const domainId = domainName.split(' ')[0];
            const color = getDomainColor(domainId, examResult.exam);
            return (
              <div key={domainName} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-gray-300">{domainName}</span>
                  </div>
                  <span className="text-gray-400">{score.correct}/{score.total} ({pct}%)</span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
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

      {/* Missed Questions */}
      {examResult.questionResults.filter(r => !r.correct).length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">
            Missed Questions ({examResult.questionResults.filter(r => !r.correct).length})
          </h3>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {examResult.questionResults
              .filter(r => !r.correct)
              .map(r => {
                const q = examQuestions.find(qq => qq.id === r.questionId);
                if (!q) return null;

                if (r.questionType === 'matching' && q.questionType === 'matching') {
                  return (
                    <div key={r.questionId} className="bg-gray-900 rounded-lg p-4 border border-gray-700/50">
                      <p className="text-sm text-gray-200 mb-2">{q.question}</p>
                      <p className="text-sm text-amber-400 mb-1">{r.correctPairs} of {r.totalPairs} pairs correct</p>
                      <div className="space-y-1 mt-2">
                        {q.pairs.map(cp => {
                          const userPair = r.selectedPairs.find(up => up.left === cp.left);
                          const isRight = userPair?.right === cp.right;
                          return (
                            <div key={cp.left} className="flex items-center gap-2 text-xs">
                              <span className={isRight ? 'text-green-400' : 'text-red-400'}>{isRight ? '\u2713' : '\u2717'}</span>
                              <span className="text-gray-300">{cp.left} &rarr; {cp.right}</span>
                              {!isRight && userPair && <span className="text-gray-500">(you: {userPair.right})</span>}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">{q.explanation}</p>
                    </div>
                  );
                }

                if (r.questionType === 'multiple-choice' && q.questionType === 'multiple-choice') {
                  return (
                    <div key={r.questionId} className="bg-gray-900 rounded-lg p-4 border border-gray-700/50">
                      <p className="text-sm text-gray-200 mb-2">{q.question}</p>
                      {r.selectedAnswer ? (
                        <p className="text-sm text-red-400">Your answer: {r.selectedAnswer} - {q.options[r.selectedAnswer]}</p>
                      ) : (
                        <p className="text-sm text-gray-500">Not answered</p>
                      )}
                      <p className="text-sm text-green-400">Correct: {q.correct} - {q.options[q.correct]}</p>
                      <p className="text-xs text-gray-400 mt-2">{q.explanation}</p>
                    </div>
                  );
                }

                return null;
              })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={() => setPhase('setup')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
        >
          Take Another Exam
        </button>
      </div>
    </div>
  );
}
