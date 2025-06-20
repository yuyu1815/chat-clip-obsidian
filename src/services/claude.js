/**
 * Claude DOM extraction service
 * Handles parsing and extracting messages from Claude web interface
 */

class ClaudeService {
  constructor() {
    this.selectors = {
      // 2024年版の最新Claude UI用セレクタ
      messageContainer: 'div[data-is-streaming], div[class*="font-claude-message"], .group, div[class*="message"]',
      // Alternative selectors for robustness
      alternativeContainer: 'div[role="article"], article, div[class*="bg-bg-300"], div[class*="bg-bg-000"]',
      userMessage: 'div[data-is-streaming="false"][class*="user"], div[class*="font-user"], div[class*="bg-bg-300"]',
      assistantMessage: 'div[data-is-streaming][class*="claude"], div[class*="font-claude-message"], div[class*="bg-bg-000"]',
      // Code blocks
      codeBlock: 'pre code, code',
      codeBlockPre: 'pre',
      // Math expressions
      mathInline: '.katex, span[class*="math"]',
      mathBlock: '.katex-display, div[class*="math-display"]',
      // Message content
      messageContent: 'div[class*="font-claude-message"], div[class*="whitespace-pre-wrap"]',
      alternativeContent: '.prose, div[class*="break-words"], p, div',
      // Speaker identification
      messageRole: '[data-role], [class*="role"]',
      // Conversation title
      conversationTitle: 'h1, h2, [class*="title"]',
      alternativeTitle: '.conversation-title, [role="heading"]'
    };
  }

  /**
   * Extract a single message from a DOM element
   * @param {Element} messageElement - The message DOM element
   * @returns {Object} Extracted message data
   */
  extractSingleMessage(messageElement) {
    try {
      // Determine message role (user or assistant)
      let role = 'assistant'; // Default to assistant
      
      if (messageElement.closest(this.selectors.userMessage) || 
          messageElement.querySelector(this.selectors.userMessage) ||
          messageElement.getAttribute('data-testid') === 'user-message') {
        role = 'user';
      }
      
      // Find content element
      const contentElement = messageElement.querySelector(this.selectors.messageContent) || 
                           messageElement.querySelector(this.selectors.alternativeContent) ||
                           messageElement;
      
      // Clone to avoid modifying the original DOM
      const clonedContent = contentElement.cloneNode(true);
      
      // Process code blocks to preserve formatting
      const codeBlocks = clonedContent.querySelectorAll(this.selectors.codeBlock);
      codeBlocks.forEach(block => {
        const preElement = block.closest('pre');
        if (preElement) {
          const language = block.className.match(/language-(\w+)/)?.[1] || 
                          preElement.getAttribute('data-language') || '';
          const code = block.textContent;
          preElement.setAttribute('data-language', language);
        }
      });

      // Process standalone pre elements
      const preBlocks = clonedContent.querySelectorAll(this.selectors.codeBlockPre);
      preBlocks.forEach(block => {
        if (!block.querySelector('code')) {
          const language = block.className.match(/language-(\w+)/)?.[1] || '';
          block.setAttribute('data-language', language);
        }
      });

      // Process math expressions (KaTeX)
      const mathInline = clonedContent.querySelectorAll(this.selectors.mathInline);
      mathInline.forEach(math => {
        // Skip if it's already a display math
        if (!math.closest('.katex-display')) {
          const mathText = math.getAttribute('data-katex') || math.textContent;
          math.textContent = `$${mathText}$`;
        }
      });

      const mathBlock = clonedContent.querySelectorAll(this.selectors.mathBlock);
      mathBlock.forEach(math => {
        const mathText = math.getAttribute('data-katex') || math.textContent;
        math.textContent = `$$\n${mathText}\n$$`;
      });

      return {
        role: role,
        speaker: role === 'user' ? 'User' : 'Assistant',
        content: clonedContent.innerHTML,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting Claude message:', error);
      return null;
    }
  }

  /**
   * Extract all messages from the current chat
   * @returns {Array} Array of message objects
   */
  extractAllMessages() {
    const messages = [];
    let messageElements = document.querySelectorAll(this.selectors.messageContainer);
    
    if (messageElements.length === 0) {
      // Fallback to alternative selector
      messageElements = document.querySelectorAll(this.selectors.alternativeContainer);
    }
    
    if (messageElements.length === 0) {
      // Another fallback - look for common message patterns
      messageElements = document.querySelectorAll('[class*="message"]');
    }
    
    messageElements.forEach(element => {
      const message = this.extractSingleMessage(element);
      if (message && message.content.trim()) {
        messages.push(message);
      }
    });

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
      ? container.querySelectorAll(this.selectors.messageContainer)
      : container.parentElement.querySelectorAll(this.selectors.messageContainer);

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
      this.selectors.conversationTitle,
      this.selectors.alternativeTitle,
      'h1',
      '.title',
      '[role="heading"]'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    // Extract from URL if available
    const urlMatch = window.location.pathname.match(/\/chat\/([^\/]+)/);
    if (urlMatch) {
      return `Claude Chat ${urlMatch[1]}`;
    }

    // Fallback to page title
    let title = document.title.replace(' | Claude', '').replace(' - Claude', '').trim();
    return title || 'Claude Conversation';
  }

  /**
   * Find the closest message element to a given element
   * @param {Element} element - The starting element
   * @returns {Element|null} The closest message element
   */
  findClosestMessage(element) {
    return element.closest(this.selectors.messageContainer) || 
           element.closest(this.selectors.alternativeContainer) ||
           element.closest('[class*="message"]');
  }

  /**
   * Check if the current page is a Claude chat page
   * @returns {boolean} True if on Claude chat page
   */
  isClaudeChat() {
    return window.location.hostname.includes('claude.ai') && 
           (window.location.pathname.includes('/chat') || 
            document.querySelector(this.selectors.messageContainer) ||
            document.querySelector(this.selectors.alternativeContainer));
  }

  /**
   * Wait for messages to load on the page
   * @param {number} timeout - Maximum time to wait in milliseconds
   * @returns {Promise<boolean>} Resolves when messages are found or timeout
   */
  waitForMessages(timeout = 5000) {
    return new Promise((resolve) => {
      const checkMessages = () => {
        const messages = document.querySelectorAll(this.selectors.messageContainer);
        if (messages.length > 0) {
          resolve(true);
          return;
        }
        
        const altMessages = document.querySelectorAll(this.selectors.alternativeContainer);
        if (altMessages.length > 0) {
          resolve(true);
          return;
        }
      };

      // Check immediately
      checkMessages();

      // Set up observer
      const observer = new MutationObserver(() => {
        checkMessages();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Timeout fallback
      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, timeout);
    });
  }
}

export default ClaudeService;