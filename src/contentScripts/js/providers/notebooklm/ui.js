// NotebookLM UI-related helpers (button placement, etc.)
import { getSelectors } from './checks.js';

// グローバル変数
let globalObserver = null;

/**
 * NotebookLM用のObsidian保存ボタンを作成する
 * @returns {HTMLElement} 保存ボタン要素
 */
function createSaveButton() {
  const button = document.createElement('button');
  button.className = 'chatvault-save-btn notebooklm-save-btn mdc-icon-button mat-mdc-icon-button mat-mdc-button-base action-button';
  button.setAttribute('aria-label', 'Obsidianに保存');
  button.setAttribute('data-test-id', 'chatvault-save-button');
  button.setAttribute('mat-icon-button', '');
  button.setAttribute('type', 'button');
  
  // NotebookLMのアイコンボタンスタイルに合わせる
  button.style.cssText = `
    width: 40px;
    height: 40px;
    padding: 8px;
    margin: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: #5f6368;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: background-color 0.2s ease;
    font-size: 0;
    line-height: 1;
    vertical-align: middle;
  `;
  
  // Material Design Iconsのsaveアイコンを使用
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-icon-button__ripple"></span>
    <mat-icon role="img" class="mat-icon notranslate google-symbols mat-icon-no-color" aria-hidden="true" data-mat-icon-type="font">
      save
    </mat-icon>
    <span class="mat-focus-indicator"></span>
    <span class="mat-mdc-button-touch-target"></span>
  `;

  // mat-iconのスタイルを設定
  const matIcon = button.querySelector('mat-icon');
  if (matIcon) {
    matIcon.style.cssText = `
      font-family: 'Material Symbols Outlined', 'Material Icons', sans-serif;
      font-weight: normal;
      font-style: normal;
      font-size: 20px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
    `;
    matIcon.textContent = 'save';
  }

  // ホバー効果
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(60, 64, 67, 0.08)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
  });

  return button;
}

/**
 * NotebookLM用のボタンコンテナを作成（実装は後で調整）
 * @returns {HTMLElement} ボタンコンテナ要素
 */
function createChatButtonsContainer() {
  const container = document.createElement('div');
  container.className = 'notebooklm-buttons-container';
  container.style.cssText = `
    display: flex;
    gap: 8px;
    padding: 8px;
    justify-content: flex-end;
    align-items: center;
  `;

  // Obsidian保存ボタンを追加
  const saveButton = createSaveButton();
  container.appendChild(saveButton);

  return container;
}

/**
 * NotebookLM用のツールバーを作成（実装は後で調整）
 * @returns {HTMLElement} ツールバー要素
 */
function createToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'notebooklm-toolbar';
  toolbar.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #dadce0;
    background-color: #fff;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'NotebookLM チャット';
  title.style.cssText = `
    margin: 0;
    font-size: 18px;
    font-weight: 500;
    color: #3c4043;
  `;
  
  const saveButton = createSaveButton();
  
  toolbar.appendChild(title);
  toolbar.appendChild(saveButton);
  
  return toolbar;
}

/**
 * ボタンをメッセージ要素に追加
 * @param {HTMLElement} messageElement - メッセージ要素
 * @param {Function} createButtonFn - ボタン作成関数
 * @returns {Object} 結果オブジェクト
 */
function addSaveButton(messageElement, createButtonFn) {
  // 既存のボタンチェック
  const existingButton = messageElement.querySelector('.chatvault-save-btn');
  if (existingButton) {
    return { added: false, button: existingButton, target: existingButton.parentElement };
  }

  const button = createButtonFn();

  // NotebookLMのアクションコンテナ(<chat-actions>)を探す
  const selectors = getSelectors();
  let actions = null;

  // messageElement自体がアクションコンテナの場合
  if (messageElement.matches && messageElement.matches(selectors.actionsContainer)) {
    actions = messageElement;
  }
  // messageElement内でアクションコンテナを探す
  else if (messageElement.querySelector) {
    actions = messageElement.querySelector(selectors.actionsContainer);
  }

  // アクションコンテナが見つからない場合は、mat-card-actionsを探す
  if (!actions && messageElement.querySelector) {
    const matCardActions = messageElement.querySelector('mat-card-actions');
    if (matCardActions) {
      actions = matCardActions.querySelector(selectors.actionsContainer);
    }
  }

  if (actions) {
    // 既存のアクションボタン群の先頭に挿入（左側）
    const firstAction = actions.querySelector('.action');
    if (firstAction) {
      const wrapper = document.createElement('div');
      wrapper.className = 'action chatvault-action';
      wrapper.style.cssText = 'display: flex; align-items: center;';
      
      // ボタンのスタイリングを調整
      button.classList.add('action-button');
      button.style.cssText = `
        margin: 0 4px 0 0;
        padding: 8px;
        border: none;
        background: none;
        cursor: pointer;
        border-radius: 4px;
        transition: background-color 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        height: 40px;
      `;
      
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
      });
      
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = 'transparent';
      });
      
      wrapper.appendChild(button);
      actions.insertBefore(wrapper, firstAction);
    } else {
      // アクションボタンが無い場合は直接追加
      actions.appendChild(button);
    }
    return { added: true, button: button, target: actions };
  }

  console.warn('NotebookLM: アクションコンテナが見つかりませんでした', messageElement);
  return { added: false, button: null, target: null };
}

/**
 * NotebookLM用の初期化処理
 */
function initializeNotebookLM() {
  console.log('NotebookLM: 初期化を開始');
  
  // 既存のObserverをクリーンアップ
  if (globalObserver) {
    globalObserver.disconnect();
    globalObserver = null;
  }

  // 既存のボタンをクリーンアップ
  const existingButtons = document.querySelectorAll('.chatvault-save-btn');
  existingButtons.forEach(btn => btn.remove());

  const selectors = getSelectors();

  // 初期スキャンを遅延実行（DOM構築を待つ）
  function performInitialScan() {
    const containers = document.querySelectorAll(selectors.container);
    console.log(`NotebookLM: ${containers.length}個のメッセージコンテナを発見`);
    
    let buttonsAdded = 0;
    containers.forEach(container => {
      const result = addSaveButton(container, () => createSaveButton());
      if (result.added) {
        buttonsAdded++;
      }
    });
    
    console.log(`NotebookLM: ${buttonsAdded}個のボタンを追加`);
    
    // 追加で直接アクションコンテナも検索
    const actionContainers = document.querySelectorAll(selectors.actionsContainer);
    actionContainers.forEach(actionContainer => {
      // 親のmat-cardを探して処理
      let card = actionContainer.closest('mat-card');
      if (card && !card.querySelector('.chatvault-save-btn')) {
        const result = addSaveButton(card, () => createSaveButton());
        if (result.added) {
          buttonsAdded++;
        }
      }
    });
    
    console.log(`NotebookLM: 最終的に${buttonsAdded}個のボタンを追加`);
  }

  // 段階的な初期スキャン（DOM構築のタイミングに対応）
  setTimeout(performInitialScan, 100);
  setTimeout(performInitialScan, 500);
  setTimeout(performInitialScan, 1000);

  // mutation observerを設定
  globalObserver = new MutationObserver((mutations) => {
    let shouldScan = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 重要なノードの追加を検出
            if (node.matches && (
              node.matches(selectors.container) || 
              node.matches(selectors.actionsContainer) ||
              node.matches('mat-card') ||
              node.matches('chat-actions')
            )) {
              shouldScan = true;
            }
            
            // 子要素にも対象が含まれているか確認
            if (node.querySelectorAll) {
              const childContainers = node.querySelectorAll(selectors.container + ', ' + selectors.actionsContainer);
              if (childContainers.length > 0) {
                shouldScan = true;
              }
            }
          }
        });
      }
    });
    
    if (shouldScan) {
      // debounceで複数の変更を一度に処理
      setTimeout(() => {
        console.log('NotebookLM: DOM変更を検出、再スキャン実行');
        performInitialScan();
      }, 200);
    }
  });

  globalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  console.log('NotebookLM: MutationObserver設定完了');
}

/**
 * ボタンからメッセージ要素を解決する
 * @param {HTMLElement} btn - クリックされたボタン
 * @returns {HTMLElement|null} メッセージ要素
 */
function resolveMessageElementFromButton(btn) {
  try {
    const selectors = getSelectors();
    
    // ボタンの親要素を辿ってメッセージ要素を探す
    let current = btn.parentElement;
    while (current && current !== document.body) {
      if (current.matches(selectors.container)) {
        return current;
      }
      current = current.parentElement;
    }
    
    // フォールバック: 最後のメッセージ要素を返す
    const allMessages = document.querySelectorAll(selectors.container);
    if (allMessages && allMessages.length) {
      return allMessages[allMessages.length - 1];
    }
  } catch (error) {
    console.error('NotebookLM: メッセージ要素の解決に失敗:', error);
  }
  
  return null;
}

export { 
  createSaveButton, 
  createChatButtonsContainer,
  createToolbar,
  addSaveButton, 
  initializeNotebookLM,
  resolveMessageElementFromButton 
};
