// ChatGPT-specific helpers extracted from inject.js for maintainability
// This module encapsulates selectors, button placement, and message extraction for ChatGPT UI.

const ChatGPTProvider = {
  // Selectors for ChatGPT conversation items
  getSelectors() {
    return {
      container: '[data-message-author-role][data-message-id]',
      userMessage: '[data-message-author-role="user"][data-message-id]',
      assistantMessage: '[data-message-author-role="assistant"][data-message-id]',
      content: '.markdown, [class*="markdown"], .prose, [class*="prose"], .whitespace-pre-wrap'
    };
  },

  // Add a save button to a ChatGPT message element
  addSaveButton(messageElement, createSaveButton) {
    const button = createSaveButton();

    // Find content area in ChatGPT message
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
      // Inline style similar to previous behavior
      const buttonEl = button;
      buttonEl.style.display = 'inline-flex';
      buttonEl.style.marginLeft = '8px';
      buttonEl.style.marginTop = '4px';
      buttonEl.style.verticalAlign = 'top';
      buttonEl.style.opacity = '0.7';
      buttonEl.style.transition = 'opacity 0.2s';

      buttonEl.addEventListener('mouseenter', () => (buttonEl.style.opacity = '1'));
      buttonEl.addEventListener('mouseleave', () => (buttonEl.style.opacity = '0.7'));

      contentElement.appendChild(buttonEl);
      return { added: true, button: buttonEl, target: contentElement };
    }

    return { added: false, button: null, target: null };
  },

  // Extract a single message content and role for ChatGPT
  extractSingleMessage(messageElement) {
    const text = messageElement.textContent || messageElement.innerText || '';
    const isUser = messageElement.getAttribute('data-message-author-role') === 'user';
    const role = isUser ? 'user' : 'assistant';
    const title = document.title.replace(' | ChatGPT', '').replace(' - ChatGPT', '');
    return {
      role,
      content: text,
      title
    };
  },

  // Capture multiple messages according to mode for ChatGPT
  captureMessages(mode, count = null) {
    const selectors = this.getSelectors();
    const allMessages = Array.from(document.querySelectorAll(selectors.container)).map((msg) => {
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
    } else if (mode === 'selected') {
      // Best-effort: If selection-based extraction is needed, fallback to all for ChatGPT
      messages = allMessages;
    } else if (mode !== 'all' && mode !== 'recent') {
      throw new Error('無効なキャプチャモード: ' + mode);
    }

    const title = document.title
      .replace(' | Claude', '')
      .replace(' - ChatGPT', '')
      .replace(' | ChatGPT', '');

    return { success: true, messages, title };
  }
};

export default ChatGPTProvider;
