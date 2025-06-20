/**
 * ChatGPT DOM extraction service
 * Handles parsing and extracting messages from ChatGPT web interface
 */

class ChatGPTService {
  constructor() {
    this.selectors = {
      // Message container that includes both user and assistant messages
      messageGroup: '[data-message-author-role]',
      // Alternative selectors for robustness
      alternativeGroup: '.group',
      // Code blocks
      codeBlock: 'pre',
      // Math expressions
      mathInline: '.math-inline',
      mathBlock: '.math-block',
      // Message content
      messageContent: '.markdown',
      // Speaker identification
      userAvatar: '[data-message-author-role="user"]',
      assistantAvatar: '[data-message-author-role="assistant"]'
    };
  }

  /**
   * Extract a single message from a DOM element
   * @param {Element} messageElement - The message DOM element
   * @returns {Object} Extracted message data
   */
  extractSingleMessage(messageElement) {
    try {
      const role = messageElement.getAttribute('data-message-author-role') || 
                   (messageElement.querySelector(this.selectors.userAvatar) ? 'user' : 'assistant');
      
      const contentElement = messageElement.querySelector(this.selectors.messageContent) || messageElement;
      
      // Clone to avoid modifying the original DOM
      const clonedContent = contentElement.cloneNode(true);
      
      // Process code blocks to preserve formatting
      const codeBlocks = clonedContent.querySelectorAll(this.selectors.codeBlock);
      codeBlocks.forEach(block => {
        const language = block.getAttribute('class')?.match(/language-(\w+)/)?.[1] || '';
        const code = block.textContent;
        block.setAttribute('data-language', language);
      });

      // Process math expressions
      const mathInline = clonedContent.querySelectorAll(this.selectors.mathInline);
      mathInline.forEach(math => {
        math.textContent = `$${math.textContent}$`;
      });

      const mathBlock = clonedContent.querySelectorAll(this.selectors.mathBlock);
      mathBlock.forEach(math => {
        math.textContent = `$$\n${math.textContent}\n$$`;
      });

      return {
        role: role,
        content: clonedContent.innerHTML,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting message:', error);
      return null;
    }
  }

  /**
   * Extract all messages from the current chat
   * @returns {Array} Array of message objects
   */
  extractAllMessages() {
    const messages = [];
    const messageElements = document.querySelectorAll(this.selectors.messageGroup);
    
    if (messageElements.length === 0) {
      // Fallback to alternative selector
      const altElements = document.querySelectorAll(this.selectors.alternativeGroup);
      altElements.forEach(element => {
        const message = this.extractSingleMessage(element);
        if (message) messages.push(message);
      });
    } else {
      messageElements.forEach(element => {
        const message = this.extractSingleMessage(element);
        if (message) messages.push(message);
      });
    }

    return messages;
  }

  /**
   * Extract the last N messages
   * @param {number} count - Number of messages to extract
   * @returns {Array} Array of message objects
   */
  extractLastNMessages(count = 30) {
    const allMessages = this.extractAllMessages();
    return allMessages.slice(-count);
  }

  /**
   * Extract messages within a selection range
   * @returns {Array} Array of message objects within selection
   */
  extractSelectedMessages() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return [];

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    
    const messages = [];
    const messageElements = container.nodeType === Node.ELEMENT_NODE 
      ? container.querySelectorAll(this.selectors.messageGroup)
      : container.parentElement.querySelectorAll(this.selectors.messageGroup);

    messageElements.forEach(element => {
      if (range.intersectsNode(element)) {
        const message = this.extractSingleMessage(element);
        if (message) messages.push(message);
      }
    });

    return messages;
  }

  /**
   * Get the current conversation title
   * @returns {string} The conversation title
   */
  getConversationTitle() {
    // Try multiple selectors for robustness
    const titleSelectors = [
      'h1',
      '.text-2xl',
      '[role="heading"]',
      'title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Fallback to page title
    return document.title.replace(' | OpenAI', '').trim() || 'ChatGPT Conversation';
  }

  /**
   * Find the closest message element to a given element
   * @param {Element} element - The starting element
   * @returns {Element|null} The closest message element
   */
  findClosestMessage(element) {
    return element.closest(this.selectors.messageGroup) || 
           element.closest(this.selectors.alternativeGroup);
  }
}

export default ChatGPTService;