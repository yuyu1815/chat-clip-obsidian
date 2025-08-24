import { getSelectors } from './checks.js';
import { addSaveButton, createSaveButton, resolveMessageElementFromButton } from './ui.js';
import { extractSingleMessage, captureMessages } from './text.js';
import * as Comm from './comm.js';

const GeminiProvider = {
  getSelectors,
  addSaveButton,
  createSaveButton,
  extractSingleMessage,
  captureMessages,
  resolveMessageElementFromButton,
  comm: Comm
};

export default GeminiProvider;
