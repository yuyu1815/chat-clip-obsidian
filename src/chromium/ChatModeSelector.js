/**
 * Chat mode selector component for ChatVault Clip
 */

import React from 'react';

function ChatModeSelector({ mode, onModeChange, messageCount, onMessageCountChange, isOnChatPage }) {
  const modes = [
    { value: 'single', label: 'Single Message', icon: '💬', description: 'Save one AI chat message' },
    { value: 'selection', label: 'Selected Text', icon: '✂️', description: 'Save highlighted text' },
    { value: 'lastN', label: 'Recent Messages', icon: '📋', description: 'Save last N messages' },
    { value: 'full', label: 'Full Thread', icon: '📚', description: 'Save entire conversation' }
  ];

  const availableModes = isOnChatPage ? modes : [];

  return (
    <div className="border-b-2 border-zinc-700 bg-zinc-100 p-2">
      <div className="flex flex-wrap gap-1">
        {availableModes.map((modeOption) => (
          <button
            key={modeOption.value}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === modeOption.value
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-700'
            }`}
            onClick={() => onModeChange(modeOption.value)}
            title={modeOption.description}
          >
            <span className="mr-1">{modeOption.icon}</span>
            {modeOption.label}
          </button>
        ))}
      </div>
      
      {mode === 'lastN' && (
        <div className="mt-2 flex items-center gap-2">
          <label className="text-xs text-zinc-600">Number of messages:</label>
          <input
            type="number"
            min="1"
            max="100"
            value={messageCount}
            onChange={(e) => onMessageCountChange(parseInt(e.target.value) || 30)}
            className="w-16 px-2 py-1 text-xs rounded border border-zinc-300"
          />
        </div>
      )}
    </div>
  );
}

export default ChatModeSelector;