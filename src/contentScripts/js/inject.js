/**
 * ChatVault Clip のコンテンツスクリプト
 * ChatGPTページに保存ボタンを追加するスクリプト
 */

import { toast } from '../../utils/notifications/toast.js';
import { createLogger } from '../../utils/logger.js';
import { toUserMessage } from '../../utils/messages.js';
import { detectService } from './inject/service.js';
import { getProvider } from './providers/ProviderFactory.js';
import { copyToClipboard } from './inject/clipboard.js';
import { handleFileSystemSave, ensureDirectoryHandleIfNeeded } from './inject/filesystem.js';
import { enableSelectionMode, getSelectedContent } from './inject/selection.js';
import '../css/inject.css';

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

  /**
 * ChatGPT用のメッセージセレクタを取得
 * @returns {Object|null} セレクタオブジェクト、プロバイダーが利用できない場合はnull
 */
  function getSelectors() {
    if (!provider) return null;
    return provider.getSelectors();
  }
  /**
   * メッセージデータを抽出して準備する
   * @param {HTMLElement} messageElement - メッセージ要素
   * @returns {Object} 準備されたメッセージデータ
   */
  function extractMessageData(messageElement) {
    if (!provider) {
      throw new Error(`プロバイダーが見つかりません: ${service}`);
    }
    
    log.debug(`${service}メッセージを抽出中...`);
    const extracted = provider.extractSingleMessage(messageElement);
    const roleLabel = extracted.role === 'user' ? 'User' : 'Assistant';
    
    return {
      messageContent: `### ${roleLabel}\n\n${extracted.content}`,
      messageType: 'single',
      conversationTitle: extracted.title,
      service: service
    };
  }

  /**
   * ボタンの状態を更新する
   * @param {HTMLElement} button - ボタン要素
   * @param {string} state - 新しい状態 ('saving', 'saved', 'error', 'reset')
   */
  function updateButtonState(button, state) {
    if (!button) return;
    
    // 既存のクラスをクリア
    button.classList.remove('chatvault-saving', 'chatvault-saved', 'chatvault-error');
    
    switch (state) {
      case 'saving':
        button.classList.add('chatvault-saving');
        button.disabled = true;
        break;
      case 'saved':
        button.classList.add('chatvault-saved');
        button.disabled = false;
        setTimeout(() => button.classList.remove('chatvault-saved'), 2000);
        break;
      case 'error':
        button.classList.add('chatvault-error');
        button.disabled = false;
        setTimeout(() => button.classList.remove('chatvault-error'), 2000);
        break;
      case 'reset':
        button.disabled = false;
        break;
    }
  }

  /**
   * 成功メッセージを表示する
   * @param {Object} response - レスポンスオブジェクト
   */
  function showSuccessMessage(response) {
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
  }

  /**
   * エラーメッセージを表示する
   * @param {Object|string} error - エラーオブジェクトまたはメッセージ
   * @param {string} userMessage - ユーザー向けメッセージ（オプション）
   */
  function showErrorMessage(error, userMessage = null) {
    const message = userMessage || error?.message || error || '保存に失敗しました。';
    log.error('保存エラー:', error);
    console.error('[ChatVault] 保存失敗:', message);
    toast.show(message, 'error');
  }

  /**
   * 保存レスポンスを処理する
   * @param {Object} response - レスポンスオブジェクト
   * @param {Object} lastError - Chromeランタイムエラー
   * @param {HTMLElement} messageElement - メッセージ要素
   * @param {HTMLElement} buttonEl - ボタン要素
   */
  function handleSaveResponse(response, lastError, messageElement, buttonEl) {
    log.info('保存レスポンス:', response);
    const targetBtn = buttonEl || messageElement.querySelector(BUTTON_SELECTOR);

    if (lastError) {
      showErrorMessage(lastError, '保存に失敗しました: ' + lastError.message + '\nページを再読み込みして再試行してください。');
      return;
    }

    if (response && response.success) {
      updateButtonState(targetBtn, 'saved');
      showSuccessMessage(response);
    } else {
      const msg = response?.userMessage || toUserMessage(response?.errorCode, response?.error);
      updateButtonState(targetBtn, 'error');
      showErrorMessage(response?.error, msg);
    }
  }

  /**
   * 保存ボタンクリックイベントを処理（シンプル版）
   * @param {HTMLElement} messageElement - 保存するメッセージ要素
   * @param {HTMLElement} buttonEl - ボタン要素（オプション）
   */
  async function handleSaveClick(messageElement, buttonEl = null) {
    log.debug('メッセージ保存を開始します:', {
      tagName: messageElement.tagName,
      className: messageElement.className
    });

    try {
      // 1. メッセージデータを抽出
      const messageData = extractMessageData(messageElement);
      log.debug('準備されたメッセージデータ:', messageData);

      // 2. バックグラウンドに送信（再試行付き）
      sendMessageWithRetry({
        action: 'saveSingleMessage',
        ...messageData
      }, (response, lastError) => {
        handleSaveResponse(response, lastError, messageElement, buttonEl);
      });

    } catch (error) {
      log.error('保存処理エラー:', error);
      const targetBtn = buttonEl || messageElement.querySelector(BUTTON_SELECTOR);
      updateButtonState(targetBtn, 'error');
      showErrorMessage(error, '保存中にエラーが発生しました: ' + (error?.message || error));
    }
  }

  /**
   * 再試行付きメッセージ送信
   * @param {Object} payload - 送信データ
   * @param {Function} onResponse - レスポンスコールバック
   * @param {number} attempts - 試行回数
   */
  function sendMessageWithRetry(payload, onResponse, attempts = 2) {
    chrome.runtime.sendMessage(payload, (response) => {
      const lastError = chrome.runtime.lastError;
      const transient = lastError && (
        /Extension context invalidated/i.test(lastError.message || '') ||
        /message port closed/i.test(lastError.message || '') ||
        /Could not establish connection/i.test(lastError.message || '')
      );
      
      if (transient && attempts > 1) {
        log.warn('送信エラー、再試行中...', lastError?.message);
        setTimeout(() => sendMessageWithRetry(payload, onResponse, attempts - 1), 300);
        return;
      }
      
      onResponse(response, lastError);
    });
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

    // 統一された初期化処理
    provider.initialize();

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
