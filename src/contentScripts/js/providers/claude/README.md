# Claude Provider

Claude (https://claude.ai/) 用のプロバイダー実装ドキュメントです。UI ボタン挿入と API 連携型の抽出に対応しています。

## 機能概要

- data-test-render-count ベースのメッセージ検出（SPA 対応）
- 各メッセージに「Save to Obsidian」ボタンを挿入
- クリック時にセッション/API から対象メッセージを再取得して高精度に保存
- HTML→Markdown 変換（Turndown + カスタムルール）
- 背景処理への堅牢な送信（リトライ内蔵）

## ファイル構成

- `index.js` — プロバイダーエクスポート集約
- `checks.js` — DOM セレクター定義と検出
- `ui.js` — 保存ボタン生成・配置、クリック時の保存処理
- `api.js` — セッション初期化・メッセージ取得（render-count 紐付け）
- `text.js` — 単一/複数メッセージ抽出インターフェース

## セレクター（checks.js）

- メッセージコンテナ (container)
  - `[data-test-render-count]`
  - `[data-testid="user-message"]`
  - `.font-claude-response`
- ユーザーメッセージ: `[data-testid="user-message"]`
- アシスタントメッセージ: `.font-claude-response`
- コンテンツ: `.font-claude-response`
- コピーボタン（参考・配置補助）: `[data-testid="action-bar-copy"]`

備考: Claude は DOM 構造が頻繁に更新されるため、最上位は `data-test-render-count` を優先して監視します。

## ボタン配置（ui.js）

- 作成する要素
  - ボタン: `.chatvault-save-btn`
    - aria-label: `Save to Obsidian`
    - アイコン: SVG（フロッピーディスク風）
  - 近傍配置: メッセージコンテナ内のアクションバー付近（Claude はアクションバー構造が可変のため、最寄りのコンテナにインラインで挿入）
- クリック時の動作
  1. クリック元ボタンから最も近い `[data-test-render-count]` を特定
  2. その index を算出し、`api.getMessageByIndex(index)` で最新メッセージを取得
  3. `toMarkdownIfHtml` で本文を Markdown 化
  4. 背景スクリプトへ `saveSingleMessage` を送信（1 回リトライ付き）
- UI 効果
  - ホバー時に色/背景を微変更

## 抽出（text.js）

- `extractSingleMessage(element)`
  - `checks.content`（`.font-claude-response`）を優先して本文テキスト/HTML を取り出し、Markdown に変換
  - `role` は `user`/`assistant` をセレクターで判定
  - `title` は `document.title` を基に生成
- `captureMessages(mode, count)`
  - `mode = 'all' | 'recent'`
  - `container` にマッチする要素群から map して抽出

## HTML→Markdown

プロジェクト共通の `src/utils/markdown.js` を使用。Turndown + GFM、コードブロック/インラインコード/HR/ラッパ解除などのカスタムルールを適用。

## 監視/再挿入

- MutationObserver により `[data-test-render-count]` 追加を監視
- ボタンの重複挿入防止（`.chatvault-save-btn` チェック）

## 想定 DOM（抜粋）

```html
<div data-test-render-count="3">
  <div class="font-claude-response">...AI応答HTML...</div>
  <div class="action-bar">
    <button data-testid="action-bar-copy">Copy</button>
    <!-- 拡張がここに Save ボタンを挿入 -->
    <button class="chatvault-save-btn" aria-label="Save to Obsidian">...</button>
  </div>
</div>
```

## 実装状況

- ✅ セレクター/検出ロジック
- ✅ 保存ボタンの生成・配置
- ✅ API 経由のメッセージ再取得 & 保存
- ✅ HTML→Markdown 変換
- ⚠️ DOM 変更に追随するため定期的な確認が必要

## 使用方法

対象ページ（https://claude.ai/）で拡張を有効にすると、各メッセージに保存ボタンが表示されます。クリックで Obsidian 保存フローが起動します。
