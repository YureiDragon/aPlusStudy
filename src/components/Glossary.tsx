import { useState, useMemo } from 'react';
import glossaryData from '../data/glossary.json';
import type { GlossaryTerm } from '../types/index.ts';

const allTerms = glossaryData as GlossaryTerm[];

type QuizMode = 'none' | 'acronym' | 'definition';

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateQuizOptions(correct: GlossaryTerm, allTermsPool: GlossaryTerm[], mode: 'acronym' | 'definition'): string[] {
  const getValue = (t: GlossaryTerm) => mode === 'acronym' ? t.fullName : t.term;
  const correctVal = getValue(correct);
  const others = shuffleArray(allTermsPool.filter(t => getValue(t) !== correctVal))
    .slice(0, 3)
    .map(getValue);
  return shuffleArray([correctVal, ...others]);
}

export default function Glossary() {
  const [search, setSearch] = useState('');
  const [examFilter, setExamFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [quizMode, setQuizMode] = useState<QuizMode>('none');
  const [quizTerms, setQuizTerms] = useState<GlossaryTerm[]>([]);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [quizSelected, setQuizSelected] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

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

  const startQuiz = (mode: 'acronym' | 'definition') => {
    const pool = filteredTerms.length >= 4 ? filteredTerms : allTerms;
    if (pool.length < 4) return; // Need at least 4 terms
    const shuffled = shuffleArray(pool);
    setQuizTerms(shuffled);
    setQuizIdx(0);
    setQuizSelected(null);
    setQuizScore({ correct: 0, total: 0 });
    setQuizOptions(generateQuizOptions(shuffled[0], pool, mode));
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
  };

  const nextQuizQuestion = () => {
    const pool = filteredTerms.length >= 4 ? filteredTerms : allTerms;
    if (quizIdx < quizTerms.length - 1) {
      const nextIdx = quizIdx + 1;
      setQuizIdx(nextIdx);
      setQuizSelected(null);
      setQuizOptions(generateQuizOptions(quizTerms[nextIdx], pool, quizMode as 'acronym' | 'definition'));
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
          {quizOptions.map(option => {
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
                key={option}
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

      {/* Quiz Mode Buttons */}
      <div className="flex gap-3">
        <button
          onClick={() => startQuiz('acronym')}
          disabled={allTerms.length < 4}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors min-h-[44px]"
        >
          Acronym Quiz
        </button>
        <button
          onClick={() => startQuiz('definition')}
          disabled={allTerms.length < 4}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors min-h-[44px]"
        >
          Definition Quiz
        </button>
        <span className="text-sm text-gray-500 self-center">
          {filteredTerms.length} term{filteredTerms.length !== 1 ? 's' : ''}
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
                    <td className="px-4 py-3 text-gray-100 font-medium whitespace-nowrap">{term.term}</td>
                    <td className="px-4 py-3 text-gray-300">{term.fullName}</td>
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
