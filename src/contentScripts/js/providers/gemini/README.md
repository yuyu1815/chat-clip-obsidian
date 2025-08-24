# Gemini Provider

Geminiサイト（https://gemini.google.com/）用のプロバイダーです。

## 機能

- Geminiのメッセージコンテンツを検出・抽出
- 保存ボタンを「回答をコピー」と「その他」の間に配置
- HTMLからMarkdownへの変換
- 動的コンテンツの監視（SPA対応）

## ファイル構成

- `index.js` - プロバイダーのメインエクスポート
- `checks.js` - DOMセレクターの定義
- `ui.js` - 保存ボタンの作成と配置
- `text.js` - メッセージテキストの抽出
- `markdown.js` - HTMLからMarkdownへの変換
- `comm.js` - 通信レイヤー（将来のAPI対応用）

## セレクター

### メッセージコンテナ
- `message-content` - Geminiのメッセージ要素
- `[id^="message-content-id-"]` - 動的IDを持つメッセージ
- `.model-response-text` - モデル応答テキスト
- `.user-message` - ユーザーメッセージ

### ボタン配置
- `.buttons-container-v2` - ボタンコンテナ
- `[data-test-id="copy-button"]` - コピーボタン
- `.more-menu-button-container` - その他メニューボタン

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

## 特徴

1. **Gemini固有のUI対応**: Geminiの独特なHTML構造に対応
2. **動的コンテンツ監視**: SPA遷移やリアルタイム更新に対応
3. **レスポンシブデザイン**: GeminiのUIに合わせたボタンスタイル
4. **エラーハンドリング**: 堅牢なエラー処理とフォールバック機能
