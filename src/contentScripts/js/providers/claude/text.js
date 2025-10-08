// Claude text extraction - API直接リクエスト型
import { getSelectors } from './checks.js';
import { getMessageByIndex, getMessageIndexFromRenderCount, initializeSession, startPolling } from './api.js';
import { createLogger } from '../../../../utils/logger.js';

const log = createLogger('Claude Text API');

// セッション初期化フラグ
let isInitialized = false;

// セッションを初期化
async function ensureInitialized() {
  if (!isInitialized) {
    const success = await initializeSession();
    if (success) {
      isInitialized = true;
      startPolling(); // ポーリングを開始
    }
    return success;
  }
  return true;
}

export async function extractSingleMessage(messageElement) {
  try {
    // セッション初期化を確認
    if (!await ensureInitialized()) {
      throw new Error('セッションの初期化に失敗しました');
    }

    const selectors = getSelectors();
    
    // data-test-render-countを取得
    const container = messageElement.closest('[data-test-render-count]');
    if (!container) {
      throw new Error('data-test-render-countが見つかりません');
    }

  } catch (error) {
    log.error('メッセージ抽出エラー:', error);
    
    // フォールバック: 基本的なテキスト抽出
    const text = messageElement.textContent || messageElement.innerText || '';
    const title = (document.title || '')
      .replace(' | Claude', '')
      .replace(' – Claude', '')
      .replace(' - Claude', '');
    
    // エラーをログに記録し、フォールバック値を返す
    log.warn('APIからの取得に失敗、フォールバック処理を実行:', error.message);
    return { 
      role: 'assistant', 
      content: text, 
      title: title,
      error: error.message 
    };
  }
}

export async function captureMessages(mode, count = null) {
  try {
    // セッション初期化を確認
    if (!await ensureInitialized()) {
      throw new Error('セッションの初期化に失敗しました');
    }

    const selectors = getSelectors();
    const containers = document.querySelectorAll(selectors.container);
    
    const messages = [];
    
    for (let i = 0; i < containers.length; i++) {
      const container = containers[i];
      const renderCount = container.getAttribute('data-test-render-count');
      
      if (renderCount !== null) {
        const messageIndex = getMessageIndexFromRenderCount(renderCount);
        const result = await getMessageByIndex(messageIndex);
        
        if (result.success) {
          messages.push({
            speaker: result.message.role === 'user' ? 'User' : 'Assistant',
            content: result.message.content,
            index: messageIndex,
            uuid: result.message.uuid
          });
        }
      }
    }

    // モードに応じてフィルタリング
    let filteredMessages = messages;
    if (mode === 'recent' && count) {
      filteredMessages = messages.slice(-count);
    } else if (mode === 'selected') {
      // 選択されたメッセージの処理（必要に応じて実装）
      filteredMessages = messages;
    } else if (mode !== 'all' && mode !== 'recent') {
      throw new Error('無効なキャプチャモード: ' + mode);
    }

    const title = (document.title || '')
      .replace(' | Claude', '')
      .replace(' – Claude', '')
      .replace(' - Claude', '');

    return { 
      success: true, 
      messages: filteredMessages, 
      title: title,
      totalCount: messages.length,
      filteredCount: filteredMessages.length
    };

  } catch (error) {
    log.error('メッセージキャプチャエラー:', error);
    // エラーをログに記録し、失敗状態を返す
    return { 
      success: false, 
      messages: [], 
      title: '',
      error: error.message 
    };
  }
}
