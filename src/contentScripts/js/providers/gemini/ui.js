// Gemini UI-related helpers (button placement, etc.)
import { getSelectors } from './checks.js';

// グローバルでツールチップを管理
let globalTooltip = null;

/**
 * Gemini用の保存ボタンを作成
 * @returns {HTMLElement} 保存ボタン要素
 */
function createSaveButton() {
  const button = document.createElement('button');
  button.className = 'chatvault-save-btn';
  button.style.cssText = `
    background-color: transparent;
    color: #5f6368;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
    padding: 8px;
    margin: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  `;
  button.setAttribute('aria-label', 'Save to Obsidian');
  button.setAttribute('data-tooltip', 'Save to Obsidian');
  button.setAttribute('data-state', 'closed');
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
      <polyline points="17 21 17 13 7 13 7 21"/>
      <polyline points="7 3 7 8 15 8"/>
    </svg>
  `;

  // 既存のツールチップがあれば削除
  if (globalTooltip && globalTooltip.parentNode) {
    globalTooltip.remove();
  }

  // ツールチップ要素を作成
  globalTooltip = document.createElement('div');
  globalTooltip.className = 'chatvault-tooltip';
  globalTooltip.setAttribute('data-radix-popper-content-wrapper', '');
  globalTooltip.style.cssText = `
    position: fixed;
    left: 0px;
    top: 0px;
    transform: translate(0px, 0px);
    min-width: max-content;
    z-index: 50;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.2s ease;
    pointer-events: none;
  `;
  globalTooltip.innerHTML = `
    <div style="
      background-color: #202124;
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
      line-height: 1.4;
    ">
      Obsidianに保存する
    </div>
  `;

  // body直下にツールチップを追加
  document.body.appendChild(globalTooltip);

  // ホバー時の背景色変更
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(95, 99, 104, 0.1)';
    button.style.color = '#1a73e8';
    button.setAttribute('data-state', 'delayed-open');

    // ツールチップの位置を計算
    const rect = button.getBoundingClientRect();
    const tooltipRect = globalTooltip.getBoundingClientRect();

    // ボタンの下に表示
    globalTooltip.style.transform = `translate(${rect.left + rect.width / 2 - tooltipRect.width / 2}px, ${rect.bottom + 8}px)`;
    globalTooltip.style.opacity = '1';
    globalTooltip.style.visibility = 'visible';
  });

  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
    button.style.color = '#5f6368';
    button.setAttribute('data-state', 'closed');
    if (globalTooltip) {
      globalTooltip.style.opacity = '0';
      globalTooltip.style.visibility = 'hidden';
    }
  });

  return button;
}

function addSaveButton(messageElement, createSaveButton) {
  // 既存のボタンをチェックして重複を防ぐ
  const existingButton = messageElement.querySelector('.chatvault-save-btn');
  if (existingButton) {
    return { added: false, button: existingButton, target: existingButton.parentElement };
  }

  const button = createSaveButton();

  // deep-research-immersive-panelの場合は特別な処理
  if (messageElement.closest('deep-research-immersive-panel')) {
    return addButtonToDeepResearchPanel(messageElement, button);
  }

  // code-immersive-panelの場合は特別な処理
  if (messageElement.closest('code-immersive-panel')) {
    return addButtonToCodeImmersivePanel(messageElement, button);
  }

  const contentElement = findContentElement(messageElement);

  if (!contentElement) {
    setupDynamicObserver(messageElement, button);
    return { added: false, button: null, target: null };
  }

  return addButtonToElement(contentElement, button);
}

// グローバルなObserver管理
let globalObserver = null;

/**
 * 初期化処理 - 動的コンテンツに対応（SPA遷移にも対応）
 * @param {Function} createSaveButton - ボタン作成関数
 */
function initializeGemini(createSaveButton) {
  // 既存のObserverをクリーンアップ
  if (globalObserver) {
    globalObserver.disconnect();
    globalObserver = null;
  }

  // 既存のボタンをクリーンアップ（SPA遷移時の重複防止）
  const existingButtons = document.querySelectorAll('.chatvault-save-btn');
  existingButtons.forEach(btn => btn.remove());

  // 既存メッセージの初期スキャン - ボタンコンテナとdeep-research-immersive-panel、code-immersive-panelを探す
  let messages = document.querySelectorAll('.buttons-container-v2');
  let deepResearchPanels = document.querySelectorAll('deep-research-immersive-panel');
  let codeImmersivePanels = document.querySelectorAll('code-immersive-panel');

  // 通常のメッセージにボタンを追加
  messages.forEach(buttonContainer => {
    addSaveButton(buttonContainer.parentElement, createSaveButton);
  });

  // deep-research-immersive-panelにボタンを追加
  deepResearchPanels.forEach(panel => {
    addSaveButton(panel, createSaveButton);
  });

  // code-immersive-panelにボタンを追加
  codeImmersivePanels.forEach(panel => {
    addSaveButton(panel, createSaveButton);
  });

  // 新しいメッセージ用のmutation observerを設定
  globalObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // 追加されたノードの処理
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // ボタンコンテナが追加された場合の処理
            const buttonContainers = node.matches('.buttons-container-v2')
              ? [node]
              : node.querySelectorAll ? node.querySelectorAll('.buttons-container-v2') : [];

            buttonContainers.forEach(buttonContainer => {
              addSaveButton(buttonContainer.parentElement, createSaveButton);
            });

            // deep-research-immersive-panelが追加された場合の処理
            const deepResearchPanels = node.matches('deep-research-immersive-panel')
              ? [node]
              : node.querySelectorAll ? node.querySelectorAll('deep-research-immersive-panel') : [];

            deepResearchPanels.forEach(panel => {
              addSaveButton(panel, createSaveButton);
            });

            // code-immersive-panelが追加された場合の処理
            const codeImmersivePanels = node.matches('code-immersive-panel')
              ? [node]
              : node.querySelectorAll ? node.querySelectorAll('code-immersive-panel') : [];

            codeImmersivePanels.forEach(panel => {
              addSaveButton(panel, createSaveButton);
            });
          }
        });
      }

      // 属性変更時の処理
      if (mutation.type === 'attributes') {
        if (mutation.target.matches('.buttons-container-v2')) {
          addSaveButton(mutation.target.parentElement, createSaveButton);
        } else if (mutation.target.matches('deep-research-immersive-panel')) {
          addSaveButton(mutation.target, createSaveButton);
        } else if (mutation.target.matches('code-immersive-panel')) {
          addSaveButton(mutation.target, createSaveButton);
        }
      }
    });
  });

  globalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true
  });
}

/**
 * コンテンツ要素を探す
 * @param {HTMLElement} messageElement - メッセージ要素
 * @returns {HTMLElement|null} コンテンツ要素またはnull
 */
function findContentElement(messageElement) {
  // ボタンコンテナを探す
  const buttonContainer = messageElement.querySelector('.buttons-container-v2');
  if (buttonContainer) {
    return buttonContainer;
  }

  // メッセージ要素自体がボタンコンテナの場合
  if (messageElement.matches && messageElement.matches('.buttons-container-v2')) {
    return messageElement;
  }

  return null;
}

/**
 * 動的更新を監視するオブザーバーを設定
 * @param {HTMLElement} messageElement - メッセージ要素
 * @param {HTMLElement} button - 追加するボタン
 */
function setupDynamicObserver(messageElement, button) {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;

      const addedNode = findAddedContentNode(mutation.addedNodes);
      if (addedNode) {
        addButtonToElement(addedNode, button);
        observer.disconnect();
        return;
      }
    }
  });

  observer.observe(messageElement, {
    childList: true,
    subtree: true
  });

  setTimeout(() => {
    observer.disconnect();
    retryAddButton(messageElement, button);
  }, 500);
}

/**
 * 追加されたノードからコンテンツ要素を探す
 * @param {NodeList} addedNodes - 追加されたノード
 * @returns {HTMLElement|null} コンテンツ要素またはnull
 */
function findAddedContentNode(addedNodes) {
  for (const node of addedNodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    // ノード自体がボタンコンテナかチェック
    if (node.matches && node.matches('.buttons-container-v2')) {
      return node;
    }

    // ノード内にボタンコンテナがあるかチェック
    const buttonContainer = node.querySelector('.buttons-container-v2');
    if (buttonContainer) {
      return buttonContainer;
    }
  }

  return null;
}

/**
 * deep-research-immersive-panelにセーブボタンを追加する特別な処理
 * @param {HTMLElement} messageElement - メッセージ要素
 * @param {HTMLElement} button - 追加するボタン
 * @returns {Object} 追加結果
 */
function addButtonToDeepResearchPanel(messageElement, button) {
  // deep-research-immersive-panel内のエクスポートボタンを探す
  const exportButton = messageElement.querySelector('[data-test-id="export-menu-button"]');

  if (exportButton) {
    // エクスポートボタンの左側にセーブボタンを挿入
    exportButton.parentElement.insertBefore(button, exportButton);

    // deep-research-immersive-panel内での表示に適したスタイルを適用
    button.style.cssText += `
      margin-right: 8px;
      height: 36px;
      min-width: 36px;
      border-radius: 4px;
    `;

    return { added: true, button: button, target: exportButton.parentElement };
  }

  // エクスポートボタンが見つからない場合は、action-buttonsコンテナに追加
  const actionButtons = messageElement.querySelector('.action-buttons');
  if (actionButtons) {
    actionButtons.appendChild(button);

    // action-buttons内での表示に適したスタイルを適用
    button.style.cssText += `
      margin-right: 8px;
      height: 36px;
      min-width: 36px;
      border-radius: 4px;
    `;

    return { added: true, button: button, target: actionButtons };
  }

  return { added: false, button: null, target: null };
}

/**
 * code-immersive-panelにセーブボタンを追加する特別な処理
 * @param {HTMLElement} messageElement - メッセージ要素
 * @param {HTMLElement} button - 追加するボタン
 * @returns {Object} 追加結果
 */
function addButtonToCodeImmersivePanel(messageElement, button) {
  // code-immersive-panel内のaction-buttonsを探す
  const actionButtons = messageElement.querySelector('.action-buttons');

  if (actionButtons) {
    // 閉じるボタンの左側にセーブボタンを挿入
    const closeButton = actionButtons.querySelector('[data-test-id="close-button"]');
    if (closeButton) {
      closeButton.parentElement.insertBefore(button, closeButton);
    } else {
      actionButtons.appendChild(button);
    }

    // code-immersive-panel内での表示に適したスタイルを適用
    button.style.cssText += `
      margin-right: 8px;
      height: 36px;
      min-width: 36px;
      border-radius: 4px;
    `;

    return { added: true, button: button, target: actionButtons };
  }

  return { added: false, button: null, target: null };
}

/**
 * 要素にボタンを追加するヘルパー関数
 * @param {HTMLElement} contentElement - ボタンを追加する要素
 * @param {HTMLElement} button - 追加するボタン
 * @returns {Object} 追加結果
 */
function addButtonToElement(contentElement, button) {
  const buttonEl = button;

  // If a ChatVault button already exists in this insertion container, skip to avoid duplicates
  const existingInContainer = contentElement.querySelector('.chatvault-save-btn');
  if (existingInContainer) {
    return { added: false, button: existingInContainer, target: contentElement };
  }

  // コピーボタンが存在するかチェック
  const copyButton = contentElement.querySelector('[data-test-id="copy-button"]');

  if (copyButton && copyButton.parentElement === contentElement) {
    // コピーボタンの左側に挿入（= 左に表示）
    contentElement.insertBefore(buttonEl, copyButton);
  } else if (copyButton) {
    // copyButton が別ラッパー内にある場合のフォールバック
    const parent = copyButton.closest('.buttons-container-v2') || copyButton.parentElement;
    if (parent && parent.contains(copyButton)) {
      // If parent already has our button, do not insert
      const existingParentBtn = parent.querySelector('.chatvault-save-btn');
      if (existingParentBtn) {
        return { added: false, button: existingParentBtn, target: parent };
      }
      parent.insertBefore(buttonEl, copyButton);
    } else {
      contentElement.appendChild(buttonEl);
    }
  } else {
    // 従来の方法で追加
    contentElement.appendChild(buttonEl);
  }

  return { added: true, button: buttonEl, target: contentElement };
}

/**
 * タイムアウト後の再試行関数
 * @param {HTMLElement} messageElement - メッセージ要素
 * @param {HTMLElement} button - 追加するボタン
 */
function retryAddButton(messageElement, button) {
  // 最後の手段として、メッセージ要素自体にボタンを追加
  if (messageElement && messageElement.isConnected) {
    const buttonEl = button;

    // ボタンコンテナが存在するかチェック
    const buttonContainer = messageElement.querySelector('.buttons-container-v2');

    if (buttonContainer) {
      // Guard: if container already has our button, skip
      const existing = buttonContainer.querySelector('.chatvault-save-btn');
      if (existing) return;
      const copyButton = buttonContainer.querySelector('[data-test-id="copy-button"]');
      if (copyButton) {
        (copyButton.parentElement || buttonContainer).insertBefore(buttonEl, copyButton);
      } else {
        const moreMenuButton = buttonContainer.querySelector('.more-menu-button-container');
        if (moreMenuButton) {
          const refParent = moreMenuButton.parentElement === buttonContainer
            ? buttonContainer
            : (moreMenuButton.closest('.menu-button-wrapper')?.parentElement || buttonContainer);
          // Guard at refParent as well
          const existingRef = refParent.querySelector('.chatvault-save-btn');
          if (existingRef) return;
          refParent.insertBefore(buttonEl, moreMenuButton.closest('.menu-button-wrapper') || moreMenuButton);
        } else {
          buttonContainer.appendChild(buttonEl);
        }
      }
    } else if (messageElement.matches('.buttons-container-v2')) {
      // メッセージ要素自体がボタンコンテナの場合
      // Guard: if container already has our button, skip
      const existing = messageElement.querySelector('.chatvault-save-btn');
      if (existing) return;
      const copyButton = messageElement.querySelector('[data-test-id="copy-button"]');
      if (copyButton) {
        (copyButton.parentElement || messageElement).insertBefore(buttonEl, copyButton);
      } else {
        const moreMenuButton = messageElement.querySelector('.more-menu-button-container');
        if (moreMenuButton) {
          messageElement.insertBefore(buttonEl, moreMenuButton);
        } else {
          messageElement.appendChild(buttonEl);
        }
      }
    } else {
      // 従来の方法で追加
      // Guard against duplicates in messageElement
      const existing = messageElement.querySelector('.chatvault-save-btn');
      if (existing) return;
      messageElement.appendChild(buttonEl);
    }
  }
}

// 関数を明示的にエクスポート
function resolveMessageElementFromButton(btn) {
  try {
    const selectors = getSelectors();

    // deep-research-immersive-panel内のボタンの場合の特別処理
    const deepResearchPanel = btn.closest('deep-research-immersive-panel');
    if (deepResearchPanel) {
      // deep-research-immersive-panel内のメッセージコンテンツを探す
      const messageContent = deepResearchPanel.querySelector(selectors.container);
      if (messageContent) return messageContent;

      // 代替として、response-container内のメッセージコンテンツを探す
      const responseContainer = deepResearchPanel.querySelector('.response-container');
      if (responseContainer) {
        const msg = responseContainer.querySelector(selectors.container);
        if (msg) return msg;
      }

      // 最後の手段として、deep-research-immersive-panel自体を返す
      return deepResearchPanel;
    }

    // code-immersive-panel内のボタンの場合の特別処理
    const codeImmersivePanel = btn.closest('code-immersive-panel');
    if (codeImmersivePanel) {
      // code-immersive-panel内のコードエディタを探す
      const codeEditor = codeImmersivePanel.querySelector('[data-test-id="code-editor"]');
      if (codeEditor) return codeEditor;

      // 代替として、xap-code-editorを探す
      const xapCodeEditor = codeImmersivePanel.querySelector('xap-code-editor');
      if (xapCodeEditor) return xapCodeEditor;

      // 最後の手段として、code-immersive-panel自体を返す
      return codeImmersivePanel;
    }

    // Start from the button container
    const buttonsContainer = btn.closest('.buttons-container-v2');
    // Typical Gemini structure: response-container -> response-container-content -> message-content
    const responseContainer = btn.closest('.response-container');

    // 1) Prefer searching within the nearest response container
    if (responseContainer) {
      // Find the message content within this container
      const msg = responseContainer.querySelector(selectors.container);
      if (msg) return msg;

      // Some builds nest content under .response-container-content
      const contentScope = responseContainer.querySelector('.response-container-content') || responseContainer;
      const msgAlt = contentScope.querySelector(selectors.container);
      if (msgAlt) return msgAlt;
    }

    // 2) If we only have the buttons container, try walking up to its parent and query within
    if (buttonsContainer) {
      const parent = buttonsContainer.parentElement || buttonsContainer.closest('*');
      if (parent) {
        const withinParent = parent.querySelector(selectors.container);
        if (withinParent) return withinParent;
      }

      // Try previous siblings (content is typically before actions)
      let sib = buttonsContainer.previousElementSibling;
      while (sib) {
        const found = sib.matches && sib.matches(selectors.container) ? sib : sib.querySelector?.(selectors.container);
        if (found) return found;
        sib = sib.previousElementSibling;
      }
    }

    // 3) Global fallback: take the last visible message-content on the page
    const all = document.querySelectorAll(selectors.container);
    if (all && all.length) {
      return all[all.length - 1];
    }
  } catch (_) {
    // ignore
  }
  return null;
}

export { createSaveButton, addSaveButton, initializeGemini, resolveMessageElementFromButton };
