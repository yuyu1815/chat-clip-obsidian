import { getSelectors } from './checks.js';
import { addSaveButton, createSaveButton, createChatButtonsContainer, createToolbar, resolveMessageElementFromButton, initializeGeminiWithNewButtons } from './ui.js';
import { extractSingleMessage, captureMessages } from './text.js';
import * as Comm from './comm.js';

const GeminiProvider = {
  getSelectors,
  addSaveButton,
  createSaveButton,
  createChatButtonsContainer,
  createToolbar,
  extractSingleMessage,
  captureMessages,
  resolveMessageElementFromButton,
  initialize: initializeGeminiWithNewButtons,
  comm: Comm
};

export default GeminiProvider;
