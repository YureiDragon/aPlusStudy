import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import objectivesData from '../data/objectives.json';
import flashcardsData from '../data/flashcards.json';
import questionsData from '../data/questions.json';
import { storage, STORAGE_KEYS } from '../utils/storage.ts';
import { getDomainColor } from '../utils/colors.ts';
import type { ObjectivesData, Flashcard, Question, ObjectiveProgress } from '../types/index.ts';

const data = objectivesData as ObjectivesData;
const flashcards = flashcardsData as Flashcard[];
const questions = questionsData as Question[];

type ExamFilter = 'Core 1' | 'Core 2' | 'Both';

export default function ObjectiveBrowser() {
  const navigate = useNavigate();
  const [examFilter, setExamFilter] = useState<ExamFilter>('Both');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  const progress = storage.load<ObjectiveProgress[]>(STORAGE_KEYS.PROGRESS, []) ?? [];

  const filteredExams = useMemo(() => {
    if (examFilter === 'Both') return data.exams;
    return data.exams.filter(e => e.exam === examFilter);
  }, [examFilter]);

  const toggleDomain = (key: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getMasteryBadge = (objectiveId: string, exam: string) => {
    const objProgress = progress.find(p => p.objectiveId === objectiveId && p.exam === exam);
    if (!objProgress || objProgress.mastery === 'not_started') {
      return <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">Not Started</span>;
    }
    if (objProgress.mastery === 'mastered') {
      return <span className="px-2 py-0.5 rounded text-xs bg-green-900/50 text-green-400">Mastered</span>;
    }
    return <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/50 text-yellow-400">In Progress</span>;
  };

  const getObjectiveCounts = (objectiveId: string, exam: string) => {
    const fcCount = flashcards.filter(f => f.objectiveId === objectiveId && f.exam === exam).length;
    const qCount = questions.filter(q => q.objectiveId === objectiveId && q.exam === exam).length;
    return { fcCount, qCount };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tab Filter */}
      <div className="flex gap-2">
        {(['Core 1', 'Core 2', 'Both'] as ExamFilter[]).map(tab => (
          <button
            key={tab}
            onClick={() => setExamFilter(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
              examFilter === tab
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Domain Accordion */}
      <div className="space-y-3">
        {filteredExams.map(exam =>
          exam.domains.map(domain => {
            const domainKey = `${exam.exam}-${domain.id}`;
            const isExpanded = expandedDomains.has(domainKey);
            const color = getDomainColor(domain.id, exam.exam);

            return (
              <div key={domainKey} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {/* Domain Header */}
                <button
                  onClick={() => toggleDomain(domainKey)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-750 transition-colors text-left min-h-[44px]"
                >
                  <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-gray-500">{exam.exam}</span>
                      <span className="text-base font-semibold text-gray-100">
                        Domain {domain.id} - {domain.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">{domain.weight}% of exam</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">{domain.objectives.length} objectives</span>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Objectives List */}
                {isExpanded && (
                  <div className="border-t border-gray-700">
                    {domain.objectives.map(objective => {
                      const counts = getObjectiveCounts(objective.id, exam.exam);
                      return (
                        <button
                          key={objective.id}
                          onClick={() =>
                            navigate(`/flashcards?exam=${encodeURIComponent(exam.exam)}&objective=${objective.id}`)
                          }
                          className="w-full flex items-center justify-between p-4 pl-10 border-b border-gray-700/50 last:border-b-0 hover:bg-gray-900/50 transition-colors text-left min-h-[44px]"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-sm font-mono text-gray-500 shrink-0">{objective.id}</span>
                              <span className="text-sm text-gray-200">{objective.title}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5">
                              {getMasteryBadge(objective.id, exam.exam)}
                              <span className="text-xs text-gray-500">
                                {counts.fcCount} flashcard{counts.fcCount !== 1 ? 's' : ''}
                              </span>
                              <span className="text-xs text-gray-500">
                                {counts.qCount} question{counts.qCount !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-500 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
