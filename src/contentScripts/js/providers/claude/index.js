import { getSelectors } from './checks.js';
import { addSaveButton, createSaveButton, resolveMessageElementFromButton } from './ui.js';
import { initializeSession, startPolling } from './api.js';
import { extractSingleMessage, captureMessages } from './text.js';

const ClaudeProvider = {
  // Selectors & UI helpers
  getSelectors,
  addSaveButton,
  createSaveButton,
  resolveMessageElementFromButton,
  // API/session
  initializeSession,
  startPolling,
  // Text extraction interface for generic handler
  extractSingleMessage,
  captureMessages,
};

export default ClaudeProvider;
