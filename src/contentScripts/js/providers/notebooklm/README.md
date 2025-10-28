# NotebookLM Provider

NotebookLM（https://notebooklm.google.com/notebook/{uuid}）に対応するためのプロバイダー実装です。

## ファイル構成

### `checks.js`
- NotebookLMサイトの検出ロジック
- DOM要素のセレクター定義
- `isNotebookLM()`: NotebookLMサイトかどうかの判定
- `getSelectors()`: メッセージ要素などのセレクターを返す

### `ui.js`
- UI関連の機能（保存ボタンの作成・配置など）
- `createSaveButton()`: Obsidian保存ボタンの作成
- `addSaveButton()`: メッセージ要素への保存ボタン追加
- `initializeNotebookLM()`: NotebookLM用の初期化処理
- `resolveMessageElementFromButton()`: ボタンからメッセージ要素の解決

### `text.js`
- メッセージの抽出機能
- `extractSingleMessage()`: 単一メッセージからのデータ抽出
- `captureMessages()`: 複数メッセージのキャプチャ
- HTMLからMarkdownへの変換機能（実装予定）

### `index.js`
- プロバイダーのメインエントリーポイント
- 他の機能をエクスポートし、プロバイダーインターフェースを提供

## 実装状況

### NotebookLMで設置・検出する要素（大量に具体記述）

以下は、NotebookLM（Angular Materialベース）で本プロバイダーが検出・利用するDOM要素およびセレクターの詳細です。UI変更に強い実装を目指し、一次・二次・フォールバックの順で探索します。

- ルート/ページ判定
  - URL: https://notebooklm.google.com/notebook/{uuid}
  - isNotebookLM(): window.location.href に `notebooklm.google.com/notebook/` を含むかで判定

- メッセージカード（container）
  - 優先: `chat-message .message-actions`（アクション領域から逆引き）
  - フォールバック: `chat-message mat-card.mat-mdc-card`
  - 備考: NotebookLMの1メッセージは Angular の `<chat-message>` 配下に `mat-card` を持つ

- メッセージ本文（content）
  - `chat-message .message-text-content`
  - `chat-message .message-content`
  - 備考: NotebookLMでは `mat-card-content` 直下に `.message-content`/`.message-text-content` が入る

- アクションコンテナ（actionsContainer）
  - `chat-actions.actions-container`
  - 備考: アクションボタン（コピー、サムズアップ/ダウン）が `.action` ラッパーに入って並ぶ

- 既存のコピーアクション（copyButton）
  - `${actionsContainer} .xap-copy-to-clipboard`
  - アイコン: `<mat-icon>copy_all</mat-icon>`

- 追加する保存ボタン（Save）
  - ボタン本体クラス: `.chatvault-save-btn.notebooklm-save-btn`
  - ラッパー: `.action.chatvault-action`（他のアクションと同階層に合わせる）
  - 追加位置: actionsContainer 直下の `.action` の先頭（左側）。結果としてコピーの左に表示される
  - アクセシビリティ属性: `aria-label="Obsidianに保存"`, `data-test-id="chatvault-save-button"`
  - スタイル: ボタンは `action-button` クラスを追加し、周囲の丸アイコンに近づける（CSSは最小限／将来調整）

- 監視・再挿入ロジック
  - 初期スキャン: `querySelectorAll(actionsContainer + ', ' + container)`
  - MutationObserver: 追加ノードに対し上記セレクターで再探索し、未設置なら設置
  - 冪等性: `.chatvault-save-btn` の重複設置を防止

- ボタンからメッセージ解決
  - resolveMessageElementFromButton(): 祖先を辿り `selectors.container` にマッチする要素、なければ最後のメッセージを返す

- 想定HTML（要約）
  - `<chat-message>` 内に `<mat-card>` → `<mat-card-actions class="message-actions">` 配下に `<chat-actions class="actions-container">`
  - 例（省略版）:
    ```html
    <chat-actions class="actions-container">
      <div class="action"><button class="xap-copy-to-clipboard"><mat-icon>copy_all</mat-icon></button></div>
      <div class="action"><button><mat-icon>thumb_up</mat-icon></button></div>
      <div class="action"><button><mat-icon>thumb_down</mat-icon></button></div>
    </chat-actions>
    ```
  - 本拡張は以下を先頭に挿入:
    ```html
    <div class="action chatvault-action">
      <button class="chatvault-save-btn notebooklm-save-btn action-button" aria-label="Obsidianに保存" data-test-id="chatvault-save-button">
        <!-- SVGアイコン + 保存テキスト -->
      </button>
    </div>
    ```

### 完了
- ✅ 基本的なファイル構造とクラスの作成
- ✅ ProviderFactoryへの登録
- ✅ サイト検出ロジックの追加
- ✅ inject.jsでの初期化処理追加

### 実装状況の補足
- ✅ DOM要素のセレクターを実装（actionsContainer, container, content, copyButton）
- ✅ メッセージ抽出ロジック実装（extractSingleMessage, captureMessages）
- ✅ HTMLからMarkdownへの変換機能（src/utils/markdown.js を利用）
- ⚠️ 実サイトでの回帰テストは継続的に必要

## 今後の作業

1. **実際のNotebookLMサイトでの動作確認**
   - 実際のDOM構造の確認
   - セレクターの調整

2. **メッセージ抽出機能の実装**
   - 適切なHTMLからMarkdownへの変換
   - ユーザー/アシスタントメッセージの判定ロジック

3. **UI改善**
   - NotebookLMのデザインに合わせたボタンスタイル
   - 適切なボタン配置位置の特定

4. **エラーハンドリングの改善**
   - 堅牢性の向上
   - ユーザーフィードバックの改善

## 使用方法

NotebookLMサイト（https://notebooklm.google.com/notebook/{uuid}）にアクセスすると、自動的にプロバイダーが検出され、メッセージに保存ボタンが追加されます。

現在は雛形実装のため、実際の機能は限定的です。実装の詳細化が必要です。
