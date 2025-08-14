// Content script for ChatVault Clip
// This script is injected into ChatGPT and Claude pages to add save buttons

import ClaudeService from '../../services/ai/claude.js';
import GeminiService from '../../services/ai/gemini.js';
import { toast } from '../../utils/ui/toast.js';
import ChatGPTProvider from './providers/chatgpt.js';
import ClaudeProvider from './providers/claude.js';
import GeminiProvider from './providers/gemini.js';

// Error codes
const ErrorCodes = {
  NoServiceDetected: 'NO_SERVICE',
  MissingVaultHandle: 'MISSING_VAULT_HANDLE',
  ClipboardFailed: 'CLIPBOARD_FAILED',
  FilesystemPermission: 'FILESYSTEM_PERMISSION',
  ObsidianUriTooLong: 'URI_TOO_LONG',
  BackgroundNoTabId: 'NO_TAB_ID',
  SaveFailed: 'SAVE_FAILED',
};

// Convert error code to user-friendly message
function toUserMessage(code, detail) {
  switch (code) {
    case ErrorCodes.NoServiceDetected:
      return '対応サイトではありません（ChatGPT/Claudeで使用してください）';
    case ErrorCodes.MissingVaultHandle:
      return 'Vaultフォルダが未設定です。オプションからVaultを選択してください。';
    case ErrorCodes.ClipboardFailed:
      return 'クリップボードへのコピーに失敗しました。再度お試しください。';
    case ErrorCodes.FilesystemPermission:
      return 'ファイル保存の権限がありません。Vaultフォルダの権限を再承認してください。';
    case ErrorCodes.ObsidianUriTooLong:
      return 'コンテンツが大きすぎてURIに載せられません。クリップボード保存に切り替えます。';
    case ErrorCodes.BackgroundNoTabId:
      return '有効なタブが見つかりません。ページをリロードして再試行してください。';
    case ErrorCodes.SaveFailed:
      return '保存に失敗しました。コンソールのログを確認してください。';
    default:
      return detail || '不明なエラーが発生しました。';
  }
}

console.info('[ChatVault Content] コンテンツスクリプトを読み込み中...', window.location.href);

