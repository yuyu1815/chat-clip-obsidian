// Gemini-specific helpers extracted from inject.js for maintainability
// This module encapsulates selectors, button placement, and message extraction for Gemini UI.

const GeminiProvider = {
  // Selectors for Gemini conversation items
  getSelectors(geminiService) {
    const sel = geminiService?.selectors || {};
    return {
      container: sel.messageContainer || 'main article, main [role="listitem"], [data-message-id]',
      userMessage: sel.userMessage || '[data-author="user"]',
      assistantMessage: sel.assistantMessage || '[data-author="assistant"]',
      content: sel.messageContent || '[data-message-content], .markdown, .prose'
    };
  },

  // Add a save button to a Gemini message element
  addSaveButton(messageElement, createSaveButton, geminiService) {
    const selectors = this.getSelectors(geminiService);
    const contentSelector = selectors.content || '[data-message-content]';

    let contentElement = null;
    const candidates = String(contentSelector)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const s of candidates) {
      contentElement = messageElement.querySelector(s);
      if (contentElement) break;
    }

    if (contentElement) {
      const button = createSaveButton();
      button.style.display = 'inline-flex';
      button.style.marginLeft = '8px';
      button.style.marginTop = '4px';
      button.style.verticalAlign = 'top';
      button.style.opacity = '0.7';
      button.style.transition = 'opacity 0.2s';
      button.addEventListener('mouseenter', () => (button.style.opacity = '1'));
      button.addEventListener('mouseleave', () => (button.style.opacity = '0.7'));
      contentElement.appendChild(button);
      return { added: true, button, target: contentElement };
    }

    return { added: false, button: null, target: null };
  },

  // Extract a single message content and role for Gemini
  extractSingleMessage(messageElement, geminiService) {
    if (geminiService && typeof geminiService.extractSingleMessage === 'function') {
      const extracted = geminiService.extractSingleMessage(messageElement);
      if (extracted) {
        return {
          role: extracted.role,
          content: extracted.content,
          title: (typeof geminiService.getConversationTitle === 'function'
            ? geminiService.getConversationTitle()
            : document.title)
        };
      }
    }

    // Fallback DOM-based extraction
    const selectors = this.getSelectors(geminiService);
    const isUser = messageElement.matches(selectors.userMessage);
    const contentEl = messageElement.querySelector(selectors.content);
    const text = contentEl ? (contentEl.textContent || contentEl.innerText || '') : (messageElement.textContent || '');

    return {
      role: isUser ? 'user' : 'assistant',
      content: text,
      title: document.title
    };
  },

  // Capture multiple messages according to mode for Gemini
  captureMessages(mode, count = null, geminiService) {
    if (!geminiService) {
      // Fallback DOM-only approach if service instance is not provided
      const selectors = this.getSelectors();
      const allMessages = Array.from(document.querySelectorAll(selectors.container)).map((msg) => {
        const isUser = msg.matches(selectors.userMessage);
        const contentEl = msg.querySelector(selectors.content);
        return {
          speaker: isUser ? 'User' : 'Assistant',
          content: contentEl ? contentEl.innerHTML : ''
        };
      });
      let messages = allMessages;
      if (mode === 'recent' && count) messages = allMessages.slice(-count);
      else if (mode !== 'all' && mode !== 'recent' && mode !== 'selected') {
        throw new Error('無効なキャプチャモード: ' + mode);
      }
      return { success: true, messages, title: document.title };
    }

    // Use GeminiService when available
    let rawMessages = [];
    switch (mode) {
      case 'all':
        rawMessages = geminiService.extractAllMessages();
        break;
      case 'recent':
        rawMessages = geminiService.extractRecentMessages(count || 30);
        break;
      case 'selected':
        rawMessages = geminiService.extractSelectedMessages();
        break;
      default:
        throw new Error('無効なキャプチャモード: ' + mode);
    }

    const title = typeof geminiService.getConversationTitle === 'function'
      ? geminiService.getConversationTitle()
      : document.title;

    const messages = rawMessages.map((msg) => ({
      speaker: msg.role === 'user' ? 'User' : 'Assistant',
      content: msg.content
    }));

    return { success: true, messages, title };
  }
};

export default GeminiProvider;
