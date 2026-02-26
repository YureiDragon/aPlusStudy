import { useState, useMemo } from 'react';
import objectivesData from '../data/objectives.json';
import type { ObjectivesData } from '../types/index.ts';

const data = objectivesData as ObjectivesData;

export default function StudyNotes() {
  const [examChoice, setExamChoice] = useState(data.exams[0]?.exam ?? '');
  const [domainChoice, setDomainChoice] = useState('');
  const [objectiveChoice, setObjectiveChoice] = useState('');

  const exam = useMemo(() => data.exams.find(e => e.exam === examChoice), [examChoice]);
  const domain = useMemo(() => exam?.domains.find(d => d.id === domainChoice), [exam, domainChoice]);
  const objective = useMemo(() => domain?.objectives.find(o => o.id === objectiveChoice), [domain, objectiveChoice]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Selectors */}
      <div className="flex flex-wrap gap-3">
        <select
          value={examChoice}
          onChange={e => { setExamChoice(e.target.value); setDomainChoice(''); setObjectiveChoice(''); }}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px]"
        >
          {data.exams.map(e => (
            <option key={e.exam} value={e.exam}>{e.exam} ({e.examCode})</option>
          ))}
        </select>

        <select
          value={domainChoice}
          onChange={e => { setDomainChoice(e.target.value); setObjectiveChoice(''); }}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px]"
        >
          <option value="">Select Domain</option>
          {exam?.domains.map(d => (
            <option key={d.id} value={d.id}>{d.id} - {d.name}</option>
          ))}
        </select>

        <select
          value={objectiveChoice}
          onChange={e => setObjectiveChoice(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-100 rounded-lg px-3 py-2 text-sm min-h-[44px] max-w-sm"
          disabled={!domainChoice}
        >
          <option value="">Select Objective</option>
          {domain?.objectives.map(o => (
            <option key={o.id} value={o.id}>{o.id} - {o.title.substring(0, 60)}</option>
          ))}
        </select>

        {objective && (
          <button
            onClick={handlePrint}
            className="ml-auto px-4 py-2 bg-gray-800 border border-gray-700 text-gray-400 hover:text-gray-200 rounded-lg text-sm transition-colors min-h-[44px] flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        )}
      </div>

      {/* Notes Display */}
      {!objective ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-12 text-center">
          <p className="text-gray-400">Select an exam, domain, and objective to view study notes.</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 lg:p-8 print:bg-white print:text-black print:border-0">
          {/* Objective Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-mono text-gray-500 print:text-gray-600">
                {examChoice} / {domainChoice} / {objective.id}
              </span>
            </div>
            <h2 className="text-xl font-bold text-gray-100 print:text-black leading-relaxed">
              {objective.title}
            </h2>
          </div>

          {/* Subtopics */}
          {objective.subtopics.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 print:text-gray-600 uppercase tracking-wide mb-3">
                Key Topics
              </h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {objective.subtopics.map((topic, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300 print:text-black">
                    <span className="text-blue-400 print:text-blue-600 mt-0.5 shrink-0">&#8226;</span>
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Study Notes */}
          {objective.studyNotes ? (
            <div className="border-t border-gray-700 print:border-gray-300 pt-6">
              <h3 className="text-sm font-semibold text-gray-400 print:text-gray-600 uppercase tracking-wide mb-3">
                Study Notes
              </h3>
              <div className="prose prose-invert print:prose max-w-none">
                <p className="text-gray-200 print:text-black leading-relaxed whitespace-pre-line text-base">
                  {objective.studyNotes}
                </p>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-700 pt-6">
              <p className="text-gray-500 text-sm">No study notes available for this objective.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
