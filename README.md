# Chat Clip Obsidian — AIチャットをObsidianへ

ChatGPTやGoogle Geminiなどの生成AIサービスのチャット会話を、ワンクリックでObsidian vaultにMarkdownとして保存するChrome拡張機能。

## 概要

Chat Clip Obsidianは、Web版生成AIチャットサービスの会話を効率的にObsidianに保存するためのブラウザ拡張機能です。研究、学習、開発におけるAIとの対話を体系的に記録し、ナレッジベースとして活用できます。

### 主な特徴

- 🤖 **AIチャット専用**: ChatGPT、Claude、その他の生成AIサービスに特化
- 📝 **複数の保存モード**: 単一メッセージ、選択範囲、最新N件、会話全体
- 🎯 **ワンクリック保存**: メッセージにホバーで表示される保存ボタン
- 📁 **スマート整理**: サービス別、日付別の自動フォルダ分類
- ✨ **きれいなMarkdown**: コードブロック、数式、定義リスト、ネストされたリスト、画像キャプションなどを適切に変換
- 🔗 **直接連携**: Obsidian URIで即座にノート作成
- 💾 **直接保存機能**: File System Access APIによるVaultへの直接書き込み（NEW!）
- 🔔 **保存通知**: ファイル保存成功時の通知表示

## 対応サービス

### 現在対応済み
- ✅ **ChatGPT** (`chat.openai.com`, `chatgpt.com`)
- ✅ **Claude** (`claude.ai`)
- ✅ **Google Gemini** (`gemini.google.com`)

### 今後対応予定
- 🔄 **Perplexity AI**
- 🔄 **その他の生成AIサービス**

*新しいサービスのリクエストは、Issueでお気軽にお知らせください。*

## 保存モード

| モード | 説明 | 用途 |
|--------|------|------|
| **単一メッセージ** | 個別のメッセージを保存 | 重要な回答やアイデアをピンポイントで記録 |
| **選択範囲** | ハイライトしたテキストを保存 | 長いメッセージから必要な部分だけ抜粋 |
| **最新N件** | 直近のメッセージをまとめて保存 | 一連の議論や問答を記録 |
| **会話全体** | スレッド全体を保存 | 完全な対話ログとして保管 |

## インストール

### 手動インストール（開発版）

1. **リポジトリをクローン**:
```bash
git clone https://github.com/yourusername/chat-clip-obsidian.git
cd chat-clip-obsidian
```

2. **依存関係をインストール**:
```bash
npm install
```

3. **拡張機能をビルド**:
```bash
npm run build:chromium
```

4. **Chromeに拡張機能を読み込み**:
   - `chrome://extensions/` にアクセス
   - 「デベロッパーモード」を有効化
   - 「パッケージ化されていない拡張機能を読み込む」をクリック
   - `dist-chromium` フォルダを選択

### Chrome Web Store（公開予定）
近日中にChrome Web Storeで公開予定です。

## 設定

1. **拡張機能アイコン**をクリックして**オプション**を選択
2. **保存方法の選択**:
   - **File System API (推奨)**: File System Access APIでVaultに直接保存
   - **Advanced URI プラグイン**: ObsidianのAdvanced URIプラグインと連携して即時保存
   - **ダウンロードフォルダ経由**: ダウンロードフォルダ経由で保存
   - **自動選択**: 状況に応じて最適な方法を自動選択
3. **Advanced URIプラグイン設定**（任意）:
   - Obsidianで「Advanced URI」コミュニティプラグインをインストールして有効化
   - Chat Clip Obsidianの保存方法から「Advanced URI プラグイン」を選択
   - Obsidianが起動している状態でURI呼び出しを許可すると、ワンクリック保存が有効になります
4. **File System API設定**（推奨）:
   - 「Vault フォルダを選択」ボタンでObsidian Vaultフォルダを選択
   - 一度選択すれば、以降は自動的に直接保存されます
5. **基本設定**:
   - **Obsidian Vault名**: 保存先のvault名を入力
   - **保存フォルダ**: 保存先パス（例：`AI Chats/{service}/{date}`）
6. **カスタマイズ可能**:
   - デフォルト保存モード
   - ファイル名形式
   - Markdownテンプレート

## 推奨保存方法

**Advanced URIプラグイン**
- ObsidianのコミュニティプラグインからAdvanced URIをインストールして有効化
- ObsidianでURIリンクの受付を許可し、Vaultを開いた状態にしておく
- Chat Clip Obsidianの保存方法で「Advanced URI プラグイン」を選択し連携を有効化
- 保存ボタンをクリックすると、Obsidian内で対象Vaultにノートが即時作成されます

## 使用方法

### 基本的な使い方

1. **ChatGPT・Claude・Gemini**のいずれかにアクセス
2. **保存したいメッセージにホバー**すると「Save」ボタンが表示
3. **ボタンをクリック**でObsidianに保存完了

