/**
 * Web Worker管理ユーティリティ
 * Promise ベースの簡単なAPI を提供
 */

class WorkerManager {
  constructor() {
    this.workers = new Map();
    this.requestCounter = 0;
    this.pendingRequests = new Map();
  }

  /**
   * Workerを取得または作成
   * @param {string} workerPath - Workerファイルのパス
   * @returns {Worker} Workerインスタンス
   */
  getWorker(workerPath) {
    if (!this.workers.has(workerPath)) {
      const worker = new Worker(workerPath);
      
      // レスポンスハンドラーを設定
      worker.onmessage = (e) => {
        const { id, success, result, error } = e.data;
        const pendingRequest = this.pendingRequests.get(id);
        
        if (pendingRequest) {
          this.pendingRequests.delete(id);
          
          if (success) {
            pendingRequest.resolve(result);
          } else {
            pendingRequest.reject(new Error(error));
          }
        }
      };

      // エラーハンドラーを設定
      worker.onerror = (error) => {
        console.error('Worker error:', error);
        // 全ての保留中のリクエストを拒否
        for (const [id, request] of this.pendingRequests) {
          request.reject(new Error('Worker error'));
          this.pendingRequests.delete(id);
        }
      };

      this.workers.set(workerPath, worker);
    }
    
    return this.workers.get(workerPath);
  }

  /**
   * Workerにメッセージを送信してPromiseで結果を受け取る
   * @param {string} workerPath - Workerファイルのパス
   * @param {string} type - 操作タイプ
   * @param {Object} data - 送信データ
   * @returns {Promise} 処理結果のPromise
   */
  sendMessage(workerPath, type, data) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestCounter;
      const worker = this.getWorker(workerPath);
      
      // リクエストを記録
      this.pendingRequests.set(id, { resolve, reject });
      
      // メッセージ送信
      worker.postMessage({ id, type, data });
    });
  }

  /**
   * 特定のWorkerを終了
   * @param {string} workerPath - Workerファイルのパス
   */
  terminateWorker(workerPath) {
    const worker = this.workers.get(workerPath);
    if (worker) {
      worker.terminate();
      this.workers.delete(workerPath);
      
      // 該当Workerの保留中リクエストを拒否
      for (const [id, request] of this.pendingRequests) {
        request.reject(new Error('Worker terminated'));
        this.pendingRequests.delete(id);
      }
    }
  }

  /**
   * 全てのWorkerを終了
   */
  terminateAll() {
    for (const workerPath of this.workers.keys()) {
      this.terminateWorker(workerPath);
    }
  }
}

// テキスト分割用の便利な関数
class TextSplitter {
  constructor() {
    this.workerManager = new WorkerManager();
    this.workerPath = '/workers/textSplitter.js';
  }

  /**
   * テキストを分割
   * @param {string} text - 分割対象のテキスト
   * @param {number} maxSize - 最大文字数
   * @param {number} overlap - 重複文字数
   * @returns {Promise<Array<string>>} 分割されたテキストの配列
   */
  async splitText(text, maxSize = 10000, overlap = 500) {
    return this.workerManager.sendMessage(this.workerPath, 'SPLIT_TEXT', {
      text,
      maxSize,
      overlap
    });
  }

  /**
   * Markdownを分割
   * @param {string} markdown - Markdownテキスト
   * @returns {Promise<Array<string>>} 分割されたMarkdownの配列
   */
  async splitMarkdown(markdown) {
    return this.workerManager.sendMessage(this.workerPath, 'SPLIT_MARKDOWN', {
      markdown
    });
  }

  /**
   * メッセージ配列を分割
   * @param {Array} messages - メッセージ配列
   * @returns {Promise<Array>} 分割されたメッセージ配列
   */
  async splitMessages(messages) {
    return this.workerManager.sendMessage(this.workerPath, 'SPLIT_MESSAGES', {
      messages
    });
  }

  /**
   * Workerを終了
   */
  terminate() {
    this.workerManager.terminateWorker(this.workerPath);
  }
}

export { WorkerManager, TextSplitter };

// CommonJS compatibility for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WorkerManager, TextSplitter };
  module.exports.default = { WorkerManager, TextSplitter };
} 