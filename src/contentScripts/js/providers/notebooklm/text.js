// NotebookLM text extraction
import { getSelectors } from './checks.js';
import { htmlToMarkdown as utilHtmlToMarkdown, toMarkdownIfHtml } from '../../../../utils/markdown.js';

/**
 * 単一メッセージからデータを抽出
 * @param {HTMLElement} messageElement - メッセージ要素
 * @returns {Object} 抽出されたメッセージデータ
 */
export function extractSingleMessage(messageElement) {
  try {
    const selectors = getSelectors();
    
    // コンテンツ要素を取得
    let contentEl = messageElement.querySelector(selectors.content) || messageElement;
    const cloned = contentEl.cloneNode(true);
    
    // 保存ボタンを除去
    if (cloned.querySelectorAll) {
      cloned.querySelectorAll('.chatvault-save-btn').forEach(el => el.remove());
    }
    
    // HTMLとテキストコンテンツを取得
    const html = (cloned.innerHTML || '').trim();
    const text = (cloned.textContent || '').trim();

    // HTMLからMarkdownへ変換（ユーティリティを使用）
    const content = html ? safeHtmlToMarkdown(html) : text;
    
    // ロールの判定（暫定実装）
    let role = 'assistant'; // デフォルトはアシスタント
    
    // ユーザーメッセージかどうかを判定
    if (messageElement.matches && messageElement.matches(selectors.userMessage)) {
      role = 'user';
    } else if (messageElement.querySelector && messageElement.querySelector(selectors.userMessage)) {
      role = 'user';
    }
    
    // タイトルを取得（NotebookLMのページタイトルから不要な部分を除去）
    const title = document.title
      .replace(' | NotebookLM', '')
      .replace(' - NotebookLM', '')
      .replace(' | Google NotebookLM', '')
      .replace(' - Google NotebookLM', '');

    return { role, content, title };
    
  } catch (error) {
    console.error('NotebookLM: メッセージ抽出エラー:', error);
    
    // フォールバック処理
    const text = messageElement.textContent || messageElement.innerText || '';
    let role = 'assistant';
    
    if (messageElement.matches && messageElement.matches(getSelectors().userMessage)) {
      role = 'user';
    }
    
    const title = document.title || 'NotebookLM Chat';
    
    return { role, content: text, title };
  }
}

/**
 * 複数メッセージをキャプチャ
 * @param {string} mode - 'all' | 'recent'
 * @param {number} count - 取得する件数（recentモードの場合）
 * @returns {Array} メッセージ配列
 */
export function captureMessages(mode = 'all', count = 10) {
  try {
    const selectors = getSelectors();
    const messageElements = document.querySelectorAll(selectors.container);
    
    if (!messageElements || messageElements.length === 0) {
      console.warn('NotebookLM: メッセージが見つかりません');
      return [];
    }
    
    let elementsToProcess = Array.from(messageElements);
    
    // recentモードの場合、最新のメッセージから指定数を取得
    if (mode === 'recent' && count > 0) {
      elementsToProcess = elementsToProcess.slice(-count);
    }
    
    // メッセージを抽出
    const messages = elementsToProcess
      .map(element => extractSingleMessage(element))
      .filter(message => message && message.content && message.content.trim().length > 0);
    
    console.log(`NotebookLM: ${messages.length}件のメッセージを抽出しました`);
    return messages;
    
  } catch (error) {
    console.error('NotebookLM: メッセージキャプチャエラー:', error);
    return [];
  }
}

/**
 * NotebookLM用に安全にHTML→Markdownを行うラッパー
 * - 不正なHTMLでもユーティリティ側でフェイルセーフ
 */
function safeHtmlToMarkdown(html) {
  try {
    return utilHtmlToMarkdown(html);
  } catch (e) {
    console.warn('NotebookLM: htmlToMarkdown fallback used', e);
    return toMarkdownIfHtml(html);
  }
}

/**
 * メッセージの検証
 * @param {Object} message - メッセージオブジェクト
 * @returns {boolean} 有効かどうか
 */
function isValidMessage(message) {
  return message && 
         typeof message.role === 'string' && 
         typeof message.content === 'string' && 
         message.content.trim().length > 0;
}

export { safeHtmlToMarkdown as htmlToMarkdown, isValidMessage };
