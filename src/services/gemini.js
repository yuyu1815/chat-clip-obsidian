/**
 * Gemini DOM抽出ロジック
 * gemini.google.com / aistudio.google.com のチャット画面から会話を抽出
 */

import { TextSplitter } from '../utils/workerManager.js';

class GeminiService {
  constructor() {
    this.service = 'Gemini';
    this.selectors = {
      // メッセージコンテナ（複数候補にフォールバック）
      messageContainer: [
        'main article',
        'main [role="listitem"]',
        'c-wiz[role="listitem"]',
        '[data-message-id]',
        'div[class*="message"]',
        'li[class*="message"]'
      ].join(', '),
      // 役割推定用
      userMessage: [
        '[data-author="user"]',
        '[data-speaker="user"]',
        '[data-is-user="true"]',
        '[aria-label="You"], [aria-label="あなた"]',
        '[class*="user"], [class*="own"], [class*="me"]'
      ].join(', '),
      assistantMessage: [
        '[data-author="assistant"]',
        '[data-speaker="assistant"]',
        '[data-is-bot="true"]',
        '[class*="assistant"], [class*="model"], [class*="bot"]'
      ].join(', '),
      // コンテンツ
      messageContent: [
        '[data-message-content]',
        '.markdown, [class*="markdown"]',
        '.prose, [class*="prose"]',
        '[class*="whitespace-pre-wrap"]',
        'div[lang]'
      ].join(', '),
      codeBlock: 'pre, pre code',
      mathInline: '.katex:not(.katex-display)',
      mathBlock: '.katex-display',
      // タイトル
      conversationTitle: 'header h1, h1, [role="heading"], title'
    };
  }

  /**
   * 単一メッセージを抽出
   * @param {Element} messageElement
   * @returns {Object|null}
   */
  extractSingleMessage(messageElement) {
    try {
      if (!messageElement || !(messageElement instanceof Element)) return null;

      const role = this.inferRole(messageElement);

      // コンテンツ要素
      const contentElement = messageElement.querySelector(this.selectors.messageContent) || messageElement;

      // クローンしてUIを除去/整形
      const clonedContent = contentElement.cloneNode(true);

      // 余計なUIを削除
      clonedContent.querySelectorAll('.chatvault-save-btn, [role="button"], button, [data-testid*="toolbar"], [class*="toolbar"], [data-testid*="copy"], [data-qa*="copy"]').forEach(el => el.remove());

      // コードブロックをコードフェンスに
      const pres = clonedContent.querySelectorAll('pre');
      pres.forEach(pre => {
        const codeEl = pre.querySelector('code') || pre;
        const language = this.detectLanguage(codeEl);
        const codeText = codeEl.textContent || '';
        const placeholder = document.createElement('div');
        placeholder.textContent = this.buildCodeFence(codeText, language);
        pre.replaceWith(placeholder);
      });

      // 数式の整形
      const mathInline = clonedContent.querySelectorAll(this.selectors.mathInline);
      mathInline.forEach(math => {
        const span = document.createElement('span');
        span.textContent = `$${math.textContent}$`;
        math.replaceWith(span);
      });
      const mathBlock = clonedContent.querySelectorAll(this.selectors.mathBlock);
      mathBlock.forEach(math => {
        const div = document.createElement('div');
        div.textContent = `$$\n${math.textContent}\n$$`;
        math.replaceWith(div);
      });

      const content = this.extractTextContent(clonedContent).trim();

      return {
        role,
        content,
        timestamp: new Date().toISOString(),
        element: messageElement
      };
    } catch (error) {
      console.error('[Gemini Service] Error extracting single message:', error);
      return null;
    }
  }

  /**
   * 全メッセージを抽出
   * @returns {Array}
   */
  extractAllMessages() {
    try {
      const messages = [];
      // 会話領域内で幅広く検索
      const root = document.querySelector('main, [role="main"]') || document.body;
      const elements = root.querySelectorAll(this.selectors.messageContainer);
      elements.forEach(el => {
        const msg = this.extractSingleMessage(el);
        if (msg && msg.content) messages.push(msg);
      });
      return messages;
    } catch (error) {
      console.error('[Gemini Service] Error extracting all messages:', error);
      return [];
    }
  }

  /**
   * 直近N件を抽出
   * @param {number} count
   * @returns {Array}
   */
  extractRecentMessages(count = 30) {
    const all = this.extractAllMessages();
    return all.slice(-count);
  }

