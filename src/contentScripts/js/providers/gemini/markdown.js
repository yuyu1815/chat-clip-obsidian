// Gemini provider-scoped HTML -> Markdown conversion utility using Turndown
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

  // Override default GFM table handling with a more robust implementation
  // Remove default table-related rules first (present in gfm plugin)
  if (typeof td.remove === 'function') {
    try { td.remove('table'); } catch (_) {}
    try { td.remove('tableRow'); } catch (_) {}
    try { td.remove('tableCell'); } catch (_) {}
  }

  // Robust table processing similar to scripts/verify_gemini_table.js
  td.addRule('table', {
    filter: 'table',
    replacement: function(_content, node) {
      try {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        const tableData = rows.map(row => {
          const cells = Array.from(row.querySelectorAll('td, th'));
          return cells.map(cell => {
            let text = cell.textContent || '';
            // Remove text from unwanted elements inside the cell
            const unwanted = cell.querySelectorAll('.button-container, .container, button, .superscript, sup');
            unwanted.forEach(el => {
              const elText = el.textContent || '';
              if (elText) text = text.replace(elText, '');
            });
            return text.replace(/\s+/g, ' ').trim();
          });
        });

        const headers = tableData[0] || [];
        const bodyRows = tableData.slice(1);
        if (headers.length === 0) return '';

        const headerRow = '| ' + headers.join(' | ') + ' |';
        const separatorRow = '|' + headers.map(() => ' --- ').join('|') + '|';
        const bodyMarkdown = bodyRows
          .filter(row => row.length > 0)
          .map(row => '| ' + row.join(' | ') + ' |')
          .join('\n');

        return [headerRow, separatorRow, bodyMarkdown].filter(Boolean).join('\n');
      } catch (error) {
        console.error('Gemini table processing error:', error);
        return '';
      }
    }
  });

  // Preserve horizontal rules
  td.addRule('hr', {
    filter: ['hr'],
    replacement: () => '\n\n---\n\n'
  });

  // Handle Gemini code blocks with language header (must come before other code block rules)
  td.addRule('geminiCodeBlock', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      // Check if this is a Gemini code block container
      const cls = (node.className || '').toString();
      return /code-block/.test(cls) && node.querySelector('pre code');
    },
    replacement: (content, node) => {
      // Find the language from the header
      const header = node.querySelector('.code-block-decoration.header-formatted span');
      const language = header ? header.textContent.trim() : '';

      // Find the code content
      const codeEl = node.querySelector('pre code');
      const codeText = codeEl ? codeEl.textContent : '';

      // Also check for code output if present
      const outputEl = node.querySelector('[data-test-id="code-output-stdout-stderr"]');
      const outputText = outputEl ? outputEl.textContent : '';

      let result = `\n\n\u0060\u0060\u0060${language}\n${codeText}\n\u0060\u0060\u0060\n\n`;

      // Add output if present
      if (outputText) {
        result += `\n**出力:**\n\n\`\`\`\n${outputText}\n\`\`\`\n\n`;
      }

      return result;
    }
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



  // Unwrap Gemini specific wrappers that are purely presentational
  td.addRule('unwrapPresentation', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const cls = node.className || '';
      // Common Gemini/markdown wrappers
      return /(prose|markdown|whitespace-pre-wrap|markdown-main-panel)/.test(cls);
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
      const looksLikeToolbar = /(buttons|copy-button)/.test(cls);
      if (looksLikeToolbar) {
        const containsCode = node.matches('pre, code') || node.querySelector('pre, code');
        if (!containsCode) return true;
      }

      // Case 3: Specific Gemini code block decoration elements that don't contain language info
      if (/code-block-decoration.*header/.test(cls)) {
        // Don't remove if it contains language information
        const langSpan = node.querySelector('span');
        if (!langSpan) return true;
      }

      // Be conservative: don't remove generic containers that may also contain the code content
      return false;
    },
    replacement: () => ''
  });

  // Handle Gemini code block language headers
  td.addRule('geminiLanguageHeader', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      // Check if this is a Gemini code block header with language
      const cls = (node.className || '').toString();
      return /code-block-decoration.*header-formatted/.test(cls);
    },
    replacement: (content, node) => {
      // Extract language from the span element
      const langSpan = node.querySelector('span');
      const language = langSpan ? langSpan.textContent.trim() : '';

      // If we have a language, we'll handle it in the geminiCodeBlock rule
      // For now, just return empty to remove the header
      return '';
    }
  });

  // Remove Gemini-specific response elements
  td.addRule('removeResponseElements', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const cls = (node.className || '').toString();
      return /response-element/.test(cls);
    },
    replacement: () => ''
  });

  // Remove Gemini sources UI/carousel/footnotes that are not content
  td.addRule('removeGeminiSources', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const cls = (node.className || '').toString();
      const tag = node.tagName ? node.tagName.toLowerCase() : '';
      // Match by class substring or tag names present in sample markup
      return /(sources-carousel-inline|sources-carousel|source-footnote)/.test(cls) || /^(sources-carousel|sources-carousel-inline)$/.test(tag);
    },
    replacement: () => ''
  });

  // Custom table cell text cleanup for TD
  td.addRule('tableCellText', {
    filter: 'td',
    replacement: (content) => {
      if (!content) return '';
      return content
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        .trim();
    }
  });

  // Custom table header text cleanup for TH
  td.addRule('tableHeaderText', {
    filter: 'th',
    replacement: (content) => {
      if (!content) return '';
      return content
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/&[a-zA-Z0-9#]+;/g, ' ')
        .trim();
    }
  });

  // Inside table cells, treat <br> as a space (not a newline)
  td.addRule('brInTable', {
    filter: (node) => node && node.nodeName === 'BR' && node.parentElement && /^(TD|TH)$/i.test(node.parentElement.tagName || ''),
    replacement: () => ' '
  });

  // Inside table cells, treat <p> as inline (no extra blank lines)
  td.addRule('pInTable', {
    filter: (node) => node && node.nodeName === 'P' && node.parentElement && /^(TD|TH)$/i.test(node.parentElement.tagName || ''),
    replacement: (content) => content.trim()
  });

  // Inside table cells, treat <div> as inline as well (avoid line breaks from wrappers)
  td.addRule('divInTable', {
    filter: (node) => node && node.nodeName === 'DIV' && node.parentElement && /^(TD|TH)$/i.test(node.parentElement.tagName || ''),
    replacement: (content) => (content || '').trim()
  });

  // Remove superscript footnote markers that leak into content
  td.addRule('removeSuperscripts', {
    filter: (node) => node && node.nodeName === 'SUP' && (/\bsuperscript\b/.test(node.getAttribute?.('class') || '') || true) && true,
    replacement: () => ''
  });

  // Remove generic Gemini UI noise elements
  td.addRule('removeUiNoise', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      const cls = (node.className || '').toString();
      const tag = (node.tagName || '').toLowerCase();
      // Known noisy wrappers/buttons/spans in Gemini markup
      const classNoise = /(button-container|mat-mdc-tooltip-trigger|hide-from-message-actions|ng-tns-|ng-star-inserted|carousel-container|carousel-content)\b/.test(cls);
      const isEmptyContainer = /\bcontainer\b/.test(cls) && !node.querySelector('table, pre, code, img, video');
      const isButton = tag === 'button';
      return classNoise || isEmptyContainer || isButton;
    },
    replacement: () => ''
  });

  // Collapse any newlines for any descendant element inside a table cell to avoid multi-line rows
  td.addRule('collapseAnyInTable', {
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return false;
      let p = node.parentElement;
      while (p) {
        const tag = (p.tagName || '').toUpperCase();
        if (tag === 'TD' || tag === 'TH') return true;
        p = p.parentElement;
      }
      return false;
    },
    replacement: (content) => (content || '').replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
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
  return md.split('\n').map(line => {
    const isTableRow = /^\s*\|.*\|\s*$/.test(line);
    if (isTableRow) {
      const parts = line.split('|').map(part => part.trim()).filter((part, index, arr) =>
        index === 0 || index === arr.length - 1 ? part !== '' : true
      );
      const cleanedParts = parts.map(cell =>
        cell.replace(/\r?\n+/g, ' ').replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim()
      );
      return '| ' + cleanedParts.join(' | ') + ' |';
    }
    return line;
  }).join('\n');
}

export function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') return '';
  try {
    const td = getTurndown();
    const md = td.turndown(html);
    return normalizeTableSpacing(md);
  } catch (e) {
    // Fallback: strip tags naively
    return html.replace(/<br\s*\/?/gi, '\n')
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
