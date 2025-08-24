// ChatGPT provider-scoped HTML -> Markdown conversion utility using Turndown
// Note: Moved from src/utils/markdown.js because HTML differs per provider
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

let singletonTd = null;

function getTurndown() {
  if (singletonTd) return singletonTd;

  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    br: '\n',
    strongDelimiter: '**',
  });

  // GitHub Flavored Markdown rules (tables, strikethrough, task lists, code)
  td.use(gfm);

  // Preserve horizontal rules
  td.addRule('hr', {
    filter: ['hr'],
    replacement: () => '\n\n---\n\n'
  });

  // Preserve inline code spans more reliably, but promote long/multiline to fenced blocks with a language
  td.addRule('inlineCode', {
    filter: (node) => node.nodeName === 'CODE' && node.parentNode && node.parentNode.nodeName !== 'PRE',
    replacement: (content, node) => {
      const text = (node.textContent || '').replace(/\u00A0/g, ' ');
      const className = (node.getAttribute && (node.getAttribute('class') || '')) || '';
      // Treat standalone code elements that look like blocks as fenced blocks
      const langMatch = className.toLowerCase().match(/language-([a-z0-9+#-]+)/i);
      const isBlocky = /whitespace-pre/.test(className) || !!langMatch;
      if (isBlocky) {
        const lang = langMatch ? langMatch[1] : '';
        return `\n\n\u0060\u0060\u0060${lang}\n${text}\n\u0060\u0060\u0060\n\n`;
      }

      return '`' + text.replace(/`/g, '\u200b`') + '`';
    }
  });

  // Handle pre>code blocks with language class
  td.addRule('fencedCode', {
    filter: (node) => {
      if (node.nodeName !== 'PRE') return false;
      const code = Array.from(node.childNodes).find(n => n.nodeName === 'CODE');
      return !!code;
    },
    replacement: (_content, node) => {
      const codeEl = Array.from(node.childNodes).find(n => n.nodeName === 'CODE');
      const className = (codeEl?.getAttribute('class') || '').toLowerCase();
      const langMatch = className.match(/language-([a-z0-9+#-]+)/i) || className.match(/lang-([a-z0-9+#-]+)/i);
      const lang = langMatch ? langMatch[1] : '';
      const text = codeEl?.textContent || '';
      return `\n\n\u0060\u0060\u0060${lang}\n${text}\n\u0060\u0060\u0060\n\n`;
    }
  });

  // Unwrap ChatGPT specific wrappers that are purely presentational
  td.addRule('unwrapPresentation', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const cls = node.className || '';
      // Common ChatGPT/markdown wrappers
      return /(prose|markdown|whitespace-pre-wrap)/.test(cls);
    },
    replacement: (content) => content
  });

  // Remove code toolbars/buttons conservatively (Copy/Edit in English/Japanese)
  td.addRule('removeCopyCodeButtons', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;

      const attr = (name) => (node.getAttribute(name) || '').toLowerCase();
      const text = (node.textContent || '').trim();

      const isButton = node.tagName === 'BUTTON' || node.getAttribute('role') === 'button';
      const isCopyText = /^(copy\s*code|コードをコピーする)$/i.test(text);
      const isEditText = /^(edit|編集する)$/i.test(text);
      const hasCopyAttr = /copy/.test(attr('aria-label')) || /copy/.test(attr('data-testid'));
      const hasEditAttr = /edit/.test(attr('aria-label')) || /edit/.test(attr('data-testid'));

      // Case 1: The element itself is a copy/edit button
      if (isButton && (isCopyText || isEditText)) return true;
      if (hasCopyAttr || hasEditAttr) return true;

      // Case 2: Toolbar/header containers (narrow strips above code)
      const cls = (node.className || '').toString();
      const looksLikeToolbar = /(bg-token-bg-elevated-secondary|sticky\s+top-9|h-9\b|rounded-t-2xl|select-none\b)/.test(cls);
      if (looksLikeToolbar) {
        const containsCode = node.matches('pre, code') || node.querySelector('pre, code');
        if (!containsCode) return true;
      }

      // Be conservative: don't remove generic containers that may also contain the code content
      return false;
    },
    replacement: () => ''
  });

  // Remove standalone short language labels that precede code blocks (e.g., "js", "nginx")
  td.addRule('removeLanguageHeader', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const txt = (node.textContent || '').trim();
      if (!txt) return false;
      // Accept short single token labels as potential language tags
      const isShortToken = txt.length <= 20 && /^[a-z0-9+#-]+$/i.test(txt);
      if (!isShortToken) return false;
      // if this element is near a code block (sibling or descendant in parent)
      const parent = node.parentElement;
      if (!parent) return false;
      const hasCode = parent.querySelector('pre code, code[class*="language-"], code[class*="whitespace-pre"]')
        || parent.nextElementSibling?.matches?.('pre, code')
        || node.nextElementSibling?.matches?.('pre, code');
      return !!hasCode;
    },
    replacement: () => ''
  });

  singletonTd = td;
  return singletonTd;
}

/**
 * Convert HTML string to Markdown.
 * If input is empty or not a string, returns empty string.
 * @param {string} md
 * @returns {string}
 */
function normalizeTableSpacing(md) {
  if (!md) return md;
  const lines = md.split('\n');
  const result = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = i + 1 < lines.length ? lines[i + 1] : '';
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);
    const isSeparator = /^\s*\|?\s*:?[-]{3,}.*\|.*$/.test(next);

    if (!inTable) {
      if (isTableRow && isSeparator) {
        inTable = true;
        result.push(line);
        continue;
      }
      result.push(line);
      continue;
    }

    if (line.trim() === '') {
      continue;
    }

    if (isTableRow) {
      result.push(line);
    } else {
      inTable = false;
      result.push(line);
    }
  }
  return result.join('\n');
}

export function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') return '';
  try {
    const td = getTurndown();
    const md = td.turndown(html);
    return normalizeTableSpacing(md);
  } catch (e) {
    // Fallback: strip tags naively
    return html.replace(/<br\s*\/>?/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .trim();
  }
}

/**
 * Convert possibly-HTML content to Markdown. If it doesn't look like HTML,
 * returns the original text.
 * @param {string} content
 * @returns {string}
 */
export function toMarkdownIfHtml(content) {
  if (!content) return '';
  if (typeof content !== 'string') return String(content);
  // Heuristic: if it contains tags like <p>, <div>, <h1>, <ul>, <pre>, <code>, <br>
  if (/[<][a-zA-Z][^>]*>/.test(content)) {
    return htmlToMarkdown(content);
  }
  return content;
}