  /**
   * 選択範囲内のメッセージ抽出
   * @returns {Array}
   */
  extractSelectedMessages() {
    try {
      const selection = window.getSelection();
      if (!selection.rangeCount || selection.isCollapsed) return [];
      const range = selection.getRangeAt(0);
      const all = this.extractAllMessages();
      return all.filter(msg => range.intersectsNode(msg.element));
    } catch (error) {
      console.error('[Gemini Service] Error extracting selected messages:', error);
      return [];
    }
  }

  /**
   * 長文分割（Worker優先、失敗時フォールバック）
   * @param {string} content
   * @param {number} maxLength
   * @returns {Promise<Array<string>>}
   */
  async splitLongMessage(content, maxLength = 10000) {
    if (!content || content.length <= maxLength) return [content];
    try {
      const splitter = new TextSplitter();
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        splitter.workerPath = chrome.runtime.getURL('workers/textSplitter.js');
      }
      const chunks = await splitter.splitText(content, maxLength, 500);
      if (Array.isArray(chunks) && chunks.length > 0) return chunks;
    } catch (e) {
      // fallthrough to sync
    }
    return this.splitLongMessageSync(content, maxLength);
  }

  /**
   * 同期分割フォールバック
   */
  splitLongMessageSync(content, maxLength = 10000) {
    if (content.length <= maxLength) return [content];
    const chunks = [];
    let current = '';
    const lines = content.split('\n');
    for (const line of lines) {
      if (current.length + line.length + 1 > maxLength) {
        chunks.push(current.trim());
        current = line;
      } else {
        current += (current ? '\n' : '') + line;
      }
    }
    if (current) chunks.push(current.trim());
    return chunks;
  }

  /**
   * 役割を推定
   * @param {Element} element
   * @returns {'user'|'assistant'}
   */
  inferRole(element) {
    try {
      if (
        element.matches?.(this.selectors.userMessage) ||
        element.querySelector?.(this.selectors.userMessage)
      ) {
        return 'user';
      }
      if (
        element.matches?.(this.selectors.assistantMessage) ||
        element.querySelector?.(this.selectors.assistantMessage)
      ) {
        return 'assistant';
      }
      // テキスト手掛かり（英/日）
      const text = element.textContent || '';
      if (/^you\b/i.test(text) || /\bYou:/i.test(text) || /あなた[:：]/.test(text)) {
        return 'user';
      }
      return 'assistant';
    } catch (_) {
      return 'assistant';
    }
  }

  /**
   * タイトル取得
   */
  getConversationTitle() {
    const selectors = this.selectors.conversationTitle.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent?.trim()) return el.textContent.trim();
    }
    return document.title
      .replace(' - Gemini', '')
      .replace(' | Gemini', '')
      .replace(' - Google', '')
      .trim() || 'Gemini Conversation';
  }

  /**
   * テキスト抽出（ブロック間は空行）
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
          if (lastWasBlock && text && !text.endsWith('\n\n')) text += '\n\n';
          text += content;
          lastWasBlock = false;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const isBlock = [
          'P','DIV','H1','H2','H3','H4','H5','H6','UL','OL','LI','BLOCKQUOTE','PRE','TABLE','SECTION','ARTICLE'
        ].includes(node.tagName);
        if (isBlock) lastWasBlock = true;
        if (node.tagName === 'BR') text += '\n';
      }
    }
    return text;
  }

  /**
   * コードフェンス生成
   */
  buildCodeFence(codeText, language = '') {
    const lang = (language || '').trim();
    return `\`\`\`${lang}\n${codeText}\n\`\`\``;
  }

  /**
   * 言語推定
   */
  detectLanguage(codeElement) {
    if (!codeElement) return '';
    const attrLang = codeElement.getAttribute?.('data-language') || codeElement.getAttribute?.('lang');
    if (attrLang) return attrLang.toLowerCase();
    const className = codeElement.className || '';
    const preClass = codeElement.closest('pre')?.className || '';
    const match = (className.match(/language-([\w#+-]+)/i) || preClass.match(/language-([\w#+-]+)/i));
    if (match && match[1]) return match[1].toLowerCase();
    return '';
  }

  /**
   * 近傍のメッセージ要素
   */
  findClosestMessage(element) {
    try {
      const root = document.querySelector('main, [role="main"]') || document.body;
      const containers = root.querySelectorAll(this.selectors.messageContainer);
      if (element.closest) {
        for (const container of containers) {
          if (element.closest(container.tagName)) return element.closest(container.tagName);
        }
      }
    } catch (_) {}
    return null;
  }
}

export default GeminiService;


