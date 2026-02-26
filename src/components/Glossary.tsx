import { useState, useMemo } from 'react';
import glossaryData from '../data/glossary.json';
import { storage, STORAGE_KEYS } from '../utils/storage.ts';
import type { GlossaryTerm, GlossaryProgress } from '../types/index.ts';

const allTerms = glossaryData as GlossaryTerm[];

type QuizMode = 'none' | 'acronym' | 'definition';
type FocusFilter = '' | 'not_started' | 'in_progress' | 'needs_review';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function computeMastery(p: GlossaryProgress | undefined): 'not_started' | 'in_progress' | 'mastered' {
  if (!p || p.attemptCount === 0) return 'not_started';
  if (p.correctCount / p.attemptCount >= 0.8 && p.attemptCount >= 3) return 'mastered';
  return 'in_progress';
}

function generateQuizOptions(correct: GlossaryTerm, allTermsPool: GlossaryTerm[], mode: 'acronym' | 'definition'): string[] {
  const getValue = (t: GlossaryTerm) => mode === 'acronym' ? t.fullName : t.term;
  const correctVal = getValue(correct);
  const seen = new Set<string>([correctVal]);
  const others: string[] = [];
  for (const t of shuffleArray(allTermsPool)) {
    const v = getValue(t);
    if (v && v.trim() !== '' && !seen.has(v)) {
      seen.add(v);
      others.push(v);
      if (others.length >= 3) break;
    }
  }
  return shuffleArray([correctVal, ...others]);
}

