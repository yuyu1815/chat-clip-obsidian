/**
 * Markdown conversion utilities using Turndown
 */

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

class MarkdownConverter {
  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```',
      bulletListMarker: '-',
      strongDelimiter: '**',
      emDelimiter: '*'
    });

    // Use GFM plugin for tables, strikethrough, etc.
    this.turndownService.use(gfm);

    // Custom rules for better conversion
    this.addCustomRules();
  }

  addCustomRules() {
    // Remove non-content UI elements (toolbars, copy buttons, in-artifact controls)
    // Keep selectors narrowly focused to avoid removing meaningful content
    // Turndown v7 の remove はセレクタを受けず hook 的に扱いにくいため、常に稼働する削除ルールで対応
    this.turndownService.addRule('removeArtifactUI', {
      filter: function (node) {
        if (!node || node.nodeType !== 1) return false;
        const el = node;
        const className = (el.className || '').toString();
        const testId = (el.getAttribute && (el.getAttribute('data-testid') || el.getAttribute('data-qa'))) || '';
        const aria = (el.getAttribute && el.getAttribute('aria-label')) || '';
        const tooltip = (el.getAttribute && (el.getAttribute('data-tooltip') || el.getAttribute('data-mdc-tooltip'))) || '';
        const role = (el.getAttribute && el.getAttribute('role')) || '';
        const textLike = (el.textContent || '').toString();
        const isCopyLike = /copy|コピー|download|ダウンロード|toolbar|thumb|評価|フィードバック|feedback|share|共有|insert|挿入/i
          .test([className, testId, aria, tooltip, textLike].join(' '));
        const isButton = el.tagName === 'BUTTON' || role.toLowerCase() === 'button';
        const isSaveBtn = className.includes('chatvault-save-btn');
        return Boolean(isSaveBtn || (isCopyLike && (isButton || aria || tooltip)));
      },
      replacement: function () { return ''; }
    });
    // Preserve code blocks with language (supports data-language and class="language-xxx")
    this.turndownService.addRule('codeBlock', {
      filter: function (node) {
        return node.nodeName === 'PRE';
      },
      replacement: function (content, node) {
        const pre = node;
        const codeElement = pre.querySelector('code') || pre;
        const fromDataAttr = pre.getAttribute('data-language') || codeElement.getAttribute('data-language') || '';
        const classNames = (codeElement.getAttribute('class') || '') + ' ' + (pre.getAttribute('class') || '');
        const classMatch = classNames.match(/language-([\w#+-]+)/i);
        const language = (fromDataAttr || (classMatch && classMatch[1]) || '').toString();
        const code = (codeElement.textContent || '').toString();
        return '\n```' + language + '\n' + code + '\n```\n';
      }
    });

    // Handle inline code
    this.turndownService.addRule('inlineCode', {
      filter: function (node) {
        return node.nodeName === 'CODE' && node.parentNode && node.parentNode.nodeName !== 'PRE';
      },
      replacement: function (content) {
        return '`' + content + '`';
      }
    });

    // Preserve math expressions
    this.turndownService.addRule('mathExpression', {
      filter: function (node) {
        return node.classList && (
          node.classList.contains('math-inline') || 
          node.classList.contains('math-block') ||
          node.classList.contains('katex')
        );
      },
      replacement: function (content, node) {
        // Math content should already be wrapped in $ or $$
        return content;
      }
    });

    // Handle ChatGPT/Claude specific formatting
    this.turndownService.addRule('messageFormatting', {
      filter: function (node) {
        return node.classList && node.classList.contains('whitespace-pre-wrap');
      },
      replacement: function (content) {
        // Preserve whitespace in pre-wrapped content
        return content;
      }
    });
  }

  /**
   * Convert HTML to Markdown
   * @param {string} html - HTML content to convert
   * @returns {string} Markdown content
   */
  convert(html) {
    return this.turndownService.turndown(html);
  }

  /**
   * Convert messages array to formatted Markdown
   * @param {Array} messages - Array of message objects
   * @param {Object} options - Formatting options
   * @returns {string} Formatted Markdown content
   */
  messagesToMarkdown(messages, options = {}) {
    const {
      includeTimestamp = false,
      speakerLabels = { user: 'User', assistant: 'Assistant' },
      separator = '\n\n---\n\n'
    } = options;

    return messages.map(message => {
      const speaker = speakerLabels[message.role] || message.role;
      const header = `### ${speaker}`;
      const timestamp = includeTimestamp ? `\n*${new Date(message.timestamp).toLocaleString()}*\n` : '';
      const content = this.convert(message.content);
      
      return header + timestamp + '\n\n' + content;
    }).join(separator);
  }

  /**
   * Create a complete Obsidian note from messages
   * @param {Object} data - Note data including messages, metadata, etc.
   * @returns {string} Complete Markdown note
   */
  createObsidianNote(data) {
    const {
      title,
      url,
      messages,
      service,
      template = '{url}\n\n{content}',
      includeMetadata = true
    } = data;

    const date = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const content = this.messagesToMarkdown(messages);
    
    // Build frontmatter if metadata is included
    let frontmatter = '';
    if (includeMetadata) {
      frontmatter = `---
title: ${title}
date: ${date}
service: ${service}
url: ${url}
---\n\n`;
    }

    // Replace template variables
    let note = template
      .replace('{url}', url)
      .replace('{title}', title)
      .replace('{content}', content)
      .replace('{date}', date)
      .replace('{service}', service);

    // Add frontmatter if not using custom template
    if (template === '{url}\n\n{content}' && includeMetadata) {
      note = frontmatter + note;
    }

    return note;
  }
}

export default MarkdownConverter;

// CommonJS compatibility for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkdownConverter;
  module.exports.default = MarkdownConverter;
}
