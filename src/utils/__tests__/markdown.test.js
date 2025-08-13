/**
 * MarkdownConverter のテスト
 * HTML→Markdown変換とメッセージ処理のテスト
 */

const MarkdownConverter = require('../markdown.js').default;

describe('MarkdownConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new MarkdownConverter();
  });

  describe('基本的なHTML→Markdown変換', () => {
    test('シンプルなテキストが正しく変換される', () => {
      const html = '<p>Hello World</p>';
      const result = converter.convert(html);
      expect(result).toBe('Hello World');
    });

    test('強調テキストが正しく変換される', () => {
      const html = '<p><strong>太字</strong>と<em>斜体</em></p>';
      const result = converter.convert(html);
      expect(result).toBe('**太字**と*斜体*');
    });

    test('リストが正しく変換される', () => {
      const html = '<ul><li>項目1</li><li>項目2</li></ul>';
      const result = converter.convert(html);
      expect(result).toContain('項目1');
      expect(result).toContain('項目2');
      expect(result).toMatch(/-\s+項目1/);
      expect(result).toMatch(/-\s+項目2/);
    });
  });

  describe('コードブロックの変換', () => {
    test('言語指定ありのコードブロック', () => {
      const html = '<pre data-language="javascript"><code>console.log("hello");</code></pre>';
      const result = converter.convert(html);
      expect(result).toContain('```javascript');
      expect(result).toContain('console.log("hello");');
      expect(result).toContain('```');
    });

    test('言語指定なしのコードブロック', () => {
      const html = '<pre><code>echo "hello"</code></pre>';
      const result = converter.convert(html);
      expect(result).toContain('```');
      expect(result).toContain('echo "hello"');
    });

    test('インラインコード', () => {
      const html = '<p>コマンド <code>npm test</code> を実行</p>';
      const result = converter.convert(html);
      expect(result).toBe('コマンド `npm test` を実行');
    });
  });

describe('Claude/Gemini 追加ルールの回帰', () => {
  test('コピー/ツールバー等のUIが取り除かれる', () => {
    const html = `
      <div>
        <button aria-label="copy">copy</button>
        <div data-testid="artifact-content"><p>本文</p></div>
      </div>
    `;
    const result = converter.convert(html);
    expect(result).toContain('本文');
    expect(result).not.toMatch(/copy|コピー|toolbar/i);
  });

  test('コードブロックの言語が data-language/class から保持される', () => {
    const html = '<pre class="language-ts"><code>const a: number = 1;</code></pre>';
    const result = converter.convert(html);
    expect(result).toContain('```ts');
    expect(result).toContain('const a: number = 1;');
  });
});

  describe('数式の変換', () => {
    test('KaTeX数式が保持される', () => {
      const html = '<span class="katex">$x^2 + y^2 = z^2$</span>';
      const result = converter.convert(html);
      expect(result).toContain('$x^2 + y^2 = z^2$');
    });
  });

  describe('メッセージの変換', () => {
    test('単一メッセージの変換', () => {
      const messages = [
        {
          role: 'user',
          content: '<p>こんにちは</p>',
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      ];

      const result = converter.messagesToMarkdown(messages);
      expect(result).toContain('### User');
      expect(result).toContain('こんにちは');
    });

    test('複数メッセージの変換', () => {
      const messages = [
        {
          role: 'user',
          content: '<p>質問です</p>',
          timestamp: '2024-01-01T00:00:00.000Z'
        },
        {
          role: 'assistant',
          content: '<p>回答です</p>',
          timestamp: '2024-01-01T00:01:00.000Z'
        }
      ];

      const result = converter.messagesToMarkdown(messages);
      expect(result).toContain('### User');
      expect(result).toContain('### Assistant');
      expect(result).toContain('質問です');
      expect(result).toContain('回答です');
      expect(result).toContain('---'); // セパレータ
    });

    test('カスタムスピーカーラベル', () => {
      const messages = [
        {
          role: 'user',
          content: '<p>テスト</p>',
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      ];

      const options = {
        speakerLabels: { user: 'ユーザー', assistant: 'AI' }
      };

      const result = converter.messagesToMarkdown(messages, options);
      expect(result).toContain('### ユーザー');
    });
  });

  describe('Obsidianノート作成', () => {
    test('基本的なノート作成', () => {
      const data = {
        title: 'テスト会話',
        url: 'https://chatgpt.com/test',
        service: 'ChatGPT',
        messages: [
          {
            role: 'user',
            content: '<p>こんにちは</p>',
            timestamp: '2024-01-01T00:00:00.000Z'
          }
        ]
      };

      const result = converter.createObsidianNote(data);
      
      expect(result).toContain('title: テスト会話');
      expect(result).toContain('service: ChatGPT');
      expect(result).toContain('url: https://chatgpt.com/test');
      expect(result).toContain('### User');
      expect(result).toContain('こんにちは');
    });

    test('メタデータなしのノート作成', () => {
      const data = {
        title: 'テスト会話',
        url: 'https://chatgpt.com/test',
        service: 'ChatGPT',
        messages: [
          {
            role: 'user',
            content: '<p>こんにちは</p>',
            timestamp: '2024-01-01T00:00:00.000Z'
          }
        ],
        includeMetadata: false
      };

      const result = converter.createObsidianNote(data);
      
      expect(result).not.toContain('---');
      expect(result).not.toContain('title:');
      expect(result).toContain('https://chatgpt.com/test');
      expect(result).toContain('### User');
    });

    test('カスタムテンプレート', () => {
      const data = {
        title: 'テスト会話',
        url: 'https://chatgpt.com/test',
        service: 'ChatGPT',
        messages: [
          {
            role: 'user',
            content: '<p>こんにちは</p>',
            timestamp: '2024-01-01T00:00:00.000Z'
          }
        ],
        template: '# {title}\n\n{content}\n\n出典: {url}'
      };

      const result = converter.createObsidianNote(data);
      
      expect(result).toContain('# テスト会話');
      expect(result).toContain('出典: https://chatgpt.com/test');
      expect(result).toContain('### User');
    });
  });
}); 