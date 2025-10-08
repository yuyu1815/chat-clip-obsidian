// NotebookLM Provider - Main entry point
import { getSelectors, isNotebookLM } from './checks.js';
import { 
  addSaveButton, 
  createSaveButton, 
  createChatButtonsContainer, 
  createToolbar, 
  resolveMessageElementFromButton,
  initializeNotebookLM
} from './ui.js';
import { extractSingleMessage, captureMessages } from './text.js';

/**
 * NotebookLMプロバイダー
 * BaseProviderインターフェースを実装
 */
const NotebookLMProvider = {
  // セレクター取得
  getSelectors,
  
  // サイト検出
  isNotebookLM,
  
  // UI関連
  addSaveButton,
  createSaveButton,
  createChatButtonsContainer,
  createToolbar,
  resolveMessageElementFromButton,
  
  // 初期化
  initialize: initializeNotebookLM,
  
  // テキスト抽出
  extractSingleMessage,
  captureMessages,
  
  // プロバイダー情報
  name: 'NotebookLM',
  domain: 'notebooklm.google.com',
  urlPattern: /^https:\/\/notebooklm\.google\.com\/notebook\/[^\/]+/
};

export default NotebookLMProvider;
