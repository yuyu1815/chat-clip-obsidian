# Chat Clip Obsidian — AIチャットをObsidianへ

ChatGPT、Claude、その他の生成AIサービスのチャット会話を、ワンクリックでObsidian vaultにMarkdownとして保存するChrome拡張機能。

## 概要

Chat Clip Obsidianは、Web版生成AIチャットサービスの会話を効率的にObsidianに保存するためのブラウザ拡張機能です。研究、学習、開発におけるAIとの対話を体系的に記録し、ナレッジベースとして活用できます。

### 主な特徴

- 🤖 **AIチャット専用**: ChatGPT、Claude、その他の生成AIサービスに特化
- 📝 **複数の保存モード**: 単一メッセージ、選択範囲、最新N件、会話全体
- 🎯 **ワンクリック保存**: メッセージにホバーで表示される保存ボタン
- 📁 **スマート整理**: サービス別、日付別の自動フォルダ分類
- ✨ **きれいなMarkdown**: コードブロック、数式、フォーマットを保持
- 🔗 **直接連携**: Obsidian URIで即座にノート作成

## 対応サービス

### 現在対応済み
- ✅ **ChatGPT** (`chat.openai.com`, `chatgpt.com`)
- ✅ **Claude** (`claude.ai`)

### 今後対応予定
- 🔄 **Google Gemini**
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
2. **必須設定**:
   - **Obsidian Vault名**: 保存先のvault名を入力
   - **保存フォルダ**: 保存先パス（例：`AI Chats/{service}/{date}`）
3. **カスタマイズ可能**:
   - デフォルト保存モード
   - ファイル名形式
   - Markdownテンプレート

## 使用方法

### 基本的な使い方

1. **ChatGPTまたはClaude**にアクセス
2. **保存したいメッセージにホバー**すると「Save」ボタンが表示
3. **ボタンをクリック**でObsidianに保存完了

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

## 開発・カスタマイズ

### 開発環境

```bash
# 開発モード（ファイル監視）
npm run dev:chromium

# プロダクションビルド
npm run build:chromium

# Firefox版ビルド
npm run build:firefox
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
- [ ] **Google Gemini**対応
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
- 自動的にクリップボード経由で保存されます
- Obsidianで貼り付けを行ってください

## 開発への貢献

このプロジェクトへの貢献を歓迎します！

- **バグ報告**: [Issues](https://github.com/yourusername/chat-clip-obsidian/issues)でお知らせください
- **機能リクエスト**: 新しいAIサービス対応やUI改善のご提案
- **プルリクエスト**: コードの改善や新機能の実装

## 技術仕様

- **対応ブラウザ**: Chrome 121+, Edge 121+, Brave
- **Manifest**: Version 3
- **フレームワーク**: React, Tailwind CSS
- **ビルドツール**: Webpack
- **ライブラリ**: Turndown（Markdown変換）

## クレジット

本プロジェクトは、[Massimiliano Vavassori](https://github.com/mvavassori)氏による[Obsidian Web Clipper](https://github.com/mvavassori/obsidian-web-clipper)の設計思想とObsidian連携の仕組みを参考にさせていただきました。素晴らしい基盤を提供していただいたことに心から感謝いたします。

ただし、Chat Clip ObsidianはAIチャット専用の拡張機能として、独自の実装とUI設計で開発されています。

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)ファイルをご覧ください。

---

**📧 質問・要望**: [Issues](https://github.com/yourusername/chat-clip-obsidian/issues)  
**🌟 気に入ったら**: リポジトリにスターをお願いします！  
**🤝 貢献**: プルリクエストやフィードバックをお待ちしています