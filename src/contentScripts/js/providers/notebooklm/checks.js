// NotebookLM checks and selectors
// URL pattern: https://notebooklm.google.com/notebook/{uuid}

export function getSelectors() {
  // HTMLサンプルに基づく実際のセレクター（Angular/Material構造）
  // 実際の構造: mat-card.mat-mdc-card > mat-card-actions > chat-actions.actions-container
  const container = [
    'mat-card.mat-mdc-card', // メッセージ全体のカード
    'mat-card.to-user-message-card-content', // ユーザーメッセージ
    'mat-card.from-user-message-card-content' // AIレスポンス
  ].join(', ');

  // ユーザーメッセージとアシスタントメッセージの区別
  const userMessage = 'mat-card.to-user-message-card-content';
  const assistantMessage = 'mat-card.from-user-message-card-content, mat-card.mat-mdc-card:not(.to-user-message-card-content)';

  // メッセージコンテンツエリア（実際のHTML構造に基づく）
  const content = [
    '.message-text-content',
    '.message-content',
    'mat-card-content .message-content'
  ].join(', ');

  // アクションコンテナとコピーボタン
  const actionsContainer = 'chat-actions.actions-container';
  const copyButton = `${actionsContainer} .xap-copy-to-clipboard`;

  return { container, userMessage, assistantMessage, content, copyButton, actionsContainer };
}

// NotebookLMサイトの検出
export function isNotebookLM() {
  const url = window.location.href;
  return url.includes('notebooklm.google.com/notebook/');
}
