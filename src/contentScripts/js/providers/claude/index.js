import { getSelectors } from './checks.js';
import { addSaveButton, createSaveButton, resolveMessageElementFromButton, injectObsidianMenuItem, startContentScriptIntegration } from './ui.js';
import { initializeSession, startPolling } from './api.js';
import { extractSingleMessage, captureMessages } from './text.js';

const ClaudeProvider = {
  // Selectors & UI helpers
  getSelectors,
  addSaveButton,
  createSaveButton,
  resolveMessageElementFromButton,
  injectObsidianMenuItem,
  // API/session
  initializeSession,
  startPolling,
  // Text extraction interface for generic handler
  extractSingleMessage,
  captureMessages,
  // Content script integration
  startContentScriptIntegration,
  // 統一初期化メソッド（他のプロバイダーと合わせるため）
  initialize: startContentScriptIntegration,
};

export default ClaudeProvider;
