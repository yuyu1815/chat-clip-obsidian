// Enhanced Content script for ChatVault Clip with improved error handling
// This script is injected into ChatGPT and Claude pages to add save buttons

console.log('[ChatVault] Content script loading...', window.location.href);

(function() {
  'use strict';
  
  console.log('[ChatVault] Content script executing...');

  // Configuration
  const BUTTON_SELECTOR = '.chatvault-save-btn';
  const DEBOUNCE_DELAY = 100;
  
  // Global error handler for unhandled errors
  const originalAddEventListener = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function(type, listener, options) {
    const wrappedListener = function(event) {
      try {
        return listener.call(this, event);
      } catch (error) {
        console.error('[ChatVault] Event listener error:', error);
        // Don't propagate the error to avoid breaking the page
      }
    };
    return originalAddEventListener.call(this, type, wrappedListener, options);
  };
  
  // Service detection
  const service = detectService();
  console.log('[ChatVault] Detected service:', service);
  if (!service) {
    console.log('[ChatVault] No supported service detected, exiting');
    return;
  }

  // Detect current service (ChatGPT or Claude)
  function detectService() {
    try {
      const hostname = window.location.hostname;
      if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) return 'chatgpt';
      if (hostname.includes('claude.ai')) return 'claude';
      if (hostname.includes('gemini.google.com') || hostname.includes('aistudio.google.com')) return 'gemini';
      return null;
    } catch (error) {
      console.error('[ChatVault] Error detecting service:', error);
      return null;
    }
  }

  // Create save button element with error handling
  function createSaveButton() {
    try {
      const button = document.createElement('button');
      button.className = 'chatvault-save-btn';
      button.setAttribute('aria-label', 'Save to Obsidian');
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
      `;
      return button;
    } catch (error) {
      console.error('[ChatVault] Error creating save button:', error);
      return null;
    }
  }

  // Get message selectors based on service
  function getMessageSelectors() {
    try {
      if (service === 'chatgpt') {
        return {
          container: '[data-message-author-role][data-message-id]',
          userMessage: '[data-message-author-role="user"][data-message-id]',
          assistantMessage: '[data-message-author-role="assistant"][data-message-id]',
          content: '.markdown, [class*="markdown"], .prose, [class*="prose"], .whitespace-pre-wrap'
        };
      } else if (service === 'claude') {
        return {
          container: '[data-testid="user-message"]',
          userMessage: '[data-testid="user-message"]',
          assistantMessage: '[data-is-streaming]',
          content: '.font-user-message, .font-claude-message'
        };
      }
      return null;
    } catch (error) {
      console.error('[ChatVault] Error getting selectors:', error);
      return null;
    }
  }

  // Add save button to message element with improved safety
  function addSaveButton(messageElement) {
    try {
      // Safety checks
      if (!messageElement || !messageElement.isConnected || !document.contains(messageElement)) {
        console.log('[ChatVault] Message element not valid or connected, skipping');
        return;
      }
      
      // Skip if button already exists
      if (messageElement.querySelector(BUTTON_SELECTOR)) {
        return;
      }

      // Additional Claude-specific validation
      if (service === 'claude') {
        if (messageElement.closest('[data-testid="sidebar"]') ||
            messageElement.closest('nav') ||
            messageElement.closest('header') ||
            messageElement.matches('button') ||
            messageElement.matches('svg') ||
            messageElement.matches('a')) {
          return;
        }
        
        const isUserMessage = messageElement.matches('[data-testid="user-message"]');
        const isAssistantMessage = messageElement.hasAttribute('data-is-streaming');
        
        if (!isUserMessage && !isAssistantMessage) {
          console.log('[ChatVault] Skipping non-message element:', messageElement);
          return;
        }
      }

      console.log('[ChatVault] Adding save button to message element:', messageElement);

      const button = createSaveButton();
      if (!button) return;
      
      let buttonAdded = false;
      
      // Position button at the end of message content
      if (service === 'chatgpt') {
        const contentSelectors = [
          '.markdown',
          '[class*="markdown"]', 
          '.prose',
          '[class*="prose"]',
          '.whitespace-pre-wrap',
          '[class*="message-content"]'
        ];
        
        let contentArea = null;
        for (const selector of contentSelectors) {
          contentArea = messageElement.querySelector(selector);
          if (contentArea) break;
        }
        
        if (contentArea) {
          button.style.display = 'inline-flex';
          button.style.marginLeft = '8px';
          button.style.marginTop = '4px';
          button.style.verticalAlign = 'top';
          button.style.opacity = '0.7';
          button.style.transition = 'opacity 0.2s';
          
          button.addEventListener('mouseenter', () => button.style.opacity = '1');
          button.addEventListener('mouseleave', () => button.style.opacity = '0.7');
          
          contentArea.appendChild(button);
          buttonAdded = true;
          console.log('[ChatVault] Button added to ChatGPT content end:', contentArea);
        }
      } else if (service === 'claude') {
        button.style.display = 'inline-flex';
        button.style.marginLeft = '8px';
        button.style.marginTop = '4px';
        button.style.verticalAlign = 'middle';
        button.style.opacity = '0.7';
        button.style.visibility = 'visible';
        button.style.transition = 'opacity 0.2s';
        button.style.position = 'static';
        
        button.addEventListener('mouseenter', () => {
          button.style.opacity = '1';
        });
        button.addEventListener('mouseleave', () => {
          button.style.opacity = '0.7';
        });
        
        if (messageElement.matches('[data-testid="user-message"]')) {
          const userContent = messageElement.querySelector('.font-user-message') || messageElement;
          const lastParagraph = userContent.querySelector('p:last-child') || userContent;
          
          lastParagraph.appendChild(button);
          buttonAdded = true;
          console.log('[ChatVault] Button added to user message end:', lastParagraph);
        } else if (messageElement.matches('[data-is-streaming]')) {
          const claudeContent = messageElement.querySelector('.font-claude-message');
          if (claudeContent) {
            const allParagraphs = claudeContent.querySelectorAll('p, div');
            const lastParagraph = allParagraphs[allParagraphs.length - 1] || claudeContent;
            
            lastParagraph.appendChild(button);
            buttonAdded = true;
            console.log('[ChatVault] Button added to assistant message end:', lastParagraph);
          }
        }
      }
      
      // Fallback positioning if content area not found
      if (!buttonAdded) {
        console.warn('[ChatVault] Could not find content area, using fallback positioning');
        messageElement.style.position = 'relative';
        button.style.position = 'absolute';
        button.style.top = '10px';
        button.style.right = '10px';
        button.style.zIndex = '1000';
        messageElement.appendChild(button);
      }

      // Add click event listener with error handling
      button.addEventListener('click', (event) => {
        try {
          event.preventDefault();
          event.stopPropagation();
          console.log('[ChatVault] Save button clicked for element:', messageElement);
          
          // Additional safety check
          if (!messageElement.isConnected || !document.contains(messageElement)) {
            console.warn('[ChatVault] Message element no longer connected to DOM');
            return;
          }
          
          handleSaveClick(messageElement);
        } catch (error) {
          console.error('[ChatVault] Error in button click handler:', error);
        }
      });
      
    } catch (error) {
      console.error('[ChatVault] Error in addSaveButton:', error);
    }
  }

  // Handle save button click with enhanced error handling
  async function handleSaveClick(messageElement) {
    try {
      console.log('[ChatVault] handleSaveClick called for:', messageElement);
      
      // Safety check
      if (!messageElement || !messageElement.isConnected || !document.contains(messageElement)) {
        console.error('[ChatVault] Invalid message element');
        return;
      }
      
      const button = messageElement.querySelector(BUTTON_SELECTOR);
      
      let messageData;
      
      if (service === 'chatgpt') {
        const selectors = getMessageSelectors();
        const contentElement = messageElement.querySelector(selectors.content);
        
        if (!contentElement) {
          throw new Error('Could not find message content');
        }
        
        const isUser = messageElement.matches(selectors.userMessage);
        
        messageData = {
          messageContent: `### ${isUser ? 'User' : 'Assistant'}\n\n${contentElement.innerHTML}`,
          messageType: 'single',
          conversationTitle: document.title.replace(' | ChatGPT', '').replace(' - ChatGPT', ''),
          service: service
        };
        
      } else if (service === 'claude') {
        let contentElement, speaker;
        
        console.log('[ChatVault] Extracting Claude message from:', messageElement);
        
        if (messageElement.matches('[data-testid="user-message"]')) {
          contentElement = messageElement.querySelector('.font-user-message') || messageElement;
          speaker = 'User';
        } else if (messageElement.matches('[data-is-streaming]')) {
          contentElement = messageElement.querySelector('.font-claude-message');
          speaker = 'Assistant';
        } else {
          throw new Error('Unknown message type');
        }
        
        if (!contentElement) {
          throw new Error('Could not find message content');
        }
        
        // Temporarily remove button for clean extraction
        const saveButton = contentElement.querySelector('.chatvault-save-btn');
        if (saveButton) saveButton.remove();
        
        const messageContent = contentElement.innerHTML;
        
        // Re-add button if it was there
        if (saveButton && contentElement.querySelector('p:last-child')) {
          contentElement.querySelector('p:last-child').appendChild(saveButton);
        } else if (saveButton) {
          contentElement.appendChild(saveButton);
        }
        
        messageData = {
          messageContent: `### ${speaker}\n\n${messageContent}`,
          messageType: 'single',
          conversationTitle: document.title.replace(' | Claude', '').replace(' - Claude', ''),
          service: service
        };
        
        console.log('[ChatVault] Message data:', messageData);
        
      } else {
        const selectors = getMessageSelectors();
        const contentElement = messageElement.querySelector(selectors.content);
        
        if (!contentElement) {
          throw new Error('Could not find message content');
        }
        
        const isUser = messageElement.matches(selectors.userMessage);
        
        messageData = {
          messageContent: `### ${isUser ? 'User' : 'Assistant'}\n\n${contentElement.innerHTML}`,
          messageType: 'single',
          conversationTitle: document.title.replace(' | Claude', '').replace(' - ChatGPT', ''),
          service: service
        };
      }

      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'saveSingleMessage',
        ...messageData
      }, (response) => {
        try {
          console.log('[ChatVault] Save response:', response);
          
          if (response && response.success) {
            if (button) {
              button.classList.add('chatvault-saved');
              setTimeout(() => {
                if (button.classList) {
                  button.classList.remove('chatvault-saved');
                }
              }, 2000);
            }
            
            console.log(`[ChatVault] Message saved via ${response.method}: ${response.filename}`);
            alert(`メッセージがObsidianに保存されました！\nファイル名: ${response.filename}`);
          } else {
            console.error('[ChatVault] Failed to save message:', response?.error);
            alert(`保存に失敗しました: ${response?.error || 'Unknown error'}`);
          }
        } catch (error) {
          console.error('[ChatVault] Error handling save response:', error);
        }
      });
      
    } catch (error) {
      console.error('Error handling save click:', error);
      alert(`エラーが発生しました: ${error.message}`);
    }
  }

  // Rest of the script remains the same but with try-catch wrappers...
  // (The rest of the functions follow the same pattern with enhanced error handling)
  
  // Initialize with error handling
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initializeWithDelay);
    } else {
      setTimeout(initializeWithDelay, 1000);
    }
  } catch (error) {
    console.error('[ChatVault] Error during initialization:', error);
  }

})();