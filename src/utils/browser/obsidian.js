/**
 * Utilities to construct Obsidian URIs safely.
 */

export function buildObsidianNewUri({ vaultName, filePath, content }) {
  const v = encodeURIComponent(vaultName || 'MyVault');
  const f = encodeURIComponent(filePath || 'Untitled.md');
  const c = content != null ? encodeURIComponent(content) : undefined;
  return c != null
    ? `obsidian://new?vault=${v}&file=${f}&content=${c}`
    : `obsidian://new?vault=${v}&file=${f}`;
}

export function buildAdvancedUriText({ vaultName, filePath, text, mode = 'new' }) {
  const v = encodeURIComponent(vaultName || 'MyVault');
  const f = encodeURIComponent(filePath || 'Untitled.md');
  const t = encodeURIComponent(text || '');
  return `obsidian://advanced-uri?vault=${v}&filepath=${f}&text=${t}&mode=${mode}`;
}

export function buildAdvancedUriClipboard({ vaultName, filePath, mode = 'new' }) {
  const v = encodeURIComponent(vaultName || 'MyVault');
  const f = encodeURIComponent(filePath || 'Untitled.md');
  return `obsidian://advanced-uri?vault=${v}&filepath=${f}&clipboard=true&mode=${mode}`;
}


