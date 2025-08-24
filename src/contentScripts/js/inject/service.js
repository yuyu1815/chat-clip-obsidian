// Service detection for content script
// Detects which AI service page is currently loaded

export function detectService() {
  const hostname = window.location.hostname;
  if (hostname.includes('chat.openai.com') || hostname.includes('chatgpt.com')) return 'chatgpt';
  if (hostname.includes('claude.ai')) return 'claude';
  if (hostname.includes('gemini.google.com') || hostname.includes('aistudio.google.com')) return 'gemini';
  return null;
}
