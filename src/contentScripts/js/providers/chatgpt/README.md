# ChatGPT プロバイダー

このディレクトリには、ChatGPTとの統合を担当するモジュールが含まれています。

## 概要

- **目的**: ChatGPTとのAPI通信とUI操作
- **責任**: メッセージの送受信、チャット履歴の抽出、Markdown変換
- **対象サイト**: chat.openai.com

## ディレクトリ構造

```
chatgpt/
├── index.js        # メインエントリーポイント
├── comm.js         # 通信処理とAPI呼び出し
├── ui.js           # UI操作とDOM制御
├── text.js         # テキスト処理とメッセージ抽出
├── markdown.js     # Markdown変換と整形
├── checks.js       # 状態チェックと検証
└── README.md       # このファイル
```

## ファイル説明

### index.js
- プロバイダーのメインエントリーポイント
- 各モジュールの初期化と統合
- 外部からの呼び出しインターフェース

### comm.js
- ChatGPT APIとの通信処理
- メッセージの送信とレスポンス受信
- WebSocket接続の管理

### ui.js
- ChatGPT UIの操作
- ボタンクリック、フォーム入力
- チャット要素の検出と制御

### text.js
- メッセージテキストの抽出
- 会話履歴の取得
- テキストの前処理と後処理

### markdown.js
- Markdown形式の変換
- コードブロックの処理
- 特殊文字のエスケープ

### checks.js
- ページ状態の検証
- 要素の存在確認
- エラー状態の検出

## API インターフェース

```javascript
class ChatGPTProvider {
  // 初期化
  async init() {}
  
  // メッセージ送信
  async sendMessage(message) {}
  
  // レスポンス受信
  async receiveResponse() {}
  
  // チャット履歴取得
  async getChatHistory() {}
  
  // UI状態取得
  getUIState() {}
  
  // メッセージ抽出
  extractMessages() {}
}
```

## 使用例

```javascript
import ChatGPTProvider from './index.js';

const provider = new ChatGPTProvider();
await provider.init();

// メッセージ送信
await provider.sendMessage('こんにちは');

// 履歴取得
const history = await provider.getChatHistory();
```

## エラーハンドリング

- ネットワークエラーの処理
- API制限の検出
- ページ構造変更への対応
- タイムアウト処理

## パフォーマンス最適化

- 効率的なDOM操作
- 不要なAPI呼び出しの削減
- メモリ使用量の最適化
- レスポンス時間の改善

## 注意事項

- ChatGPTの利用規約を遵守してください
- 適切なレート制限を設定してください
- ユーザーのプライバシーを保護してください
- エラー時の適切なフォールバックを実装してください
