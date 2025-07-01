const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  
  /* 並列実行設定 */
  fullyParallel: true,
  
  /* CI上でのリトライ設定 */
  retries: process.env.CI ? 2 : 0,
  
  /* Worker数の設定 */
  workers: process.env.CI ? 1 : undefined,
  
  /* レポーター設定 */
  reporter: 'html',
  
  /* 共通設定 */
  use: {
    /* アクションの前後にスクリーンショットを撮る */
    trace: 'on-first-retry',
    
    /* ヘッドレスモード */
    headless: true,
    
    /* ビューポートサイズ */
    viewport: { width: 1280, height: 720 },
    
    /* 操作の待機時間 */
    actionTimeout: 0,
    
    /* ナビゲーションタイムアウト */
    navigationTimeout: 30000,
  },

  /* 対象ブラウザプロジェクト */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* ローカル開発サーバー設定 */
  webServer: {
    command: 'npm run dev:chromium',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
}); 