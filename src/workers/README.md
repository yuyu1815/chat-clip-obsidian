# Workers

Web Workersを含むディレクトリです。

## 概要

このディレクトリには、バックグラウンド処理を担当するWeb Workersが含まれています。重い処理をメインスレッドから分離し、UIの応答性を保ちます。

## ディレクトリ構造

```
workers/
├── textSplitter.js  # テキスト分割処理
└── README.md        # このファイル
```

## ファイル説明

### textSplitter.js
テキスト分割処理（4.1KB、160行）
- **機能**: 大規模テキストの分割処理
- **特徴**: バックグラウンドでの重い処理
- **用途**: 長いチャット履歴の分割

## 主要機能

### テキスト分割
- **大規模テキスト**: 長いテキストの効率的な処理
- **チャンク分割**: 適切なサイズでの分割
- **境界検出**: 文や段落の境界を考慮
- **メモリ最適化**: メモリ使用量の制御

### バックグラウンド処理
- **非同期処理**: UIをブロックしない処理
- **進捗報告**: 処理の進行状況の通知
- **エラーハンドリング**: 処理エラーの適切な処理
- **リソース管理**: 効率的なリソース使用

## アーキテクチャ

### Worker通信
```javascript
// メインスレッドからWorkerへ
worker.postMessage({
  type: 'split',
  text: largeText,
  options: { chunkSize: 1000 }
});

// Workerからメインスレッドへ
self.postMessage({
  type: 'progress',
  progress: 50,
  result: splitText
});
```

### 処理フロー
1. **初期化**: Workerの初期化
2. **タスク受信**: メインスレッドからのタスク
3. **処理実行**: バックグラウンドでの処理
4. **進捗報告**: 定期的な進捗通知
5. **結果送信**: 処理完了時の結果送信

## パフォーマンス最適化

### 最適化技術
- **ストリーミング処理**: 大きなデータの段階的処理
- **メモリ管理**: 効率的なメモリ使用
- **キャッシュ**: 処理結果のキャッシュ
- **並列処理**: 複数Workerでの並列処理

### 監視機能
- **実行時間**: 処理時間の測定
- **メモリ使用量**: メモリ消費の監視
- **CPU使用率**: CPU負荷の監視
- **エラー率**: エラー発生率の追跡

## 使用例

```javascript
// Workerの作成
const worker = new Worker('./workers/textSplitter.js');

// テキスト分割の実行
worker.postMessage({
  type: 'split',
  text: longText,
  options: {
    chunkSize: 1000,
    preserveParagraphs: true
  }
});

// 結果の受信
worker.onmessage = (event) => {
  const { type, progress, result, error } = event.data;
  
  if (type === 'progress') {
    console.log(`進捗: ${progress}%`);
  } else if (type === 'complete') {
    console.log('分割完了:', result);
  } else if (type === 'error') {
    console.error('エラー:', error);
  }
};
```

## 開発ガイドライン

- **重い処理**: 重い処理はWorkerで実行
- **エラーハンドリング**: 適切なエラーハンドリングを実装
- **メモリ管理**: メモリリークを防ぐ
- **進捗報告**: 進捗報告を定期的に行う
- **リソース解放**: 処理完了後のリソース解放

## デバッグ

```javascript
// Worker内でのデバッグ
console.log('[Worker] 処理開始');

// エラー処理
try {
  const result = processData(data);
  self.postMessage({ type: 'complete', result });
} catch (error) {
  self.postMessage({ type: 'error', error: error.message });
}
```

## 注意事項

- WorkerはDOMにアクセスできません
- メインスレッドとの通信は非同期です
- 適切なリソース管理を行ってください
- エラー時の適切なフォールバックを実装してください