(function() {
  'use strict';

  // ChatGPTの画像読み込みとの干渉を防ぐ
  const originalConsoleError = console.error;
  console.error = function(...args) {
    const errorStr = args.join(' ');
    if (errorStr.includes('imageData') || errorStr.includes('googleusercontent')) {
      // ChatGPTの画像読み込みエラーを抑制
      return;
    }
    return originalConsoleError.apply(console, args);
  };

  // エラーイベントリスナーを追加してバブリングを防ぐ
  window.addEventListener('error', function(event) {
    if (event.target && event.target.src && event.target.src.includes('googleusercontent')) {
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

  // 必要に応じてClaudeサービスを初期化
  let claudeService = null;
  let geminiService = null;
  if (service === 'claude') {
    claudeService = new ClaudeService();
    log.info('Claudeサービスを初期化しました');
  } else if (service === 'gemini') {
    geminiService = new GeminiService();
    log.info('Geminiサービスを初期化しました');
  }

  // Active provider interface
  const provider = service === 'chatgpt'
    ? ChatGPTProvider
    : service === 'claude'
      ? ClaudeProvider
      : service === 'gemini'
        ? GeminiProvider
        : null;

  // DOM操作のレート制限
  let lastOperationTime = 0;
  let operationQueue = [];

  function throttleOperation(fn, delay = 100) {
    return function(...args) {
      const now = Date.now();
      if (now - lastOperationTime < delay) {
        operationQueue.push(() => fn.apply(this, args));
        return;
      }
      lastOperationTime = now;
      try {
        fn.apply(this, args);
      } catch (error) {
        log.error('スロットル操作エラー:', error);
      }

      // Process queue
      if (operationQueue.length > 0) {
        const nextOp = operationQueue.shift();
        setTimeout(nextOp, delay);
      }
    };
  }

  // 現在のサービスを検出（ChatGPTまたはClaude）
  function detectService() {
    const hostname = window.location.hostname;
    if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) return 'chatgpt';
    if (hostname.includes('claude.ai')) return 'claude';
    if (hostname.includes('gemini.google.com') || hostname.includes('aistudio.google.com')) return 'gemini';
    return null;
  }

  // 保存ボタン要素を作成
  function createSaveButton() {
    const button = document.createElement('button');
    button.className = 'chatvault-save-btn';
    button.setAttribute('aria-label', 'Save to Obsidian');
    button.setAttribute('data-tooltip', 'Save to Obsidian');
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
    `;
    return button;
  }

  // サービスに基づいてメッセージセレクタを取得（プロバイダに委譲）
  function getSelectors() {
    if (!provider) return null;
    const helper = service === 'claude' ? claudeService : (service === 'gemini' ? geminiService : null);
    return provider.getSelectors(helper);
  }

  // Claudeの理想的な挿入ターゲットを解決（免責事項行を優先、コンテンツ末尾にフォールバック）
  // Claude provider helper moved to provider module
  function getClaudeTargetEnd(messageElement) {
    return ClaudeProvider.getTargetEnd(messageElement);
  }

  // Claude保存ボタンを優先位置に挿入（プロバイダに委譲）
  function insertClaudeButtonAtPreferredSpot(button, messageElement) {
    return ClaudeProvider.insertButtonAtPreferredSpot(button, messageElement);
  }

  // メッセージ要素に保存ボタンを追加
  function addSaveButton(messageElement) {
    // 既存ボタンの扱い（Claudeは末尾へリポジショニング）
    const existingButton = messageElement.querySelector(BUTTON_SELECTOR);
    if (existingButton) {
      if (service === 'claude') {
        const placed = insertClaudeButtonAtPreferredSpot(existingButton, messageElement);
        if (placed) {
          log.debug('Claude保存ボタンを優先位置に再配置しました');
        }
      }
      return;
    }

    // Claude専用: 実際のメッセージかどうかを緩く判定（UI変更に強く）
    if (service === 'claude') {
      // サイドバーやUI要素を除外
      if (messageElement.closest('[data-testid="sidebar"]') ||
          messageElement.closest('nav') ||
          messageElement.closest('header') ||
          messageElement.matches('button, svg, a')) {
        return;
      }

      // メッセージ容器 or コンテンツを内包していれば対象とする
      const hasUserFlag = messageElement.matches('[data-testid="user-message"]') || !!messageElement.querySelector('[data-testid="user-message"]');
      const hasAssistantFlag = messageElement.hasAttribute('data-is-streaming') || !!messageElement.querySelector('[data-is-streaming]');
      const hasClaudeContent = messageElement.matches('.font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]') || !!messageElement.querySelector('.font-claude-message, div.prose, div[class*="whitespace-pre-wrap"]');
      const isMessageLike = hasUserFlag || hasAssistantFlag || hasClaudeContent;
      if (!isMessageLike) {
        log.debug('メッセージ以外の要素をスキップ:', messageElement);
        return;
      }
    }

    log.debug('メッセージ要素に保存ボタンを追加:', messageElement);

    const button = createSaveButton();
    let buttonAdded = false;

    // メッセージコンテンツの末尾にボタンを配置
    if (service === 'chatgpt') {
      const res = ChatGPTProvider.addSaveButton(messageElement, createSaveButton);
      if (res.added) {
        buttonAdded = true;
        log.debug('ChatGPTコンテンツ末尾にボタンを追加:', res.target);
      }
    } else if (service === 'claude') {
      const res = ClaudeProvider.addSaveButton(messageElement, createSaveButton, claudeService);
      if (res.added) {
        buttonAdded = true;
        log.debug('Claudeプロバイダでボタンを追加:', res.target);
      }
    } else if (service === 'gemini') {
      const res = GeminiProvider.addSaveButton(messageElement, createSaveButton, geminiService);
      if (res.added) {
        buttonAdded = true;
        log.debug('Geminiコンテンツ末尾にボタンを追加:', res.target);
      }
    }

    // フォールバック配置（Claudeでは思考領域に付かないようスキップ）
    if (!buttonAdded) {
      const allowFallback = (provider?.absoluteFallbackAllowed !== false);
      if (allowFallback) {
        const fbButton = button && button.isConnected ? button : createSaveButton();
        log.warn('コンテンツエリアが見つかりませんでした、フォールバック配置を使用');
        messageElement.style.position = 'relative';
        fbButton.style.position = 'absolute';
        fbButton.style.top = '10px';
        fbButton.style.right = '10px';
        fbButton.style.zIndex = '1000';
        messageElement.appendChild(fbButton);
      } else {
        // Claude: コンテンツ確定後に再試行
        setTimeout(() => {
          if (messageElement.isConnected && !messageElement.querySelector(BUTTON_SELECTOR)) {
            addSaveButton(messageElement);
          }
        }, 800);
      }
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
        toast.show('エラー: ' + error.message, 'error');
        actualButton.classList.remove('chatvault-saving');
        actualButton.classList.add('chatvault-error');
        actualButton.disabled = false;
        setTimeout(() => {
          actualButton.classList.remove('chatvault-error');
        }, 2000);
      }
    });
  }

  // Claude Artifactコンテナに保存ボタンを追加（プロバイダに委譲）
  function addSaveButtonToArtifact(artifactContainer) {
    try {
      if (service !== 'claude' || !claudeService) return;
      const res = ClaudeProvider.addSaveButtonToArtifact(artifactContainer, createSaveButton, claudeService);
      if (!res?.added) return;
      const btn = res.button || artifactContainer.querySelector(BUTTON_SELECTOR);
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        log.info('ARTIFACT保存ボタンがクリックされました！', artifactContainer);
        btn.classList.add('chatvault-saving');
        btn.disabled = true;
        try {
          handleSaveClick(artifactContainer);
        } catch (error) {
          log.error('Error in handleSaveClick (artifact):', error);
          toast.show('エラー: ' + error.message, 'error');
          btn.classList.remove('chatvault-saving');
          btn.classList.add('chatvault-error');
          btn.disabled = false;
          setTimeout(() => btn.classList.remove('chatvault-error'), 2000);
        }
      });
      log.debug('Artifactボタンを追加:', artifactContainer);
    } catch (error) {
      log.error('Artifact保存ボタンの追加に失敗:', error);
    }
  }

  // 保存ボタンクリックを処理
  async function handleSaveClick(messageElement) {
    log.debug('handleSaveClickが呼び出されました:', messageElement);
    log.debug('メッセージ要素の詳細:', {
      tagName: messageElement.tagName,
      className: messageElement.className,
      textContent: messageElement.textContent?.substring(0, 100) + '...'
    });

    const button = messageElement.querySelector(BUTTON_SELECTOR);

    try {
      let messageData;

      // Claude Artifact: 要素自体がartifactコンテナの場合、ClaudeService経由で抽出
      if (service === 'claude' && claudeService) {
        const artifactSelector = claudeService?.selectors?.artifactContainer;
        if (artifactSelector && messageElement.matches(artifactSelector)) {
          log.debug('Artifactコンテナを検出しました。Artifactを抽出中...');
          const artifact = await claudeService.extractArtifact(messageElement);
          if (!artifact || !artifact.content) {
            throw new Error('Artifact の抽出に失敗しました');
          }
          const conversationTitle = claudeService.getConversationTitle();

          // 長文の場合は分割し、part/totalParts を付与して複数保存
          let artifacts = [];
          try {
            artifacts = await claudeService.splitArtifactIfNeeded(artifact);
          } catch (e) {
            log.warn('Artifact分割に失敗しました、単一保存にフォールバック:', e);
            artifacts = [artifact];
          }

          if (!Array.isArray(artifacts) || artifacts.length === 0) {
            artifacts = [artifact];
          }

          // ボタン状態は最後の保存結果で反映
          let pending = artifacts.length;
          let anyError = false;

          artifacts.forEach((partArtifact) => {
            const hasPartInfo = Number.isInteger(partArtifact.part) && Number.isInteger(partArtifact.totalParts);
            const partSuffix = hasPartInfo ? ` (Part ${partArtifact.part}/${partArtifact.totalParts})` : '';

            const perPartMessage = {
              messageContent: `### Artifact: ${artifact.title}${partSuffix}\n\n${partArtifact.content}`,
              messageType: 'artifact',
              conversationTitle: conversationTitle,
              service: service,
              metadata: {
                type: 'artifact',
                artifactTitle: artifact.title,
                artifactLanguage: partArtifact.language || artifact.language || '',
                artifactFilename: partArtifact.filename || artifact.filename || '',
                ...(hasPartInfo ? { part: partArtifact.part, totalParts: partArtifact.totalParts } : {})
              }
            };

            log.debug('Artifact（分割の可能性あり）をバックグラウンドに送信中:', perPartMessage);
            chrome.runtime.sendMessage({
              action: 'saveSingleMessage',
              ...perPartMessage
            }, (response) => {
              log.info('Artifact部分保存レスポンス:', response);
              pending -= 1;
              if (!response || !response.success) {
                anyError = true;
                const msg = response?.userMessage || toUserMessage(response?.errorCode, response?.error);
                toast.show(msg || '保存に失敗しました。', 'error');
              } else {
                toast.show(response.message || 'Artifact を保存しました。', 'success');
              }

              if (pending === 0) {
                if (button) {
                  button.classList.remove('chatvault-saving');
                  if (anyError) {
                    button.classList.add('chatvault-error');
                  } else {
                    button.classList.add('chatvault-saved');
                  }
                  button.disabled = false;
                  setTimeout(() => {
                    button.classList.remove('chatvault-saved');
                    button.classList.remove('chatvault-error');
                  }, 2000);
                }
              }
            });
          });

          return; // Artifact処理はここで終了
        }
      }

      if (service === 'chatgpt') {
        log.debug('ChatGPTメッセージを抽出中...');
        const extracted = ChatGPTProvider.extractSingleMessage(messageElement);
        const roleLabel = extracted.role === 'user' ? 'User' : 'Assistant';
        messageData = {
          messageContent: `### ${roleLabel}\n\n${extracted.content}`,
          messageType: 'single',
          conversationTitle: extracted.title,
          service: service
        };
        log.debug('準備されたメッセージデータ:', messageData);
      } else if (service === 'claude' && claudeService) {
        // Claude用のメッセージ抽出（ClaudeProvider経由）
        log.debug('ClaudeProviderを使用してClaudeメッセージを抽出中');
        const extractedMessage = ClaudeProvider.extractSingleMessage(messageElement, claudeService);
        if (!extractedMessage) {
          throw new Error('メッセージの抽出に失敗しました');
        }
        const role = extractedMessage.role === 'user' ? 'User' : 'Assistant';
        messageData = {
          messageContent: `### ${role}\n\n${extractedMessage.content}`,
          messageType: 'single',
          conversationTitle: extractedMessage.title,
          service: service
        };

         log.debug('メッセージデータ:', messageData);
      } else if (service === 'gemini') {
        // Gemini用のメッセージ抽出（GeminiProvider経由）
        log.debug('GeminiProviderを使用してGeminiメッセージを抽出中');
        const extracted = GeminiProvider.extractSingleMessage(messageElement, geminiService);
        if (!extracted) {
          throw new Error('メッセージの抽出に失敗しました');
        }
        const role = extracted.role === 'user' ? 'User' : 'Assistant';
        messageData = {
          messageContent: `### ${role}\n\n${extracted.content}`,
          messageType: 'single',
          conversationTitle: extracted.title,
          service: service
        };
        log.debug('Geminiメッセージデータ:', messageData);
      } else {
        // 他のサービスのための基本的なDOM抽出にフォールバック
        const selectors = getSelectors();
        const contentElement = messageElement.querySelector(selectors.content);

        if (!contentElement) {
          throw new Error('メッセージコンテンツが見つかりませんでした');
        }

        const isUser = messageElement.matches(selectors.userMessage);
        const speaker = isUser ? 'User' : 'Assistant';

        messageData = {
          messageContent: `### ${speaker}\n\n${contentElement.innerHTML}`,
          messageType: 'single',
          conversationTitle: document.title.replace(' | Claude', '').replace(' - ChatGPT', ''),
          service: service
        };
      }

      // バックグラウンドスクリプトに送信
      log.debug('バックグラウンドにメッセージを送信中:', {
        action: 'saveSingleMessage',
        ...messageData
      });

      chrome.runtime.sendMessage({
        action: 'saveSingleMessage',
        ...messageData
      }, (response) => {
        log.info('保存レスポンス:', response);

        if (chrome.runtime.lastError) {
          log.error('ランタイムエラー:', chrome.runtime.lastError);
          toast.show('保存に失敗しました: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        if (response && response.success) {
          // 成功フィードバックを表示
          if (actualButton) {
            actualButton.classList.remove('chatvault-saving');
            actualButton.classList.add('chatvault-saved');
            actualButton.disabled = false;
            setTimeout(() => {
              actualButton.classList.remove('chatvault-saved');
            }, 2000);
          }
          log.info(`メッセージを${response.method}経由で保存: ${response.filename}`);
          if (response.message) {
            toast.show(response.message, 'success');
          } else if (response.method === 'clipboard') {
            toast.show('コンテンツをクリップボードにコピーしました。Obsidianで貼り付けてください。', 'success');
          } else {
            toast.show('メッセージを保存しました。', 'success');
          }
        } else {
          log.error('メッセージの保存に失敗:', response?.error);
          const msg = response?.userMessage || toUserMessage(response?.errorCode, response?.error);
          toast.show(msg, 'error');
          if (actualButton) {
            actualButton.classList.remove('chatvault-saving');
            actualButton.classList.add('chatvault-error');
            actualButton.disabled = false;
            setTimeout(() => {
              actualButton.classList.remove('chatvault-error');
            }, 2000);
          }
        }
      });

    } catch (error) {
      log.error('保存クリック処理エラー:', error);
      toast.show('エラー: ' + error.message, 'error');
    }
  }

  // DOM変更を監視して新しいメッセージにボタンを追加
  function observeMessages() {
    const selectors = getSelectors();
    if (!selectors) return;

    log.info(`${service}のメッセージ監視を開始、セレクタ:`, selectors);
    log.debug(`現在のURL: ${window.location.href}`);

    // 既存メッセージの初期スキャン
    let messages = document.querySelectorAll(selectors.container);

    // Claude特別処理: アシスタントメッセージも追加で検索
    if (service === 'claude') {
      const assistantMessages = document.querySelectorAll('[data-is-streaming]');
      const allMessages = [...messages, ...assistantMessages];
      // 重複を除去
      messages = Array.from(new Set(allMessages));
    }

    log.debug('主要セレクタで', messages.length, '個のメッセージを発見');

    // デバッグ: ClaudeのDOM構造を詳しく調査
    if (service === 'claude' && messages.length === 0) {
      log.debug('メッセージが見つかりませんでした、ClaudeのDOMを調査中...');

      // 会話エリアを探す
      const conversationContainers = document.querySelectorAll('main, [role="main"], div[class*="conversation"], div[class*="chat"]');
      log.debug('潜在的な会話コンテナ:', conversationContainers.length);

      // テキストを含む要素を探す
      const allDivs = document.querySelectorAll('div');
      const messagelikeDivs = Array.from(allDivs).filter(div => {
        const text = div.textContent?.trim() || '';
        return text.length > 50 && text.length < 5000 &&
               !div.querySelector('nav') &&
               !div.querySelector('header') &&
               !div.matches('button, a, svg');
      });
      log.debug('メッセージのようなdivを発見:', messagelikeDivs.length);

      // 最初の数個を詳しく見る
      messagelikeDivs.slice(0, 3).forEach((div, index) => {
        log.debug(`潜在的なメッセージ ${index}:`, {
          classes: div.className,
          attributes: Array.from(div.attributes).map(attr => `${attr.name}="${attr.value}"`),
          textPreview: div.textContent?.substring(0, 100) + '...'
        });
      });
    }

    // メッセージが見つからない場合、より広いセレクタを試すが会話エリア内のみ
    if (messages.length === 0) {
      log.debug('メッセージが見つかりませんでした、より広いセレクタを試行中...');
      if (service === 'chatgpt') {
        // メイン会話エリア内を特に探す
        const conversationArea = document.querySelector('main[role="main"], [role="main"], main, .conversation-turn');
        if (conversationArea) {
          messages = conversationArea.querySelectorAll('[data-message-author-role], .group.w-full, [class*="conversation-turn"]');
        } else {
          messages = document.querySelectorAll('[data-message-author-role]:not([data-testid])');
        }
      } else if (service === 'claude') {
        // 会話エリア内のgroup.relativeクラスを持つ要素を検索
        const conversationArea = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
        messages = conversationArea.querySelectorAll('div.group.relative');
        log.debug('group.relative要素を発見:', messages.length);
      }
      log.debug('より広いセレクタで', messages.length, '個のメッセージを発見');
    }

    // まだメッセージが見つからない場合、少し待って再試行
    if (messages.length === 0) {
      log.debug('まだメッセージが見つかりませんでした、2秒後に再試行します...');
      setTimeout(() => {
                  // サービス固有のフォールバックセレクタ
        let retryMessages = [];
        if (service === 'claude') {
          // Claude用: メッセージの親要素を探す（ユーザーメッセージの親要素を取得）
          const userMessages = document.querySelectorAll('div[data-testid="user-message"]');
          const messageParents = [];
          userMessages.forEach(msg => {
            const parent = msg.closest('.group.relative');
            if (parent && !messageParents.includes(parent)) {
              messageParents.push(parent);
            }
          });

          // アシスタントメッセージも探す
          const assistantMessages = document.querySelectorAll('div[data-is-streaming], div.font-claude-message');
          assistantMessages.forEach(msg => {
            const parent = msg.closest('.group.relative');
            if (parent && !messageParents.includes(parent)) {
              messageParents.push(parent);
            }
          });

          retryMessages = messageParents;
          log.debug('Claudeフォールバック: ', retryMessages.length, '個のメッセージ親要素を発見');
        } else {
          retryMessages = document.querySelectorAll('div, article, section');
          log.debug('一般的なフォールバック: ', retryMessages.length, '個の潜在的な要素を発見');
        }

        // メッセージのように見える要素にボタンを追加
        Array.from(retryMessages).filter(el => {
          const text = el.textContent?.trim();
          // Claude用のより洗練されたフィルタリング
          if (service === 'claude') {
            return text && text.length > 20 && text.length < 5000 &&
                   !el.querySelector('input') && !el.querySelector('button') &&
                   !el.matches('nav, header, footer, aside');
          }
          return text && text.length > 10 && text.length < 10000; // 妥当なメッセージ長
        }).slice(0, 15).forEach(addSaveButton); // スパムを避けるために最初の15個に制限
      }, 2000);
    }

    messages.forEach(addSaveButton);

    // Claudeのartifactコンテナの初期スキャン
    if (service === 'claude' && claudeService?.selectors?.artifactContainer) {
      const artifactSelector = claudeService.selectors.artifactContainer;
      const artifacts = document.querySelectorAll(artifactSelector);
      log.debug('Artifactコンテナを発見:', artifacts.length);
      artifacts.forEach(addSaveButtonToArtifact);
    }

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

            // ClaudeのArtifactコンテナ
            if (service === 'claude' && claudeService?.selectors?.artifactContainer) {
              const artifactSelector = claudeService.selectors.artifactContainer;
              if (node.matches && node.matches(artifactSelector)) {
                addSaveButtonToArtifact(node);
              }
              const newArtifacts = node.querySelectorAll ? node.querySelectorAll(artifactSelector) : [];
              newArtifacts.forEach(addSaveButtonToArtifact);
            }

            // Claude: コンテンツが追記された場合にボタンを末尾へ再配置
            if (service === 'claude') {
              const container = (node.matches && node.matches(selectors.container))
                ? node
                : (node.closest ? node.closest(selectors.container) : null);
              if (container) {
                const btn = container.querySelector(BUTTON_SELECTOR);
              const targetEnd = getClaudeTargetEnd(container);
              if (btn && targetEnd && btn.parentElement !== targetEnd) {
                targetEnd.appendChild(btn);
                log.debug('Observer: Claude保存ボタンを最終出力末尾に再配置');
              }
              }
            }
          }
        });
        // 新機能: メッセージの可視性/更新を示す可能性のある属性変更を処理（SPA）
        if (mutation.type === 'attributes' && mutation.target && mutation.target.matches) {
          const targetEl = mutation.target;
          if (targetEl.matches(selectors.container)) {
            addSaveButton(targetEl);
          }
          if (service === 'claude' && claudeService?.selectors?.artifactContainer) {
            const artifactSelector = claudeService.selectors.artifactContainer;
            if (targetEl.matches(artifactSelector)) {
              addSaveButtonToArtifact(targetEl);
            }
          }
          // Claude: 属性変化時にも末尾へ再配置
          if (service === 'claude' && targetEl.matches(selectors.container)) {
            const btn = targetEl.querySelector(BUTTON_SELECTOR);
            const targetEnd = getClaudeTargetEnd(targetEl);
            if (btn && targetEnd && btn.parentElement !== targetEnd) {
              targetEnd.appendChild(btn);
              log.debug('Observer(attributes): Claude保存ボタンを最終出力末尾に再配置');
            }
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

  // オブザーバーコールバックを制限するデバウンス関数
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

  // サービス固有の抽出を使用してメッセージキャプチャを処理
  function handleCaptureMessages(mode, count = null) {
    try {
      if (service === 'gemini') {
        // Gemini専用の抽出ロジック（プロバイダに委譲）
        if (!geminiService) geminiService = new GeminiService();
        return GeminiProvider.captureMessages(mode, count || null, geminiService);
      }
      if (service === 'claude' && claudeService) {
        // Claude専用の抽出ロジック（プロバイダに委譲）
        return ClaudeProvider.captureMessages(mode, count || null, claudeService);
      } else {
        // ChatGPT用のロジックをプロバイダに委譲
        return ChatGPTProvider.captureMessages(mode, count || null);
      }
    } catch (error) {
      console.error('メッセージキャプチャエラー:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // クリップボードコピー機能
  async function copyToClipboard(content) {
    try {
      // まず最新のクリップボードAPIを試す
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        console.log('[ChatVault] navigator.clipboardを使用してコンテンツをクリップボードにコピーしました');
        return { success: true, method: 'navigator.clipboard' };
      } else {
        // execCommand方式にフォールバック
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
          console.log('[ChatVault] execCommandを使用してコンテンツをクリップボードにコピーしました');
          return { success: true, method: 'execCommand' };
        } else {
          throw new Error('execCommandコピーに失敗しました');
        }
      }
    } catch (error) {
      console.error('[ChatVault] クリップボードへのコピーに失敗:', error);
      return { success: false, error: error.message };
    }
  }

  // File System Access API機能
  async function handleFileSystemSave(content, relativePath) {
    try {
      console.log('[ChatVault] File System Access API保存を試行中...');

      // IndexedDBからディレクトリハンドルを読み込み（ページオリジン）
      let dirHandle = await loadDirectoryHandle();
      if (!dirHandle) {
        // ユーザーにVaultディレクトリの選択を促す（ユーザージェスチャーが必要）
        if (typeof window.showDirectoryPicker === 'function') {
          try {
            dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await saveDirectoryHandle(dirHandle);
          } catch (e) {
            throw new Error('Vaultフォルダが未設定です。オプションで設定するか、保存時に表示されるダイアログで許可してください。');
          }
        } else {
          throw new Error('このブラウザはFile System Access APIをサポートしていません。オプションから別の保存方法を選択してください。');
        }
      }

      // 権限を確認
      const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const newPermission = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (newPermission !== 'granted') {
          throw new Error('ファイルシステム権限が拒否されました');
        }
      }

      // パスを解析して必要に応じてディレクトリを作成
      const pathSegments = relativePath.split('/').filter(segment => segment);
      const fileName = pathSegments.pop();

      let currentDir = dirHandle;
      for (const segment of pathSegments) {
        currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
      }

      // ファイルを作成または上書き
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      console.log('[ChatVault] File System Access API経由でファイルを正常に保存しました');
      return { success: true, method: 'filesystem' };
    } catch (error) {
      console.error('[ChatVault] File System Access APIエラー:', error);
      return { success: false, error: error.message };
    }
  }

  // saveMethodがfilesystemを優先する場合、ユーザージェスチャーでディレクトリハンドルを確保
  async function ensureDirectoryHandleIfNeeded() {
    try {
      const prefs = await new Promise((resolve) => {
        chrome.storage.sync.get(['saveMethod'], resolve);
      });
      const method = prefs?.saveMethod || 'filesystem';
      if (method !== 'filesystem' && method !== 'auto') return;

      // 既存のハンドルをチェック
      const existing = await loadDirectoryHandle();
      if (existing) {
        const perm = await existing.queryPermission?.({ mode: 'readwrite' });
        if (perm === 'granted') return;
        const req = await existing.requestPermission?.({ mode: 'readwrite' });
        if (req === 'granted') return;
      }

      // ハンドルがないか権限がない場合: ユーザーに促す（ユーザージェスチャー内である必要がある）
      if (typeof window.showDirectoryPicker === 'function') {
        const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
        await saveDirectoryHandle(dir);
      }
    } catch (e) {
      // 致命的でない: バックグラウンドが他の方式にフォールバック
      log.warn('ensureDirectoryHandleIfNeeded skipped:', e);
    }
  }

  // IndexedDBからディレクトリハンドルを読み込み
  async function loadDirectoryHandle() {
    try {
      const db = await openDB();
      const tx = db.transaction(['handles'], 'readonly');
      const store = tx.objectStore('handles');
      const request = store.get('vaultDirectory');

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          db.close();
          resolve(request.result);
        };
        request.onerror = () => {
          db.close();
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[ChatVault] ディレクトリハンドルの読み込みエラー:', error);
      return null;
    }
  }

  // IndexedDBにディレクトリハンドルを保存（ページオリジン）
  async function saveDirectoryHandle(handle) {
    try {
      const db = await openDB();
      const tx = db.transaction(['handles'], 'readwrite');
      const store = tx.objectStore('handles');
      await new Promise((resolve, reject) => {
        const req = store.put(handle, 'vaultDirectory');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      db.close();
    } catch (error) {
      console.error('[ChatVault] ディレクトリハンドルの保存エラー:', error);
    }
  }

  // IndexedDBを開く
  function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ChatVaultDB', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles');
        }
      };
    });
  }

  // 選択ハイライト機能
  let selectionOverlay = null;
  let isSelectionMode = false;

  function enableSelectionMode() {
    isSelectionMode = true;
    document.body.style.cursor = 'crosshair';

    // Add visual indicator
    if (!selectionOverlay) {
      selectionOverlay = document.createElement('div');
      selectionOverlay.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(59, 130, 246, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 10000;
        pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      selectionOverlay.textContent = '選択モード: テキストをハイライトして保存を押してください';
      document.body.appendChild(selectionOverlay);
    }
  }

  function disableSelectionMode() {
    isSelectionMode = false;
    document.body.style.cursor = '';

    if (selectionOverlay) {
      selectionOverlay.remove();
      selectionOverlay = null;
    }
  }

  function getSelectedContent() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());

    // フォーマットを保持しようとする
    let content = container.innerHTML;
    if (!content.trim()) {
      content = selection.toString();
    }

    return {
      text: selection.toString().trim(),
      html: content,
      range: {
        startContainer: range.startContainer.nodeType === Node.TEXT_NODE ?
                       range.startContainer.parentElement?.tagName : range.startContainer.tagName,
        endContainer: range.endContainer.nodeType === Node.TEXT_NODE ?
                     range.endContainer.parentElement?.tagName : range.endContainer.tagName
      }
    };
  }

  // ポップアップとバックグラウンドスクリプトからのメッセージをリッスン
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageInfo') {
      sendResponse({
        service: service,
        url: window.location.href,
        title: document.title
      });
    } else if (request.action === 'captureSelection') {
      const selection = window.getSelection().toString();
      sendResponse({
        success: true,
        content: selection
      });
    } else if (request.action === 'saveActive') {
      if (service === 'gemini') {
        // Gemini: 最後のメッセージを単一保存（プロバイダに委譲）
        try {
          if (!geminiService) geminiService = new GeminiService();
          const result = GeminiProvider.captureMessages('all', null, geminiService);
          if (!result.success || result.messages.length === 0) {
            sendResponse({ success: false, error: 'ページにメッセージが見つかりませんでした' });
            return true;
          }
          const last = result.messages[result.messages.length - 1];
          chrome.runtime.sendMessage({
            action: 'saveSingleMessage',
            service,
            messageContent: `### ${last.speaker}\n\n${last.content}`,
            messageType: 'single',
            conversationTitle: result.title
          }, (response) => {
            sendResponse(response);
          });
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }
      // アクティブなメッセージを見つける（ユーザーがホバーまたはクリックできる）
      const messageElements = document.querySelectorAll(getSelectors().container);
      if (messageElements.length > 0) {
        // 最後のメッセージを「アクティブ」なものとして取得
        const lastMessage = messageElements[messageElements.length - 1];
        handleSaveClick(lastMessage);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'ページにメッセージが見つかりませんでした' });
      }
    } else if (request.action === 'saveSelected') {
      if (service === 'claude' && claudeService) {
        // Claudeの場合は選択範囲内のメッセージを取得
        const selectedMessages = claudeService.extractSelectedMessages();
        if (selectedMessages.length > 0) {
          const markdown = claudeService.messagesToMarkdown(selectedMessages);
          const title = claudeService.generateTitle(selectedMessages);

          chrome.runtime.sendMessage({
            action: 'saveMultipleMessages',
            messages: selectedMessages.map(msg => ({
              speaker: msg.role === 'user' ? 'User' : 'Assistant',
              content: msg.content
            })),
            conversationTitle: title,
            service: service,
            messageType: 'selection'
          }, (response) => {
            sendResponse(response);
          });
          return true; // Keep channel open for async response
        } else {
          // 通常のテキスト選択処理
          const selectedContent = getSelectedContent();
          if (selectedContent && selectedContent.text) {
            chrome.runtime.sendMessage({
              action: 'saveSingleMessage',
              service: service,
              messageContent: `### Selection\n\n${selectedContent.text}`,
              messageType: 'selection',
              conversationTitle: document.title.replace(' | Claude', '').replace(' - Claude', ''),
              metadata: {
                type: 'selection',
                url: window.location.href,
                title: document.title,
                timestamp: new Date().toISOString(),
                selectionInfo: selectedContent.range
              }
            }, (response) => {
              sendResponse(response);
            });
            return true;
                      } else {
              enableSelectionMode();
              sendResponse({ success: false, error: 'テキストが選択されていません。まずテキストを選択してください。' });
            }
        }
      } else if (service === 'gemini') {
        try {
          if (!geminiService) geminiService = new GeminiService();
          const result = GeminiProvider.captureMessages('selected', null, geminiService);
          if (result.success && result.messages.length > 0) {
            chrome.runtime.sendMessage({
              action: 'saveMultipleMessages',
              messages: result.messages,
              conversationTitle: result.title,
              service,
              messageType: 'selection'
            }, (response) => {
              sendResponse(response);
            });
            return true;
          } else {
            // テキスト選択にフォールバック
            const selectedContent = getSelectedContent();
            if (selectedContent && selectedContent.text) {
              chrome.runtime.sendMessage({
                action: 'saveSingleMessage',
                service,
                messageContent: `### Selection\n\n${selectedContent.text}`,
                messageType: 'selection',
                conversationTitle: document.title.replace(' | Gemini', '').replace(' - Gemini', ''),
                metadata: {
                  type: 'selection',
                  url: window.location.href,
                  title: document.title,
                  timestamp: new Date().toISOString(),
                  selectionInfo: selectedContent.range
                }
              }, (response) => {
                sendResponse(response);
              });
              return true;
            } else {
              enableSelectionMode();
              sendResponse({ success: false, error: 'テキストが選択されていません。まずテキストを選択してください。' });
            }
          }
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      } else {
        const selectedContent = getSelectedContent();
        if (selectedContent && selectedContent.text) {
          // 選択されたコンテンツをバックグラウンドスクリプトに送信
          chrome.runtime.sendMessage({
            action: 'saveSingleMessage',
            service: service,
            content: selectedContent.text,
            html: selectedContent.html,
            metadata: {
              type: 'selection',
              url: window.location.href,
              title: document.title,
              timestamp: new Date().toISOString(),
              selectionInfo: selectedContent.range
            }
          });

          disableSelectionMode();
          sendResponse({ success: true, content: selectedContent.text });
        } else {
          enableSelectionMode();
          sendResponse({ success: false, error: 'テキストが選択されていません。まずテキストを選択してください。' });
        }
      }
    } else if (request.action === 'saveLastN') {
      if (service === 'gemini') {
        try {
          if (!geminiService) geminiService = new GeminiService();
          const result = GeminiProvider.captureMessages('recent', request.count || 30, geminiService);
          if (result.success) {
            chrome.runtime.sendMessage({
              action: 'saveMultipleMessages',
              messages: result.messages,
              conversationTitle: result.title,
              service,
              messageType: 'recent',
              count: request.count
            }, (response) => {
              sendResponse(response);
            });
          } else {
            sendResponse({ success: false, error: result.error || '抽出に失敗しました' });
          }
        } catch (e) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }
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
      } else {
        sendResponse(result);
      }
      return true; // Keep channel open for async response
    } else if (request.action === 'saveAll') {
      if (service === 'gemini') {
        (async () => {
          try {
            if (!geminiService) geminiService = new GeminiService();
            const result = handleCaptureMessages('all');
            if (result.success) {
              // 長文分割（GeminiServiceの分割ロジックを利用）
              const processed = [];
              for (const msg of result.messages) {
                let chunks = [msg.content];
                if (geminiService.splitLongMessage) {
                  try {
                    chunks = await geminiService.splitLongMessage(msg.content);
                  } catch (_) {
                    chunks = [msg.content];
                  }
                }
                if (chunks.length > 1) {
                  chunks.forEach((content, index) => {
                    processed.push({
                      speaker: `${msg.speaker} (Part ${index + 1}/${chunks.length})`,
                      content
                    });
                  });
                } else {
                  processed.push(msg);
                }
              }
              chrome.runtime.sendMessage({
                action: 'saveMultipleMessages',
                messages: processed,
                conversationTitle: result.title,
                service,
                messageType: 'all'
              }, (response) => {
                sendResponse(response);
              });
            } else {
              sendResponse(result);
            }
          } catch (e) {
            sendResponse({ success: false, error: e.message });
          }
        })();
        return true;
      }
      const result = handleCaptureMessages('all');
      if (result.success) {
        // メッセージが長すぎる場合の処理
        let processedMessages = result.messages;
        if (service === 'claude' && claudeService) {
          // 長文メッセージを分割
          processedMessages = result.messages.map(msg => {
            const splitContent = claudeService.splitLongMessage(msg.content);
            if (splitContent.length > 1) {
              // 分割されたメッセージを複数のメッセージとして扱う
              return splitContent.map((content, index) => ({
                speaker: msg.speaker + ` (Part ${index + 1}/${splitContent.length})`,
                content: content
              }));
            }
            return msg;
          }).flat();
        }

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
      } else {
        sendResponse(result);
      }
      return true; // Keep channel open for async response
    } else if (request.action === 'captureRecentMessages') {
      sendResponse(handleCaptureMessages('recent', request.count));
    } else if (request.action === 'captureAllMessages') {
      sendResponse(handleCaptureMessages('all'));
    } else if (request.action === 'copyToClipboard') {
      // バックグラウンドスクリプトからのクリップボードコピーリクエストを処理
      copyToClipboard(request.content).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
    } else if (request.action === 'saveViaFileSystem') {
      // File System Access API保存リクエストを処理
      handleFileSystemSave(request.content, request.relativePath).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep message channel open for async response
    }
    return true; // Keep message channel open for async response
  });

  // 動的コンテンツ用により長い遅延で初期化
  function initializeWithDelay() {
    observeMessages();

    // Retry periodically until messages are found
    let retryCount = 0;
    const maxRetries = 20; // Increased from 10 to 20
    const retryInterval = setInterval(() => {
      const selectors = getSelectors();
      const messages = document.querySelectorAll(selectors.container);
      const existingButtons = document.querySelectorAll('.chatvault-save-btn');

      console.log(`[ChatVault] Retry ${retryCount + 1}: Found ${messages.length} messages, ${existingButtons.length} buttons`);

      if (messages.length > 0) {
        // Add buttons to messages that don't have them yet
        messages.forEach(message => {
          if (!message.querySelector('.chatvault-save-btn')) {
            log.debug('Adding button to message without one:', message);
            addSaveButton(message);
          }
        });

        // If all messages have buttons, we're done
        if (existingButtons.length >= messages.length) {
          clearInterval(retryInterval);
          log.debug('All messages have buttons, stopping retry');
        }
      }

      retryCount++;
      if (retryCount >= maxRetries) {
        clearInterval(retryInterval);
        log.debug('Max retries reached');
      }
    }, 500); // Reduced from 1000ms to 500ms for faster detection
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeWithDelay);
  } else {
    setTimeout(initializeWithDelay, 1000); // Wait 1 second for dynamic content
  }

})();
