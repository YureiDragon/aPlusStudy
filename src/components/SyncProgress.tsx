import { useState } from 'react';
import { generateSyncCode, restoreSyncCode } from '../utils/sync.ts';

export default function SyncProgress() {
  const [generatedCode, setGeneratedCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [restoreInput, setRestoreInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const code = await generateSyncCode();
      setGeneratedCode(code);
    } catch {
      setGeneratedCode('Error generating sync code.');
    }
    setGenerating(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the textarea content
      const textarea = document.querySelector<HTMLTextAreaElement>('#sync-code-output');
      if (textarea) {
        textarea.select();
      }
    }
  };

  const handleRestore = async () => {
    if (!restoreInput.trim()) return;
    setRestoring(true);
    setRestoreMessage(null);

    const result = await restoreSyncCode(restoreInput);

    if (result.success) {
      setRestoreMessage({ type: 'success', text: 'Progress restored! Reloading...' });
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setRestoreMessage({ type: 'error', text: result.error ?? 'Unknown error.' });
    }
    setRestoring(false);
  };

  return (
    <div className="space-y-6">
      {/* Generate Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Generate Code</h3>
        <p className="text-xs text-gray-400">
          Create a sync code to transfer your progress to another device.
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
        >
          {generating ? 'Generating...' : 'Generate Sync Code'}
        </button>

        {generatedCode && (
          <div className="space-y-2">
            <textarea
              id="sync-code-output"
              readOnly
              value={generatedCode}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors min-h-[44px]"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700" />

      {/* Restore Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-300">Restore Code</h3>
        <p className="text-xs text-gray-400">
          Paste a sync code from another device to restore your progress.
        </p>
        <textarea
          value={restoreInput}
          onChange={e => setRestoreInput(e.target.value)}
          placeholder="Paste sync code here (starts with aPS_)"
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-blue-500 placeholder:text-gray-600"
        />
        <button
          onClick={handleRestore}
          disabled={restoring || !restoreInput.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors min-h-[44px]"
        >
          {restoring ? 'Restoring...' : 'Restore'}
        </button>

        {restoreMessage && (
          <p className={`text-sm ${restoreMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {restoreMessage.text}
          </p>
        )}
      </div>
    </div>
  );
}
