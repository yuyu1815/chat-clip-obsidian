// Claude API直接リクエスト機能
import {createLogger} from '../../../../utils/logger.js';

const log = createLogger('Claude API');

// API設定
const API_BASE = 'https://claude.ai/api';
// ポーリング設定（ミリ秒）とリトライ最大回数
const POLLING_INTERVAL = 5000; // 5秒ごとに更新チェック（負荷軽減）
const MAX_RETRIES = 3; // エラー時の最大リトライ回数（削減）

// セッション管理
let currentSession = {
  orgId: null,
  chatId: null,
  urlType: null, // 'chat' または 'shared'
  lastUpdatedAt: null
};

// 組織IDを取得
async function getOrgId() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getClaudeOrgId' });
    if (response && response.success) {
      return response.orgId;
    } else {
      log.error('組織IDの取得に失敗:', response?.error);
      return null;
    }
  } catch (error) {
    log.error('組織IDの取得に失敗:', error);
    return null;
  }
}

// URLタイプを判定
function getUrlType(url) {
  if (url.includes('/share/')) {
    return 'shared';
  } else if (url.includes('/chat/')) {
    return 'chat';
  }
  return 'unknown';
}

// チャットIDまたはスナップショットIDをURLから抽出
function extractChatId(url) {
  try {
    const urlType = getUrlType(url);

    if (urlType === 'shared') {
      const patterns = [
        /\/share\/([a-f0-9-]+)/,
        /\/share\/([a-f0-9-]+)\?/,
        /\/share\/([a-f0-9-]+)\//,
        /\/share\/([a-f0-9-]+)$/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return { type: 'shared', id: match[1] };
        }
      }
    } else if (urlType === 'chat') {
      const patterns = [
        /\/chat\/([a-f0-9-]+)/,
        /\/chat\/([a-f0-9-]+)\?/,
        /\/chat\/([a-f0-9-]+)\//,
        /\/chat\/([a-f0-9-]+)$/
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          return { type: 'chat', id: match[1] };
        }
      }
    }

    return null;
  } catch (error) {
    log.error('IDの抽出に失敗:', error);
    return null;
  }
}

