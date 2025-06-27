import React, { useState, useEffect } from 'react';

const MarkdownPreview = ({ content, isLoading = false, maxHeight = '400px' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formattedContent, setFormattedContent] = useState('');

  useEffect(() => {
    // Simple markdown formatting for preview
    if (content) {
      let formatted = content;
      
      // Headers
      formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2 text-gray-200">$1</h3>');
      formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2 text-gray-100">$1</h2>');
      formatted = formatted.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-3 text-white">$1</h1>');
      
      // Code blocks
      formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<div class="bg-gray-900 rounded-md p-3 my-2 overflow-x-auto">
          <code class="text-sm text-gray-300 font-mono">${escapeHtml(code.trim())}</code>
        </div>`;
      });
      
      // Inline code
      formatted = formatted.replace(/`([^`]+)`/g, '<code class="bg-gray-700 px-1 py-0.5 rounded text-sm text-gray-300">$1</code>');
      
      // Bold
      formatted = formatted.replace(/\*\*([^\*]+)\*\*/g, '<strong class="font-semibold text-gray-100">$1</strong>');
      
      // Italic
      formatted = formatted.replace(/\*([^\*]+)\*/g, '<em class="italic">$1</em>');
      
      // Links
      formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-400 hover:underline">$1</a>');
      
      // Line breaks
      formatted = formatted.replace(/\n/g, '<br />');
      
      // Math blocks (basic support)
      formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="bg-gray-800 p-2 my-2 rounded font-mono text-sm text-green-400">$1</div>');
      
      setFormattedContent(formatted);
    }
  }, [content]);

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-700 rounded w-5/6"></div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-sm">No content to preview</p>
        <p className="text-xs text-gray-600 mt-1">Select a save mode to see the preview</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-300">Markdown Preview</h4>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          )}
        </button>
      </div>
      
      <div 
        className={`p-4 overflow-y-auto transition-all duration-300 ${
          isExpanded ? 'max-h-none' : ''
        }`}
        style={{ maxHeight: isExpanded ? 'none' : maxHeight }}
      >
        <div className="prose prose-invert prose-sm max-w-none">
          <div 
            className="text-gray-300 break-words"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        </div>
      </div>

      {!isExpanded && content.length > 500 && (
        <div className="px-4 py-2 bg-gradient-to-t from-gray-800 to-transparent">
          <button
            onClick={() => setIsExpanded(true)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Show more...
          </button>
        </div>
      )}

      <div className="px-4 py-2 bg-gray-900 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{content.length} characters</span>
          <span>{content.split('\n').length} lines</span>
        </div>
      </div>
    </div>
  );
};

export default MarkdownPreview;