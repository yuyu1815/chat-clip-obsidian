/**
 * Claude DOM抽出ロジック
 * Claude.aiのチャット画面から会話データを抽出する
 */

class ClaudeService {
  constructor() {
    this.service = 'Claude';
    this.selectors = {
      // 最新のClaude UI用セレクタ (2025年版)
      userMessage: '[data-testid="user-message"]',
      assistantMessage: '[data-is-streaming]',
      messageContainer: '[data-testid="user-message"], [data-is-streaming]',
      // コンテンツ要素
      messageContent: 'div.prose, div[class*="whitespace-pre-wrap"]',
      codeBlock: 'pre code, pre',
      mathInline: '.katex:not(.katex-display)',
      mathBlock: '.katex-display',
      // 会話タイトル
      conversationTitle: 'h1, h2, [class*="title"]'
    };
  }

  /**
   * 単一メッセージを抽出
   * @param {Element} messageElement - メッセージDOM要素
   * @returns {Object} 抽出されたメッセージデータ
   */
  extractSingleMessage(messageElement) {
    try {
      // メッセージの種類を判定
      const isUserMessage = messageElement.hasAttribute('data-testid') && 
                           messageElement.getAttribute('data-testid') === 'user-message';
      const isAssistantMessage = messageElement.hasAttribute('data-is-streaming');
      
      const role = isUserMessage ? 'user' : (isAssistantMessage ? 'assistant' : 'unknown');
      
      // メッセージ内容を取得
      let content = '';
      
      // コンテンツ要素を探す
      const contentElement = messageElement.querySelector(this.selectors.messageContent) || messageElement;
      
      // クローンして処理（元のDOMを変更しない）
      const clonedContent = contentElement.cloneNode(true);
      
      // 保存ボタンを削除（もし存在すれば）
      const saveButtons = clonedContent.querySelectorAll('.chatvault-save-btn');
      saveButtons.forEach(btn => btn.remove());
      
      // コードブロックを処理
      const codeBlocks = clonedContent.querySelectorAll('pre');
      codeBlocks.forEach(pre => {
        const code = pre.querySelector('code');
        const language = code?.className.match(/language-(\w+)/)?.[1] || '';
        const codeText = (code || pre).textContent;
        const placeholder = document.createElement('div');
        placeholder.textContent = `\`\`\`${language}\n${codeText}\n\`\`\``;
        pre.replaceWith(placeholder);
      });
      
      // インライン数式を処理
      const mathInline = clonedContent.querySelectorAll(this.selectors.mathInline);
      mathInline.forEach(math => {
        const mathText = math.textContent;
        const placeholder = document.createElement('span');
        placeholder.textContent = `$${mathText}$`;
        math.replaceWith(placeholder);
      });
      
      // ブロック数式を処理
      const mathBlock = clonedContent.querySelectorAll(this.selectors.mathBlock);
      mathBlock.forEach(math => {
        const mathText = math.textContent;
        const placeholder = document.createElement('div');
        placeholder.textContent = `$$\n${mathText}\n$$`;
        math.replaceWith(placeholder);
      });
      
      // テキストコンテンツを取得
      content = this.extractTextContent(clonedContent);
      
      return {
        role,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        element: messageElement
      };
    } catch (error) {
      console.error('[Claude Service] Error extracting single message:', error);
      return null;
    }
  }

  /**
   * DOM要素からテキストコンテンツを抽出
   * @param {Element} element - DOM要素
   * @returns {string} テキストコンテンツ
   */
  extractTextContent(element) {
    let text = '';
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    let node;
    let lastWasBlock = false;
    
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent.trim();
        if (content) {
          // 前がブロック要素だった場合は改行を追加
          if (lastWasBlock && text && !text.endsWith('\n\n')) {
            text += '\n\n';
          }
          text += content;
          lastWasBlock = false;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // ブロック要素の判定
        const isBlock = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE'].includes(node.tagName);
        if (isBlock) {
          lastWasBlock = true;
        }
        
        // 改行が必要な要素
        if (node.tagName === 'BR') {
          text += '\n';
        }
      }
    }
    
