// Claude UI関連ヘルパー
import { getSelectors } from './checks.js';
import { initializeSession, getMessageByIndex, getSessionInfo, startPolling } from './api.js';
import { toMarkdownIfHtml } from '../../../../utils/markdown.js';
import { createLogger } from '../../../../utils/logger.js';
import { toast } from '../../../../utils/notifications/toast.js';
import { handleFileSystemSave } from '../../inject/filesystem.js';
import { copyToClipboard } from '../../inject/clipboard.js';
import { sanitizeForFilename } from '../../../../utils/data/validation.js';

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

  // クリックイベント処理
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const container = button.closest('[data-test-render-count]');
      if (!container) {
        return;
      }
      const all = document.querySelectorAll('[data-test-render-count]');
      const arr = Array.from(all);
      const index = arr.indexOf(container);

      // セッション初期化を確認
      if (!getSessionInfo?.()?.chatId) {
        const ok = await initializeSession();
        if (!ok) {
          return;
        }
      }

      const result = await getMessageByIndex(index);
      if (result?.success) {

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
              toast.show('保存に失敗しました: ' + lastError.message + '\nページを再読み込みして再試行してください。', 'error');
              return;
            }

            if (!response || !response.success) {
              const msg = response?.userMessage || (response?.error || '保存に失敗しました。');
              toast.show(msg, 'error');
            } else {
              const msg = response.message
                ? response.message
                : (response.method === 'clipboard'
                  ? 'クリップボードにコピーしました。Obsidianで貼り付けてください。'
                  : 'メッセージを保存しました。');
              toast.show(msg, 'success');
            }
          });
        };
        sendWithRetry();
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

    // コンテキストガード: ヘッダー/ツールバー/モデルセレクタなどは除外
    const isInHeaderLike = !!(root.closest('header, [role="toolbar"]')
      || root.closest('[data-testid*="model-selector"], [data-testid="model-selector-dropdown"]'));
    const isValidMessageContext = !!(root.matches('[data-test-render-count], [data-testid="user-message"]')
      || root.querySelector(selectors.assistantMessage));
    if (isInHeaderLike || !isValidMessageContext) {
      return { added: false, button: null, target: null };
    }

    // ルート内に既存のボタンがある場合は追加しない（祖先/子孫双方の重複を防止）
    const existingInRoot = root.querySelector('.chatvault-save-btn');
    if (existingInRoot) {
      return { added: false, button: existingInRoot, target: root };
    }

    const btn = typeof createBtn === 'function' ? createBtn() : createSaveButton();

    // 1) バナーの Publish ボタンの“右”に配置（変更に強いテキストマッチ）
    let publishBtn = null;
    let candidateButtons = [];
    try {
      candidateButtons = root.querySelectorAll((selectors && selectors.publishButton) || 'button');
    } catch (e) {
      candidateButtons = root.querySelectorAll('button');
    }
    for (const cand of candidateButtons) {
      const t = (cand.textContent || '').trim();
      if (t === 'Publish') { publishBtn = cand; break; }
    }
    if (!publishBtn) {
      const allButtons = root.querySelectorAll('button');
      for (const b of allButtons) {
        const t = (b.textContent || '').trim();
        if (t === 'Publish') { publishBtn = b; break; }
        const cls = b.className || '';
        if (!publishBtn && typeof cls === 'string' && cls.includes('bg-text-000') && cls.includes('text-bg-000')) {
          publishBtn = publishBtn || b;
        }
      }
    }
    if (publishBtn && publishBtn.parentElement) {
      btn.style.pointerEvents = 'auto';
      if (publishBtn.nextSibling) {
        publishBtn.parentElement.insertBefore(btn, publishBtn.nextSibling);
      } else {
        publishBtn.parentElement.appendChild(btn);
      }
      return { added: true, button: btn, target: publishBtn.parentElement };
    }

    // 2) コピーボタンの“左”に配置
    let copyButton = root.querySelector((selectors && selectors.copyButton) || '[data-testid="action-bar-copy"], button[aria-label="Copy to clipboard"]');
    if (!copyButton) {
      const btns = root.querySelectorAll('button');
      for (const b of btns) {
        const text = (b.textContent || '').trim();
        if (text === 'Copy') { copyButton = b; break; }
      }
    }
    if (copyButton && copyButton.parentElement) {
      btn.style.pointerEvents = 'auto';
      copyButton.parentElement.insertBefore(btn, copyButton);
      return { added: true, button: btn, target: root };
    }

    // 3) Hoverアクションバー（items-stretch/justify-betweenのボタン行）に先頭として挿入
    const actionBar = root.querySelector('.text-text-300.flex.items-stretch.justify-between, .flex.items-stretch.justify-between');
    if (actionBar) {
      btn.style.pointerEvents = 'auto';
      const firstChild = actionBar.firstElementChild;
      if (firstChild) {
        actionBar.insertBefore(btn, firstChild);
      } else {
        actionBar.appendChild(btn);
      }
      return { added: true, button: btn, target: actionBar };
    }

    // 明示的アンカーが見つからない場合は何もしない（誤配置防止）
    return { added: false, button: null, target: null };
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

