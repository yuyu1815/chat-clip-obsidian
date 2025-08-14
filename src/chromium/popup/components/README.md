# components

ポップアップUIの再利用可能なコンポーネントを含むディレクトリです。

## コンポーネント

### ChatModeSelector.js
チャットモード選択コンポーネント
- **機能**: 異なるAIサービス（Claude、Gemini）の選択
- **プロパティ**: 現在のモード、モード変更コールバック
- **スタイル**: モダンなセレクターUI

### MarkdownPreview.js
Markdownプレビューコンポーネント
- **機能**: MarkdownテキストのHTMLプレビュー
- **プロパティ**: Markdownテキスト、スタイル設定
- **特徴**: リアルタイムプレビュー、シンタックスハイライト

## 設計原則

- **再利用性**: 他の場所でも使用できる汎用的な設計
- **独立性**: 外部依存を最小限に抑える
- **カスタマイズ性**: プロパティを通じて柔軟に設定可能
- **パフォーマンス**: 効率的なレンダリング

## 使用方法

```javascript
// ChatModeSelectorの使用例
<ChatModeSelector 
  currentMode={mode} 
  onModeChange={handleModeChange} 
/>

// MarkdownPreviewの使用例
<MarkdownPreview 
  content={markdownText} 
  className="preview-container" 
/>
```

## 開発ガイドライン

- プロパティの型チェックを行う
- デフォルト値を適切に設定する
- エラーハンドリングを実装する
- アクセシビリティ属性を追加する
