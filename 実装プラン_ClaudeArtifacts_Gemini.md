### 実装プラン: Claude Artifacts 対応 + Gemini 対応（保存パイプライン維持）

#### 前提/現状
- **ChatGPT**: 単一/選択/最新N件/全会話 保存 実装済み（安定）
- **Claude**: 通常メッセージの保存 実装済み。Artifacts 専用抽出は未実装
- **Gemini**: 未対応（manifest も未登録）
- **保存パイプライン**: `chromium/background.js` で frontmatter+Markdown 生成し、Obsidian URI → 失敗時フォールバック
- **HTML→Markdown**: `src/utils/markdown.js`（Turndown + gfm、カスタムルールあり）
- **長文分割**: `workers/textSplitter.js` + `utils/workerManager.js`

---

### 方針（ブレークダウン）
- **段階1: Claude Artifacts**
  - DOM 構造を確認し、Artifacts 専用セレクタを追加
  - 抽出→Markdown 整形→保存までを通常メッセージと同じパイプで流す
  - frontmatter `type: artifact` とし、フォルダテンプレ `{type}` も使えるように拡張
- **段階2: Gemini 対応**
  - manifest にホスト登録、service 検出、`GeminiService` 実装
  - 抽出は ChatGPT/Claude 実装の設計踏襲（Turndown ルール調整）
- **品質/テスト**
  - 既存E2E/ユニットテストに追補。Playwright のロール/アクセシビリティロケータ使用

---

### タスク一覧（チェックリスト）

#### フェーズ1: Claude Artifacts 対応
1.1 [x] `src/services/claude.js` に Artifacts 抽出のためのセレクタ定義を追加
  - [x] `selectors.artifactContainer`
  - [x] `selectors.artifactTitle`
  - [x] `selectors.artifactContent`（コード/HTML/テキストを包括）
  - [x] `selectors.artifactCodeBlock`（コードブロック抽出）
1.2 [x] `ClaudeService` に抽出メソッドを追加
  - [x] `extractArtifact(element)`：単一 Artifact を `{ type, title, content, language?, filename? }` で返却
  - [x] `extractArtifactsInMessage(messageElement)`：メッセージ内の複数 Artifact を配列で返却
  - [x] 10,000 文字超の content は `TextSplitter` で分割（part/totalParts 付与）
1.3 [x] `src/contentScripts/inject.js` のボタン注入を拡張
  - [x] `addSaveButton()` で Artifact コンテナにも Save ボタンを注入（重複防止）
  - [x] クリックハンドラで、クリック元が Artifact 内なら `ClaudeService.extractArtifact` を使い `messageType: 'artifact'`
1.4 [x] Markdown 整形
  - [x] `src/utils/markdown.js` に Artifact 用の Turndown ルール追補
  - [x] ツールバー/コピーアイコン等の除去（remove）
  - [x] コードブロック言語保持（`data-language` または `class=language-xxx`）
1.5 [x] 保存パイプライン拡張
  - [x] `chromium/background.js` のフォルダテンプレ置換に `{type}` 追加
  - [x] frontmatter `type: artifact` を保持し、ファイル名にも `artifact_` プレフィックスを付与（選択保存と同等の方式）
1.6 [x] 受け入れテスト（手動）
  - [x] Claude の Artifact を単一保存し、Obsidian へ Markdown が生成される
  - [x] コードブロック/見出し/本文が崩れない（Turndown ルールが期待通り）
  - [x] 文字数上限超の Artifact で分割保存が行われ、`part/totalParts` が frontmatter または本文に反映

#### フェーズ2: Gemini 対応
2.1 [ ] manifest 登録
  - [ ] `manifests/manifest_chromium.json` の `host_permissions` と `content_scripts.matches` に `https://gemini.google.com/*` を追加
  - [ ] 可能なら `https://aistudio.google.com/*` も追加（将来の互換）
  - [ ] `manifests/manifest_firefox.json` の `permissions` と `content_scripts.matches` に同様の URL を追加
2.2 [ ] サービス検出
  - [ ] `src/contentScripts/inject.js` と `inject-safe.js` の `detectService()` に `gemini` を追加（`hostname.includes('gemini.google.com') || hostname.includes('aistudio.google.com')`）
2.3 [ ] `src/services/gemini.js` を新規追加
  - [ ] 最新 UI の DOM を確認し、セレクタ定義（`userMessage`, `assistantMessage`, `messageContent`, `codeBlock`, `mathInline`, `mathBlock`, `conversationTitle`）
  - [ ] `extractSingleMessage(messageElement)` 実装（ChatGPT/Claude 実装に準拠、DOM クローンで改変回避）
  - [ ] `extractAllMessages()` or `extractRecentMessages(n)` 実装
  - [ ] 長文分割の適用（TextSplitter）
2.4 [ ] コンテントスクリプト統合
  - [ ] `inject.js` で `service === 'gemini'` のとき `new GeminiService()` を初期化
  - [ ] 単一/選択/最新N件/全会話 の保存トリガで `GeminiService` を使用
