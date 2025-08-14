// Claude-specific helpers extracted from inject.js for maintainability
// This module centralizes DOM targeting and button placement nuances for Claude UI.

const ClaudeProvider = {
  // Claude should avoid absolute-positioned fallback on thinking areas
  absoluteFallbackAllowed: false,

  // Selectors with unified keys
  getSelectors(claudeService) {
    const sel = claudeService?.selectors || {};
    return {
      container:
        sel.messageContainer ||
        '[data-testid="user-message"], [data-is-streaming], .font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]',
      userMessage: sel.userMessage || '[data-testid="user-message"]',
      assistantMessage: sel.assistantMessage || '[data-is-streaming]',
      content:
        sel.messageContent || '.font-user-message, .font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]',
      artifactContainer: sel.artifactContainer
    };
  },

  // Determine best target end node for placing the button (disclaimer line preferred)
  getTargetEnd(messageElement) {
    try {
      const topContainer = (messageElement.closest && messageElement.closest('div.group.relative')) || messageElement;
      const disclaimerAnchor = topContainer.querySelector('a[href*="support.anthropic.com"]');
      if (disclaimerAnchor) {
        let row = disclaimerAnchor.closest('div') || topContainer;
        let current = row;
        while (current && current !== topContainer && current !== document.body) {
          if (current.classList && current.classList.contains('flex') && current.classList.contains('items-center')) {
            row = current;
            break;
          }
          current = current.parentElement;
        }
        return row;
      }
      const content = (messageElement.matches && messageElement.matches('.font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]'))
        ? messageElement
        : messageElement.querySelector?.('.font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]');
      if (content) {
        const paragraphs = content.querySelectorAll('p, div, pre, code');
        return paragraphs[paragraphs.length - 1] || content;
      }
      return null;
    } catch (_) {
      return null;
    }
  },

  // Try placing the button next to the copy button; fallback to end target
  insertButtonAtPreferredSpot(button, messageElement) {
    try {
      const topContainer = (messageElement.closest && messageElement.closest('div.group.relative')) || messageElement;
      const copyBtn = topContainer.querySelector('button[data-testid="action-bar-copy"]');
      if (copyBtn && copyBtn.parentElement) {
        copyBtn.parentElement.insertBefore(button, copyBtn);
        return true;
      }
      const targetEnd = this.getTargetEnd(messageElement);
      if (targetEnd) {
        targetEnd.appendChild(button);
        return true;
      }
    } catch (_) {
      // no-op
    }
    return false;
  },

  // Add save button with Claude-specific placement rules
  addSaveButton(messageElement, createSaveButton, claudeService) {
    // Exclude non-message UI like sidebars/navs/buttons
    if (
      messageElement.closest?.('[data-testid="sidebar"]') ||
      messageElement.closest?.('nav') ||
      messageElement.closest?.('header') ||
      messageElement.matches?.('button, svg, a')
    ) {
      return { added: false, button: null, target: null };
    }

    const hasUserFlag = messageElement.matches?.('[data-testid="user-message"]') || !!messageElement.querySelector?.('[data-testid="user-message"]');
    const hasAssistantFlag = messageElement.hasAttribute?.('data-is-streaming') || !!messageElement.querySelector?.('[data-is-streaming]');
    const hasClaudeContent = messageElement.matches?.('.font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]') || !!messageElement.querySelector?.('.font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]');
    const isMessageLike = hasUserFlag || hasAssistantFlag || hasClaudeContent;
    if (!isMessageLike) {
      return { added: false, button: null, target: null };
    }

    const button = createSaveButton();
    // Claude style preferences
    button.style.display = 'inline-flex';
    button.style.marginLeft = '8px';
    button.style.marginTop = '4px';
    button.style.verticalAlign = 'middle';
    button.style.opacity = '0.7';
    button.style.visibility = 'visible';
    button.style.transition = 'opacity 0.2s';
    button.style.position = 'static';
    button.addEventListener('mouseenter', () => { button.style.opacity = '1'; });
    button.addEventListener('mouseleave', () => { button.style.opacity = '0.7'; });

    // Preferred: next to copy button
    if (this.insertButtonAtPreferredSpot(button, messageElement)) {
      return { added: true, button, target: button.parentElement };
    }

    // Place at end for user or assistant content
    const userContainer = messageElement.matches?.('[data-testid="user-message"]')
      ? messageElement
      : messageElement.querySelector?.('[data-testid="user-message"]');
    const assistantContent = messageElement.matches?.('.font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]')
      ? messageElement
      : messageElement.querySelector?.('.font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]');

    if (userContainer) {
      const messageContent = userContainer.querySelector?.('.font-user-message') || userContainer;
      const lastTextNode = messageContent.querySelector?.('p:last-child, div:last-child') || messageContent;
      lastTextNode.appendChild(button);
      return { added: true, button, target: lastTextNode };
    }

    const targetEnd = this.getTargetEnd(messageElement) || assistantContent;
    if (targetEnd) {
      targetEnd.appendChild(button);
      return { added: true, button, target: targetEnd };
    }

    // Retry later (streaming)
    setTimeout(() => {
      if (messageElement.isConnected && !messageElement.querySelector?.('.chatvault-save-btn')) {
        try { this.addSaveButton(messageElement, createSaveButton, claudeService); } catch (_) {}
      }
    }, 800);

    return { added: false, button: null, target: null };
  },

  // Single message extraction via ClaudeService
  extractSingleMessage(messageElement, claudeService) {
    if (!claudeService || typeof claudeService.extractSingleMessage !== 'function') return null;
    const extractedMessage = claudeService.extractSingleMessage(messageElement);
    if (!extractedMessage) return null;
    const conversationTitle = typeof claudeService.getConversationTitle === 'function'
      ? claudeService.getConversationTitle()
      : document.title;
    return {
      role: extractedMessage.role,
      content: extractedMessage.content,
      title: conversationTitle
    };
  },

  // Multi-message capture via ClaudeService
  captureMessages(mode, count = null, claudeService) {
    if (!claudeService) return { success: false, error: 'ClaudeService not initialized' };
    let messages = [];
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
        return { success: false, error: '無効なキャプチャモード: ' + mode };
    }
    const title = claudeService.getConversationTitle();
    const formattedMessages = messages.map(msg => ({
      speaker: msg.role === 'user' ? 'User' : 'Assistant',
      content: msg.content
    }));
    return { success: true, messages: formattedMessages, title };
  },

  // Artifact button support for Claude
  addSaveButtonToArtifact(artifactContainer, createSaveButton, claudeService) {
    if (!artifactContainer || !artifactContainer.isConnected) return { added: false };
    if (artifactContainer.querySelector('.chatvault-save-btn')) return { added: false };

    const button = createSaveButton();
    if (!button) return { added: false };

    button.style.display = 'inline-flex';
    button.style.marginLeft = '8px';
    button.style.marginTop = '4px';
    button.style.verticalAlign = 'middle';
    button.style.opacity = '0.7';
    button.style.transition = 'opacity 0.2s';
    button.addEventListener('mouseenter', () => (button.style.opacity = '1'));
    button.addEventListener('mouseleave', () => (button.style.opacity = '0.7'));

    const titleSelector = claudeService?.selectors?.artifactTitle;
    const titleEl = titleSelector ? artifactContainer.querySelector(titleSelector) : null;
    if (titleEl) {
      titleEl.insertAdjacentElement('afterend', button);
    } else {
      artifactContainer.appendChild(button);
    }
    return { added: true, button };
  }
};

export default ClaudeProvider;
