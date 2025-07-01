/**
 * アクセシビリティE2Eテスト
 * Axe-coreを使用してアクセシビリティ違反をチェック
 */

const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;

test.describe('アクセシビリティチェック', () => {
  test.beforeEach(async ({ page }) => {
    // テスト用のローカルHTML ページに移動
    await page.goto('data:text/html,<!DOCTYPE html><html><head><title>Test</title></head><body><div id="root"></div></body></html>');
  });

  test('ChatModeSelectorコンポーネントのアクセシビリティ', async ({ page }) => {
    // ChatModeSelectorコンポーネントを動的に挿入してテスト
    await page.addScriptTag({
      content: `
        // React と ChatModeSelector の簡単なモック
        const mockComponent = document.createElement('div');
        mockComponent.innerHTML = \`
          <div class="space-y-4">
            <h3 id="save-mode-heading" class="text-lg font-semibold text-white mb-3">Save Mode</h3>
            <div 
              class="grid grid-cols-2 gap-3"
              role="radiogroup"
              aria-labelledby="save-mode-heading"
              aria-describedby="save-mode-description"
            >
              <button
                role="radio"
                aria-checked="true"
                aria-describedby="single-description"
                tabindex="0"
                class="relative p-4 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-blue-500 bg-blue-500/20 text-white"
              >
                <div class="flex flex-col items-center space-y-2">
                  <div aria-hidden="true">📝</div>
                  <div class="text-sm font-medium">Single Message</div>
                  <div id="single-description" class="text-xs text-gray-400 text-center">
                    Save the current message
                  </div>
                </div>
              </button>
              
              <button
                role="radio"
                aria-checked="false"
                aria-describedby="selection-description"
                tabindex="-1"
                class="relative p-4 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-600 bg-gray-800 text-gray-300"
              >
                <div class="flex flex-col items-center space-y-2">
                  <div aria-hidden="true">📄</div>
                  <div class="text-sm font-medium">Selected Text</div>
                  <div id="selection-description" class="text-xs text-gray-400 text-center">
                    Save highlighted text only
                  </div>
                </div>
              </button>
            </div>
            
            <div id="save-mode-description" class="mt-4 p-3 bg-gray-800/50 rounded-lg">
              <div class="flex items-start space-x-2">
                <div aria-hidden="true">ℹ️</div>
                <div class="text-xs text-gray-400">
                  <p class="font-medium text-gray-300">Quick tip:</p>
                  <p>Use "Single Message" for important responses.</p>
                </div>
              </div>
            </div>
          </div>
        \`;
        document.getElementById('root').appendChild(mockComponent);
      `
    });

    // アクセシビリティチェックを実行
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#root')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('フォーム要素のアクセシビリティ', async ({ page }) => {
    // Recent Messages モードの数値入力フィールドをテスト
    await page.addScriptTag({
      content: `
        const formComponent = document.createElement('div');
        formComponent.innerHTML = \`
          <div class="mt-4 p-4 bg-gray-800 rounded-lg">
            <label 
              for="message-count-input" 
              class="block text-sm font-medium text-gray-300 mb-2"
            >
              Number of messages to save
            </label>
            <div class="flex items-center space-x-3">
              <input
                id="message-count-input"
                type="number"
                min="1"
                max="100"
                value="30"
                aria-describedby="count-help"
                aria-invalid="false"
                class="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span id="count-help" class="text-gray-400 text-sm" aria-live="polite">messages</span>
            </div>
          </div>
        \`;
        document.getElementById('root').innerHTML = '';
        document.getElementById('root').appendChild(formComponent);
      `
    });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#root')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('エラー状態のアクセシビリティ', async ({ page }) => {
    // エラー状態のフォームをテスト
    await page.addScriptTag({
      content: `
        const errorComponent = document.createElement('div');
        errorComponent.innerHTML = \`
          <div class="mt-4 p-4 bg-gray-800 rounded-lg">
            <label 
              for="message-count-input-error" 
              class="block text-sm font-medium text-gray-300 mb-2"
            >
              Number of messages to save
            </label>
            <div class="flex items-center space-x-3">
              <input
                id="message-count-input-error"
                type="number"
                min="1"
                max="100"
                value="0"
                aria-describedby="count-error"
                aria-invalid="true"
                class="flex-1 px-3 py-2 bg-gray-700 border border-red-500 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span class="text-gray-400 text-sm">messages</span>
            </div>
            <p id="count-error" class="mt-1 text-xs text-red-400" role="alert">
              Please enter a number between 1 and 100
            </p>
          </div>
        \`;
        document.getElementById('root').innerHTML = '';
        document.getElementById('root').appendChild(errorComponent);
      `
    });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#root')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('キーボードナビゲーション', async ({ page }) => {
    // キーボードで操作可能な要素をテスト
    await page.addScriptTag({
      content: `
        const navComponent = document.createElement('div');
        navComponent.innerHTML = \`
          <div class="space-y-4">
            <button 
              class="p-2 bg-blue-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              tabindex="0"
            >
              保存ボタン
            </button>
            
            <button 
              aria-expanded="false"
              aria-controls="preview-content"
              aria-label="Expand preview"
              class="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              tabindex="0"
            >
              プレビュー展開
            </button>
            
            <div 
              id="preview-content"
              role="region"
              aria-labelledby="preview-heading"
              class="p-4 bg-gray-800"
            >
              <h4 id="preview-heading">プレビュー内容</h4>
              <p>ここにマークダウンプレビューが表示されます</p>
            </div>
          </div>
        \`;
        document.getElementById('root').innerHTML = '';
        document.getElementById('root').appendChild(navComponent);
      `
    });

    // キーボードフォーカスのテスト
    await page.keyboard.press('Tab');
    const focusedElement1 = await page.evaluate(() => document.activeElement.textContent);
    expect(focusedElement1).toBe('保存ボタン');

    await page.keyboard.press('Tab');
    const focusedElement2 = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
    expect(focusedElement2).toBe('Expand preview');

    // アクセシビリティチェック
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('#root')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
}); 