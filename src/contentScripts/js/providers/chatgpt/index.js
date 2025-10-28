import { getSelectors } from './checks.js';
import { addSaveButton, createSaveButton, resolveMessageElementFromButton, initializeChatGPT } from './ui.js';
import { extractSingleMessage, captureMessages } from './text.js';
import * as Comm from './comm.js';

const ChatGPTProvider = {
  getSelectors,
  addSaveButton,
  createSaveButton,
  resolveMessageElementFromButton,
  extractSingleMessage,
  captureMessages,
  initialize: initializeChatGPT,
  comm: Comm
};

export default ChatGPTProvider;
