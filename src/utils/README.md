# Utils

ユーティリティ関数とヘルパーを含むディレクトリです。

## 概要

このディレクトリには、プロジェクト全体で使用される共通のユーティリティ関数とヘルパーが含まれています。ブラウザAPI、データ処理、UI機能を提供します。

## ディレクトリ構造

### browser/
ブラウザ固有の機能（Chrome API、Obsidian API）
- **chrome.js**: Chrome拡張機能APIのラッパー
- **obsidian.js**: Obsidianとの連携機能
- **README.md**: ブラウザ機能の詳細ドキュメント

### data/
データ処理とエラーハンドリング
- **encoding.js**: エンコーディング処理（文字エンコーディング変換）
- **validation.js**: データ検証（入力値の妥当性チェック）
- **workerManager.js**: Web Worker管理（バックグラウンド処理）
- **README.md**: データ処理の詳細ドキュメント

### notifications/
通知システム
- **notifications.js**: 通知機能（システム通知の表示）
- **toast.js**: トースト通知（一時的なメッセージ表示）
- **README.md**: 通知システムの詳細ドキュメント

### markdown.js
Markdown処理ユーティリティ（Markdownの解析と変換）

## 主要機能

### ブラウザ機能
- **Chrome API**: 拡張機能APIのラッパー関数
- **Obsidian API**: Obsidianとの通信機能
- **ストレージ**: データの永続化処理
- **メッセージング**: コンポーネント間通信

### データ処理
- **エンコーディング**: 文字エンコーディング変換
- **データ検証**: 入力値の妥当性チェック
- **Worker管理**: バックグラウンド処理の管理
- **エラーハンドリング**: 包括的なエラー処理

### 通知システム
- **システム通知**: ブラウザ通知の表示
- **トースト通知**: 一時的なメッセージ表示
- **通知管理**: 通知の表示・非表示制御

### Markdown処理
- **Markdown解析**: Markdownテキストの解析
- **HTML変換**: MarkdownからHTMLへの変換
- **コードブロック処理**: コードブロックの特殊処理

## アーキテクチャ

```
utils/
├── browser/         # ブラウザ機能
├── data/           # データ処理
├── notifications/  # 通知システム
├── markdown.js     # Markdown処理
└── README.md       # このファイル
```

## 設計原則

- **再利用性**: 汎用的な関数設計
- **モジュラー**: 独立した機能単位
- **パフォーマンス**: 効率的な実装
- **保守性**: 読みやすく管理しやすいコード
- **型安全性**: 適切な型定義と検証

## 使用例

```javascript
// ブラウザ機能
import { ChromeAPI } from './browser/chrome.js';
const chromeAPI = new ChromeAPI();

// データ処理
import { validateData } from './data/validation.js';
const isValid = validateData(data);

// 通知システム
import { showToast } from './notifications/toast.js';
showToast('処理が完了しました');

// Markdown処理
import { parseMarkdown } from './markdown.js';
const html = parseMarkdown(markdownText);
```

## 開発ガイドライン

- **単一責任**: 各関数は単一の責任を持つ
- **エラーハンドリング**: 適切なエラー処理を実装
- **パフォーマンス**: 効率的なアルゴリズムを使用
- **テスト**: 包括的なテストを書く
- **ドキュメント**: 関数の目的と使用方法を明記

## デバッグ

```javascript
// ログ出力
console.log('[Utils] 処理開始');

// エラー処理
try {
  const result = processData(data);
} catch (error) {
  console.error('[Utils] エラー:', error);
}
```

## 注意事項

- ブラウザの互換性を考慮してください
- 適切なエラーハンドリングを実装してください
- パフォーマンスを考慮した実装を行ってください