export default function Glossary() {
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('');

  const [quizMode, setQuizMode] = useState<QuizMode>('none');
  const [quizTerms, setQuizTerms] = useState<GlossaryTerm[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizCount, setQuizCount] = useState<number>(0); // 0 = All

  // Progress tracking — reload when quiz ends (quizMode changes back to 'none')
  const [progressVersion, setProgressVersion] = useState(0);
  const progressData = useMemo(() => {
    return storage.load<GlossaryProgress[]>(STORAGE_KEYS.GLOSSARY_PROGRESS, []) ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressVersion, quizMode]);

  const progressMap = useMemo(() => {
    return new Map(progressData.map(p => [p.term, p]));
  }, [progressData]);

  // Filter options
  const exams = useMemo(() => [...new Set(allTerms.map(t => t.exam))].sort(), []);
  const domains = useMemo(() => [...new Set(allTerms.map(t => t.domain))].sort(), []);
  const categories = useMemo(() => [...new Set(allTerms.map(t => t.category))].sort(), []);

  // Filtered terms
  const filteredTerms = useMemo(() => {
    let terms = allTerms;
    if (search) {
      const s = search.toLowerCase();
      terms = terms.filter(t =>
        t.term.toLowerCase().includes(s) ||
        t.fullName.toLowerCase().includes(s) ||
        t.definition.toLowerCase().includes(s)
      );
    }
    if (examFilter) terms = terms.filter(t => t.exam === examFilter);
    if (domainFilter) terms = terms.filter(t => t.domain === domainFilter);
    if (categoryFilter) terms = terms.filter(t => t.category === categoryFilter);
    return terms.sort((a, b) => a.term.localeCompare(b.term));
  }, [search, examFilter, domainFilter, categoryFilter]);

  // For acronym quiz: only include terms with non-empty fullName that differs from term
  const acronymQuizPool = useMemo(() => {
    const base = filteredTerms.length >= 4 ? filteredTerms : allTerms;
    let pool = base.filter(t => t.fullName.trim() !== '' && t.fullName !== t.term);
    if (focusFilter) {
      pool = pool.filter(t => {
        const mastery = computeMastery(progressMap.get(t.term));
        if (focusFilter === 'not_started') return mastery === 'not_started';
        if (focusFilter === 'in_progress') return mastery === 'in_progress';
        if (focusFilter === 'needs_review') return mastery !== 'mastered';
        return true;
      });
    }
    return pool;
  }, [filteredTerms, focusFilter, progressMap]);

  // Definition quiz pool with focus filter
  const definitionQuizPool = useMemo(() => {
    let pool = filteredTerms.length >= 4 ? filteredTerms : allTerms;
    if (focusFilter) {
      pool = pool.filter(t => {
        const mastery = computeMastery(progressMap.get(t.term));
        if (focusFilter === 'not_started') return mastery === 'not_started';
        if (focusFilter === 'in_progress') return mastery === 'in_progress';
        if (focusFilter === 'needs_review') return mastery !== 'mastered';
        return true;
      });
    }
    return pool;
  }, [filteredTerms, focusFilter, progressMap]);

  const updateProgress = (term: GlossaryTerm, isCorrect: boolean) => {
    const all = storage.load<GlossaryProgress[]>(STORAGE_KEYS.GLOSSARY_PROGRESS, []) ?? [];
    const idx = all.findIndex(p => p.term === term.term);
    const existing = idx >= 0 ? all[idx] : null;

    const correctCount = (existing?.correctCount ?? 0) + (isCorrect ? 1 : 0);
    const attemptCount = (existing?.attemptCount ?? 0) + 1;

    const updated: GlossaryProgress = {
      term: term.term,
      exam: term.exam,
      domain: term.domain,
      correctCount,
      attemptCount,
      lastStudied: new Date().toISOString(),
      mastery: computeMastery({ correctCount, attemptCount } as GlossaryProgress),
    };

    if (idx >= 0) {
      all[idx] = updated;
    } else {
      all.push(updated);
    }
    storage.save(STORAGE_KEYS.GLOSSARY_PROGRESS, all);
    setProgressVersion(v => v + 1);
  };

  const startQuiz = (mode: 'acronym' | 'definition') => {
    const pool = mode === 'acronym' ? acronymQuizPool : definitionQuizPool;
    // Need at least 4 for options generation
    const optionsPool = mode === 'acronym'
      ? (filteredTerms.length >= 4 ? filteredTerms : allTerms).filter(t => t.fullName.trim() !== '' && t.fullName !== t.term)
      : (filteredTerms.length >= 4 ? filteredTerms : allTerms);
    if (pool.length < 1 || optionsPool.length < 4) return;
    const shuffled = shuffleArray(pool);
    const limited = quizCount > 0 ? shuffled.slice(0, quizCount) : shuffled;
    setQuizTerms(limited);
    setQuizIdx(0);
    setQuizSelected(null);
    setQuizScore({ correct: 0, total: 0 });
    setQuizOptions(generateQuizOptions(limited[0], optionsPool, mode));
    setQuizMode(mode);
  };

  const handleQuizAnswer = (answer: string) => {
    if (quizSelected) return;
    setQuizSelected(answer);

    const current = quizTerms[quizIdx];
    const correctVal = quizMode === 'acronym' ? current.fullName : current.term;
    const isCorrect = answer === correctVal;

    setQuizScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1,
    }));

    // Update progress
    updateProgress(current, isCorrect);
  };

  const nextQuizQuestion = () => {
    const optionsPool = quizMode === 'acronym'
      ? (filteredTerms.length >= 4 ? filteredTerms : allTerms).filter(t => t.fullName.trim() !== '' && t.fullName !== t.term)
      : (filteredTerms.length >= 4 ? filteredTerms : allTerms);
    if (quizIdx < quizTerms.length - 1) {
      const nextIdx = quizIdx + 1;
      setQuizIdx(nextIdx);
      setQuizSelected(null);
      setQuizOptions(generateQuizOptions(quizTerms[nextIdx], optionsPool, quizMode as 'acronym' | 'definition'));
    } else {
      setQuizMode('none');
    }
  };

  // Quiz Mode
  if (quizMode !== 'none' && quizTerms.length > 0) {
    const current = quizTerms[quizIdx];
    const correctVal = quizMode === 'acronym' ? current.fullName : current.term;
    const prompt = quizMode === 'acronym' ? current.term : current.definition;
    const promptLabel = quizMode === 'acronym' ? 'What does this acronym stand for?' : 'What term matches this definition?';

    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Quiz Header */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Question {quizIdx + 1} of {quizTerms.length}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-green-400">{quizScore.correct} correct</span>
            <span className="text-sm text-gray-400">/ {quizScore.total}</span>
            <button
              onClick={() => setQuizMode('none')}
              className="text-sm text-gray-400 hover:text-gray-200 underline"
            >
              End Quiz
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${(quizIdx / quizTerms.length) * 100}%` }}
          />
        </div>

        {/* Question */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
          <p className="text-xs text-gray-500 mb-2">{promptLabel}</p>
          <p className="text-2xl font-bold text-gray-100">{prompt}</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quizOptions.map((option, idx) => {
            let cls = 'bg-gray-800 border-gray-700 hover:border-gray-500';
            if (quizSelected) {
              if (option === correctVal) {
                cls = 'bg-green-900/30 border-green-600';
              } else if (option === quizSelected && option !== correctVal) {
                cls = 'bg-red-900/30 border-red-600';
              } else {
                cls = 'bg-gray-800 border-gray-700 opacity-50';
              }
            }
            return (
              <button
                key={`${option}-${idx}`}
                onClick={() => handleQuizAnswer(option)}
                disabled={quizSelected !== null}
                className={`p-4 rounded-xl border text-left text-sm text-gray-200 transition-colors min-h-[44px] ${cls}`}
              >
                {option}
              </button>
            );
          })}
        </div>

        {/* Next */}
        {quizSelected && (
          <div className="flex justify-center">
            <button
              onClick={nextQuizQuestion}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors min-h-[44px]"
            >
              {quizIdx < quizTerms.length - 1 ? 'Next' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Browse Mode
  const getMasteryIndicator = (term: GlossaryTerm) => {
    const mastery = computeMastery(progressMap.get(term.term));
    if (mastery === 'mastered') return <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" title="Mastered" />;
    if (mastery === 'in_progress') return <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" title="In Progress" />;
    return <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-600" title="Not Started" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Search + Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search terms..."
          className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-4 py-2 text-sm min-h-[44px] placeholder-gray-500"
        />
        <select
          value={examFilter}
          onChange={e => setExamFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">All Exams</option>
          {exams.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={domainFilter}
          onChange={e => setDomainFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">All Domains</option>
          {domains.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Focus Filter */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Focus</label>
        <div className="flex gap-2 flex-wrap">
          {([
            ['', 'All'],
            ['not_started', 'Not Studied'],
            ['in_progress', 'In Progress'],
            ['needs_review', 'Needs Review'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFocusFilter(val as FocusFilter)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                focusFilter === val
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Question Count Selector */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Questions</label>
        <div className="flex gap-3">
          {[10, 20, 0].map(n => (
            <button
              key={n}
              onClick={() => setQuizCount(n)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                quizCount === n
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-900 border border-gray-700 text-gray-400 hover:text-gray-200'
              }`}
            >
              {n === 0 ? 'All' : n}
            </button>
          ))}
        </div>
      </div>

      {/* Quiz Mode Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => startQuiz('acronym')}
          disabled={acronymQuizPool.length < 1}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors min-h-[44px]"
        >
          Acronym Quiz
        </button>
        <button
          onClick={() => startQuiz('definition')}
          disabled={definitionQuizPool.length < 1}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors min-h-[44px]"
        >
          Definition Quiz
        </button>
        <span className="text-sm text-gray-500 self-center">
          {filteredTerms.length} term{filteredTerms.length !== 1 ? 's' : ''}
          {' | '}{acronymQuizPool.length} acronym{acronymQuizPool.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Terms Table */}
      {filteredTerms.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <p className="text-gray-400">
            {allTerms.length === 0
              ? 'No glossary terms loaded yet. The glossary data file will be added later.'
              : 'No terms match your search.'}
          </p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 text-left">
                  <th className="px-2 py-3 text-gray-400 font-medium w-8"></th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Term</th>
                  <th className="px-4 py-3 text-gray-400 font-medium">Full Name</th>
                  <th className="px-4 py-3 text-gray-400 font-medium hidden md:table-cell">Definition</th>
                  <th className="px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Exam</th>
                  <th className="px-4 py-3 text-gray-400 font-medium hidden lg:table-cell">Domain</th>
                </tr>
              </thead>
              <tbody>
                {filteredTerms.map((term, i) => (
                  <tr key={`${term.term}-${i}`} className="border-b border-gray-700/50 hover:bg-gray-900/50">
                    <td className="px-2 py-3 text-center">{getMasteryIndicator(term)}</td>
                    <td className="px-4 py-3 text-gray-100 font-medium whitespace-nowrap">{term.term}</td>
                    <td className="px-4 py-3 text-gray-300">{term.fullName !== term.term ? term.fullName : ''}</td>
                    <td className="px-4 py-3 text-gray-400 hidden md:table-cell max-w-md truncate">{term.definition}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell whitespace-nowrap">{term.exam}</td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell whitespace-nowrap">{term.domain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
