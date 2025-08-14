/**
 * Claude DOM抽出ロジック
 * Claude.aiのチャット画面から会話データを抽出する
 */

import { TextSplitter } from '../utils/workerManager.js';

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
      conversationTitle: 'h1, h2, [class*="title"]',
      // Artifacts 用セレクタ（複数パターンにフォールバック）
      // コンテナ: もっとも広い Artifact 包含要素
      artifactContainer: [
        '[data-testid="artifact"]',
        '[data-testid="artifact-container"]',
        '[data-qa="artifact-container"]',
        'section:has([data-testid="artifact-title"])',
        'div:has(> [data-testid="artifact-title"])',
        '[class*="artifact-container"]',
        '[class*="ArtifactContainer"]',
        '[class*="artifact"]:has(pre), [class*="Artifact"]:has(pre)'
      ].join(', '),
      // タイトル: Artifact 内の見出し
      artifactTitle: [
        '[data-testid="artifact-title"]',
        '[data-qa="artifact-title"]',
        '[role="heading"][aria-level="1"]',
        '[role="heading"][aria-level="2"]',
        'header h1, header h2',
        'h1, h2'
      ].join(', '),
      // 本文/内容: コード/HTML/テキストを包括
      artifactContent: [
        '[data-testid="artifact-content"]',
        '[data-qa="artifact-content"]',
        'div[role="document"]',
        'div.prose',
        'article',
        'div[class*="whitespace-pre"]',
        'div[class*="cm-content"]',
        'pre, code'
      ].join(', '),
      // コードブロック（言語推定用）
      artifactCodeBlock: [
        '[data-testid="code-block"] pre',
        'pre code',
        'pre'
      ].join(', ')
    };
  }

  /**
   * 単一の Artifact を抽出
   * @param {Element} element - Artifact を含む/指す要素
   * @returns {Promise<Object|null>} `{ type, title, content, language?, filename? }`
   */
  async extractArtifact(element) {
    try {
      if (!element || !(element instanceof Element)) return null;

      // Artifact コンテナを解決（:has() 非対応環境ではフォールバック）
      let artifactContainer = null;
      const safeContainerSelector = [
        '[data-testid="artifact"]',
        '[data-testid="artifact-container"]',
        '[data-qa="artifact-container"]',
        '[class*="artifact-container"]',
        '[class*="ArtifactContainer"]'
      ].join(', ');

      const tryResolve = (selector) => {
        let found = null;
        try {
          if (element.matches?.(selector)) found = element;
        } catch (_) {}
        if (!found) {
          try { found = element.closest?.(selector) || null; } catch (_) {}
        }
        if (!found) {
          try { found = element.querySelector?.(selector) || null; } catch (_) {}
        }
        return found;
      };

      artifactContainer = tryResolve(this.selectors.artifactContainer);
      if (!artifactContainer) {
        artifactContainer = tryResolve(safeContainerSelector);
      }
      if (!artifactContainer) return null;

      // タイトル抽出
      const titleElement = artifactContainer.querySelector(this.selectors.artifactTitle);
      const rawTitle = titleElement?.textContent?.trim() || 'Artifact';

      // 内容抽出（クローンして無関係UIを除去）
      const contentRoot = artifactContainer.querySelector(this.selectors.artifactContent) || artifactContainer;
      const cloned = contentRoot.cloneNode(true);

      // 余計なUIを削除
      cloned.querySelectorAll('.chatvault-save-btn, [role="button"], button, [data-testid*="toolbar"], [class*="toolbar"], [data-testid*="copy"], [data-qa*="copy"]').forEach(el => el.remove());

      // コードブロックを検出
      const codeBlocks = cloned.querySelectorAll(this.selectors.artifactCodeBlock);
      let language = '';
      let content = '';

      if (codeBlocks.length > 0) {
        // 代表ブロックから言語を推定
        const primaryBlock = codeBlocks[0].closest('pre') || codeBlocks[0];
        const primaryCode = primaryBlock.querySelector('code') || primaryBlock;
        language = this.detectLanguage(primaryCode, artifactContainer) || '';

        // すべてのブロックを Markdown フェンスに変換して連結
        const fenced = Array.from(codeBlocks).map(block => {
          const pre = block.closest('pre') || block;
          const codeEl = pre.querySelector('code') || pre;
          const lang = this.detectLanguage(codeEl, artifactContainer) || language || '';
          const codeText = codeEl.textContent || '';
          return this.buildCodeFence(codeText, lang);
        });
        content = fenced.join('\n\n');
      } else {
        // テキスト/HTML ベースの場合は一部整形
        // pre 要素はコードフェンスに変換
        const preBlocks = cloned.querySelectorAll('pre');
        preBlocks.forEach(pre => {
          const codeEl = pre.querySelector('code') || pre;
          const lang = this.detectLanguage(codeEl, artifactContainer) || '';
          const codeText = codeEl.textContent || '';
          const placeholder = document.createElement('div');
          placeholder.textContent = this.buildCodeFence(codeText, lang);
          pre.replaceWith(placeholder);
        });

        content = this.extractTextContent(cloned).trim();
      }

      const filename = this.deriveFilename(rawTitle, language);

      return {
        type: 'artifact',
        title: rawTitle,
        content,
        ...(language ? { language } : {}),
        ...(filename ? { filename } : {})
      };
    } catch (error) {
      console.error('[Claude Service] Error extracting artifact:', error);
      return null;
    }
  }

  /**
   * メッセージ要素内の Artifact をすべて抽出
   * 長文は TextSplitter で分割し、`part/totalParts` を付与
   * @param {Element} messageElement - メッセージDOM要素
   * @returns {Promise<Array<Object>>} 抽出された Artifact オブジェクト配列
   */
  async extractArtifactsInMessage(messageElement) {
    try {
      if (!messageElement || !(messageElement instanceof Element)) return [];
      // :has() を含むセレクタは JSDOM で DOMException を投げる可能性があるためフォールバックを用意
      let containers = [];
      const tryQueryAll = (selector) => {
        try {
          const list = messageElement.querySelectorAll(selector);
          return Array.from(list);
        } catch (_) {
          return [];
        }
      };
      const safeContainerSelector = [
        '[data-testid="artifact"]',
        '[data-testid="artifact-container"]',
        '[data-qa="artifact-container"]',
        '[class*="artifact-container"]',
        '[class*="ArtifactContainer"]'
      ].join(', ');

      containers = tryQueryAll(this.selectors.artifactContainer);
      if (!containers.length) {
        containers = tryQueryAll(safeContainerSelector);
      }
      if (!containers || containers.length === 0) return [];

      const results = [];
      for (const container of containers) {
        const artifact = await this.extractArtifact(container);
        if (!artifact || !artifact.content) continue;

        const artifacts = await this.splitArtifactIfNeeded(artifact);
        results.push(...artifacts);
      }

      return results;
    } catch (error) {
      console.error('[Claude Service] Error extracting artifacts in message:', error);
      return [];
    }
  }

  /**
   * アーティファクトの content が長すぎる場合に分割する
   * @param {Object} artifact - `{ type, title, content, language?, filename? }`
   * @returns {Promise<Array<Object>>} 分割後の配列（1要素の場合もある）
   */
  async splitArtifactIfNeeded(artifact) {
    const MAX = 10000;
    const base = {
      type: 'artifact',
      title: artifact.title,
      language: artifact.language,
      filename: artifact.filename
    };

    if (!artifact.content || artifact.content.length <= MAX) {
      return [{ ...base, content: artifact.content }];
    }

    // Worker ベースの分割を試行し、失敗時は同期フォールバック
    let chunks = [];
    try {
      const splitter = new TextSplitter();
      // 拡張として、拡張機能のURL解決に対応
      if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
        splitter.workerPath = chrome.runtime.getURL('workers/textSplitter.js');
      }
      chunks = await splitter.splitText(artifact.content, MAX, 500);
    } catch (e) {
      // フォールバック: 既存の同期分割
      chunks = this.splitLongMessage(artifact.content, MAX);
    }

    if (!Array.isArray(chunks) || chunks.length === 0) {
      return [{ ...base, content: artifact.content }];
    }

    return chunks.map((chunk, index) => ({
      ...base,
      content: chunk,
      part: index + 1,
      totalParts: chunks.length
    }));
  }

  /**
   * コードフェンスを生成
   * @param {string} codeText
   * @param {string} language
   * @returns {string}
   */
  buildCodeFence(codeText, language = '') {
    const lang = (language || '').trim();
    return `\`\`\`${lang}\n${codeText}\n\`\`\``;
  }

  /**
   * 要素やコンテナから言語を推定
   * @param {Element} codeElement
   * @param {Element} container
   * @returns {string}
   */
  detectLanguage(codeElement, container) {
    if (!codeElement) return '';
    const attrLang = codeElement.getAttribute('data-language') || codeElement.getAttribute('lang');
    if (attrLang) return attrLang.toLowerCase();

    const className = codeElement.className || '';
    const preClass = codeElement.closest('pre')?.className || '';
    const match = (className.match(/language-([\w#+-]+)/i) || preClass.match(/language-([\w#+-]+)/i));
    if (match && match[1]) return match[1].toLowerCase();

    // コンテナのデータ属性を確認
    const containerLang = container?.getAttribute?.('data-language');
    if (containerLang) return containerLang.toLowerCase();

    // タイトルの拡張子から推定
    const titleEl = container?.querySelector?.(this.selectors.artifactTitle);
    const title = titleEl?.textContent || '';
    const ext = (title.split('.').pop() || '').toLowerCase();
    const map = this.languageByExtension();
    if (map[ext]) return map[ext];

    return '';
  }

  /**
   * タイトルと推定言語からファイル名を導出
   * @param {string} rawTitle
   * @param {string} language
   * @returns {string}
   */
  deriveFilename(rawTitle, language = '') {
    const title = (rawTitle || 'artifact').trim();
    const sanitizedTitle = title.replace(/[\/*?"<>:|]/g, '').replace(/\s+/g, '_');
    // 既に拡張子を含む場合はそのまま
    if (/\.[A-Za-z0-9]+$/.test(sanitizedTitle)) return sanitizedTitle;

    const extMap = this.extensionByLanguage();
    const ext = extMap[(language || '').toLowerCase()];
    return ext ? `${sanitizedTitle}.${ext}` : sanitizedTitle;
  }

  /**
   * 言語→拡張子の簡易マップ
   */
  extensionByLanguage() {
    return {
      javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts',
      python: 'py', py: 'py', java: 'java', c: 'c', cpp: 'cpp', 'c++': 'cpp',
      csharp: 'cs', 'c#': 'cs', go: 'go', rust: 'rs', ruby: 'rb', php: 'php',
      swift: 'swift', kotlin: 'kt', scala: 'scala', shell: 'sh', bash: 'sh',
      powershell: 'ps1', html: 'html', css: 'css', json: 'json', yaml: 'yml', yml: 'yml',
      markdown: 'md', md: 'md', sql: 'sql', xml: 'xml', tex: 'tex', r: 'r', matlab: 'm',
      perl: 'pl', lua: 'lua', dart: 'dart', haskell: 'hs'
    };
  }

  /**
   * 拡張子→言語の簡易マップ
   */
  languageByExtension() {
    const map = this.extensionByLanguage();
    const reverse = {};
    Object.keys(map).forEach(lang => {
      const ext = map[lang];
      if (ext && !reverse[ext]) reverse[ext] = lang;
    });
    return reverse;
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
      
      // Claudeの思考プロセスUIを除去（Obsidianには保存しない）
      try {
        // 明示的なクラス名に基づく除去（Claudeの思考プロセス表示ブロック）
        clonedContent.querySelectorAll('[class*="font-claude-response"]').forEach(el => el.remove());
        
        // ラベルに基づく除去（ボタンや見出しのテキストに「思考プロセス」等が含まれる場合）
        const thinkingLabels = /(思考プロセス|Chain of Thought|Thinking)/i;
        const buttons = Array.from(clonedContent.querySelectorAll('button')).filter(btn => thinkingLabels.test(btn.textContent || ''));
        buttons.forEach(btn => {
          const wrapper = btn.closest('div');
          if (wrapper && clonedContent.contains(wrapper)) {
            wrapper.remove();
          }
        });
      } catch (_) {}
      
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