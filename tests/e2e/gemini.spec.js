const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Gemini E2E（モック）', () => {
  test('保存ボタン注入とクリックで chrome.runtime.sendMessage が呼ばれる', async ({ page }) => {
    const html = `<!DOCTYPE html>
      <html>
        <head><title>Gemini - Test</title></head>
        <body>
          <main>
            <article data-message-id="1" data-author="user">
              <div data-message-content><p>こんにちは</p></div>
            </article>
            <article data-message-id="2" data-author="assistant">
              <div data-message-content>
                <pre><code class="language-python">print('ok')</code></pre>
              </div>
            </article>
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
            if (typeof cb === 'function') cb({ success: true, method: 'uri', filename: 'gemini_test.md' });
          },
          lastError: null,
          onMessage: { addListener: () => {} }
        }
      };
    });

    await page.goto('https://gemini.google.com/app');
    await page.addScriptTag({ path: path.join(__dirname, '../../dist-chromium/contentScript.js') });

    // 最後のメッセージ（assistant）にボタンが付与される想定
    const lastMessage = page.locator('article').last();
    const btn = lastMessage.getByRole('button', { name: /save/i });
    await expect(btn).toBeVisible({ timeout: 5000 });
    await btn.click();

    // 送信メッセージ検証
    const messages = await page.evaluate(() => window.__sentMessages || []);
    expect(messages.length).toBeGreaterThan(0);
    const last = messages[messages.length - 1];
    expect(last.action).toBe('saveSingleMessage');
    expect(last.messageType).toBe('single');
    expect(last.service).toBe('gemini');
    expect(last.messageContent).toMatch(/```python[\s\S]*print\('ok'\)/);
  });
});


