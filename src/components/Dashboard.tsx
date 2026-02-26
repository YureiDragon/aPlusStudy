import { useMemo, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import objectivesData from '../data/objectives.json';
import flashcardsData from '../data/flashcards.json';
import { storage, STORAGE_KEYS } from '../utils/storage.ts';
import { calculateDomainScore, calculateReadinessScore } from '../utils/scoring.ts';
import { getDomainColor } from '../utils/colors.ts';
import { getDueCards } from '../utils/spaced-repetition.ts';
import { useInstallPrompt } from '../hooks/useInstallPrompt.ts';
import SyncProgress from './SyncProgress.tsx';
import type { ObjectivesData, Flashcard, ObjectiveProgress, StreakData, CardSchedule, AppSettings } from '../types/index.ts';

const data = objectivesData as ObjectivesData;
const flashcards = flashcardsData as Flashcard[];

function getScoreColor(score: number): string {
  if (score >= 80) return '#10B981';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}

function RadialScore({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative w-40 h-40">
      <svg className="w-40 h-40 -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#374151" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="54" fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color }}>{score}%</span>
        <span className="text-xs text-gray-400">Readiness</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [installDismissed, setInstallDismissed] = useState(() => {
    const settings = storage.load<AppSettings>(STORAGE_KEYS.SETTINGS, {});
    return settings?.pwaInstallDismissed ?? false;
  });
  const [syncExpanded, setSyncExpanded] = useState(false);

  const progress = storage.load<ObjectiveProgress[]>(STORAGE_KEYS.PROGRESS, []) ?? [];
  const streak = storage.load<StreakData>(STORAGE_KEYS.STREAK);
  const schedules = storage.load<CardSchedule[]>(STORAGE_KEYS.FLASHCARD_SCHEDULE, []) ?? [];

  // Redirect new users to onboarding
  useEffect(() => {
    const settings = storage.load<AppSettings>(STORAGE_KEYS.SETTINGS, {});
    const hasProgress = progress.length > 0;
    const onboardingDone = settings?.onboardingCompleted === true;
    if (!hasProgress && !onboardingDone) {
      navigate('/onboarding', { replace: true });
    }
  }, [navigate, progress.length]);

  const dismissInstall = () => {
    setInstallDismissed(true);
    const settings = storage.load<AppSettings>(STORAGE_KEYS.SETTINGS, {}) ?? {};
    storage.save<AppSettings>(STORAGE_KEYS.SETTINGS, { ...settings, pwaInstallDismissed: true });
  };

  const dueCardCount = useMemo(() => getDueCards(schedules).length, [schedules]);

  const { readinessScore, domainData, weakObjectives } = useMemo(() => {
    const domainScores: Record<string, number> = {};
    const domainWeights: Record<string, number> = {};
    const domainInfo: { id: string; name: string; exam: string; score: number; weight: number }[] = [];

    for (const exam of data.exams) {
      for (const domain of exam.domains) {
        const key = `${exam.exam}-${domain.id}`;
        const domainProgress = progress.filter(
          p => p.exam === exam.exam && p.objectiveId.startsWith(domain.id.replace('.0', '.'))
        );
        const score = calculateDomainScore(domainProgress);
        domainScores[key] = score;
        domainWeights[key] = domain.weight;
        domainInfo.push({
          id: domain.id,
          name: domain.name,
          exam: exam.exam,
          score,
          weight: domain.weight,
        });
      }
    }

    const readiness = calculateReadinessScore(domainScores, domainWeights);

    // Find weak objectives
    const allObjectives: { id: string; title: string; exam: string; score: number }[] = [];
    for (const exam of data.exams) {
      for (const domain of exam.domains) {
        for (const obj of domain.objectives) {
          const objProgress = progress.find(p => p.objectiveId === obj.id && p.exam === exam.exam);
          const avgScore = objProgress && objProgress.quizScores.length > 0
            ? objProgress.quizScores.reduce((a, b) => a + b, 0) / objProgress.quizScores.length
            : 0;
          allObjectives.push({ id: obj.id, title: obj.title, exam: exam.exam, score: avgScore });
        }
      }
    }
    const weak = allObjectives.sort((a, b) => a.score - b.score).slice(0, 5);

    return { readinessScore: readiness, domainData: domainInfo, weakObjectives: weak };
  }, [progress]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* PWA Install Banner */}
      {canInstall && !installDismissed && (
        <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-white">A+</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-100">Install A+ Study</p>
              <p className="text-xs text-gray-400">Study offline anytime, even without internet.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={dismissInstall}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors min-h-[44px]"
            >
              Dismiss
            </button>
            <button
              onClick={promptInstall}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors min-h-[44px]"
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* Top Row: Readiness + Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Readiness Score */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col items-center justify-center">
          <RadialScore score={readinessScore} />
          <p className="mt-3 text-sm text-gray-400">Exam Readiness</p>
        </div>

        {/* Study Streak */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 flex flex-col items-center justify-center">
          <div className="text-5xl font-bold text-orange-400">
            {streak?.currentStreak ?? 0}
          </div>
          <p className="mt-2 text-sm text-gray-400">Day Streak</p>
          {streak && streak.longestStreak > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Best: {streak.longestStreak} day{streak.longestStreak !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Flashcards Total</span>
            <span className="text-lg font-semibold text-gray-100">{flashcards.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Cards Due</span>
            <span className="text-lg font-semibold text-blue-400">{dueCardCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Cards Reviewed</span>
            <span className="text-lg font-semibold text-gray-100">{schedules.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Objectives Studied</span>
            <span className="text-lg font-semibold text-gray-100">
              {progress.filter(p => p.mastery !== 'not_started').length}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => navigate('/flashcards?due=true')}
          className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-4 text-sm font-medium transition-colors min-h-[44px]"
        >
          Review Due Cards
          {dueCardCount > 0 && (
            <span className="block text-blue-200 text-xs mt-1">{dueCardCount} cards</span>
          )}
        </button>
        <button
          onClick={() => navigate('/exam')}
          className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl p-4 text-sm font-medium transition-colors min-h-[44px]"
        >
          Take Practice Exam
        </button>
        <button
          onClick={() => navigate('/quiz')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl p-4 text-sm font-medium transition-colors min-h-[44px]"
        >
          Quick Quiz
        </button>
        <button
          onClick={() => {
            if (weakObjectives.length > 0) {
              navigate(`/flashcards?exam=${encodeURIComponent(weakObjectives[0].exam)}&objective=${weakObjectives[0].id}`);
            } else {
              navigate('/objectives');
            }
          }}
          className="bg-red-600 hover:bg-red-700 text-white rounded-xl p-4 text-sm font-medium transition-colors min-h-[44px]"
        >
          Weak Areas
        </button>
      </div>

      {/* Domain Mastery */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Domain Mastery</h2>
        <div className="space-y-3">
          {domainData.map(d => {
            const color = getDomainColor(d.id, d.exam);
            return (
              <div key={`${d.exam}-${d.id}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-gray-300">{d.exam} - {d.name}</span>
                    <span className="text-gray-500">({d.weight}%)</span>
                  </div>
                  <span className="font-medium" style={{ color: getScoreColor(d.score) }}>
                    {d.score}%
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${d.score}%`,
                      backgroundColor: getScoreColor(d.score),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Weak Areas */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Weakest Areas</h2>
        {weakObjectives.length === 0 ? (
          <p className="text-gray-400 text-sm">Start studying to see your weak areas here.</p>
        ) : (
          <div className="space-y-2">
            {weakObjectives.map(obj => (
              <button
                key={`${obj.exam}-${obj.id}`}
                onClick={() => navigate(`/flashcards?exam=${encodeURIComponent(obj.exam)}&objective=${obj.id}`)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-900 hover:bg-gray-700 transition-colors text-left min-h-[44px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-gray-500 shrink-0">
                    {obj.exam} {obj.id}
                  </span>
                  <span className="text-sm text-gray-300 truncate">{obj.title}</span>
                </div>
                <span
                  className="text-sm font-medium shrink-0 ml-3"
                  style={{ color: getScoreColor(obj.score) }}
                >
                  {obj.score}%
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sync Progress */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <button
          onClick={() => setSyncExpanded(prev => !prev)}
          className="w-full flex items-center justify-between p-6 text-left min-h-[44px]"
        >
          <h2 className="text-lg font-semibold text-gray-100">Sync Progress</h2>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${syncExpanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {syncExpanded && (
          <div className="px-6 pb-6 border-t border-gray-700 pt-4">
            <SyncProgress />
          </div>
        )}
      </div>
    </div>
  );
}