2.5 [ ] Markdown 調整
  - [ ] `markdown.js` に Gemini 固有要素（装飾/余計なUI）を remove するルールを追加
2.6 [ ] 受け入れテスト（手動）
  - [ ] 単一/選択/最新N件/全会話 の全モードで Obsidian に Markdown 保存できる
  - [ ] コードブロック言語・数式の保持

#### フェーズ3: テスト/品質保証（自動/半自動）
3.1 [ ] ユニットテスト
  - [ ] `src/services/__tests__/claude.artifacts.test.js`：疑似 DOM（JSDOM）で Artifact 抽出の正常系/異常系
  - [ ] `src/services/__tests__/gemini.test.js`：疑似 DOM で単一/複数抽出
  - [ ] `src/utils/__tests__/markdown.test.js`：Artifact/Gemini の追加ルールの回帰
3.2 [ ] E2E（Playwright）
  - [ ] `tests/e2e/claude-artifacts.spec.js`：ボタン注入・クリックで `chrome.runtime.sendMessage` が所定 payload を送るかをモック検証
  - [ ] `tests/e2e/gemini.spec.js`：同上（ログイン壁により実ページ操作はスキップ/モック）
  - [ ] ロケータはアクセシビリティ優先（例: `getByRole('button', { name: /save/i })`）

#### フェーズ4: ドキュメント/リリース
4.1 [ ] `README.md` に Gemini 対応/Artifacts 保存のサポート状況を更新
- [ ] `CHANGELOG` エントリ追加（なければ新規）
- [ ] バージョンバンプ（`package.json`）
- [ ] ビルド/手動動作確認/配布手順確認

---

### 受け入れ基準（各フェーズの Done 定義）
- **Claude Artifacts**
  - Save ボタンが Artifact 領域に表示されること
  - `messageType: 'artifact'` で frontmatter 出力され、`chatFolderPath` の `{type}` が `artifact` に展開されること
  - コード/見出し/本文の Markdown 化が破綻しないこと（Turndown ルールの追加が有効）
- **Gemini**
  - 対象サイトでボタン注入/各保存モードが機能すること
  - コード/数式/表の Markdown 変換が妥当であること
- **テスト/品質**
  - 新規ユニット/疑似E2E が通ること
  - 既存テストが回帰しないこと
- **リリース**
  - README 更新、バージョンバンプ、ビルドの成功

---

### 実装メモ（参照指針）
- Turndown（`src/utils/markdown.js`）
  - ルール追加は `turndownService.addRule(name, { filter, replacement })`
  - 不要要素は `turndownService.remove(filter)`、保持は `keep(filter)`
  - コードブロックは `data-language` または `class="language-xxx"` を優先してフェンス化
- Playwright（E2E）
  - ロケータはロール/アクセシビリティ名優先: `getByRole('button', { name: /save/i })`
  - CSS は最小限、`filter({ visible: true })` 等で安定化

---

### 具体的な変更ポイント（ファイル/関数）
- `src/services/claude.js`
  - `selectors` に Artifact 関連キー追加
  - `extractArtifact`, `extractArtifactsInMessage` を追加
- `src/contentScripts/inject.js`
  - `addSaveButton` で Artifact コンテナにもボタン注入
  - `handleSaveClick` で Artifact 判定→`messageType: 'artifact'`
- `src/utils/markdown.js`
  - Artifact/Gemini 固有UIの remove ルール、コードフェンス強化
- `src/chromium/background.js`
  - `{type}` プレースホルダを `chatFolderPath` 置換に追加
  - `filename` に `artifact_` プレフィックス（選択時の `selection_` と同様の命名方針）
- `src/services/gemini.js`（新規）
  - ChatGPT/Claude と同等 API で DOM 抽出を実装
- `manifests/manifest_*.json`
  - `gemini.google.com`（必要に応じて `aistudio.google.com`）を許可

---

### リスクと緩和
- サイト DOM 変更
  - 緩和: データ属性/ロール優先のセレクタ、フォールバック抽出を併用
- ログイン壁により E2E が難しい
  - 緩和: コンテントスクリプトの DOM だけをモックした疑似E2E、ユニットで抽出ロジックを網羅
- URI 文字数制限
  - 緩和: 既存の分割/フォールバック（クリップボード/Downloads API）を適用

---

### 作業順序（推奨）
1) Claude Artifacts: セレクタ決定 → 抽出実装 → Turndown 調整 → `{type}` 置換 → 手動確認/ユニット
2) Gemini: manifest → Service 検出 → `GeminiService` → Turndown 調整 → 手動確認/ユニット
3) テスト拡充（疑似E2E/ユニット）→ README/バージョン → ビルド確認

---

### 補足（トラブルシュートの観点）
- Save ボタンが表示されない: manifest `matches`/`host_permissions` を確認
- 変換崩れ: `markdown.js` のカスタムルールを最小再現 HTML で検証
- 文字化け/URI 失敗: `background.js` のエンコード/制御文字除去の順序と長さをログで確認


