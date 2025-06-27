import React, { useState, useEffect } from 'react';

const ChatModeSelector = ({ onModeChange, onCountChange, defaultMode = 'single', defaultCount = 30 }) => {
  const [selectedMode, setSelectedMode] = useState(defaultMode);
  const [messageCount, setMessageCount] = useState(defaultCount);
  const [isCountValid, setIsCountValid] = useState(true);

  const modes = [
    {
      id: 'single',
      name: 'Single Message',
      description: 'Save the current message',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      )
    },
    {
      id: 'selection',
      name: 'Selected Text',
      description: 'Save highlighted text only',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      id: 'recent',
      name: 'Recent Messages',
      description: 'Save the last N messages',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      hasCount: true
    },
    {
      id: 'full',
      name: 'Full Conversation',
      description: 'Save the entire chat thread',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    }
  ];

  useEffect(() => {
    if (onModeChange) {
      onModeChange(selectedMode);
    }
  }, [selectedMode, onModeChange]);

  useEffect(() => {
    if (onCountChange && selectedMode === 'recent') {
      onCountChange(messageCount);
    }
  }, [messageCount, selectedMode, onCountChange]);

  const handleModeSelect = (modeId) => {
    setSelectedMode(modeId);
  };

  const handleCountChange = (e) => {
    const value = parseInt(e.target.value) || 0;
    setMessageCount(value);
    setIsCountValid(value > 0 && value <= 100);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white mb-3">Save Mode</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleModeSelect(mode.id)}
            className={`
              relative p-4 rounded-lg border-2 transition-all duration-200
              ${selectedMode === mode.id 
                ? 'border-blue-500 bg-blue-500/20 text-white' 
                : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500 hover:bg-gray-700'
              }
            `}
          >
            <div className="flex flex-col items-center space-y-2">
              <div className={`${selectedMode === mode.id ? 'text-blue-400' : 'text-gray-400'}`}>
                {mode.icon}
              </div>
              <div className="text-sm font-medium">{mode.name}</div>
              <div className="text-xs text-gray-400 text-center">{mode.description}</div>
            </div>
            
            {selectedMode === mode.id && (
              <div className="absolute top-2 right-2">
                <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedMode === 'recent' && (
        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Number of messages to save
          </label>
          <div className="flex items-center space-x-3">
            <input
              type="number"
              min="1"
              max="100"
              value={messageCount}
              onChange={handleCountChange}
              className={`
                flex-1 px-3 py-2 bg-gray-700 border rounded-md text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500
                ${!isCountValid ? 'border-red-500' : 'border-gray-600'}
              `}
            />
            <span className="text-gray-400 text-sm">messages</span>
          </div>
          {!isCountValid && (
            <p className="mt-1 text-xs text-red-400">Please enter a number between 1 and 100</p>
          )}
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
        <div className="flex items-start space-x-2">
          <svg className="w-4 h-4 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-xs text-gray-400">
            <p className="font-medium text-gray-300">Quick tip:</p>
            <p>Use "Single Message" for important responses, "Recent Messages" for context, and "Full Conversation" for complete records.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatModeSelector;