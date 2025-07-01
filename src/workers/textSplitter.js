/**
 * テキスト分割処理用 Web Worker
 * メインスレッドをブロックせずに長文を分割
 */

// 分割設定
const MAX_CHUNK_SIZE = 10000; // 文字数上限
const OVERLAP_SIZE = 500;     // 重複文字数

/**
 * テキストを指定されたサイズに分割
 * @param {string} text - 分割対象のテキスト
 * @param {number} maxSize - 最大文字数
 * @param {number} overlap - 重複文字数
 * @returns {Array<string>} 分割されたテキストの配列
 */
function splitText(text, maxSize = MAX_CHUNK_SIZE, overlap = OVERLAP_SIZE) {
  if (text.length <= maxSize) {
    return [text];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxSize;
    
    // テキストの終わりに達した場合
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    // 適切な分割ポイントを見つける
    const chunk = text.slice(start, end);
    let splitPoint = findBestSplitPoint(chunk);
    
    if (splitPoint > 0) {
      chunks.push(text.slice(start, start + splitPoint));
      start = start + splitPoint - overlap;
    } else {
      // 適切な分割ポイントが見つからない場合は強制分割
      chunks.push(chunk);
      start = end - overlap;
    }

    // 重複を考慮して次の開始点を調整
    if (start < 0) start = 0;
  }

  return chunks;
}

/**
 * 最適な分割ポイントを見つける
 * @param {string} text - 分割対象のテキスト
 * @returns {number} 分割ポイントのインデックス
 */
function findBestSplitPoint(text) {
  // 優先順位の高い分割ポイント
  const splitPatterns = [
    /\n\n/g,           // 段落区切り
    /\n/g,             // 行区切り
    /\.\s+/g,          // 文末
    /[!?]\s+/g,        // 感嘆符・疑問符
    /[;:]\s+/g,        // セミコロン・コロン
    /,\s+/g,           // カンマ
    /\s+/g             // 空白
  ];

  // 後ろから優先順位の高いパターンを探す
  for (const pattern of splitPatterns) {
    const matches = [...text.matchAll(pattern)];
    if (matches.length > 0) {
      // 最後のマッチを使用
      const lastMatch = matches[matches.length - 1];
      return lastMatch.index + lastMatch[0].length;
    }
  }

  return 0; // 適切な分割ポイントが見つからない
}

/**
 * Markdown形式のテキストを適切に分割
 * @param {string} markdown - Markdownテキスト
 * @returns {Array<string>} 分割されたMarkdownの配列
 */
function splitMarkdown(markdown) {
  // Markdownの構造を考慮した分割
  const sections = markdown.split(/\n(?=#{1,6}\s)/); // ヘッダーで分割
  const chunks = [];

  for (const section of sections) {
    if (section.length <= MAX_CHUNK_SIZE) {
      chunks.push(section);
    } else {
      // 大きなセクションはさらに分割
      const subChunks = splitText(section);
      chunks.push(...subChunks);
    }
  }

  return chunks;
}

/**
 * メッセージ処理
 */
self.onmessage = function(e) {
  const { type, data, id } = e.data;

  try {
    let result;

    switch (type) {
      case 'SPLIT_TEXT':
        result = splitText(data.text, data.maxSize, data.overlap);
        break;
      
      case 'SPLIT_MARKDOWN':
        result = splitMarkdown(data.markdown);
        break;
      
      case 'SPLIT_MESSAGES':
        // 複数メッセージの場合は個別に処理
        result = data.messages.map(message => {
          if (message.content.length > MAX_CHUNK_SIZE) {
            const chunks = splitText(message.content);
            return chunks.map((chunk, index) => ({
              ...message,
              content: chunk,
              part: index + 1,
              totalParts: chunks.length
            }));
          }
          return [message];
        }).flat();
        break;
      
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }

    // 成功レスポンス
    self.postMessage({
      id,
      success: true,
      result
    });

  } catch (error) {
    // エラーレスポンス
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
}; 