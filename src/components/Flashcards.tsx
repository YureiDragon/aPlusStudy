import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import objectivesData from '../data/objectives.json';
import flashcardsData from '../data/flashcards.json';
import { storage, STORAGE_KEYS } from '../utils/storage.ts';
import { Quality, createNewCardSchedule, calculateNextReview, isDueForReview } from '../utils/spaced-repetition.ts';
import { updateStreak } from '../utils/scoring.ts';
import { getDomainColor } from '../utils/colors.ts';
import type { ObjectivesData, Flashcard, CardSchedule, StreakData } from '../types/index.ts';

const data = objectivesData as ObjectivesData;
const allFlashcards = flashcardsData as Flashcard[];

interface SessionResult {
  totalReviewed: number;
  ratings: Record<string, number>;
}

export default function Flashcards() {
  const [searchParams] = useSearchParams();

  const [examFilter, setExamFilter] = useState(searchParams.get('exam') || '');
  const [domainFilter, setDomainFilter] = useState(searchParams.get('domain') || '');
  const [objectiveFilter, setObjectiveFilter] = useState(searchParams.get('objective') || '');
  const [dueOnly, setDueOnly] = useState(searchParams.get('due') === 'true');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult>({
    totalReviewed: 0,
    ratings: { Again: 0, Hard: 0, Good: 0, Easy: 0 },
  });

  const schedules = storage.load<CardSchedule[]>(STORAGE_KEYS.FLASHCARD_SCHEDULE, []) ?? [];

  // Build filter options
  const exams = useMemo(() => data.exams.map(e => e.exam), []);
  const domains = useMemo(() => {
    if (!examFilter) return [];
    const exam = data.exams.find(e => e.exam === examFilter);
    return exam ? exam.domains.map(d => ({ id: d.id, name: d.name })) : [];
  }, [examFilter]);
  const objectives = useMemo(() => {
    if (!examFilter || !domainFilter) return [];
    const exam = data.exams.find(e => e.exam === examFilter);
    const domain = exam?.domains.find(d => d.id === domainFilter);
    return domain ? domain.objectives.map(o => ({ id: o.id, title: o.title })) : [];
  }, [examFilter, domainFilter]);

  // Filter flashcards
  const filteredCards = useMemo(() => {
    let cards = allFlashcards;
    if (examFilter) cards = cards.filter(c => c.exam === examFilter);
    if (domainFilter) {
      cards = cards.filter(c => c.objectiveId.startsWith(domainFilter.replace('.0', '.')));
    }
    if (objectiveFilter) cards = cards.filter(c => c.objectiveId === objectiveFilter);
    if (dueOnly) {
      cards = cards.filter(c => {
        const sched = schedules.find(s => s.cardId === c.id);
        return !sched || isDueForReview(sched);
      });
    }
    return cards;
  }, [examFilter, domainFilter, objectiveFilter, dueOnly, schedules]);

  const currentCard = filteredCards[currentIndex] ?? null;

  const handleRating = useCallback((quality: Quality, label: string) => {
    if (!currentCard) return;

    // Update schedule
    const currentSchedules = storage.load<CardSchedule[]>(STORAGE_KEYS.FLASHCARD_SCHEDULE, []) ?? [];
    const existingIndex = currentSchedules.findIndex(s => s.cardId === currentCard.id);
    const existing = existingIndex >= 0 ? currentSchedules[existingIndex] : createNewCardSchedule(currentCard.id);
    const updated = calculateNextReview(existing, quality);

    if (existingIndex >= 0) {
      currentSchedules[existingIndex] = updated;
    } else {
      currentSchedules.push(updated);
    }
    storage.save(STORAGE_KEYS.FLASHCARD_SCHEDULE, currentSchedules);

    // Update streak
    const currentStreak = storage.load<StreakData>(STORAGE_KEYS.STREAK);
    storage.save(STORAGE_KEYS.STREAK, updateStreak(currentStreak));

    // Update session result
    setSessionResult(prev => ({
      totalReviewed: prev.totalReviewed + 1,
      ratings: { ...prev.ratings, [label]: prev.ratings[label] + 1 },
    }));

    // Move to next card
    if (currentIndex < filteredCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setSessionDone(true);
    }
  }, [currentCard, currentIndex, filteredCards.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!sessionDone && currentCard) setIsFlipped(prev => !prev);
      }
      if (isFlipped && !sessionDone) {
        if (e.key === '1') handleRating(Quality.Again, 'Again');
        if (e.key === '2') handleRating(Quality.Hard, 'Hard');
        if (e.key === '3') handleRating(Quality.Good, 'Good');
        if (e.key === '4') handleRating(Quality.Easy, 'Easy');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFlipped, sessionDone, currentCard, handleRating]);

  const resetSession = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionDone(false);
    setSessionResult({ totalReviewed: 0, ratings: { Again: 0, Hard: 0, Good: 0, Easy: 0 } });
  };

  // Session Summary
  if (sessionDone) {
    const total = sessionResult.totalReviewed;
    const goodOrBetter = sessionResult.ratings.Good + sessionResult.ratings.Easy;
    const accuracy = total > 0 ? Math.round((goodOrBetter / total) * 100) : 0;

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Session Complete</h2>
          <p className="text-gray-400 mb-6">Great work! Here is your summary.</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-blue-400">{total}</div>
              <div className="text-sm text-gray-400">Cards Reviewed</div>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-3xl font-bold text-green-400">{accuracy}%</div>
              <div className="text-sm text-gray-400">Accuracy (Good+Easy)</div>
            </div>
          </div>

          <div className="flex justify-center gap-4 mb-6">
            {Object.entries(sessionResult.ratings).map(([label, count]) => {
              const colors: Record<string, string> = {
                Again: 'text-red-400',
                Hard: 'text-orange-400',
                Good: 'text-blue-400',
                Easy: 'text-green-400',
              };
              return (
                <div key={label} className="text-center">
                  <div className={`text-xl font-bold ${colors[label]}`}>{count}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              );
            })}
          </div>

          <button
            onClick={resetSession}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
          >
            Study Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <select
          value={examFilter}
          onChange={e => {
            setExamFilter(e.target.value);
            setDomainFilter('');
            setObjectiveFilter('');
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">All Exams</option>
          {exams.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <select
          value={domainFilter}
          onChange={e => {
            setDomainFilter(e.target.value);
            setObjectiveFilter('');
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px]"
          disabled={!examFilter}
        >
          <option value="">All Domains</option>
          {domains.map(d => (
            <option key={d.id} value={d.id}>{d.id} - {d.name}</option>
          ))}
        </select>

        <select
          value={objectiveFilter}
          onChange={e => {
            setObjectiveFilter(e.target.value);
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px] max-w-xs"
          disabled={!domainFilter}
        >
          <option value="">All Objectives</option>
          {objectives.map(o => (
            <option key={o.id} value={o.id}>{o.id} - {o.title.substring(0, 50)}</option>
          ))}
        </select>

        <button
          onClick={() => {
            setDueOnly(!dueOnly);
            setCurrentIndex(0);
            setIsFlipped(false);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
            dueOnly ? 'bg-blue-600 text-white' : 'bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          Due Only
        </button>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          Card {filteredCards.length > 0 ? currentIndex + 1 : 0} of {filteredCards.length}
        </span>
        <span className="text-xs text-gray-500">Space to flip, 1-4 to rate</span>
      </div>

      {/* Card Display */}
      {filteredCards.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <p className="text-gray-400">No flashcards match your filters.</p>
          <p className="text-sm text-gray-500 mt-2">Try adjusting your filters or disabling "Due Only".</p>
        </div>
      ) : currentCard ? (
        <>
          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full bg-gray-800 rounded-xl border border-gray-700 p-8 min-h-[280px] flex flex-col items-center justify-center text-center cursor-pointer hover:border-gray-600 transition-colors"
          >
            {/* Domain color indicator */}
            <div className="mb-4 flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getDomainColor(
                  currentCard.objectiveId.split('.').slice(0, 1).join('.') + '.0',
                  currentCard.exam
                )}}
              />
              <span className="text-xs text-gray-500">
                {currentCard.exam} / {currentCard.domain} / {currentCard.objectiveId}
              </span>
            </div>

            {!isFlipped ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Question</p>
                <p className="text-lg text-gray-100 leading-relaxed">{currentCard.question}</p>
                <p className="text-sm text-gray-500 mt-6">Click or press Space to reveal answer</p>
              </div>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-wide text-green-500 mb-3">Answer</p>
                <p className="text-lg text-gray-100 leading-relaxed mb-4">{currentCard.answer}</p>
                {currentCard.explanation && (
                  <p className="text-sm text-gray-400 mt-4 border-t border-gray-700 pt-4">
                    {currentCard.explanation}
                  </p>
                )}
              </div>
            )}
          </button>

          {/* Rating Buttons */}
          {isFlipped && (
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleRating(Quality.Again, 'Again')}
                className="flex-1 max-w-[140px] py-3 rounded-lg bg-red-600/20 border border-red-600/40 text-red-400 font-medium text-sm hover:bg-red-600/30 transition-colors min-h-[44px]"
              >
                Again (1)
              </button>
              <button
                onClick={() => handleRating(Quality.Hard, 'Hard')}
                className="flex-1 max-w-[140px] py-3 rounded-lg bg-orange-600/20 border border-orange-600/40 text-orange-400 font-medium text-sm hover:bg-orange-600/30 transition-colors min-h-[44px]"
              >
                Hard (2)
              </button>
              <button
                onClick={() => handleRating(Quality.Good, 'Good')}
                className="flex-1 max-w-[140px] py-3 rounded-lg bg-blue-600/20 border border-blue-600/40 text-blue-400 font-medium text-sm hover:bg-blue-600/30 transition-colors min-h-[44px]"
              >
                Good (3)
              </button>
              <button
                onClick={() => handleRating(Quality.Easy, 'Easy')}
                className="flex-1 max-w-[140px] py-3 rounded-lg bg-green-600/20 border border-green-600/40 text-green-400 font-medium text-sm hover:bg-green-600/30 transition-colors min-h-[44px]"
              >
                Easy (4)
              </button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
