# Gemini Provider

Geminiサイト（https://gemini.google.com/）用のプロバイダーです。

## 機能

- Geminiのメッセージコンテンツを検出・抽出
- 保存ボタンを「回答をコピー」と「その他」の間に配置（または copy の直前）
- HTMLからMarkdownへの変換（Turndown + カスタムルール）
- 動的コンテンツの監視（SPA対応）

## ファイル構成

- `index.js` - プロバイダーのメインエクスポート
- `checks.js` - DOMセレクターの定義
- `ui.js` - 保存ボタンの作成と配置
- `text.js` - メッセージテキストの抽出
- `markdown.js` - HTMLからMarkdownへの変換
- `comm.js` - 通信レイヤー（将来のAPI対応用）

## セレクター/設置ポイント（checks.js / ui.js）

### メッセージコンテナ（container）
- `message-content`
- `[id^="message-content-id-"]`
- `.model-response-text`
- `.user-message`

### ユーザー/アシスタント
- ユーザー: `.user-message`, `[data-role="user"]`
- アシスタント: `message-content`, `[id^="message-content-id-"]`, `.model-response-text`

### メッセージ本文（content）
- `.markdown`
- `.markdown-main-panel`
- `.model-response-text`
- `[class*="markdown"]`

### ボタン配置
- `.buttons-container-v2` — ボタン群のラッパ
- `[data-test-id="copy-button"]` — 回答をコピー
- `.more-menu-button-container` — その他メニュー

ボタンは通常、`.buttons-container-v2` 内で Copy ボタンの直前に挿入します（なければ最後尾）。

## 使用方法

```javascript
import GeminiProvider from './providers/gemini.js';

// セレクターを取得
const selectors = GeminiProvider.getSelectors();

// 保存ボタンを追加
GeminiProvider.addSaveButton(messageElement, createSaveButton);

// メッセージを抽出
const message = GeminiProvider.extractSingleMessage(messageElement);

// 複数メッセージをキャプチャ
const result = GeminiProvider.captureMessages('all');
```

## 実装詳細

- 監視/再挿入: MutationObserverで`.buttons-container-v2`追加を監視し、未設置なら保存ボタンを挿入
- 冪等性: `.chatvault-save-btn`の重複防止
- メッセージ解決: `resolveMessageElementFromButton()`で拡張パネル（extended-response-panel）や通常レスポンスを適切に辿る
- HTML→Markdown: `src/utils/markdown.js` の Turndown + GFM + カスタムルールを使用
- 例示DOM:
  ```html
  <div class="response-container">
    <div class="model-response-text markdown">…</div>
    <div class="buttons-container-v2">
      <button data-test-id="copy-button">Copy</button>
      <!-- 拡張がここ（Copy直前 or 直後）に Save を挿入 -->
      <button class="chatvault-save-btn" data-test-id="chatvault-save-button" aria-label="Obsidianに保存"></button>
      <div class="more-menu-button-container">…</div>
    </div>
  </div>
  ```

## 特徴

1. **Gemini固有のUI対応**: Geminiの独特なHTML構造に対応
2. **動的コンテンツ監視**: SPA遷移やリアルタイム更新に対応
3. **レスポンシブデザイン**: GeminiのUIに合わせたボタンスタイル
4. **エラーハンドリング**: 堅牢なエラー処理とフォールバック機能
