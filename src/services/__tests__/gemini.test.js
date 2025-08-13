/**
 * Gemini 抽出のユニットテスト（JSDOM）
 */

const GeminiService = require('../../services/gemini.js').default;

describe('GeminiService メッセージ抽出', () => {
  let service;

  beforeEach(() => {
    document.body.innerHTML = '';
    service = new GeminiService();
  });

  test('単一メッセージ（コード/数式含む）を抽出', () => {
    document.body.innerHTML = `
      <main>
        <article data-author="assistant">
          <div data-message-content>
            <button aria-label="copy">copy</button>
            <p>回答です。</p>
            <pre><code class="language-python">print(1)\n</code></pre>
            <span class="katex">x+y</span>
            <div class="katex-display">a=b</div>
          </div>
        </article>
      </main>
    `;
    const container = document.querySelector('article');
    const msg = service.extractSingleMessage(container);
    expect(msg).not.toBeNull();
    expect(msg.role).toBe('assistant');
    expect(msg.content).toContain('回答です。');
    expect(msg.content).toContain('```python');
    expect(msg.content).toContain('print(1)');
    expect(msg.content).toContain('```');
    expect(msg.content).toContain('$x+y$');
    expect(msg.content).toContain('$$');
  });

  test('全メッセージ抽出（複数）', () => {
    document.body.innerHTML = `
      <main>
        <article data-author="user"><div data-message-content><p>Q1</p></div></article>
        <article data-author="assistant"><div data-message-content><p>A1</p></div></article>
        <article data-author="user"><div data-message-content><p>Q2</p></div></article>
      </main>
    `;
    const all = service.extractAllMessages();
    expect(all.length).toBe(3);
    expect(all[0].role).toBe('user');
    expect(all[1].role).toBe('assistant');
  });
});


