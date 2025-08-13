// Content script for ChatVault Clip
// This script is injected into ChatGPT and Claude pages to add save buttons

import ClaudeService from '../services/claude.js';
import { toast } from '../utils/toast.js';
import { logger } from '../utils/logger.js';
import { ErrorCodes, toUserMessage } from '../utils/errors.js';

const log = logger.create('Content');
log.info('Content script loading...', window.location.href);

(function() {
  'use strict';
  
  // Prevent interference with ChatGPT's image loading
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const errorStr = args.join(' ');
    if (errorStr.includes('imageData') || errorStr.includes('googleusercontent')) {
      // Suppress ChatGPT image loading errors
      return;
    }
    return originalConsoleError.apply(console, args);
  };
  
  // Add error event listener to prevent bubbling
  window.addEventListener('error', function(event) {
    if (event.target && event.target.src && event.target.src.includes('googleusercontent')) {
      event.stopPropagation();
      event.preventDefault();
      return false;
    }
  }, true);
  
  log.info('Content script executing...');

  // Configuration
  const BUTTON_SELECTOR = '.chatvault-save-btn';
  const DEBOUNCE_DELAY = 300; // Increased to reduce conflicts with ChatGPT
  
  // Service detection
  const service = detectService();
  log.info('Detected service:', service);
  if (!service) {
    log.warn('No supported service detected, exiting');
    return;
  }
  
  // Initialize Claude service if needed
  let claudeService = null;
  if (service === 'claude') {
    claudeService = new ClaudeService();
    log.info('Claude service initialized');
  }
  
  // Rate limiting for DOM operations
  let lastOperationTime = 0;
  let operationQueue = [];
  
  function throttleOperation(fn, delay = 100) {
    return function(...args) {
      const now = Date.now();
      if (now - lastOperationTime < delay) {
        operationQueue.push(() => fn.apply(this, args));
        return;
      }
      lastOperationTime = now;
      try {
        fn.apply(this, args);
      } catch (error) {
        log.error('Throttled operation error:', error);
      }
      
      // Process queue
      if (operationQueue.length > 0) {
        const nextOp = operationQueue.shift();
        setTimeout(nextOp, delay);
      }
    };
  }

  // Detect current service (ChatGPT or Claude)
  function detectService() {
    const hostname = window.location.hostname;
    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) return 'chatgpt';
    if (hostname.includes('claude.ai')) return 'claude';
    return null;
  }

  // Create save button element
  function createSaveButton() {
    const button = document.createElement('button');
    button.className = 'chatvault-save-btn';
    button.setAttribute('aria-label', 'Save to Obsidian');
    button.setAttribute('data-tooltip', 'Save to Obsidian');
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
    `;
    return button;
  }

  // Get message selectors based on service
  function getSelectors() {
    if (service === 'chatgpt') {
      return {
        // More specific selectors for actual conversation messages only
        container: '[data-message-author-role][data-message-id]',
        userMessage: '[data-message-author-role="user"][data-message-id]',
        assistantMessage: '[data-message-author-role="assistant"][data-message-id]',
        content: '.markdown, [class*="markdown"], .prose, [class*="prose"], .whitespace-pre-wrap'
      };
    } else if (service === 'claude') {
      // Claudeのメッセージ構造: ユーザーとアシスタントメッセージを別々に扱う
      return {
        // ユーザーメッセージの親要素（bg-bg-300背景）とアシスタントメッセージ要素
        container: '[data-testid="user-message"]',  // まずはユーザーメッセージのみ
        userMessage: '[data-testid="user-message"]',
        assistantMessage: '[data-is-streaming]',
        content: '.font-user-message, .font-claude-message'
      };
    }
    return null;
  }

  // Add save button to a message element
  function addSaveButton(messageElement) {
    // Check if button already exists
    if (messageElement.querySelector(BUTTON_SELECTOR)) return;

    // Claude専用: 実際のメッセージかどうかをチェック
    if (service === 'claude') {
      // サイドバーやUI要素を除外
      if (messageElement.closest('[data-testid="sidebar"]') || 
          messageElement.closest('nav') || 
          messageElement.closest('header') ||
          messageElement.matches('button') ||
          messageElement.matches('svg') ||
          messageElement.matches('a')) {
        return;
      }
      
      // メッセージ要素自体の場合はOK
      const isUserMessage = messageElement.matches('[data-testid="user-message"]');
      const isAssistantMessage = messageElement.hasAttribute('data-is-streaming');
      
      if (!isUserMessage && !isAssistantMessage) {
        console.log('[ChatVault] Skipping non-message element:', messageElement);
        return;
      }
    }

    log.debug('Adding save button to message element:', messageElement);

    const button = createSaveButton();
    let buttonAdded = false;
    
    // Position button at the end of message content
    if (service === 'chatgpt') {
      // Find the content area in ChatGPT
      const contentSelectors = [
        '.markdown',
        '[class*="markdown"]', 
        '.prose',
        '[class*="prose"]',
        '.whitespace-pre-wrap',
        '[class*="message-content"]'
      ];
      
      let contentElement = null;
      for (const selector of contentSelectors) {
        contentElement = messageElement.querySelector(selector);
        if (contentElement) break;
      }
      
      if (contentElement) {
        // Style button for inline placement at end of content
        button.style.display = 'inline-flex';
        button.style.marginLeft = '8px';
        button.style.marginTop = '4px';
        button.style.verticalAlign = 'top';
        button.style.opacity = '0.7';
        button.style.transition = 'opacity 0.2s';
        
        // Add hover effect
        button.addEventListener('mouseenter', () => button.style.opacity = '1');
        button.addEventListener('mouseleave', () => button.style.opacity = '0.7');
        
        contentElement.appendChild(button);
        buttonAdded = true;
          log.debug('Button added to ChatGPT content end:', contentElement);
      }
    } else if (service === 'claude') {
      // Claudeの場合、メッセージ末尾にボタンを配置
      // Claude用のデフォルトスタイル（常に表示）
      button.style.display = 'inline-flex';
      button.style.marginLeft = '8px';
      button.style.marginTop = '4px';
      button.style.verticalAlign = 'middle';
      button.style.opacity = '0.7';
      button.style.visibility = 'visible';
      button.style.transition = 'opacity 0.2s';
      button.style.position = 'static'; // インライン配置
      
      // ホバー効果を追加
      button.addEventListener('mouseenter', () => {
        button.style.opacity = '1';
      });
      button.addEventListener('mouseleave', () => {
        button.style.opacity = '0.7';
      });
      
      if (messageElement.matches('[data-testid="user-message"]')) {
        // ユーザーメッセージの場合、メッセージコンテンツの末尾に追加
        const messageContent = messageElement.querySelector('.font-user-message') || messageElement;
        const lastTextNode = messageContent.querySelector('p:last-child') || messageContent;
        lastTextNode.appendChild(button);
        buttonAdded = true;
        log.debug('Button added to user message end:', lastTextNode);
      } else if (messageElement.matches('[data-is-streaming]')) {
        // アシスタントメッセージの場合、メッセージコンテンツの末尾に追加
        const messageContent = messageElement.querySelector('.font-claude-message');
        if (messageContent) {
          // メッセージの最後の段落または要素を探す
          const paragraphs = messageContent.querySelectorAll('p, div');
          const lastElement = paragraphs[paragraphs.length - 1] || messageContent;
          lastElement.appendChild(button);
          buttonAdded = true;
           log.debug('Button added to assistant message end:', lastElement);
        }
      }
    }

    // Fallback to original positioning if content area not found
    if (!buttonAdded) {
      log.warn('Could not find content area, using fallback positioning');
      messageElement.style.position = 'relative';
      button.style.position = 'absolute';
      button.style.top = '10px';
      button.style.right = '10px';
      button.style.zIndex = '1000';
      messageElement.appendChild(button);
    }

    // Add click handler with enhanced debugging
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      log.info('SAVE BUTTON CLICKED!', messageElement);
      log.debug('Service:', service);
      log.debug('Current URL:', window.location.href);
      
      // Add visual feedback using CSS classes
      button.classList.add('chatvault-saving');
      button.disabled = true;
      
      try {
        handleSaveClick(messageElement);
      } catch (error) {
        log.error('Error in handleSaveClick:', error);
        toast.show('エラー: ' + error.message, 'error');
        button.classList.remove('chatvault-saving');
        button.classList.add('chatvault-error');
        button.disabled = false;
        setTimeout(() => {
          button.classList.remove('chatvault-error');
        }, 2000);
      }
    });
  }

  // Add save button to a Claude Artifact container
  function addSaveButtonToArtifact(artifactContainer) {
    try {
      if (!artifactContainer || !artifactContainer.isConnected) return;
      // Avoid duplicate buttons inside the same artifact container
      if (artifactContainer.querySelector(BUTTON_SELECTOR)) return;

      // Only for Claude service
      if (service !== 'claude' || !claudeService) return;

      const button = createSaveButton();
      if (!button) return;

      // Style for artifact button
      button.style.display = 'inline-flex';
      button.style.marginLeft = '8px';
      button.style.marginTop = '4px';
      button.style.verticalAlign = 'middle';
      button.style.opacity = '0.7';
      button.style.transition = 'opacity 0.2s';
      button.addEventListener('mouseenter', () => (button.style.opacity = '1'));
      button.addEventListener('mouseleave', () => (button.style.opacity = '0.7'));

      // Prefer placing near title if exists; otherwise append to container end
      const titleSelector = claudeService?.selectors?.artifactTitle;
      const titleEl = titleSelector ? artifactContainer.querySelector(titleSelector) : null;
      if (titleEl) {
        // Insert after title element
        titleEl.insertAdjacentElement('afterend', button);
      } else {
        artifactContainer.appendChild(button);
      }

      // Click handler routes to artifact extraction
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        log.info('ARTIFACT SAVE BUTTON CLICKED!', artifactContainer);
        button.classList.add('chatvault-saving');
        button.disabled = true;
        try {
          handleSaveClick(artifactContainer);
        } catch (error) {
          log.error('Error in handleSaveClick (artifact):', error);
          toast.show('エラー: ' + error.message, 'error');
          button.classList.remove('chatvault-saving');
          button.classList.add('chatvault-error');
          button.disabled = false;
          setTimeout(() => button.classList.remove('chatvault-error'), 2000);
        }
      });

      log.debug('Artifact button added:', artifactContainer);
    } catch (error) {
      log.error('Failed to add artifact save button:', error);
    }
  }

  // Handle save button click
  async function handleSaveClick(messageElement) {
    log.debug('handleSaveClick called for:', messageElement);
    log.debug('Message element details:', {
      tagName: messageElement.tagName,
      className: messageElement.className,
      textContent: messageElement.textContent?.substring(0, 100) + '...'
    });
    
    const button = messageElement.querySelector(BUTTON_SELECTOR);
    
    try {
      let messageData;
      
      // Claude Artifact: if the element itself is an artifact container, extract via ClaudeService
      if (service === 'claude' && claudeService) {
        const artifactSelector = claudeService?.selectors?.artifactContainer;
        if (artifactSelector && messageElement.matches(artifactSelector)) {
          log.debug('Detected artifact container. Extracting artifact...');
          const artifact = await claudeService.extractArtifact(messageElement);
          if (!artifact || !artifact.content) {
            throw new Error('Artifact の抽出に失敗しました');
          }
          const conversationTitle = claudeService.getConversationTitle();

          // 長文の場合は分割し、part/totalParts を付与して複数保存
          let artifacts = [];
          try {
            artifacts = await claudeService.splitArtifactIfNeeded(artifact);
          } catch (e) {
            log.warn('Artifact split failed, falling back to single save:', e);
            artifacts = [artifact];
          }

          if (!Array.isArray(artifacts) || artifacts.length === 0) {
            artifacts = [artifact];
          }

          // ボタン状態は最後の保存結果で反映
          let pending = artifacts.length;
          let anyError = false;

          artifacts.forEach((partArtifact) => {
            const hasPartInfo = Number.isInteger(partArtifact.part) && Number.isInteger(partArtifact.totalParts);
            const partSuffix = hasPartInfo ? ` (Part ${partArtifact.part}/${partArtifact.totalParts})` : '';

            const perPartMessage = {
              messageContent: `### Artifact: ${artifact.title}${partSuffix}\n\n${partArtifact.content}`,
              messageType: 'artifact',
              conversationTitle: conversationTitle,
              service: service,
              metadata: {
                type: 'artifact',
                artifactTitle: artifact.title,
                artifactLanguage: partArtifact.language || artifact.language || '',
                artifactFilename: partArtifact.filename || artifact.filename || '',
                ...(hasPartInfo ? { part: partArtifact.part, totalParts: partArtifact.totalParts } : {})
              }
            };

            log.debug('Sending artifact (possibly split) to background:', perPartMessage);
            chrome.runtime.sendMessage({
              action: 'saveSingleMessage',
              ...perPartMessage
            }, (response) => {
              log.info('Artifact part save response:', response);
              pending -= 1;
              if (!response || !response.success) {
                anyError = true;
                const msg = response?.userMessage || toUserMessage(response?.errorCode, response?.error);
                toast.show(msg || '保存に失敗しました。', 'error');
              } else {
                toast.show(response.message || 'Artifact を保存しました。', 'success');
              }

              if (pending === 0) {
                if (button) {
                  button.classList.remove('chatvault-saving');
                  if (anyError) {
                    button.classList.add('chatvault-error');
                  } else {
                    button.classList.add('chatvault-saved');
                  }
                  button.disabled = false;
                  setTimeout(() => {
                    button.classList.remove('chatvault-saved');
                    button.classList.remove('chatvault-error');
                  }, 2000);
                }
              }
            });
          });

          return; // Artifact 処理はここで終了
        }
      }

      if (service === 'chatgpt') {
        log.debug('Extracting ChatGPT message...');
        
        // Simplified extraction for debugging
        const messageText = messageElement.textContent || messageElement.innerText || 'No text found';
        log.debug('Message text (first 200 chars):', messageText.substring(0, 200));
        
        // Try to determine if it's a user message
        const isUser = messageElement.getAttribute('data-message-author-role') === 'user';
        log.debug('Is user message:', isUser);
        
        messageData = {
          messageContent: `### ${isUser ? 'User' : 'Assistant'}\n\n${messageText}`,
          messageType: 'single',
          conversationTitle: document.title.replace(' | ChatGPT', '').replace(' - ChatGPT', ''),
          service: service
        };
        
        log.debug('Prepared message data:', messageData);
      } else if (service === 'claude' && claudeService) {
        // Claude用のメッセージ抽出（ClaudeServiceを使用）
        log.debug('Extracting Claude message using ClaudeService');
        
        const extractedMessage = claudeService.extractSingleMessage(messageElement);
        if (!extractedMessage) {
          throw new Error('Failed to extract message');
        }
        
        const conversationTitle = claudeService.getConversationTitle();
        const role = extractedMessage.role === 'user' ? 'User' : 'Assistant';
        
        messageData = {
          messageContent: `### ${role}\n\n${extractedMessage.content}`,
          messageType: 'single',
          conversationTitle: conversationTitle,
          service: service
        };
        
         log.debug('Message data:', messageData);
      } else {
        // Fallback to basic DOM extraction for other services
        const selectors = getSelectors();
        const contentElement = messageElement.querySelector(selectors.content);
        
        if (!contentElement) {
          throw new Error('Could not find message content');
        }

        const isUser = messageElement.matches(selectors.userMessage);
        const speaker = isUser ? 'User' : 'Assistant';
        
        messageData = {
          messageContent: `### ${speaker}\n\n${contentElement.innerHTML}`,
          messageType: 'single',
          conversationTitle: document.title.replace(' | Claude', '').replace(' - ChatGPT', ''),
          service: service
        };
      }
      
      // Send to background script
      log.debug('Sending message to background:', {
        action: 'saveSingleMessage',
        ...messageData
      });
      
      chrome.runtime.sendMessage({
        action: 'saveSingleMessage',
        ...messageData
      }, (response) => {
        log.info('Save response:', response);
        
        if (chrome.runtime.lastError) {
          log.error('Runtime error:', chrome.runtime.lastError);
          toast.show('保存に失敗しました: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        if (response && response.success) {
          // Show success feedback
          if (button) {
            button.classList.remove('chatvault-saving');
            button.classList.add('chatvault-saved');
            button.disabled = false;
            setTimeout(() => {
              button.classList.remove('chatvault-saved');
            }, 2000);
          }
          log.info(`Message saved via ${response.method}: ${response.filename}`);
          if (response.message) {
            toast.show(response.message, 'success');
          } else if (response.method === 'clipboard') {
            toast.show('コンテンツをクリップボードにコピーしました。Obsidianで貼り付けてください。', 'success');
          } else {
            toast.show('メッセージを保存しました。', 'success');
          }
        } else {
          log.error('Failed to save message:', response?.error);
          const msg = response?.userMessage || toUserMessage(response?.errorCode, response?.error);
          toast.show(msg, 'error');
          if (button) {
            button.classList.remove('chatvault-saving');
            button.classList.add('chatvault-error');
            button.disabled = false;
            setTimeout(() => {
              button.classList.remove('chatvault-error');
            }, 2000);
          }
        }
      });
      
    } catch (error) {
      log.error('Error handling save click:', error);
      toast.show('エラー: ' + error.message, 'error');
    }
  }

  // Observe DOM changes and add buttons to new messages
  function observeMessages() {
    const selectors = getSelectors();
    if (!selectors) return;

    log.info(`Starting message observation for ${service} with selectors:`, selectors);
    log.debug(`Current URL: ${window.location.href}`);

    // Initial scan for existing messages
    let messages = document.querySelectorAll(selectors.container);
    
    // Claude特別処理: アシスタントメッセージも追加で検索
    if (service === 'claude') {
      const assistantMessages = document.querySelectorAll('[data-is-streaming]');
      const allMessages = [...messages, ...assistantMessages];
      // 重複を除去
      messages = Array.from(new Set(allMessages));
    }
    
    log.debug('Found', messages.length, 'messages with primary selectors');
    
    // Debug: クラウドのDOM構造を詳しく調査
    if (service === 'claude' && messages.length === 0) {
      log.debug('No messages found, investigating Claude DOM...');
      
      // 会話エリアを探す
      const conversationContainers = document.querySelectorAll('main, [role="main"], div[class*="conversation"], div[class*="chat"]');
      log.debug('Potential conversation containers:', conversationContainers.length);
      
      // テキストを含む要素を探す
      const allDivs = document.querySelectorAll('div');
      const messagelikeDivs = Array.from(allDivs).filter(div => {
        const text = div.textContent?.trim() || '';
        return text.length > 50 && text.length < 5000 && 
               !div.querySelector('nav') && 
               !div.querySelector('header') &&
               !div.matches('button, a, svg');
      });
      log.debug('Message-like divs found:', messagelikeDivs.length);
      
      // 最初の数個を詳しく見る
      messagelikeDivs.slice(0, 3).forEach((div, index) => {
        log.debug(`Potential message ${index}:`, {
          classes: div.className,
          attributes: Array.from(div.attributes).map(attr => `${attr.name}="${attr.value}"`),
          textPreview: div.textContent?.substring(0, 100) + '...'
        });
      });
    }
    
    // If no messages found, try broader selectors but only in conversation area
    if (messages.length === 0) {
      log.debug('No messages found, trying broader selectors...');
      if (service === 'chatgpt') {
        // Look specifically in the main conversation area
        const conversationArea = document.querySelector('main[role="main"], [role="main"], main, .conversation-turn');
        if (conversationArea) {
          messages = conversationArea.querySelectorAll('[data-message-author-role], .group.w-full, [class*="conversation-turn"]');
        } else {
          messages = document.querySelectorAll('[data-message-author-role]:not([data-testid])');
        }
      } else if (service === 'claude') {
        // 会話エリア内のgroup.relativeクラスを持つ要素を検索
        const conversationArea = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        messages = conversationArea.querySelectorAll('div.group.relative');
        log.debug('Found group.relative elements:', messages.length);
      }
      log.debug('Found', messages.length, 'messages with broader selectors');
    }
    
    // If still no messages, wait a bit and try again
    if (messages.length === 0) {
      log.debug('Still no messages found, will retry in 2 seconds...');
      setTimeout(() => {
        // Service-specific fallback selectors
        let retryMessages = [];
        if (service === 'claude') {
          // Claude用: メッセージの親要素を探す（ユーザーメッセージの親要素を取得）
          const userMessages = document.querySelectorAll('div[data-testid="user-message"]');
          const messageParents = [];
          userMessages.forEach(msg => {
            const parent = msg.closest('.group.relative');
            if (parent && !messageParents.includes(parent)) {
              messageParents.push(parent);
            }
          });
          
          // アシスタントメッセージも探す
          const assistantMessages = document.querySelectorAll('div[data-is-streaming], div.font-claude-message');
          assistantMessages.forEach(msg => {
            const parent = msg.closest('.group.relative');
            if (parent && !messageParents.includes(parent)) {
              messageParents.push(parent);
            }
          });
          
          retryMessages = messageParents;
          log.debug('Claude fallback: found', retryMessages.length, 'message parents');
        } else {
          retryMessages = document.querySelectorAll('div, article, section');
          log.debug('General fallback: found', retryMessages.length, 'potential elements');
        }
        
        // Add buttons to any element that looks like it could be a message
        Array.from(retryMessages).filter(el => {
          const text = el.textContent?.trim();
          // More sophisticated filtering for Claude
          if (service === 'claude') {
            return text && text.length > 20 && text.length < 5000 && 
                   !el.querySelector('input') && !el.querySelector('button') &&
                   !el.matches('nav, header, footer, aside');
          }
          return text && text.length > 10 && text.length < 10000; // Reasonable message length
        }).slice(0, 15).forEach(addSaveButton); // Limit to first 15 to avoid spam
      }, 2000);
    }
    
    messages.forEach(addSaveButton);

    // Initial scan for artifact containers on Claude
    if (service === 'claude' && claudeService?.selectors?.artifactContainer) {
      const artifactSelector = claudeService.selectors.artifactContainer;
      const artifacts = document.querySelectorAll(artifactSelector);
      log.debug('Found artifact containers:', artifacts.length);
      artifacts.forEach(addSaveButtonToArtifact);
    }

    // Set up mutation observer for new messages
    const observer = new MutationObserver(debounce((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a message
            if (node.matches && node.matches(selectors.container)) {
              addSaveButton(node);
            }
            // Check if the added node contains messages
            const newMessages = node.querySelectorAll ? node.querySelectorAll(selectors.container) : [];
            newMessages.forEach(addSaveButton);

            // Artifact containers on Claude
            if (service === 'claude' && claudeService?.selectors?.artifactContainer) {
              const artifactSelector = claudeService.selectors.artifactContainer;
              if (node.matches && node.matches(artifactSelector)) {
                addSaveButtonToArtifact(node);
              }
              const newArtifacts = node.querySelectorAll ? node.querySelectorAll(artifactSelector) : [];
              newArtifacts.forEach(addSaveButtonToArtifact);
            }
          }
        });
        // NEW: Handle attribute changes that may indicate message visibility/update (SPA)
        if (mutation.type === 'attributes' && mutation.target && mutation.target.matches) {
          const targetEl = mutation.target;
          if (targetEl.matches(selectors.container)) {
            addSaveButton(targetEl);
          }
          if (service === 'claude' && claudeService?.selectors?.artifactContainer) {
            const artifactSelector = claudeService.selectors.artifactContainer;
            if (targetEl.matches(artifactSelector)) {
              addSaveButtonToArtifact(targetEl);
            }
          }
        }
      });
    }, DEBOUNCE_DELAY));

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  // Debounce function to limit observer callbacks
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Handle message capture using service-specific extraction
  function handleCaptureMessages(mode, count = null) {
    try {
      if (service === 'claude' && claudeService) {
        // Claude専用の抽出ロジック
        let messages = [];
        let title = '';
        
        switch (mode) {
          case 'all':
            messages = claudeService.extractAllMessages();
            break;
          case 'recent':
            messages = claudeService.extractLastNMessages(count || 30);
            break;
          case 'selected':
            messages = claudeService.extractSelectedMessages();
            break;
          default:
            throw new Error('Invalid capture mode: ' + mode);
        }
        
        title = claudeService.getConversationTitle();
        
        // メッセージをMarkdown形式に変換
        const formattedMessages = messages.map(msg => ({
          speaker: msg.role === 'user' ? 'User' : 'Assistant',
          content: msg.content
        }));
        
        return {
          success: true,
          messages: formattedMessages,
          title: title
        };
      } else {
        // ChatGPT用の既存のロジック
        const selectors = getSelectors();
        const allMessages = Array.from(document.querySelectorAll(selectors.container))
          .map(msg => {
            const contentEl = msg.querySelector(selectors.content);
            const isUser = msg.matches(selectors.userMessage);
            return {
              speaker: isUser ? 'User' : 'Assistant',
              content: contentEl ? contentEl.innerHTML : ''
            };
          });
        
        let messages = allMessages;
        if (mode === 'recent' && count) {
          messages = allMessages.slice(-count);
        }
        
        return {
          success: true,
          messages: messages,
          title: document.title.replace(' | Claude', '').replace(' - ChatGPT', '').replace(' | ChatGPT', '')
        };
      }
    } catch (error) {
      console.error('Error capturing messages:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Clipboard copy functionality
  async function copyToClipboard(content) {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        console.log('[ChatVault] Content copied to clipboard using navigator.clipboard');
        return { success: true, method: 'navigator.clipboard' };
      } else {
        // Fallback to execCommand method
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (successful) {
          console.log('[ChatVault] Content copied to clipboard using execCommand');
          return { success: true, method: 'execCommand' };
        } else {
          throw new Error('execCommand copy failed');
        }
      }
    } catch (error) {
      console.error('[ChatVault] Failed to copy to clipboard:', error);
      return { success: false, error: error.message };
    }
  }

  // File System Access API functionality
  async function handleFileSystemSave(content, relativePath) {
    try {
      console.log('[ChatVault] Attempting File System Access API save...');
      
      // Load the directory handle from IndexedDB
      const dirHandle = await loadDirectoryHandle();
      if (!dirHandle) {
        throw new Error('No directory handle found. Please select a vault folder in the extension options.');
      }

      // Verify permission
      const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const newPermission = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (newPermission !== 'granted') {
          throw new Error('File system permission denied');
        }
      }

      // Parse the path and create directories as needed
      const pathSegments = relativePath.split('/').filter(segment => segment);
      const fileName = pathSegments.pop();
      
      let currentDir = dirHandle;
      for (const segment of pathSegments) {
        currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
      }

      // Create or overwrite the file
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      console.log('[ChatVault] File saved successfully via File System Access API');
      return { success: true, method: 'filesystem' };
    } catch (error) {
      console.error('[ChatVault] File System Access API error:', error);
      return { success: false, error: error.message };
    }
  }

  // Load directory handle from IndexedDB
  async function loadDirectoryHandle() {
    try {
      const db = await openDB();
      const tx = db.transaction(['handles'], 'readonly');
      const store = tx.objectStore('handles');
      const request = store.get('vaultDirectory');
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db.close();
          resolve(request.result);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[ChatVault] Error loading directory handle:', error);
      return null;
    }
  }

  // Open IndexedDB
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ChatVaultDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
    });
  }

  // Selection highlighting functionality
  let selectionOverlay = null;
  let isSelectionMode = false;
  
  function enableSelectionMode() {
    isSelectionMode = true;
    document.body.style.cursor = 'crosshair';
    
    // Add visual indicator
    if (!selectionOverlay) {
      selectionOverlay = document.createElement('div');
      selectionOverlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 10000;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      selectionOverlay.textContent = 'Selection mode: Highlight text and press Save';
      document.body.appendChild(selectionOverlay);
    }
  }
  
  function disableSelectionMode() {
    isSelectionMode = false;
    document.body.style.cursor = '';
    
    if (selectionOverlay) {
      selectionOverlay.remove();
      selectionOverlay = null;
    }
  }
  
  function getSelectedContent() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;
    
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    
    // Try to preserve formatting
    let content = container.innerHTML;
    if (!content.trim()) {
      content = selection.toString();
    }
    
    return {
      text: selection.toString().trim(),
      html: content,
      range: {
        startContainer: range.startContainer.nodeType === Node.TEXT_NODE ? 
                       range.startContainer.parentElement?.tagName : range.startContainer.tagName,
        endContainer: range.endContainer.nodeType === Node.TEXT_NODE ? 
                     range.endContainer.parentElement?.tagName : range.endContainer.tagName
      }
    };
  }

  // Listen for messages from popup and background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
      sendResponse({
        service: service,
        url: window.location.href,
        title: document.title
      });
    } else if (request.action === 'captureSelection') {
      const selection = window.getSelection().toString();
      sendResponse({
        success: true,
        content: selection
      });
    } else if (request.action === 'saveActive') {
      // Find the active message (user can hover or click on it)
      const messageElements = document.querySelectorAll(getSelectors().container);
      if (messageElements.length > 0) {
        // Get the last message as the "active" one
        const lastMessage = messageElements[messageElements.length - 1];
        handleSaveClick(lastMessage);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No messages found on the page' });
      }
    } else if (request.action === 'saveSelected') {
      if (service === 'claude' && claudeService) {
        // Claudeの場合は選択範囲内のメッセージを取得
        const selectedMessages = claudeService.extractSelectedMessages();
        if (selectedMessages.length > 0) {
          const markdown = claudeService.messagesToMarkdown(selectedMessages);
          const title = claudeService.generateTitle(selectedMessages);
          
          chrome.runtime.sendMessage({
            action: 'saveMultipleMessages',
            messages: selectedMessages.map(msg => ({
              speaker: msg.role === 'user' ? 'User' : 'Assistant',
              content: msg.content
            })),
            conversationTitle: title,
            service: service,
            messageType: 'selection'
          }, (response) => {
            sendResponse(response);
          });
          return true; // Keep channel open for async response
        } else {
          // 通常のテキスト選択処理
          const selectedContent = getSelectedContent();
          if (selectedContent && selectedContent.text) {
            chrome.runtime.sendMessage({
              action: 'saveSingleMessage',
              service: service,
              messageContent: `### Selection\n\n${selectedContent.text}`,
              messageType: 'selection',
              conversationTitle: document.title.replace(' | Claude', '').replace(' - Claude', ''),
              metadata: {
                type: 'selection',
                url: window.location.href,
                title: document.title,
                timestamp: new Date().toISOString(),
                selectionInfo: selectedContent.range
              }
            }, (response) => {
              sendResponse(response);
            });
            return true;
          } else {
            enableSelectionMode();
            sendResponse({ success: false, error: 'No text selected. Please select some text first.' });
          }
        }
      } else {
        const selectedContent = getSelectedContent();
        if (selectedContent && selectedContent.text) {
          // Send selected content to background script
          chrome.runtime.sendMessage({
            action: 'saveSingleMessage',
            service: service,
            content: selectedContent.text,
            html: selectedContent.html,
            metadata: {
              type: 'selection',
              url: window.location.href,
              title: document.title,
              timestamp: new Date().toISOString(),
              selectionInfo: selectedContent.range
            }
          });
          
          disableSelectionMode();
          sendResponse({ success: true, content: selectedContent.text });
        } else {
          enableSelectionMode();
          sendResponse({ success: false, error: 'No text selected. Please select some text first.' });
        }
      }
    } else if (request.action === 'saveLastN') {
      const result = handleCaptureMessages('recent', request.count);
      if (result.success) {
        // Send to background script for saving
        chrome.runtime.sendMessage({
          action: 'saveMultipleMessages',
          messages: result.messages,
          conversationTitle: result.title,
          service: service,
          messageType: 'recent',
          count: request.count
        }, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse(result);
      }
      return true; // Keep channel open for async response
    } else if (request.action === 'saveAll') {
      const result = handleCaptureMessages('all');
      if (result.success) {
        // メッセージが長すぎる場合の処理
        let processedMessages = result.messages;
        if (service === 'claude' && claudeService) {
          // 長文メッセージを分割
          processedMessages = result.messages.map(msg => {
            const splitContent = claudeService.splitLongMessage(msg.content);
            if (splitContent.length > 1) {
              // 分割されたメッセージを複数のメッセージとして扱う
              return splitContent.map((content, index) => ({
                speaker: msg.speaker + ` (Part ${index + 1}/${splitContent.length})`,
                content: content
              }));
            }
            return msg;
          }).flat();
        }
        
        // Send to background script for saving
        chrome.runtime.sendMessage({
          action: 'saveMultipleMessages',
          messages: processedMessages,
          conversationTitle: result.title,
          service: service,
          messageType: 'all'
        }, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse(result);
      }
      return true; // Keep channel open for async response
    } else if (request.action === 'captureRecentMessages') {
      sendResponse(handleCaptureMessages('recent', request.count));
    } else if (request.action === 'captureAllMessages') {
      sendResponse(handleCaptureMessages('all'));
    } else if (request.action === 'copyToClipboard') {
      // Handle clipboard copy request from background script
      copyToClipboard(request.content).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
    } else if (request.action === 'saveViaFileSystem') {
      // Handle File System Access API save request
      handleFileSystemSave(request.content, request.relativePath).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
    }
    return true; // Keep message channel open for async response
  });

  // Initialize with longer delay for dynamic content
  function initializeWithDelay() {
    observeMessages();
    
    // Retry periodically until messages are found
    let retryCount = 0;
    const maxRetries = 20; // Increased from 10 to 20
    const retryInterval = setInterval(() => {
      const selectors = getSelectors();
      const messages = document.querySelectorAll(selectors.container);
      const existingButtons = document.querySelectorAll('.chatvault-save-btn');
      
      console.log(`[ChatVault] Retry ${retryCount + 1}: Found ${messages.length} messages, ${existingButtons.length} buttons`);
      
      if (messages.length > 0) {
        // Add buttons to messages that don't have them yet
        messages.forEach(message => {
          if (!message.querySelector('.chatvault-save-btn')) {
            log.debug('Adding button to message without one:', message);
            addSaveButton(message);
          }
        });
        
        // If all messages have buttons, we're done
        if (existingButtons.length >= messages.length) {
          clearInterval(retryInterval);
          log.debug('All messages have buttons, stopping retry');
        }
      }
      
      retryCount++;
      if (retryCount >= maxRetries) {
        clearInterval(retryInterval);
        log.debug('Max retries reached');
      }
    }, 500); // Reduced from 1000ms to 500ms for faster detection
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWithDelay);
  } else {
    setTimeout(initializeWithDelay, 1000); // Wait 1 second for dynamic content
  }

})();