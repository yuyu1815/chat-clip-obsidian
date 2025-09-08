// Factory to obtain provider implementation based on detected service
import ChatGPTProvider from './chatgpt/index.js';
import GeminiProvider from './gemini/index.js';
import NotebookLMProvider from './notebooklm/index.js';

import ClaudeProvider from './claude/index.js';

const registry = {
  chatgpt: ChatGPTProvider,
  gemini: GeminiProvider,
  notebooklm: NotebookLMProvider,
  claude: ClaudeProvider,
};

export function getProvider(service) {
  if (!service) return null;
  return registry[service] || null;
}

export default { getProvider };