> ℹ️ **Claudeでのツールチップ表示について**
>
> Claudeは独自のツールチップ（Radix UI）を使用しているため、保存ボタンにカーソルを合わせると「Copy」と表示される場合があります。ボタン自体は正常に動作しますが、表示はClaude側の仕様で上書きされるため、現状はそのままの挙動となります。

### その他の保存方法

- **拡張機能ポップアップ**: アイコンクリックで保存モード選択
- **右クリックメニュー**: テキスト選択後の保存（今後実装予定）
- **キーボードショートカット**: Alt+O（今後実装予定）

## 保存されるMarkdown形式

```markdown
---
title: "AI Chat - 2024-01-15"
service: "ChatGPT"
date: "2024-01-15"
url: "https://chat.openai.com/c/xxxxx"
---

# AI Chat - 2024-01-15

## User
ここにユーザーの質問が入ります。

## Assistant
ここにAIの回答が入ります。

```javascript
// コードブロックも適切に保持されます
function example() {
  return "Hello, World!";
}
```

数式も適切に変換されます：
$$E = mc^2$$
```

## HTML→Markdown変換機能

Chat Clip Obsidianは、[Turndown](https://github.com/mixmark-io/turndown)ライブラリを使用して、AIチャットのHTML要素を高品質なMarkdownに変換します。以下の要素を適切に処理します：

- **コードブロック**: 言語指定を保持し、フェンスド形式で出力
- **インラインコード**: バッククォートで適切に囲む
- **数式表現**: KaTeXやMathJax形式の数式を保持
- **定義リスト**: 用語と説明を適切なフォーマットで変換
- **ネストされたリスト**: 複数階層のリストを適切なインデントで保持
- **画像とキャプション**: 画像とその説明文を適切に変換
- **HTMLコメント**: コメントを保持
- **特殊要素の保持**: iframe、canvas、SVGなどの特殊要素をHTML形式で保持

これにより、AIチャットの複雑なフォーマットやコンテンツを失うことなく、Obsidianで活用できます。

## 開発・カスタマイズ

### 開発環境

```bash
# プロダクションビルド
npm run build:chromium
```

### プロジェクト構造

```
src/
├── contentScripts/     # AIチャットページに注入されるスクリプト
├── services/           # サービス別のメッセージ抽出ロジック
├── utils/              # Markdown変換などのユーティリティ
└── chromium/           # 拡張機能のUI・バックグラウンド処理
```

## ロードマップ

### 近日実装予定
- [ ] **Perplexity AI**対応
- [ ] 一括エクスポート機能
- [ ] カスタムテンプレ機能
- [ ] キーボードショートカット

### 将来的な構想
- [ ] モバイル対応
- [ ] API経由での保存
- [ ] 他のノートアプリ対応
- [ ] チームでの共有機能

## トラブルシューティング

### よくある問題

**Q: 保存ボタンが表示されない**
- ページを再読み込みしてください
- 拡張機能が有効になっているか確認してください

**Q: Obsidianにノートが作成されない**
- Vault名が正しく設定されているか確認してください
- Obsidianが起動しているか確認してください

**Q: 長い会話が保存できない**
- 保存方法を「ダウンロードフォルダ経由」に変更してください
- または「自動選択」を使用すると、コンテンツサイズに応じて適切な方法が選択されます

## 開発への貢献

このプロジェクトへの貢献を歓迎します！

- **バグ報告**: [Issues](https://github.com/yourusername/chat-clip-obsidian/issues)でお知らせください
- **機能リクエスト**: 新しいAIサービス対応やUI改善のご提案
- **プルリクエスト**: コードの改善や新機能の実装

## 技術仕様

- **対応ブラウザ**: Chrome 121+, Edge 121+, Brave
- **File System Access API**: Chrome 86+, Edge 86+（Direct Save機能）
- **Manifest**: Version 3
- **フレームワーク**: React, Tailwind CSS
- **ビルドツール**: Webpack
- **ライブラリ**: Turndown（HTML→Markdown変換、カスタムルールで拡張）

## クレジット

本プロジェクトは、[Massimiliano Vavassori](https://github.com/mvavassori)氏による[Obsidian Web Clipper](https://github.com/mvavassori/obsidian-web-clipper)の設計思想とObsidian連携の仕組みを参考にさせていただきました。素晴らしい基盤を提供していただいたことに心から感謝いたします。

ただし、Chat Clip ObsidianはAIチャット専用の拡張機能として、独自の実装とUI設計で開発されています。

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルをご覧ください。

---

**📧 質問・要望**: [Issues](https://github.com/yourusername/chat-clip-obsidian/issues)  
**🌟 気に入ったら**: リポジトリにスターをお願いします！  
**🤝 貢献**: プルリクエストやフィードバックをお待ちしています
