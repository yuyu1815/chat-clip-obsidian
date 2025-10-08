/**
 * Claude AI News Extractor Tests
 * Tests for AI news extraction functionality from Claude chat messages
 */

// Mock dependencies
global.chrome = {
  runtime: {
    sendMessage: jest.fn()
  }
};

// Mock logger
jest.mock('../utils/logger.js', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  })
}));

// Mock turndown
jest.mock('turndown', () => {
  return jest.fn().mockImplementation(() => ({
    use: jest.fn(),
    addRule: jest.fn(),
    turndown: jest.fn((html) => html.replace(/<[^>]+>/g, ''))
  }));
});

jest.mock('turndown-plugin-gfm', () => ({
  gfm: {}
}));

// Import functions to test
import {
  collectMessageElementsByRenderCount,
  detectMessageType,
  calculateApiIndexFromRenderCount,
  extractSpecialContent
} from '../contentScripts/js/providers/claude/api.js';

import { generateNewsExtractionMarkdown } from '../utils/markdown.js';

// DOM Setup
beforeEach(() => {
  document.body.innerHTML = '';
  // Mock console methods to avoid noise in tests
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
  jest.restoreAllMocks();
});

describe('Claude AI News Extractor', () => {
  
  describe('collectMessageElementsByRenderCount', () => {
    test('should collect elements with matching render count', () => {
      // Setup DOM
      document.body.innerHTML = `
        <div data-test-render-count="34">Message 1</div>
        <div data-test-render-count="35">Message 2</div>
        <div data-test-render-count="34">Message 1 continued</div>
      `;
      
      const elements = collectMessageElementsByRenderCount('34');
      expect(elements).toHaveLength(2);
      expect(elements[0].textContent).toBe('Message 1');
      expect(elements[1].textContent).toBe('Message 1 continued');
    });

    test('should return empty NodeList for non-existent render count', () => {
      document.body.innerHTML = `
        <div data-test-render-count="34">Message 1</div>
      `;
      
      const elements = collectMessageElementsByRenderCount('99');
      expect(elements).toHaveLength(0);
    });
  });

  describe('detectMessageType', () => {
    test('should detect user message type', () => {
      const mockElements = [
        {
          querySelector: jest.fn()
        }
      ];
      
      // First call should find user-message, second call should return null
      mockElements[0].querySelector
        .mockReturnValueOnce({ textContent: 'user message' })
        .mockReturnValueOnce(null);
      
      const messageType = detectMessageType(mockElements);
      expect(messageType).toBe('user');
      expect(mockElements[0].querySelector).toHaveBeenCalledWith('[data-testid="user-message"]');
    });

    test('should detect assistant message type', () => {
      const mockElements = [
        {
          querySelector: jest.fn()
            .mockReturnValueOnce(null) // no user-message
            .mockReturnValueOnce({ textContent: 'assistant response' }) // claude-response found
        }
      ];
      
      const messageType = detectMessageType(mockElements);
      expect(messageType).toBe('assistant');
      expect(mockElements[0].querySelector).toHaveBeenCalledWith('.font-claude-response');
    });

    test('should return unknown for unidentifiable message type', () => {
      const mockElements = [
        {
          querySelector: jest.fn().mockReturnValue(null) // no matching selectors
        }
      ];
      
      const messageType = detectMessageType(mockElements);
      expect(messageType).toBe('unknown');
    });
  });

  describe('calculateApiIndexFromRenderCount', () => {
    test('should calculate API index from render count', () => {
      // Setup DOM with multiple render counts
      document.body.innerHTML = `
        <div data-test-render-count="10">Message 1</div>
        <div data-test-render-count="20">Message 2</div>
        <div data-test-render-count="34">Message 3</div>
      `;
      
      const apiIndex = calculateApiIndexFromRenderCount('34', 'user');
      expect(apiIndex).toBe(2); // Should be the 3rd element (index 2)
    });

    test('should return 0 for first render count', () => {
      document.body.innerHTML = `
        <div data-test-render-count="34">Message 1</div>
      `;
      
      const apiIndex = calculateApiIndexFromRenderCount('34', 'user');
      expect(apiIndex).toBe(0);
    });

    test('should handle missing render count gracefully', () => {
      document.body.innerHTML = `
        <div data-test-render-count="10">Message 1</div>
      `;
      
      const apiIndex = calculateApiIndexFromRenderCount('99', 'user');
      expect(apiIndex).toBe(0); // Should fallback to 0
    });
  });

  describe('extractSpecialContent', () => {
    test('should extract text content', () => {
      const mockElement = document.createElement('div');
      mockElement.innerHTML = `
        <p>This is a test message</p>
        <div class="whitespace-pre-wrap">Additional text content</div>
      `;
      
      const specialContent = extractSpecialContent(mockElement);
      expect(specialContent.text).toContain('This is a test message');
      expect(specialContent.text).toContain('Additional text content');
    });

    test('should extract code blocks', () => {
      const mockElement = document.createElement('div');
      mockElement.innerHTML = `
        <pre><code class="language-javascript">console.log('test');</code></pre>
        <div class="code-block__code">const x = 1;</div>
      `;
      
      const specialContent = extractSpecialContent(mockElement);
      expect(specialContent.codeBlocks).toHaveLength(2);
      expect(specialContent.codeBlocks[0].content).toBe("console.log('test');");
      expect(specialContent.codeBlocks[0].language).toBe('javascript');
    });

    test('should extract artifacts', () => {
      const mockElement = document.createElement('div');
      mockElement.innerHTML = `
        <div class="artifact-block-cell">
          <div class="leading-tight">Test Artifact</div>
          <div>Artifact content here</div>
        </div>
      `;
      
      const specialContent = extractSpecialContent(mockElement);
      expect(specialContent.artifacts).toHaveLength(1);
      expect(specialContent.artifacts[0].title).toBe('Test Artifact');
      expect(specialContent.artifacts[0].type).toBe('artifact');
    });

    test('should extract save buttons', () => {
      const mockElement = document.createElement('div');
      mockElement.innerHTML = `
        <button class="chatvault-save-btn" aria-label="Save to Obsidian">Save</button>
        <button class="chatvault-save-btn" aria-label="Save Message">Save</button>
      `;
      
      const specialContent = extractSpecialContent(mockElement);
      expect(specialContent.buttons).toHaveLength(2);
      expect(specialContent.buttons[0].type).toBe('save');
      expect(specialContent.buttons[0].label).toBe('Save to Obsidian');
    });

    test('should handle extraction errors gracefully', () => {
      const mockElement = {
        querySelectorAll: jest.fn().mockImplementation(() => {
          throw new Error('DOM error');
        })
      };
      
      const specialContent = extractSpecialContent(mockElement);
      expect(specialContent.text).toBe('');
      expect(specialContent.codeBlocks).toEqual([]);
      expect(specialContent.artifacts).toEqual([]);
      expect(specialContent.buttons).toEqual([]);
    });
  });

  describe('generateNewsExtractionMarkdown', () => {
    test('should generate basic markdown with metadata', () => {
      const messageData = {
        title: 'Test Chat',
        content: 'This is a test message',
        role: 'user'
      };
      
      const specialContent = {
        text: 'Test text',
        codeBlocks: [],
        artifacts: [],
        buttons: []
      };
      
      const extractionMetadata = {
        render_count: '34',
        extraction_type: 'full_message',
        message_index: 0
      };
      
      const markdown = generateNewsExtractionMarkdown(messageData, specialContent, extractionMetadata);
      
      expect(markdown).toContain('---'); // frontmatter
      expect(markdown).toContain('source: claude.ai');
      expect(markdown).toContain('render_count: 34');
      expect(markdown).toContain('extraction_type: full_message');
      expect(markdown).toContain('# Claude Chat - Test Chat');
      expect(markdown).toContain('## ユーザー');
      expect(markdown).toContain('This is a test message');
    });

    test('should include special content flags in frontmatter', () => {
      const messageData = {
        title: 'Test Chat',
        content: 'Test message',
        role: 'assistant'
      };
      
      const specialContent = {
        text: 'Test text',
        codeBlocks: [{ language: 'javascript', content: 'console.log("test");' }],
        artifacts: [{ title: 'Test Artifact', content: 'Artifact content' }],
        thinking: 'Thinking process',
        buttons: []
      };
      
      const extractionMetadata = {
        render_count: '34',
        extraction_type: 'full_message'
      };
      
      const markdown = generateNewsExtractionMarkdown(messageData, specialContent, extractionMetadata);
      
      expect(markdown).toContain('has_code_blocks: true');
      expect(markdown).toContain('has_artifacts: true');
      expect(markdown).toContain('has_thinking: true');
      expect(markdown).toContain('elements_extracted:');
      expect(markdown).toContain('- text_content');
      expect(markdown).toContain('- code_blocks');
      expect(markdown).toContain('## アシスタント');
    });

    test('should handle code blocks in markdown', () => {
      const messageData = {
        title: 'Code Example',
        content: 'Here is some code:',
        role: 'assistant'
      };
      
      const specialContent = {
        text: 'Code example',
        codeBlocks: [
          { language: 'javascript', content: 'console.log("Hello World");' },
          { language: 'python', content: 'print("Hello World")' }
        ],
        artifacts: [],
        buttons: []
      };
      
      const extractionMetadata = {
        render_count: '34',
        extraction_type: 'full_message'
      };
      
      const markdown = generateNewsExtractionMarkdown(messageData, specialContent, extractionMetadata);
      
      expect(markdown).toContain('```javascript');
      expect(markdown).toContain('console.log("Hello World");');
      expect(markdown).toContain('```python');
      expect(markdown).toContain('print("Hello World")');
    });

    test('should handle artifacts in markdown', () => {
      const messageData = {
        title: 'Artifact Example',
        content: 'Here is an artifact:',
        role: 'assistant'
      };
      
      const specialContent = {
        text: 'Artifact example',
        codeBlocks: [],
        artifacts: [
          { title: 'Test Document', content: 'Document content here' }
        ],
        buttons: []
      };
      
      const extractionMetadata = {
        render_count: '34',
        extraction_type: 'full_message'
      };
      
      const markdown = generateNewsExtractionMarkdown(messageData, specialContent, extractionMetadata);
      
      expect(markdown).toContain('### アーティファクト');
      expect(markdown).toContain('#### Test Document');
      expect(markdown).toContain('Document content here');
    });

    test('should handle generation errors gracefully', () => {
      const messageData = { title: null, content: null }; // This might cause issues
      const specialContent = {};
      const extractionMetadata = {};
      
      const markdown = generateNewsExtractionMarkdown(messageData, specialContent, extractionMetadata);
      
      expect(markdown).toContain('# Claude Chat - Extracted Content');
      expect(typeof markdown).toBe('string');
    });
  });
});