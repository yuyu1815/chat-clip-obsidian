// HTML -> Markdown conversion utility using Turndown
// Keep the implementation minimal but robust for Chat UI content
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

  // Preserve inline code spans more reliably
  td.addRule('inlineCode', {
    filter: (node) => node.nodeName === 'CODE' && node.parentNode && node.parentNode.nodeName !== 'PRE',
    replacement: (content) => '`' + content.replace(/`/g, '\u200b`') + '`'
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
    return html.replace(/<br\s*\/?>/gi, '\n')
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

/**
 * Generate markdown content with metadata for AI news extraction feature
 * @param {Object} messageData - Message data from API
 * @param {Object} specialContent - Special content extracted from HTML
 * @param {Object} extractionMetadata - Extraction metadata
 * @returns {string} - Formatted markdown with frontmatter
 */
export function generateNewsExtractionMarkdown(messageData, specialContent, extractionMetadata) {
  try {
    const now = new Date().toISOString();
    const renderCount = extractionMetadata.render_count || 'unknown';
    
    // Generate frontmatter metadata
    const frontmatter = [
      '---',
      'source: claude.ai',
      `extracted_at: ${now}`,
      `render_count: ${renderCount}`,
      `message_index: ${extractionMetadata.message_index || 0}`,
      `extraction_type: ${extractionMetadata.extraction_type || 'full_message'}`,
      `conversation_title: "${messageData.title || 'Claude Chat'}"`,
    ];
    
    // Add special content flags
    if (specialContent) {
      if (specialContent.codeBlocks && specialContent.codeBlocks.length > 0) {
        frontmatter.push('has_code_blocks: true');
      }
      if (specialContent.artifacts && specialContent.artifacts.length > 0) {
        frontmatter.push('has_artifacts: true');
      }
      if (specialContent.thinking) {
        frontmatter.push('has_thinking: true');
      }
      
      const elementsExtracted = [];
      if (specialContent.text) elementsExtracted.push('text_content');
      if (specialContent.codeBlocks.length > 0) elementsExtracted.push('code_blocks');
      if (specialContent.buttons.length > 0) elementsExtracted.push('save_buttons');
      if (specialContent.artifacts.length > 0) elementsExtracted.push('artifact_previews');
      
      if (elementsExtracted.length > 0) {
        frontmatter.push('elements_extracted:');
        elementsExtracted.forEach(element => {
          frontmatter.push(`  - ${element}`);
        });
      }
    }
    
    frontmatter.push('---');
    
    // Generate main content
    const contentSections = [];
    
    // Title
    contentSections.push(`# Claude Chat - ${messageData.title || 'Extracted Content'}`);
    contentSections.push('');
    
    // User/Assistant distinction
    if (messageData.role === 'user') {
      contentSections.push('## ユーザー');
    } else {
      contentSections.push('## アシスタント');
    }
    
    // Main text content
    const mainContent = toMarkdownIfHtml(messageData.content);
    if (mainContent) {
      contentSections.push(mainContent);
      contentSections.push('');
    }
    
    // Special content sections
    if (specialContent) {
      // Code blocks
      if (specialContent.codeBlocks && specialContent.codeBlocks.length > 0) {
        specialContent.codeBlocks.forEach((codeBlock, index) => {
          if (codeBlock.content) {
            contentSections.push(`\`\`\`${codeBlock.language || 'text'}`);
            contentSections.push(codeBlock.content);
            contentSections.push('```');
            contentSections.push('');
          }
        });
      }
      
      // Artifacts
      if (specialContent.artifacts && specialContent.artifacts.length > 0) {
        contentSections.push('### アーティファクト');
        specialContent.artifacts.forEach((artifact, index) => {
          if (artifact.title) {
            contentSections.push(`#### ${artifact.title}`);
          }
          if (artifact.content) {
            contentSections.push(toMarkdownIfHtml(artifact.content));
            contentSections.push('');
          }
        });
      }
      
      // Thinking content (if present)
      if (specialContent.thinking) {
        contentSections.push('### 思考プロセス');
        contentSections.push(toMarkdownIfHtml(specialContent.thinking));
        contentSections.push('');
      }
    }
    
    // Combine frontmatter and content
    return [
      ...frontmatter,
      '',
      ...contentSections
    ].join('\n');
    
  } catch (error) {
    console.error('News extraction markdown generation failed:', error);
    // Fallback to simple format
    const title = messageData?.title || 'Extracted Content';
    const content = messageData?.content || '';
    return `# Claude Chat - ${title}\n\n${toMarkdownIfHtml(content)}`;
  }
}
