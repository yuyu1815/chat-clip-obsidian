/**
 * ChatVault Clip のコンテンツスクリプト
 * ChatGPTページに保存ボタンを追加するスクリプト
 */

import { toast } from '../../utils/notifications/toast.js';
import { createLogger } from '../../utils/logger.js';
import { toUserMessage } from '../../utils/messages.js';
import { initializeChatGPT } from './providers/chatgpt/ui.js';
import { initializeGemini } from './providers/gemini/ui.js';
import ClaudeProvider from './providers/claude/index.js';
import { detectService } from './inject/service.js';
import { createSaveButton } from './inject/ui.js';
import { getProvider } from './providers/ProviderFactory.js';
import { copyToClipboard } from './inject/clipboard.js';
import { handleFileSystemSave, ensureDirectoryHandleIfNeeded } from './inject/filesystem.js';
import { enableSelectionMode, getSelectedContent } from './inject/selection.js';

// ロガー
const log = createLogger('ChatVault');

console.info('[ChatVault Content] コンテンツスクリプトを読み込み中...', window.location.href);

(function() {
  'use strict';

  // ChatGPTの画像読み込みとの干渉を防ぐ
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const errorStr = args.join(' ');
    // 以下のようなノイズの多いエラーは抑制する:
    // - ChatGPTの画像読み込みに関するもの
    // - サイト側CSPによるスクリプト拒否（例: googletagmanager/gtm.js）
    if (
      errorStr.includes('imageData') ||
      errorStr.includes('googleusercontent') ||
      errorStr.includes('Refused to load the script') ||
      errorStr.includes('violates the following Content Security Policy') ||
      errorStr.includes('Content Security Policy') ||
      errorStr.includes('googletagmanager.com') ||
      errorStr.includes('gtm.js')
    ) {
      return; // noisy log suppressed
    }
    return originalConsoleError.apply(console, args);
  };

  // エラーイベントリスナーを追加してバブリングを防ぐ
  window.addEventListener('error', function(event) {
    const isGUserContent = event.target && event.target.src && event.target.src.includes('googleusercontent');
    const isGtmScript = event.target && event.target.tagName === 'SCRIPT' && event.target.src && (
      event.target.src.includes('googletagmanager.com') || event.target.src.includes('gtm.js')
    );
    const isCspRefusal = typeof event.message === 'string' && (
      event.message.includes('Refused to load the script') ||
      event.message.includes('Content Security Policy')
    );
    if (isGUserContent || isGtmScript || isCspRefusal) {
      event.stopPropagation();
      event.preventDefault();
      return false;
    }
  }, true);

  log.info('コンテンツスクリプトを実行中...');

  // 設定
  const BUTTON_SELECTOR = '.chatvault-save-btn';
  const DEBOUNCE_DELAY = 300; // ChatGPTとの競合を減らすために増加

  // サービス検出
  const service = detectService();
  log.info('検出されたサービス:', service);
  if (!service) {
    log.warn('対応サービスが検出されませんでした、終了します');
    return;
  }

  // プロバイダーの選択（Factory）
  let provider = getProvider(service);

  // プロバイダーが存在しない場合は終了
  if (!provider) {
    log.warn(`プロバイダーが見つかりませんでした: ${service}`);
    return;
  }

  // DOM操作のレート制限
  let lastOperationTime = 0;
  let operationQueue = [];

  // 現在のサービスを検出（ChatGPTのみ）
  // moved to separate module: inject/service.js

  // 保存ボタン要素を作成
  // moved to separate module: inject/ui.js

  /**
 * ChatGPT用のメッセージセレクタを取得
 * @returns {Object|null} セレクタオブジェクト、プロバイダーが利用できない場合はnull
 */
  function getSelectors() {
    if (!provider) return null;
    return provider.getSelectors();
  }



  /**
 * メッセージ要素に保存ボタンを追加
 * @param {HTMLElement} messageElement - ボタンを追加するメッセージ要素
 */
  function addSaveButton(messageElement) {
    // 既存ボタンのチェック
    const existingButton = messageElement.querySelector(BUTTON_SELECTOR);
    if (existingButton) {
      return;
    }



    log.debug('メッセージ要素に保存ボタンを追加:', messageElement);

    const button = createSaveButton(service);
    let buttonAdded = false;

        // プロバイダーに応じてボタンを追加
    if (provider) {
      const res = provider.addSaveButton(messageElement, () => createSaveButton(service));
      if (res.added) {
        buttonAdded = true;
        log.debug(`${service}コンテンツ末尾にボタンを追加:`, res.target);
      }
    }

    // フォールバック配置
    if (!buttonAdded) {
      const fbButton = button && button.isConnected ? button : createSaveButton(service);
      log.warn('コンテンツエリアが見つかりませんでした、フォールバック配置を使用');
      messageElement.style.position = 'relative';
      fbButton.style.position = 'absolute';
      fbButton.style.top = '10px';
      fbButton.style.right = '10px';
      fbButton.style.zIndex = '1000';
      messageElement.appendChild(fbButton);
    }

    // クリックハンドラーを追加（デバッグ強化）
    const actualButton = messageElement.querySelector(BUTTON_SELECTOR) || button;
    if (!actualButton) return;
    actualButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      log.info('保存ボタンがクリックされました！', messageElement);
      log.debug('サービス:', service);
      log.debug('現在のURL:', window.location.href);

      // CSSクラスを使用してビジュアルフィードバックを追加
      actualButton.classList.add('chatvault-saving');
      actualButton.disabled = true;

      try {
        // File System方式が優先される場合は事前にディレクトリハンドルを確保
        await ensureDirectoryHandleIfNeeded();
        await handleSaveClick(messageElement);
      } catch (error) {
        log.error('Error in handleSaveClick:', error);
        console.error('[ChatVault] 保存エラー:', error);
        actualButton.classList.remove('chatvault-saving');
        actualButton.classList.add('chatvault-error');
        actualButton.disabled = false;
        setTimeout(() => {
          actualButton.classList.remove('chatvault-error');
        }, 2000);
      }
    });
  }



  /**
   * 保存ボタンクリックイベントを処理
   * @param {HTMLElement} messageElement - 保存するメッセージ要素
   * @param {HTMLElement} buttonEl - ボタン要素（オプション）
   */
  async function handleSaveClick(messageElement, buttonEl = null) {
    log.debug('handleSaveClickが呼び出されました:', messageElement);
    log.debug('メッセージ要素の詳細:', {
      tagName: messageElement.tagName,
      className: messageElement.className,
      textContent: messageElement.textContent?.substring(0, 100) + '...'
    });

    try {
      let messageData;



      // プロバイダーに応じてメッセージを抽出
      if (!provider) {
        throw new Error(`プロバイダーが見つかりません: ${service}`);
      }
      log.debug(`${service}メッセージを抽出中...`);
      const extracted = provider.extractSingleMessage(messageElement);
      const roleLabel = extracted.role === 'user' ? 'User' : 'Assistant';
      messageData = {
        messageContent: `### ${roleLabel}\n\n${extracted.content}`,
        messageType: 'single',
        conversationTitle: extracted.title,
        service: service
      };
      log.debug('準備されたメッセージデータ:', messageData);

      // バックグラウンドスクリプトに送信
      log.debug('バックグラウンドにメッセージを送信中:', {
        action: 'saveSingleMessage',
        ...messageData
      });

      // Helper: resilient sendMessage with one retry for transient errors
      const sendMessageWithRetry = (payload, onResponse, attempts = 2) => {
        chrome.runtime.sendMessage(payload, (response) => {
          const lastError = chrome.runtime.lastError;
          const transient = lastError && (
            /Extension context invalidated/i.test(lastError.message || '') ||
            /message port closed/i.test(lastError.message || '') ||
            /Could not establish connection/i.test(lastError.message || '')
          );
          if (transient && attempts > 1) {
            log.warn('sendMessage transient error, retrying...', lastError?.message);
            setTimeout(() => sendMessageWithRetry(payload, onResponse, attempts - 1), 300);
            return;
          }
          onResponse(response, lastError);
        });
      };

      sendMessageWithRetry({
        action: 'saveSingleMessage',
        ...messageData
      }, (response, lastError) => {
        log.info('保存レスポンス:', response);

        if (lastError) {
          log.error('ランタイムエラー:', lastError);
          console.error('[ChatVault] 保存に失敗しました:', lastError.message);
          toast.show('保存に失敗しました: ' + lastError.message + '\nページを再読み込みして再試行してください。', 'error');
          return;
        }
        if (response && response.success) {
          // 成功フィードバックを表示
          const targetBtn = buttonEl || messageElement.querySelector(BUTTON_SELECTOR);
          if (targetBtn) {
            targetBtn.classList.remove('chatvault-saving');
            targetBtn.classList.add('chatvault-saved');
            targetBtn.disabled = false;
            setTimeout(() => {
              targetBtn.classList.remove('chatvault-saved');
            }, 2000);
          }
          log.info(`メッセージを${response.method}経由で保存: ${response.filename}`);
          if (response.message) {
            console.log('[ChatVault] 保存成功:', response.message);
            toast.show(response.message, 'success');
          } else if (response.method === 'clipboard') {
            console.log('[ChatVault] クリップボードにコピーしました。Obsidianで貼り付けてください。');
            toast.show('クリップボードにコピーしました。Obsidianで貼り付けてください。', 'success');
          } else {
            console.log('[ChatVault] メッセージを保存しました。');
            toast.show('メッセージを保存しました。', 'success');
          }
        } else {
          log.error('メッセージの保存に失敗:', response?.error);
          const msg = response?.userMessage || toUserMessage(response?.errorCode, response?.error);
          console.error('[ChatVault] 保存失敗:', msg);
          toast.show(msg || '保存に失敗しました。', 'error');
          const targetBtn = buttonEl || messageElement.querySelector(BUTTON_SELECTOR);
          if (targetBtn) {
            targetBtn.classList.remove('chatvault-saving');
            targetBtn.classList.add('chatvault-error');
            targetBtn.disabled = false;
            setTimeout(() => {
              targetBtn.classList.remove('chatvault-error');
            }, 2000);
          }
        }
      });

    } catch (error) {
      log.error('保存クリック処理エラー:', error);
      console.error('[ChatVault] 保存クリック処理エラー:', error);
      toast.show('保存中にエラーが発生しました: ' + (error?.message || error), 'error');
      
      // ボタンの状態をリセット
      const targetBtn = buttonEl || messageElement.querySelector(BUTTON_SELECTOR);
      if (targetBtn) {
        targetBtn.classList.remove('chatvault-saving');
        targetBtn.classList.add('chatvault-error');
        targetBtn.disabled = false;
        setTimeout(() => {
          targetBtn.classList.remove('chatvault-error');
        }, 2000);
      }
    }
  }

  /**
 * DOM変更を監視して新しいメッセージにボタンを追加
 */
  function observeMessages() {
    const selectors = getSelectors();
    if (!selectors) return;

    log.info(`${service}のメッセージ監視を開始、セレクタ:`, selectors);
    log.debug(`現在のURL: ${window.location.href}`);

    // 既存メッセージの初期スキャン
    let messages = document.querySelectorAll(selectors.container);



    log.debug('主要セレクタで', messages.length, '個のメッセージを発見');



    // メッセージが見つからない場合、より広いセレクタを試すが会話エリア内のみ
    if (messages.length === 0) {
      log.debug('メッセージが見つかりませんでした、より広いセレクタを試行中...');
      // メイン会話エリア内を特に探す
      const conversationArea = document.querySelector('main[role="main"], [role="main"], main, .conversation-turn');
      if (conversationArea) {
        messages = conversationArea.querySelectorAll('[data-message-author-role], .group.w-full, [class*="conversation-turn"]');
      } else {
        messages = document.querySelectorAll('[data-message-author-role]:not([data-testid])');
      }
      log.debug('より広いセレクタで', messages.length, '個のメッセージを発見');
    }

    // まだメッセージが見つからない場合、少し待って再試行
    if (messages.length === 0) {
      log.debug('まだメッセージが見つかりませんでした、2秒後に再試行します...');
      setTimeout(() => {
                  // ChatGPTのみ対応のフォールバックセレクタ
        let retryMessages = document.querySelectorAll('div, article, section');
        log.debug('一般的なフォールバック: ', retryMessages.length, '個の潜在的な要素を発見');

        // メッセージのように見える要素にボタンを追加
        Array.from(retryMessages).filter(el => {
          const text = el.textContent?.trim();

          return text && text.length > 10 && text.length < 10000; // 妥当なメッセージ長
        }).slice(0, 15).forEach(addSaveButton); // スパムを避けるために最初の15個に制限
      }, 2000);
    }

    messages.forEach(addSaveButton);



    // 新しいメッセージ用のmutation observerを設定
    const observer = new MutationObserver(debounce((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 追加されたノードがメッセージかどうかをチェック
            if (node.matches && node.matches(selectors.container)) {
              addSaveButton(node);
            }
            // 追加されたノードがメッセージを含むかどうかをチェック
            const newMessages = node.querySelectorAll ? node.querySelectorAll(selectors.container) : [];
            newMessages.forEach(addSaveButton);


          }
        });
        // 新機能: メッセージの可視性/更新を示す可能性のある属性変更を処理（SPA）
        if (mutation.type === 'attributes' && mutation.target && mutation.target.matches) {
          const targetEl = mutation.target;
          if (targetEl.matches(selectors.container)) {
            addSaveButton(targetEl);
          }

        }
      });
    }, DEBOUNCE_DELAY));

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  /**
   * オブザーバーコールバックを制限するデバウンス関数
   * @param {Function} func - デバウンスする関数
   * @param {number} wait - 待機時間（ミリ秒）
   * @returns {Function} デバウンスされた関数
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * プロバイダー対応のメッセージキャプチャ処理
   * @param {string} mode - キャプチャモード ('all', 'recent', 'selected')
   * @param {number|null} count - キャプチャするメッセージ数（recentモードの場合）
   * @returns {Object} キャプチャ結果
   */
  function handleCaptureMessages(mode, count = null) {
    try {
      if (!provider) {
        const errorMsg = `プロバイダーが見つかりません: ${service}`;
        log.error(errorMsg);
        return {
          success: false,
          error: errorMsg
        };
      }
      return provider.captureMessages(mode, count || null);
    } catch (error) {
      log.error('メッセージキャプチャエラー:', error);
      console.error('メッセージキャプチャエラー:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * クリップボードコピー機能
   * @param {string} content - コピーするコンテンツ
   * @returns {Promise<Object>} コピー結果
   */

  /**
   * File System Access API機能
   * @param {string} content - 保存するコンテンツ
   * @param {string} relativePath - 保存先の相対パス
   * @returns {Promise<Object>} 保存結果
   */

  /**
   * saveMethodがfilesystemを優先する場合、ユーザージェスチャーでディレクトリハンドルを確保
   */

  /**
   * IndexedDBからディレクトリハンドルを読み込み
   * @returns {Promise<Object|null>} ディレクトリハンドルまたはnull
   */

  /**
   * IndexedDBにディレクトリハンドルを保存（ページオリジン）
   * @param {Object} handle - 保存するディレクトリハンドル
   */

  /**
   * IndexedDBを開く
   * @returns {Promise<IDBDatabase>} データベースオブジェクト
   */


  // ポップアップとバックグラウンドスクリプトからのメッセージをリッスン
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
      sendResponse({
        service: service,
        url: window.location.href,
        title: document.title
      });
      return; // synchronous response
    } else if (request.action === 'captureSelection') {
      const selection = window.getSelection().toString();
      sendResponse({
        success: true,
        content: selection
      });
      return; // synchronous response
    } else if (request.action === 'saveActive') {
      // アクティブなメッセージを見つける（ユーザーがホバーまたはクリックできる）
      const messageElements = document.querySelectorAll(getSelectors().container);
      if (messageElements.length > 0) {
        // 最後のメッセージを「アクティブ」なものとして取得
        const lastMessage = messageElements[messageElements.length - 1];
        handleSaveClick(lastMessage);
        sendResponse({ success: true });
      } else {
        toast.show('ページにメッセージが見つかりませんでした。', 'error');
        sendResponse({ success: false, error: 'ページにメッセージが見つかりませんでした' });
      }
      return; // synchronous response
    } else if (request.action === 'saveSelected') {
      // ChatGPTのみ対応の選択保存処理
      const selectedContent = getSelectedContent();
      if (selectedContent && selectedContent.text) {
        // Use resilient send with retry once if transient error occurs
        const payload = {
          action: 'saveSingleMessage',
          service: service,
          messageContent: `### Selection\n\n${selectedContent.text}`,
          messageType: 'selection',
          conversationTitle: document.title.replace(' - ChatGPT', ''),
          metadata: {
            type: 'selection',
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            selectionInfo: selectedContent.range
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
              setTimeout(() => sendWithRetry(attempts - 1), 300);
              return;
            }
            sendResponse(response);
          });
        };
        sendWithRetry();
        return true; // async response
      } else {
        enableSelectionMode();
        toast.show('選択モードです。テキストをハイライトして保存を押してください。', 'info');
        sendResponse({ success: false, error: 'テキストが選択されていません。まずテキストを選択してください。' });
        return; // synchronous response
      }
    } else if (request.action === 'saveLastN') {
      const result = handleCaptureMessages('recent', request.count);
      if (result.success) {
        // 保存のためにバックグラウンドスクリプトに送信
        chrome.runtime.sendMessage({
          action: 'saveMultipleMessages',
          messages: result.messages,
          conversationTitle: result.title,
          service: service,
          messageType: 'recent',
          count: request.count
        }, (response) => {
          sendResponse(response);
        });
        return true; // async response
      } else {
        sendResponse(result);
        return; // synchronous response
      }
    } else if (request.action === 'saveAll') {
      const result = handleCaptureMessages('all');
      if (result.success) {
        // メッセージが長すぎる場合の処理
        let processedMessages = result.messages;

        // 保存のためにバックグラウンドスクリプトに送信
        chrome.runtime.sendMessage({
          action: 'saveMultipleMessages',
          messages: processedMessages,
          conversationTitle: result.title,
          service: service,
          messageType: 'all'
        }, (response) => {
          sendResponse(response);
        });
        return true; // async response
      } else {
        sendResponse(result);
        return; // synchronous response
      }
    } else if (request.action === 'captureRecentMessages') {
      sendResponse(handleCaptureMessages('recent', request.count));
      return; // synchronous response
    } else if (request.action === 'captureAllMessages') {
      sendResponse(handleCaptureMessages('all'));
      return; // synchronous response
    } else if (request.action === 'copyToClipboard') {
      // バックグラウンドスクリプトからのクリップボードコピーリクエストを処理
      copyToClipboard(request.content).then(result => {
        sendResponse(result);
      }).catch(error => {
        console.error('[ChatVault] クリップボードコピーエラー:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // async response
    } else if (request.action === 'saveViaFileSystem') {
      // File System Access API保存リクエストを処理
      handleFileSystemSave(request.content, request.relativePath).then(result => {
        sendResponse(result);
      }).catch(error => {
        console.error('[ChatVault] FileSystem保存エラー:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // async response
    }
    // No response for unknown actions
    return; // let Chrome close the port normally for sync cases
  });

  // 初期化処理をサービスに応じて実行
  const init = () => {
    if (!provider) {
      log.warn(`プロバイダーが見つからないため初期化をスキップ: ${service}`);
      return;
    }

    if (service === 'chatgpt') {
      initializeChatGPT(() => createSaveButton(service));
    } else if (service === 'gemini') {
      initializeGemini(() => createSaveButton(service));
    } else if (service === 'claude') {
      // Claudeの場合はAPIベースの初期化
      ClaudeProvider.initializeSession().then(success => {
        if (success) {
          ClaudeProvider.startPolling();

          // 既存のメッセージにボタンを追加
          const selectors = ClaudeProvider.getSelectors();
          const messages = document.querySelectorAll(selectors.container);
          messages.forEach((msg) => {
            ClaudeProvider.addSaveButton(msg, () => createSaveButton(service));
          });

          // 動的なメッセージ追加に対応
          const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                  if (node.nodeType !== Node.ELEMENT_NODE) return;
                  if (node.matches && node.matches(selectors.container)) {
                    ClaudeProvider.addSaveButton(node, () => createSaveButton(service));
                  }
                  const newMsgs = node.querySelectorAll ? node.querySelectorAll(selectors.container) : [];
                  newMsgs.forEach((n) => {
                    ClaudeProvider.addSaveButton(n, () => createSaveButton(service));
                  });
                });
              }
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    }

    // イベントデリゲーションで保存ボタンクリックを捕捉（UIファイルはそのまま使用）
    // Claude では保存機能を無効化するため、イベントデリゲーションを登録しない
    if (service !== 'claude') {
      document.addEventListener('click', async (e) => {
        const target = e.target instanceof Element ? e.target : null;
        if (!target) return;
        const btn = target.closest('.chatvault-save-btn');
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();

        try {
          // セレクタからメッセージコンテナを特定
          const selectors = getSelectors();
          let messageEl = selectors ? btn.closest(selectors.container) : null;

          // プロバイダー固有の解決処理
          if (!messageEl && provider && typeof provider.resolveMessageElementFromButton === 'function') {
            messageEl = provider.resolveMessageElementFromButton(btn);
          }
          if (!messageEl) {
            log.warn('保存ボタンの親メッセージ要素が見つかりませんでした');
            return;
          }

          // ビジュアルフィードバック用クラス操作
          btn.classList.add('chatvault-saving');
          btn.disabled = true;

          await ensureDirectoryHandleIfNeeded();
          await handleSaveClick(messageEl, btn);

          // 成功時のUI更新はhandleSaveClick内のレスポンスで行うが、念のため解除
          setTimeout(() => {
            btn.classList.remove('chatvault-saving');
            btn.disabled = false;
          }, 2000);
        } catch (err) {
          log.error('保存処理中にエラー:', err);
          btn.classList.remove('chatvault-saving');
          btn.classList.add('chatvault-error');
          btn.disabled = false;
          setTimeout(() => btn.classList.remove('chatvault-error'), 2000);
        }
      }, true);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000); // Wait 1 second for dynamic content
  }

})();
