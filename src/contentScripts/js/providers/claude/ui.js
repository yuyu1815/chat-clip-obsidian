// Claude UI関連ヘルパー
import { getSelectors } from './checks.js';
import { initializeSession, getMessageByIndex, getSessionInfo } from './api.js';
import { toMarkdownIfHtml } from '../../../../utils/markdown.js';
import { createLogger } from '../../../../utils/logger.js';
import { toast } from '../../../../utils/notifications/toast.js';

const log = createLogger('Claude UI');

// 保存ボタンを作成
function createSaveButton() {
  const button = document.createElement('button');
  button.className = 'chatvault-save-btn';
  button.style.cssText = `
    background-color: transparent;
    color: rgb(160, 160, 160);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
    padding: 4px;
    margin: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `;
  button.setAttribute('aria-label', 'Save to Obsidian');
  button.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  `;

  // ホバー効果
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    button.style.color = 'rgb(255, 255, 255)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
    button.style.color = 'rgb(160, 160, 160)';
  });

  // クリック時は、属する[data-test-render-count]の0始まりインデックスをコンソールに出力
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const container = button.closest('[data-test-render-count]');
      if (!container) {
        console.warn('[ChatVault] data-test-render-count コンテナが見つかりませんでした。');
        return;
      }
      const all = document.querySelectorAll('[data-test-render-count]');
      const arr = Array.from(all);
      const index = arr.indexOf(container);
      console.log('[ChatVault] render-count index:', index);

      // api.js のフィルターを使って chat_messages[index] を抽出しコンソール表示
      if (!getSessionInfo?.()?.chatId) {
        const ok = await initializeSession();
        if (!ok) {
          console.warn('[ChatVault] セッション初期化に失敗したため、メッセージ抽出を中止します。');
          return;
        }
      }

      const result = await getMessageByIndex(index);
      if (result?.success) {
        console.log('[ChatVault] extracted message (via api.js):', result.message);
        console.log('[ChatVault] extracted content:', result.message?.content || '');

        // 生成されたメッセージをObsidianへ保存
        const roleLabel = result.message.role === 'user' ? 'User' : 'Assistant';
        const mdBody = toMarkdownIfHtml(result.message.content || '');
        const messageContent = `### ${roleLabel}\n\n${mdBody}`;

        // Resilient sendMessage with one retry to background
        const payload = {
          action: 'saveSingleMessage',
          service: 'claude',
          messageContent,
          messageType: 'single',
          conversationTitle: result.message.title || document.title || 'Claude Chat',
          metadata: {
            type: 'single',
            index,
            uuid: result.message.uuid,
            url: window.location.href,
            created_at: result.message.created_at,
            updated_at: result.message.updated_at
          }
        };

        const sendWithRetry = (attempts = 2) => {
          chrome.runtime.sendMessage(payload, (response) => {
            const lastError = chrome.runtime.lastError;
            const transient = lastError && (
              /Extension context invalidated/i.test(lastError.message || '') ||
              /message port closed/i.test(lastError.message || '') ||
              /Could not establish connection/i.test(lastError.message || '')
            );
            if (transient && attempts > 1) {
              log.warn('sendMessage transient error, retrying...', lastError?.message);
              setTimeout(() => sendWithRetry(attempts - 1), 300);
              return;
            }

            if (lastError) {
              console.warn('[ChatVault] 保存に失敗:', lastError?.message);
              toast.show('保存に失敗しました: ' + lastError.message + '\nページを再読み込みして再試行してください。', 'error');
              return;
            }

            if (!response || !response.success) {
              const msg = response?.userMessage || (response?.error || '保存に失敗しました。');
              console.warn('[ChatVault] 保存に失敗:', msg);
              toast.show(msg, 'error');
            } else {
              const msg = response.message
                ? response.message
                : (response.method === 'clipboard'
                  ? 'クリップボードにコピーしました。Obsidianで貼り付けてください。'
                  : 'メッセージを保存しました。');
              console.log('[ChatVault] 保存成功:', response.message || response.method);
              toast.show(msg, 'success');
            }
          });
        };
        sendWithRetry();
      } else {
        console.warn('[ChatVault] メッセージ抽出に失敗:', result?.error || 'unknown error');
      }
    } catch (err) {
      log.error('インデックス判定/抽出エラー:', err);
    }
  });

  return button;
}

// メッセージ要素に保存ボタンを追加
function addSaveButton(messageElement, createBtn) {
  try {
    const selectors = getSelectors();

    // ルートメッセージコンテナ（重複防止の基準）
    const root = messageElement.closest('[data-test-render-count]') || messageElement;

    // ルート内に既存のボタンがある場合は追加しない（祖先/子孫双方の重複を防止）
    const existingInRoot = root.querySelector('.chatvault-save-btn');
    if (existingInRoot) {
      return { added: false, button: existingInRoot, target: root };
    }

    const btn = typeof createBtn === 'function' ? createBtn() : createSaveButton();

    // コピーボタンの隣に配置を試みる（常にルート内で探索）
    const copyButton = root.querySelector(selectors.copyButton || '[data-testid="action-bar-copy"]');
    if (copyButton && copyButton.parentElement) {
      copyButton.parentElement.appendChild(btn);
      return { added: true, button: btn, target: root };
    }

    // フォールバック1: ルート配下の実メッセージ要素に追加
    const preferredMsg = root.querySelector(`${selectors.userMessage}, ${selectors.assistantMessage}`);
    if (preferredMsg) {
      preferredMsg.appendChild(btn);
      return { added: true, button: btn, target: preferredMsg };
    }

    // フォールバック2: 引数の要素に追加（引数がルートでない場合）
    if (messageElement !== root) {
      messageElement.appendChild(btn);
      return { added: true, button: btn, target: messageElement };
    }

    // 最終フォールバック: ルートに追加
    root.appendChild(btn);
    return { added: true, button: btn, target: root };
  } catch (error) {
    log.error('ボタン追加に失敗:', error);
    return { added: false, button: null, target: null };
  }
}

// ボタンからメッセージ要素を解決
function resolveMessageElementFromButton(btn) {
  try {
    const selectors = getSelectors();

    // data-test-render-countを持つ要素を探す
    let el = btn.closest('[data-test-render-count]');
    if (el) return el;

    // フォールバック: セレクターで探す
    el = btn.closest(selectors.container);
    if (el) return el;

    // さらにフォールバック
    const response = btn.closest('.font-claude-response');
    if (response) return response;

    const user = btn.closest('[data-testid="user-message"]');
    if (user) return user;

  } catch (error) {
    log.error('メッセージ要素の解決に失敗:', error);
  }
  return null;
}

export { createSaveButton, addSaveButton, resolveMessageElementFromButton };
