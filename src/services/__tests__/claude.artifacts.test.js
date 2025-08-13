/**
 * Claude Artifacts 抽出のユニットテスト（JSDOM）
 */

const ClaudeService = require('../../services/claude.js').default;

describe('ClaudeService Artifacts 抽出', () => {
  let service;

  beforeEach(() => {
    document.body.innerHTML = '';
    service = new ClaudeService();
  });

  test('Artifact（コードブロックあり）を抽出できる（正常系）', async () => {
    document.body.innerHTML = `
      <div data-is-streaming="true" id="message">
        <section data-testid="artifact" class="artifact-container">
          <h2 data-testid="artifact-title">utils</h2>
          <div data-testid="artifact-content">
            <button aria-label="copy" class="toolbar">Copy</button>
            <pre><code class="language-javascript">console.log('ok');\n</code></pre>
          </div>
        </section>
      </div>
    `;

    const container = document.querySelector('[data-testid="artifact"]');
    const result = await service.extractArtifact(container);

    expect(result).not.toBeNull();
    expect(result.type).toBe('artifact');
    expect(result.title).toBe('utils');
    expect(result.content).toContain('```javascript');
    expect(result.content).toContain("console.log('ok');");
    expect(result.content.trim().endsWith('```')).toBe(true);
    // 言語・ファイル名推定
    expect(result.language).toBe('javascript');
    expect(result.filename).toBe('utils.js');
    // 余計なUI文言は含まない
    expect(result.content).not.toMatch(/Copy|コピー/i);
  });

  test('Artifact コンテナが無い場合は null を返す（異常系）', async () => {
    const div = document.createElement('div');
    const result = await service.extractArtifact(div);
    expect(result).toBeNull();
  });

  test('メッセージ内の複数 Artifact を抽出できる', async () => {
    document.body.innerHTML = `
      <div data-is-streaming id="message">
        <div data-testid="artifact">
          <h2 data-testid="artifact-title">a</h2>
          <div data-testid="artifact-content"><pre><code class="language-js">a=1;\n</code></pre></div>
        </div>
        <div data-testid="artifact">
          <h2 data-testid="artifact-title">b</h2>
          <div data-testid="artifact-content"><pre><code class="language-python">print('b')\n</code></pre></div>
        </div>
      </div>
    `;

    const message = document.getElementById('message');
    const artifacts = await service.extractArtifactsInMessage(message);
    expect(Array.isArray(artifacts)).toBe(true);
    expect(artifacts.length).toBe(2);
    expect(artifacts[0].title).toBe('a');
    expect(artifacts[0].content).toContain('```js');
    expect(artifacts[1].title).toBe('b');
    expect(artifacts[1].content).toContain('```python');
  });
});