    return text;
  }

  /**
   * 全メッセージを取得
   * @returns {Array} メッセージの配列
   */
  extractAllMessages() {
    try {
      const messages = [];
      const messageElements = document.querySelectorAll(this.selectors.messageContainer);
      
      messageElements.forEach(element => {
        const message = this.extractSingleMessage(element);
        if (message && message.content) {
          messages.push(message);
        }
      });
      
      return messages;
    } catch (error) {
      console.error('[Claude Service] Error getting all messages:', error);
      return [];
    }
  }

  /**
   * 最新N件のメッセージを取得
   * @param {number} count - 取得するメッセージ数
   * @returns {Array} メッセージの配列
   */
  extractLastNMessages(count = 30) {
    const allMessages = this.extractAllMessages();
    return allMessages.slice(-count);
  }

  /**
   * 選択範囲内のメッセージを取得
   * @returns {Array} 選択範囲内のメッセージ
   */
  extractSelectedMessages() {
    try {
      const selection = window.getSelection();
      if (!selection.rangeCount || selection.isCollapsed) {
        return [];
      }
      
      const range = selection.getRangeAt(0);
      const allMessages = this.extractAllMessages();
      
      return allMessages.filter(msg => {
        return range.intersectsNode(msg.element);
      });
    } catch (error) {
      console.error('[Claude Service] Error getting selected messages:', error);
      return [];
    }
  }

  /**
   * メッセージをMarkdown形式に変換
   * @param {Array} messages - メッセージの配列
   * @returns {string} Markdown形式のテキスト
   */
  messagesToMarkdown(messages) {
    return messages.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      return `### ${role}\n\n${msg.content}`;
    }).join('\n\n---\n\n');
  }

  /**
   * 会話のタイトルを生成
   * @param {Array} messages - メッセージの配列
   * @returns {string} タイトル
   */
  generateTitle(messages) {
    if (!messages || !messages.length) return 'Claude Chat';
    
    // 最初のユーザーメッセージからタイトルを生成
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage) {
      const title = firstUserMessage.content
        .replace(/```[\s\S]*?```/g, '') // コードブロックを除去
        .replace(/\$\$[\s\S]*?\$\$/g, '') // ブロック数式を除去
        .replace(/\$[^\$]+\$/g, '') // インライン数式を除去
        .replace(/\n+/g, ' ') // 改行を空白に
        .trim()
        .substring(0, 50); // 最大50文字
      
      return title + (firstUserMessage.content.length > 50 ? '...' : '');
    }
    
    return `Claude Chat - ${new Date().toLocaleDateString('ja-JP')}`;
  }

  /**
   * 現在の会話タイトルを取得
   * @returns {string} 会話タイトル
   */
  getConversationTitle() {
    // まずはDOM要素から取得を試みる
    const titleElement = document.querySelector(this.selectors.conversationTitle);
    if (titleElement && titleElement.textContent.trim()) {
      return titleElement.textContent.trim();
    }
    
    // URLから取得を試みる
    const urlMatch = window.location.pathname.match(/\/chat\/([^\/]+)/);
    if (urlMatch) {
      return `Claude Chat ${urlMatch[1]}`;
    }
    
    // メッセージから生成
    const messages = this.extractAllMessages();
    return this.generateTitle(messages);
  }

  /**
   * 最も近いメッセージ要素を検索
   * @param {Element} element - 起点となる要素
   * @returns {Element|null} メッセージ要素
   */
  findClosestMessage(element) {
    return element.closest(this.selectors.messageContainer);
  }

  /**
   * 現在のページがClaudeチャットページかどうか
   * @returns {boolean} チャットページの場合true
   */
  isClaudeChat() {
    return window.location.hostname.includes('claude.ai') && 
           (window.location.pathname.includes('/chat') || 
            document.querySelector(this.selectors.messageContainer));
  }

  /**
   * メッセージの読み込みを待つ
   * @param {number} timeout - タイムアウト時間（ミリ秒）
   * @returns {Promise<boolean>} メッセージが見つかった場合true
   */
  waitForMessages(timeout = 5000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      const checkMessages = () => {
        const messages = document.querySelectorAll(this.selectors.messageContainer);
        if (messages.length > 0) {
          resolve(true);
          return;
        }
        
        if (Date.now() - startTime < timeout) {
          requestAnimationFrame(checkMessages);
        } else {
          resolve(false);
        }
      };
      
      checkMessages();
    });
  }

  /**
   * 長文メッセージを分割
   * @param {string} content - メッセージ内容
   * @param {number} maxLength - 最大文字数
   * @returns {Array} 分割されたメッセージ
   */
  splitLongMessage(content, maxLength = 10000) {
    if (content.length <= maxLength) return [content];
    
    const chunks = [];
    let currentChunk = '';
    const lines = content.split('\n');
    
    for (const line of lines) {
      if (currentChunk.length + line.length + 1 > maxLength) {
        chunks.push(currentChunk.trim());
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  /**
   * 特殊文字をエスケープ
   * @param {string} text - エスケープするテキスト
   * @returns {string} エスケープ済みテキスト
   */
  escapeSpecialChars(text) {
    // Obsidianで問題になる可能性のある文字をエスケープ
    return text
      .replace(/\\/g, '\\\\') // バックスラッシュ
      .replace(/\[/g, '\\[')   // 角括弧（Wiki link用）
      .replace(/\]/g, '\\]')
      .replace(/\|/g, '\\|');  // パイプ（テーブル用）
  }
}

// エクスポート
export default ClaudeService;