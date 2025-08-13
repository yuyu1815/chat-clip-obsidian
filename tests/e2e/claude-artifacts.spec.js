const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Claude Artifacts E2E（モック）', () => {
  test('Artifact に保存ボタンが注入され、クリックで所定のpayloadを送信する', async ({ page }) => {
    const html = `<!DOCTYPE html>
      <html>
        <head><title>Claude Chat</title></head>
        <body>
          <main>
            <div data-is-streaming="false" class="group relative">
              <div class="font-claude-message">
                <div class="prose"><p>アシスタントの回答です。</p></div>
              </div>
            </div>

            <section data-testid="artifact" id="artifact-1">
              <h2 data-testid="artifact-title">hello.js</h2>
              <div data-testid="artifact-content" class="prose">
                <pre><code class="language-javascript">console.log('hi');</code></pre>
              </div>
            </section>
          </main>
        </body>
      </html>`;

    await page.route('**/*', route => {
      route.fulfill({ status: 200, contentType: 'text/html', body: html });
    });

    await page.addInitScript(() => {
      window.__sentMessages = [];
      window.chrome = {
        runtime: {
          sendMessage: (payload, cb) => {
            try { window.__sentMessages.push(payload); } catch (_) {}
            if (typeof cb === 'function') {
              cb({ success: true, method: 'uri', filename: 'artifact_test.md', message: 'OK' });
            }
          },
          lastError: null,
          onMessage: { addListener: () => {} }
        }
      };
    });

    await page.goto('https://claude.ai/chat/e2e');
    await page.addScriptTag({ path: path.join(__dirname, '../../dist-chromium/contentScript.js') });

    const artifactScope = page.locator('[data-testid="artifact"]');
    const saveButton = artifactScope.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    // 送信メッセージ検証
    const messages = await page.evaluate(() => window.__sentMessages || []);
    expect(messages.length).toBeGreaterThan(0);
    const last = messages[messages.length - 1];
    expect(last.action).toBe('saveSingleMessage');
    expect(last.messageType).toBe('artifact');
    expect(last.service).toBe('claude');
    expect(last.messageContent).toContain('### Artifact: hello.js');
    expect(last.messageContent).toContain('```javascript');
    expect(last.metadata?.type).toBe('artifact');
  });
});


