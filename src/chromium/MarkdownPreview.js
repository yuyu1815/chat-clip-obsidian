/**
 * Markdown preview component for ChatVault Clip
 */

import React, { useState } from 'react';

function MarkdownPreview({ content, title }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) return null;

  const previewLines = content.split('\n').slice(0, 10).join('\n');
  const hasMore = content.split('\n').length > 10;

  return (
    <div className="border-t-2 border-zinc-700 bg-zinc-50">
      <button
        className="w-full px-2 py-1 text-xs text-left bg-zinc-100 hover:bg-zinc-200 flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-semibold">Markdown Preview</span>
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="p-2 max-h-60 overflow-y-auto">
          <div className="text-xs bg-white p-2 rounded border border-zinc-200">
            <div className="font-semibold mb-2">{title}</div>
            <pre className="whitespace-pre-wrap font-mono text-xs">
              {content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default MarkdownPreview;