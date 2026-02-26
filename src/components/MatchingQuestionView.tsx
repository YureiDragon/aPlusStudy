import { useState, useMemo, useCallback } from 'react';
import type { MatchingQuestion } from '../types/index.ts';

interface MatchingPair {
  left: string;
  right: string;
}

interface Props {
  question: MatchingQuestion;
  onAnswer: (pairs: MatchingPair[]) => void;
  showResult: boolean;
  disabled: boolean;
}

const PAIR_COLORS = [
  { bg: 'bg-blue-600', text: 'text-white' },
  { bg: 'bg-emerald-600', text: 'text-white' },
  { bg: 'bg-purple-600', text: 'text-white' },
  { bg: 'bg-amber-600', text: 'text-white' },
  { bg: 'bg-rose-600', text: 'text-white' },
  { bg: 'bg-cyan-600', text: 'text-white' },
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatchingQuestionView({ question, onAnswer, showResult, disabled }: Props) {
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<MatchingPair[]>([]);

  // Shuffle right-side items once on mount
  const shuffledRight = useMemo(
    () => shuffleArray(question.pairs.map(p => p.right)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question.id]
  );

  const leftItems = question.pairs.map(p => p.left);

  const getPairIndex = useCallback(
    (side: 'left' | 'right', value: string): number => {
      return pairs.findIndex(p => p[side] === value);
    },
    [pairs]
  );

  const handleLeftClick = (left: string) => {
    if (disabled) return;
    const existingIdx = getPairIndex('left', left);
    if (existingIdx !== -1) {
      // Unpair
      const newPairs = pairs.filter((_, i) => i !== existingIdx);
      setPairs(newPairs);
      setSelectedLeft(left);
    } else if (selectedLeft === left) {
      setSelectedLeft(null);
    } else {
      setSelectedLeft(left);
    }
  };

  const handleRightClick = (right: string) => {
    if (disabled || selectedLeft === null) return;

    // Remove any existing pair for this right item
    let newPairs = pairs.filter(p => p.right !== right);
    // Remove any existing pair for the selected left item
    newPairs = newPairs.filter(p => p.left !== selectedLeft);

    newPairs.push({ left: selectedLeft, right });
    setPairs(newPairs);
    setSelectedLeft(null);

    // If all items are paired, notify parent
    if (newPairs.length === question.pairs.length) {
      onAnswer(newPairs);
    }
  };

  const isCorrectPair = (left: string, right: string): boolean => {
    return question.pairs.some(p => p.left === left && p.right === right);
  };

  return (
    <div className="space-y-4">
      {/* Labels */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-sm font-medium text-gray-400 text-center">
          {question.leftLabel}
        </div>
        <div className="text-sm font-medium text-gray-400 text-center">
          {question.rightLabel}
        </div>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          {leftItems.map(left => {
            const pairIdx = getPairIndex('left', left);
            const isPaired = pairIdx !== -1;
            const isSelected = selectedLeft === left;
            const colorIdx = isPaired ? pairIdx % PAIR_COLORS.length : -1;

            let className = 'w-full p-3 rounded-xl border text-left text-sm transition-colors min-h-[44px] flex items-center gap-3';

            if (showResult && isPaired) {
              const pair = pairs[pairIdx];
              if (isCorrectPair(pair.left, pair.right)) {
                className += ' bg-green-900/30 border-green-600 text-green-200';
              } else {
                className += ' bg-red-900/30 border-red-600 text-red-200';
              }
            } else if (isSelected) {
              className += ' bg-blue-900/40 border-blue-500 text-blue-200 ring-2 ring-blue-500/50';
            } else if (isPaired) {
              className += ' bg-gray-800 border-gray-600 text-gray-200';
            } else {
              className += ' bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500';
            }

            return (
              <button
                key={left}
                onClick={() => handleLeftClick(left)}
                disabled={disabled}
                className={className}
              >
                {isPaired && (
                  <span className={`w-6 h-6 rounded-full ${PAIR_COLORS[colorIdx].bg} ${PAIR_COLORS[colorIdx].text} flex items-center justify-center text-xs font-bold shrink-0`}>
                    {pairIdx + 1}
                  </span>
                )}
                <span>{left}</span>
              </button>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          {shuffledRight.map(right => {
            const pairIdx = getPairIndex('right', right);
            const isPaired = pairIdx !== -1;
            const colorIdx = isPaired ? pairIdx % PAIR_COLORS.length : -1;

            let className = 'w-full p-3 rounded-xl border text-left text-sm transition-colors min-h-[44px] flex items-center gap-3';

            if (showResult && isPaired) {
              const pair = pairs[pairIdx];
              if (isCorrectPair(pair.left, pair.right)) {
                className += ' bg-green-900/30 border-green-600 text-green-200';
              } else {
                className += ' bg-red-900/30 border-red-600 text-red-200';
              }
            } else if (isPaired) {
              className += ' bg-gray-800 border-gray-600 text-gray-200';
            } else if (selectedLeft !== null) {
              className += ' bg-gray-800 border-gray-700 text-gray-300 hover:border-blue-500 hover:bg-blue-900/20';
            } else {
              className += ' bg-gray-800 border-gray-700 text-gray-300';
            }

            return (
              <button
                key={right}
                onClick={() => handleRightClick(right)}
                disabled={disabled || selectedLeft === null}
                className={className}
              >
                {isPaired && (
                  <span className={`w-6 h-6 rounded-full ${PAIR_COLORS[colorIdx].bg} ${PAIR_COLORS[colorIdx].text} flex items-center justify-center text-xs font-bold shrink-0`}>
                    {pairIdx + 1}
                  </span>
                )}
                <span>{right}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Result: show correct answers */}
      {showResult && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-2">
          <p className="text-sm font-medium text-gray-300 mb-2">Correct pairings:</p>
          {question.pairs.map(p => {
            const userPair = pairs.find(up => up.left === p.left);
            const isRight = userPair?.right === p.right;
            return (
              <div key={p.left} className="flex items-center gap-2 text-sm">
                <span className={isRight ? 'text-green-400' : 'text-red-400'}>
                  {isRight ? '\u2713' : '\u2717'}
                </span>
                <span className="text-gray-300">{p.left}</span>
                <span className="text-gray-500">&rarr;</span>
                <span className="text-gray-300">{p.right}</span>
                {!isRight && userPair && (
                  <span className="text-gray-500 text-xs">(you: {userPair.right})</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Instructions */}
      {!showResult && !disabled && pairs.length < question.pairs.length && (
        <p className="text-xs text-gray-500 text-center">
          {selectedLeft
            ? `Now tap a ${question.rightLabel.toLowerCase()} item to pair it`
            : `Tap a ${question.leftLabel.toLowerCase()} item to start pairing`}
        </p>
      )}
    </div>
  );
}