// Radix dropdown menu helper: inject "Download of obsidian" label into Claude menus
function injectObsidianMenuItem(menuEl) {
  try {
    if (!menuEl || !(menuEl instanceof Element)) return false;
    // Ensure this looks like a Radix dropdown menu content
    const isMenu = menuEl.getAttribute('role') === 'menu' || menuEl.hasAttribute('data-radix-menu-content');
    if (!isMenu) return false;

    // Idempotency: do not add twice
    const exists = Array.from(menuEl.querySelectorAll('a, [role="menuitem"]')).some((el) => (el.textContent || '').trim() === 'Download of obsidian');
    if (exists) return false;

    // Create an actionable menu item (consistent styling with Radix items)
    const item = document.createElement('div');
    item.setAttribute('role', 'menuitem');
    item.className = 'font-base py-1.5 px-2 rounded-lg cursor-pointer whitespace-nowrap overflow-hidden text-ellipsis grid grid-cols-[minmax(0,_1fr)_auto] gap-2 items-center outline-none select-none';
    item.tabIndex = -1;
    item.textContent = 'Download of Obsidian';
    
    // Set custom styles for black background with hover effect
    item.style.cssText = `
      background-color: rgba(0, 0, 0, 0);
      transition: background-color 0.2s ease, color 0.2s ease;
    `;
    
    // Add hover effect event listeners
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
      item.style.color = 'white';
    });
    
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'rgba(0, 0, 0, 0)';
      item.style.color = ''; // Reset to default color
    });
    // Keep Radix collection attribute for consistent styling/behavior
    item.setAttribute('data-radix-collection-item', '');
    item.setAttribute('data-orientation', 'vertical');

    // Click handler: replicate 'Download as Markdown' content and save to Obsidian
    item.addEventListener('click', async (ev) => {
      try {
        ev.preventDefault();
        ev.stopPropagation();

        // Find the reference anchor (prefer exact text 'Download as Markdown')
        const anchors = Array.from(menuEl.querySelectorAll('a'));
        let mdAnchor = anchors.find(a => (a.textContent || '').trim() === 'Download as Markdown');
        if (!mdAnchor) mdAnchor = menuEl.querySelector('a[download]') || anchors[0];
        if (!mdAnchor) {
          toast.show('保存元が見つかりませんでした。', 'error');
          return;
        }

        const href = mdAnchor.getAttribute('href');
        if (!href) {
          toast.show('保存用URLが見つかりませんでした。', 'error');
          return;
        }

        const originalFilename = mdAnchor.getAttribute('download') || 'claude.md';
        
        // Pre-generate basic info (before fetching mdText)
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
        
        // Get conversation title from page
        const conversationTitle = (document.title || '')
          .replace(' | Claude', '')
          .replace(' – Claude', '')
          .replace(' - Claude', '') || 'Claude_Chat';
        
        const sanitizedTitle = sanitizeForFilename(conversationTitle, 'Claude_Chat');

        // Fetch markdown text from the href (supports blob: URLs)
        let mdText = '';
        try {
          const res = await fetch(href);
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          mdText = await res.text();
        } catch (fe) {
          log.error('Download href fetch failed:', fe);
          mdText = '';
        }

        if (mdText && mdText.trim()) {
          // Generate filename without hash for simpler naming
          const filename = `${dateStr}_${timeStr}_claude_${sanitizedTitle}.md`;
          
          // Get folder structure from settings (same as background script)
          const settings = await chrome.storage.sync.get(['chatFolderPath']);
          const chatFolderPath = settings.chatFolderPath || 'ChatVault/{service}';
          
          // Create full folder path using ChatVault settings pattern
          const fullFolderPath = chatFolderPath
            .replace('{service}', 'CLAUDE')
            .replace('{date}', dateStr)
            .replace('{title}', sanitizedTitle)
            .replace('{type}', 'single')
            .replace(/\/+/g, '/') // Remove duplicate slashes
            .replace(/\/$/, ''); // Remove trailing slash
          
          // Combine folder path and filename for full relative path
          const relativePath = `${fullFolderPath}/${filename}`;
          
          // Create markdown content with frontmatter (same as background script)
          let frontmatter = `---
title: ${conversationTitle || 'Untitled Conversation'}
service: claude
date: ${now.toISOString()}
type: single
---

`;

          // Combine frontmatter with content
          const fullContent = frontmatter + mdText;

          // Try File System Access API directly from content script
          let fileSystemSuccess = false;
          try {
            const fsResult = await handleFileSystemSave(fullContent, relativePath);
            fileSystemSuccess = fsResult && fsResult.success;
            
            if (fileSystemSuccess) {
              // カスタムメッセージがあれば使用
              let successMessage = 'Obsidianに保存しました。';
              if (fsResult.wasRenamed) {
                successMessage = `「${fsResult.finalFileName}」として保存しました（重複回避のため名前を変更）。`;
              } else if (fsResult.isDuplicate && fsResult.skipped) {
                successMessage = fsResult.message || '同じ内容のため保存をスキップしました。';
              }
              
              toast.show(successMessage, fsResult.isDuplicate ? 'info' : 'success');
              return; // 成功したので処理を終了
            }
          } catch (err) {
            log.error('File System API直接呼び出しエラー:', err);
            fileSystemSuccess = false;
          }

          // Fallback to clipboard
          try {
            const clipboardResult = await copyToClipboard(fullContent);
            
            if (!clipboardResult.success) {
              throw new Error(clipboardResult.error || 'クリップボードコピー失敗');
            }
            
            toast.show('保存に失敗したため、内容をクリップボードにコピーしました。Obsidianに貼り付けてください。', 'warning');
            
            // さらに、Obsidianを開いてファイル作成を促す
            try {
              // Generate fallback filename for Obsidian (consistent with main filename)
              const fallbackFilename = `${dateStr}_${timeStr}_claude_${sanitizedTitle}.md`;
              
              // Get folder structure from settings for fallback
              const fallbackSettings = await chrome.storage.sync.get(['obsidianVault', 'chatFolderPath']);
              const vaultName = fallbackSettings.obsidianVault || 'MyVault';
              const fallbackChatFolderPath = fallbackSettings.chatFolderPath || 'ChatVault/{service}';
              
              // Create fallback folder path
              const fallbackFolderPath = fallbackChatFolderPath
                .replace('{service}', 'CLAUDE')
                .replace('{date}', dateStr)
                .replace('{title}', sanitizedTitle)
                .replace('{type}', 'single')
                .replace(/\/+/g, '/')
                .replace(/\/$/, '');
              
              const fallbackRelativePath = `${fallbackFolderPath}/${fallbackFilename}`;
              const simpleUri = `obsidian://new?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(fallbackRelativePath)}`;
              
              // Background scriptに依頼してタブを作成してObsidianを開く
              await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                  action: 'openObsidianTab',
                  url: simpleUri,
                  autoClose: true,
                  delayMs: 2000
                }, (response) => {
                  const lastError = chrome.runtime.lastError;
                  if (lastError) {
                    reject(lastError);
                  } else if (!response || !response.success) {
                    reject(new Error(response?.error || 'Unknown error'));
                  } else {
                    resolve(response);
                  }
                });
              });
              
            } catch (obsErr) {
              // Silently handle Obsidian open error
            }
            
          } catch (clipErr) {
            log.error('クリップボードコピーも失敗:', clipErr);
            toast.show('保存とクリップボードコピーの両方に失敗しました。', 'error');
          }
        } else {
          // No text fetched; fallback to clipboard of the URL as a message
          
          try {
            const urlClipResult = await copyToClipboard(href);
            if (urlClipResult.success) {
              toast.show('マークダウンの取得に失敗しました。blob URLをクリップボードにコピーしました。', 'error');
            } else {
              toast.show('マークダウンの取得とクリップボードコピーの両方に失敗しました。', 'error');
            }
          } catch (urlClipErr) {
            toast.show('マークダウンの取得とクリップボードコピーの両方に失敗しました。', 'error');
          }
        }
      } catch (err) {
        log.error('Download of obsidian click handler error:', err);
        toast.show('保存中にエラーが発生しました。', 'error');
      }
    });

    // Append to the end of the menu
    menuEl.appendChild(item);
    return true;
  } catch (e) {
    log.error('メニュー項目の挿入に失敗:', e);
    return false;
  }
}