// APIリクエストを実行
async function fetchChatData(orgId, chatId, urlType, minimalData = false) {
  try {
    let url;

    if (urlType === 'shared') {
      url = `${API_BASE}/chat_snapshots/${chatId}?rendering_mode=messages`;
      if (!minimalData) url += '&render_all_tools=true';
    } else {
      url = `${API_BASE}/organizations/${orgId}/chat_conversations/${chatId}?rendering_mode=messages`;
      if (!minimalData) url += '&render_all_tools=true';
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    log.error('APIリクエストに失敗:', error);
    // エラーをログに記録し、呼び出し元に適切なエラー情報を伝える
    throw new Error(`Claude APIリクエストエラー: ${error.message}`);
  }
}



// メッセージの内容を抽出
function extractMessageContent(contentArray) {
  if (!Array.isArray(contentArray)) return '';

  let result = '';

  for (const item of contentArray) {
    switch (item.type) {
      case 'text':
        result = item.text;
        break;
      case 'thinking':
        // 思考プロセスはスキップ（内部処理のため）
        break;
      case 'tool_use':
        break;
      case 'tool_result':
        break;
    }
  }

  return result.trim();
}

// HTMLのdata-test-render-countからAPIの配列インデックスを取得
function getMessageIndexFromRenderCount(renderCount) {
  // render-countを直接APIインデックスとして使用
  // ただし、0ベースのインデックスなので調整が必要かもしれない
  const index = parseInt(renderCount, 10);

  // 実際のメッセージ順序を確認して適切にマッピング
  // render-countが1から始まる場合は -1、0から始まる場合はそのまま
  return Math.max(0, index);
}












// 特定のメッセージをAPIから取得
async function getMessageByIndex(index) {
  try {
    if (!currentSession.chatId || !currentSession.urlType) {
      throw new Error('セッション情報が不足しています');
    }

    const data = await fetchChatData(currentSession.orgId, currentSession.chatId, currentSession.urlType);

    if (!data.chat_messages || !Array.isArray(data.chat_messages)) {
      log.error('メッセージデータが見つかりません');
      throw new Error('メッセージデータが見つかりません');
    }

    if (index < 0 || index >= data.chat_messages.length) {
      log.error(`インデックス ${index} は範囲外です (0-${data.chat_messages.length - 1})`);

      // インデックスが範囲外の場合、最後のメッセージを返す
      const fallbackIndex = Math.min(index, data.chat_messages.length - 1);
      log.warn(`フォールバック: インデックス ${fallbackIndex} のメッセージを使用`);

      const fallbackMessage = data.chat_messages[fallbackIndex];
      const fallbackContent = extractMessageContent(fallbackMessage.content);

      return {
        success: true,
        message: {
          role: fallbackMessage.sender === 'human' ? 'user' : 'assistant',
          content: fallbackContent,
          title: data.name || 'Claude Chat',
          uuid: fallbackMessage.uuid,
          created_at: fallbackMessage.created_at,
          updated_at: fallbackMessage.updated_at,
          warning: `インデックスが範囲外のためフォールバックしました (${index} -> ${fallbackIndex})`
        }
      };
    }

    const message = data.chat_messages[index];
    const content = extractMessageContent(message.content);

    return {
      success: true,
      message: {
        role: message.sender === 'human' ? 'user' : 'assistant',
        content: content,
        title: data.name || 'Claude Chat',
        uuid: message.uuid,
        created_at: message.created_at,
        updated_at: message.updated_at
      }
    };
  } catch (error) {
    log.error('メッセージ取得に失敗:', error);
    // エラーをログに記録し、失敗結果を返す
    return {
      success: false,
      error: error.message
    };
  }
}

// セッションを初期化
async function initializeSession() {
  try {
    const urlInfo = extractChatId(window.location.href);
    if (!urlInfo) {
      throw new Error('チャットIDまたはスナップショットIDを取得できませんでした。有効なチャットページにいることを確認してください。');
    }

    // 共有URLの場合は組織IDが不要
    let orgId = null;
    if (urlInfo.type === 'chat') {
      orgId = await getOrgId();
      if (!orgId) {
        throw new Error('組織IDを取得できませんでした。Claude.aiにログインしてください。');
      }
    }

    currentSession.orgId = orgId;
    currentSession.chatId = urlInfo.id;
    currentSession.urlType = urlInfo.type;

    // 初期データを取得してupdated_atを設定
    const data = await fetchChatData(orgId, urlInfo.id, urlInfo.type);
    currentSession.lastUpdatedAt = data.updated_at;

    log.info('セッション初期化完了');
    return true;
  } catch (error) {
    log.error('セッション初期化に失敗:', error);

    // より詳細なエラーメッセージを提供
    if (error.message.includes('403')) {
      log.error('アクセス拒否: ログイン状態または権限を確認してください');
    } else if (error.message.includes('401')) {
      log.error('認証エラー: Claude.aiにログインしてください');
    } else if (error.message.includes('404')) {
      log.error('チャットが見つかりません: 有効なチャットページにいることを確認してください');
    }

    return false;
  }
}

// 変更を監視
async function startPolling() {
  if (currentSession.isPolling) return;

  currentSession.isPolling = true;

  const poll = async () => {
    if (!currentSession.isPolling) return;

    try {
      const data = await fetchChatData(currentSession.orgId, currentSession.chatId, currentSession.urlType, true);

      if (data.updated_at !== currentSession.lastUpdatedAt) {
        currentSession.lastUpdatedAt = data.updated_at;
        currentSession.retryCount = 0;

        // 変更イベントを発火（データなしで軽量化）
        window.dispatchEvent(new CustomEvent('claudeMessageUpdated', {
          detail: { updated_at: data.updated_at }
        }));
      }
    } catch (error) {
      log.error('ポーリングエラー:', error);
      currentSession.retryCount++;

      // エラーの種類に応じて処理を分岐
      if (error.message.includes('403') || error.message.includes('401')) {
        log.error('認証エラーが発生しました。ポーリングを停止します。');
        stopPolling();
        return;
      }

      if (currentSession.retryCount >= MAX_RETRIES) {
        log.error('最大リトライ回数に達しました。ポーリングを停止します。');
        stopPolling();
        return;
      }

      // 指数バックオフでリトライ間隔を調整
      const backoffDelay = Math.min(POLLING_INTERVAL * Math.pow(2, currentSession.retryCount), 30000);
      setTimeout(poll, backoffDelay);
      return;
    }

    // 次のポーリングをスケジュール
    setTimeout(poll, POLLING_INTERVAL);
  };

  poll();
}

// ポーリングを停止
function stopPolling() {
  currentSession.isPolling = false;
}

// セッション情報を取得
function getSessionInfo() {
  return {
    orgId: currentSession.orgId,
    chatId: currentSession.chatId,
    urlType: currentSession.urlType,
    lastUpdatedAt: currentSession.lastUpdatedAt,
    isPolling: currentSession.isPolling
  };
}

export {
  initializeSession,
  getMessageByIndex,
  startPolling,
  stopPolling,
  getSessionInfo,
  getMessageIndexFromRenderCount
};
