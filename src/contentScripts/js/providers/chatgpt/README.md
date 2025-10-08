# ChatGPT Provider

ChatGPT (`chat.openai.com`, `chatgpt.com`) 向けプロバイダーの概要です。

## 機能

- メッセージ抽出（data-message-author-role ベース）
- 保存ボタンの挿入（拡張側の共通実装により自動配置／フォールバック）
- HTML→Markdown 変換（Turndown + GFM）
- SPA 変更の監視（MutationObserver）

## セレクター（概略）

- コンテナ: `[data-message-author-role]` を含む要素（inject.js 側で広範に探索）
- ロール: `data-message-author-role="user|assistant"`
- 本文: プロバイダー `checks.content`（実装により変動、fallback は内側のテキスト）

## 抽出

- `providers/chatgpt/text.js`
  - `extractSingleMessage(el)` — role 判定と HTML/テキスト抽出、`toMarkdownIfHtml` で変換
  - `captureMessages(mode, count)` — `container` 群から map

## ボタン配置

ChatGPT は UI 変更が多いため、共通の `inject.js` が最適な位置に配置を試み、失敗時は対象メッセージの右上にフォールバック配置します（absolute）。

## 実装状況

- ✅ 主要機能実装
- ⚠️ DOM 更新に伴う微調整が必要になる場合があります