// inject.jsから移動したClaude特有の初期化・監視処理
async function startContentScriptIntegration(service) {
  try {
    const success = await initializeSession();
    if (!success) {
      log.error('Claude統合の初期化に失敗しました');
      return false;
    }
    
    // ポーリング開始
    startPolling();

    // 既存のメッセージにボタンを追加
    const selectors = getSelectors();
    const messages = document.querySelectorAll(selectors.container);
    messages.forEach((msg) => {
      addSaveButton(msg, () => createSaveButton());
    });

    // 動的なメッセージ追加・更新に対応（SPA変化へ追従）
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            if (node.matches && node.matches(selectors.container)) {
              addSaveButton(node, () => createSaveButton());
            }
            const newMsgs = node.querySelectorAll ? node.querySelectorAll(selectors.container) : [];
            newMsgs.forEach((n) => {
              addSaveButton(n, () => createSaveButton());
            });
          });
        }
        if (mutation.type === 'attributes' && mutation.target && mutation.target.matches && mutation.target.matches(selectors.container)) {
          // 既存メッセージの属性変化（表示/非表示、再レンダリング）時にも再試行
          addSaveButton(mutation.target, () => createSaveButton());
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    // Claude: Radix dropdown メニューが開いたら "Download of obsidian" を追加
    const maybeInjectObsidianLabel = (menuEl) => {
      try {
        if (!(menuEl instanceof Element)) return;
        // 対象メニュー確認: 既存のDownloadメニューがある場合のみ注入
        const items = menuEl.querySelectorAll('a, [role="menuitem"]');
        let hasDownloads = false;
        items.forEach((el) => {
          const t = (el.textContent || '').trim();
          if (t === 'Download as Markdown' || t === 'Download as PDF') hasDownloads = true;
        });
        if (!hasDownloads) return;
        injectObsidianMenuItem(menuEl);
      } catch (_) {/* noop */}
    };

    // 既に開いているメニューがあれば注入
    document.querySelectorAll('[data-radix-menu-content][role="menu"], [data-radix-menu-content]').forEach(maybeInjectObsidianLabel);

    const menuObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type !== 'childList') continue;
        m.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches && (node.matches('[data-radix-menu-content][role="menu"]') || node.matches('[data-radix-menu-content]'))) {
            maybeInjectObsidianLabel(node);
          }
          // wrapper内にメニューが入っている場合
          const menus = node.querySelectorAll ? node.querySelectorAll('[data-radix-menu-content][role="menu"], [data-radix-menu-content]') : [];
          menus.forEach(maybeInjectObsidianLabel);
        });
      }
    });
    menuObserver.observe(document.body, { childList: true, subtree: true });

    log.info('Claude統合の初期化が完了しました');
    return true;
  } catch (error) {
    log.error('Claude統合の初期化中にエラーが発生しました:', error);
    return false;
  }
}

export { createSaveButton, addSaveButton, resolveMessageElementFromButton, injectObsidianMenuItem, startContentScriptIntegration };
