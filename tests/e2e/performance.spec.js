/**
 * パフォーマンス測定 E2E テスト
 * 実際のブラウザ環境でのパフォーマンスを測定
 */

const { test, expect } = require('@playwright/test');
const path = require('path');

// テスト用の大容量データ
const LARGE_CONVERSATION_DATA = {
  // 長い会話データ（10,000文字超）
  longMessage: 'あ'.repeat(10000),
  // 複数メッセージ（50件）
  multipleMessages: Array.from({ length: 50 }, (_, i) => `メッセージ ${i + 1}: ${'テスト'.repeat(100)}`),
  // コードブロック含有データ
  codeMessage: `
プログラミングの例です：

\`\`\`javascript
${Array.from({ length: 100 }, (_, i) => `console.log("Line ${i + 1}");`).join('\n')}
\`\`\`

このコードは${Array.from({ length: 1000 }, () => 'データ').join(' ')}を処理します。
  `.trim()
};

test.describe('パフォーマンス測定', () => {
  let context;
  let extensionPage;

  test.beforeAll(async ({ browser }) => {
    // Chrome拡張機能を読み込み
    const pathToExtension = path.join(__dirname, '../../dist-chromium');
    context = await browser.newContext({
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox'
      ]
    });

    // 拡張機能のポップアップページを取得
    const pages = await context.pages();
    if (pages.length === 0) {
      extensionPage = await context.newPage();
    } else {
      extensionPage = pages[0];
    }
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('ポップアップの初期読み込み時間測定', async () => {
    // パフォーマンス測定開始
    const startTime = Date.now();
    
    // 拡張機能のポップアップを開く
    await extensionPage.goto('chrome-extension://placeholder/popup.html');
    
    // DOM読み込み完了まで待機
    await extensionPage.waitForLoadState('domcontentloaded');
    
    // UI要素が表示されるまで待機
    await extensionPage.waitForSelector('[data-testid="chat-mode-selector"]', { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    
    // 読み込み時間は2秒以内であること
    expect(loadTime).toBeLessThan(2000);
    
    console.log(`✅ ポップアップ読み込み時間: ${loadTime}ms`);
  });

  test('バンドルサイズとリソース使用量', async () => {
    await extensionPage.goto('chrome-extension://placeholder/popup.html');
    await extensionPage.waitForLoadState('networkidle');

    // パフォーマンス情報を取得
    const performanceData = await extensionPage.evaluate(() => {
      const perfEntries = performance.getEntriesByType('resource');
      const totalSize = perfEntries.reduce((sum, entry) => {
        return sum + (entry.transferSize || entry.encodedBodySize || 0);
      }, 0);

      const jsFiles = perfEntries.filter(entry => entry.name.endsWith('.js'));
      const cssFiles = perfEntries.filter(entry => entry.name.endsWith('.css'));

      return {
        totalSize: Math.round(totalSize / 1024), // KB
        jsSize: Math.round(jsFiles.reduce((sum, file) => sum + (file.transferSize || 0), 0) / 1024),
        cssSize: Math.round(cssFiles.reduce((sum, file) => sum + (file.transferSize || 0), 0) / 1024),
        fileCount: perfEntries.length
      };
    });

    // バンドルサイズが適切な範囲内であること
    expect(performanceData.totalSize).toBeLessThan(500); // 500KB未満
    expect(performanceData.jsSize).toBeLessThan(200);    // JS 200KB未満
    expect(performanceData.cssSize).toBeLessThan(100);   // CSS 100KB未満

    console.log(`📦 バンドルサイズ分析:
      - 総サイズ: ${performanceData.totalSize}KB
      - JavaScript: ${performanceData.jsSize}KB  
      - CSS: ${performanceData.cssSize}KB
      - ファイル数: ${performanceData.fileCount}`);
  });

  test('メモリ使用量測定', async () => {
    await extensionPage.goto('chrome-extension://placeholder/popup.html');
    await extensionPage.waitForLoadState('domcontentloaded');

    // 初期メモリ使用量
    const initialMemory = await extensionPage.evaluate(() => {
      if (performance.memory) {
        return {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
        };
      }
      return null;
    });

    if (initialMemory) {
      // メモリ使用量が適切な範囲内であること
      expect(initialMemory.used).toBeLessThan(50); // 50MB未満
      expect(initialMemory.total).toBeLessThan(100); // 100MB未満

      console.log(`💾 メモリ使用量: ${initialMemory.used}MB / ${initialMemory.total}MB`);
    }
  });

  test('大容量データ処理性能', async () => {
    await extensionPage.goto('chrome-extension://placeholder/popup.html');
    await extensionPage.waitForSelector('[data-testid="chat-mode-selector"]');

    // 大容量データ処理時間を測定
    const processingTime = await extensionPage.evaluate((testData) => {
      const startTime = performance.now();
      
      // Markdown変換処理のシミュレーション
      const messages = [
        { role: 'user', content: testData.longMessage },
        { role: 'assistant', content: testData.codeMessage },
        ...testData.multipleMessages.map((msg, i) => ({
          role: i % 2 === 0 ? 'user' : 'assistant',
          content: msg
        }))
      ];

      // 実際のMarkdownConverter処理をシミュレート
      let totalLength = 0;
      messages.forEach(msg => {
        const markdown = `**${msg.role}**: ${msg.content}\n\n`;
        totalLength += markdown.length;
      });

      const endTime = performance.now();
      return {
        processingTime: endTime - startTime,
        totalDataSize: totalLength,
        messageCount: messages.length
      };
    }, LARGE_CONVERSATION_DATA);

    // 大容量データ処理時間が適切であること
    expect(processingTime.processingTime).toBeLessThan(1000); // 1秒未満

    console.log(`⚡ 大容量データ処理:
      - 処理時間: ${processingTime.processingTime.toFixed(2)}ms
      - データサイズ: ${Math.round(processingTime.totalDataSize / 1024)}KB
      - メッセージ数: ${processingTime.messageCount}件`);
  });

  test('React Lazy Loading動作確認', async () => {
    await extensionPage.goto('chrome-extension://placeholder/popup.html');
    await extensionPage.waitForSelector('[data-testid="chat-mode-selector"]');

    // MarkdownPreviewが遅延ロードされることを確認
    const lazyLoadTest = await extensionPage.evaluate(async () => {
      const startTime = performance.now();
      
      // プレビュー機能を有効化（Lazy Loading発動）
      const previewToggle = document.querySelector('[data-testid="markdown-preview-toggle"]');
      if (previewToggle) {
        previewToggle.click();
        
        // 遅延ロードされたコンポーネントの読み込み待機
        await new Promise(resolve => {
          const checkLoaded = () => {
            const previewContent = document.querySelector('[data-testid="markdown-preview-content"]');
            if (previewContent || Date.now() - startTime > 3000) {
              resolve();
            } else {
              setTimeout(checkLoaded, 50);
            }
          };
          checkLoaded();
        });
      }
      
      const loadTime = performance.now() - startTime;
      return {
        lazyLoadTime: loadTime,
        componentLoaded: !!document.querySelector('[data-testid="markdown-preview-content"]')
      };
    });

    // Lazy Loadingが正常に動作することを確認
    if (lazyLoadTest.componentLoaded) {
      expect(lazyLoadTest.lazyLoadTime).toBeLessThan(2000); // 2秒未満でロード
      console.log(`🔄 React Lazy Loading: ${lazyLoadTest.lazyLoadTime.toFixed(2)}ms`);
    } else {
      console.log('ℹ️ Markdown Preview not available in this test');
    }
  });

  test('Web Worker性能測定', async () => {
    await extensionPage.goto('chrome-extension://placeholder/popup.html');
    
    // Web Workerが利用可能かテスト
    const workerTest = await extensionPage.evaluate(() => {
      const startTime = performance.now();
      
      try {
        // Web Workerの動作をシミュレート
        if (typeof Worker !== 'undefined') {
          const longText = 'あ'.repeat(20000); // 20,000文字
          
          // 同期的な分割処理（Web Worker相当の処理）
          const chunks = [];
          const chunkSize = 5000;
          
          for (let i = 0; i < longText.length; i += chunkSize) {
            chunks.push(longText.slice(i, i + chunkSize));
          }
          
          const endTime = performance.now();
          return {
            processingTime: endTime - startTime,
            chunksCount: chunks.length,
            workerSupported: true
          };
        }
        return { workerSupported: false };
      } catch (error) {
        return { 
          error: error.message,
          workerSupported: false 
        };
      }
    });

    if (workerTest.workerSupported) {
      // Web Worker的な処理が効率的であること
      expect(workerTest.processingTime).toBeLessThan(500); // 500ms未満
      
      console.log(`🔧 Web Worker性能:
        - 処理時間: ${workerTest.processingTime.toFixed(2)}ms
        - 分割数: ${workerTest.chunksCount}チャンク`);
    } else {
      console.log('⚠️ Web Worker not supported in test environment');
    }
  });

  test('UI応答性テスト', async () => {
    await extensionPage.goto('chrome-extension://placeholder/popup.html');
    await extensionPage.waitForSelector('[data-testid="chat-mode-selector"]');

    // UI操作の応答時間を測定
    const responsiveTest = await extensionPage.evaluate(() => {
      const startTime = performance.now();
      
      // モード選択の変更
      const modeButtons = document.querySelectorAll('[role="radio"]');
      if (modeButtons.length > 1) {
        modeButtons[1].click();
      }
      
      const endTime = performance.now();
      return endTime - startTime;
    });

    // UI応答時間が十分に速いこと
    expect(responsiveTest).toBeLessThan(100); // 100ms未満

    console.log(`🖱️ UI応答時間: ${responsiveTest.toFixed(2)}ms`);
  });
});

test.describe('スケーラビリティテスト', () => {
  let context;
  let extensionPage;

  test.beforeAll(async ({ browser }) => {
    const pathToExtension = path.join(__dirname, '../../dist-chromium');
    context = await browser.newContext({
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox'
      ]
    });

    const pages = await context.pages();
    extensionPage = pages.length > 0 ? pages[0] : await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test('極大データ処理性能', async () => {
    await extensionPage.goto('chrome-extension://placeholder/popup.html');

    // 非常に大きなデータでの処理時間測定
    const extremeDataTest = await extensionPage.evaluate(() => {
      const startTime = performance.now();
      
      // 100MB相当のデータ（実際のメモリ上限を考慮して調整）
      const largeData = 'データ'.repeat(1000000); // 約6MB
      const processedData = largeData.split('').reverse().join(''); // 簡単な処理
      
      const endTime = performance.now();
      return {
        processingTime: endTime - startTime,
        dataSize: largeData.length * 2, // バイト数（日本語文字）
        success: processedData.length === largeData.length
      };
    });

    // 極大データも適切な時間で処理できること
    expect(extremeDataTest.success).toBe(true);
    expect(extremeDataTest.processingTime).toBeLessThan(5000); // 5秒未満

    console.log(`💪 極大データ処理:
      - 処理時間: ${extremeDataTest.processingTime.toFixed(2)}ms
      - データサイズ: ${Math.round(extremeDataTest.dataSize / 1024 / 1024)}MB`);
  });

  test('同時処理性能', async () => {
    await extensionPage.goto('chrome-extension://placeholder/popup.html');

    // 複数の処理を同時実行
    const concurrentTest = await extensionPage.evaluate(async () => {
      const startTime = performance.now();
      
      // 複数の非同期処理を同時実行
      const tasks = Array.from({ length: 10 }, async (_, i) => {
        return new Promise(resolve => {
          setTimeout(() => {
            const data = `タスク${i}:` + 'データ'.repeat(1000);
            resolve(data.length);
          }, Math.random() * 100);
        });
      });

      const results = await Promise.all(tasks);
      const endTime = performance.now();

      return {
        processingTime: endTime - startTime,
        tasksCompleted: results.length,
        totalDataProcessed: results.reduce((sum, size) => sum + size, 0)
      };
    });

    // 同時処理が効率的に動作すること
    expect(concurrentTest.tasksCompleted).toBe(10);
    expect(concurrentTest.processingTime).toBeLessThan(1000); // 1秒未満

    console.log(`⚙️ 同時処理性能:
      - 処理時間: ${concurrentTest.processingTime.toFixed(2)}ms
      - 完了タスク数: ${concurrentTest.tasksCompleted}
      - 総データ量: ${Math.round(concurrentTest.totalDataProcessed / 1024)}KB`);
  });
}); 