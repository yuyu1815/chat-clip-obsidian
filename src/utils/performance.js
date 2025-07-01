/**
 * パフォーマンス測定ユーティリティ
 * 処理時間やメモリ使用量の測定
 */

class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = new Map();
  }

  /**
   * パフォーマンスマークを設定
   * @param {string} name - マーク名
   */
  mark(name) {
    if (performance.mark) {
      performance.mark(name);
    }
    this.marks.set(name, performance.now());
  }

  /**
   * 2つのマーク間の時間を測定
   * @param {string} name - 測定名
   * @param {string} startMark - 開始マーク
   * @param {string} endMark - 終了マーク
   * @returns {number} 経過時間（ミリ秒）
   */
  measure(name, startMark, endMark) {
    if (performance.measure) {
      performance.measure(name, startMark, endMark);
    }
    
    const startTime = this.marks.get(startMark);
    const endTime = this.marks.get(endMark);
    
    if (startTime && endTime) {
      const duration = endTime - startTime;
      this.measures.set(name, duration);
      return duration;
    }
    
    return 0;
  }

  /**
   * 関数の実行時間を測定
   * @param {string} name - 測定名
   * @param {Function} fn - 実行する関数
   * @returns {Promise|any} 関数の実行結果
   */
  async measureFunction(name, fn) {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    
    this.mark(startMark);
    
    try {
      const result = await fn();
      this.mark(endMark);
      const duration = this.measure(name, startMark, endMark);
      
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      this.mark(endMark);
      this.measure(name, startMark, endMark);
      throw error;
    }
  }

  /**
   * メモリ使用量を取得
   * @returns {Object} メモリ情報
   */
  getMemoryUsage() {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    return null;
  }

  /**
   * 測定結果をコンソールに出力
   */
  logResults() {
    console.group('📊 Performance Results');
    
    for (const [name, duration] of this.measures) {
      console.log(`${name}: ${duration.toFixed(2)}ms`);
    }
    
    const memory = this.getMemoryUsage();
    if (memory) {
      console.log(`Memory: ${memory.used}MB / ${memory.total}MB (limit: ${memory.limit}MB)`);
    }
    
    console.groupEnd();
  }

  /**
   * 測定データをクリア
   */
  clear() {
    this.marks.clear();
    this.measures.clear();
    
    if (performance.clearMarks) {
      performance.clearMarks();
    }
    if (performance.clearMeasures) {
      performance.clearMeasures();
    }
  }
}

// グローバルインスタンス
const performanceMonitor = new PerformanceMonitor();

/**
 * 簡単なパフォーマンス測定デコレータ
 * @param {string} name - 測定名
 * @returns {Function} デコレータ関数
 */
function measureTime(name) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      return performanceMonitor.measureFunction(
        `${target.constructor.name}.${propertyKey}`,
        () => originalMethod.apply(this, args)
      );
    };
    
    return descriptor;
  };
}

/**
 * バンドルサイズ分析
 */
class BundleAnalyzer {
  /**
   * ロードされたリソースのサイズを分析
   * @returns {Object} リソース分析結果
   */
  static analyzeLoadedResources() {
    if (!performance.getEntriesByType) {
      return null;
    }

    const resources = performance.getEntriesByType('resource');
    const analysis = {
      scripts: [],
      stylesheets: [],
      total: 0
    };

    resources.forEach(resource => {
      const size = resource.transferSize || resource.encodedBodySize || 0;
      const item = {
        name: resource.name,
        size: Math.round(size / 1024), // KB
        type: this.getResourceType(resource.name)
      };

      if (item.type === 'script') {
        analysis.scripts.push(item);
      } else if (item.type === 'style') {
        analysis.stylesheets.push(item);
      }

      analysis.total += item.size;
    });

    // サイズ順にソート
    analysis.scripts.sort((a, b) => b.size - a.size);
    analysis.stylesheets.sort((a, b) => b.size - a.size);

    return analysis;
  }

  /**
   * リソースタイプを判定
   * @param {string} url - リソースURL
   * @returns {string} リソースタイプ
   */
  static getResourceType(url) {
    if (url.endsWith('.js')) return 'script';
    if (url.endsWith('.css')) return 'style';
    if (url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/)) return 'image';
    return 'other';
  }

  /**
   * バンドル分析結果をコンソールに出力
   */
  static logBundleAnalysis() {
    const analysis = this.analyzeLoadedResources();
    if (!analysis) {
      console.warn('Bundle analysis not available');
      return;
    }

    console.group('📦 Bundle Analysis');
    console.log(`Total Size: ${analysis.total}KB`);
    
    if (analysis.scripts.length > 0) {
      console.group('JavaScript Files');
      analysis.scripts.forEach(script => {
        console.log(`${script.name}: ${script.size}KB`);
      });
      console.groupEnd();
    }

    if (analysis.stylesheets.length > 0) {
      console.group('CSS Files');
      analysis.stylesheets.forEach(style => {
        console.log(`${style.name}: ${style.size}KB`);
      });
      console.groupEnd();
    }

    console.groupEnd();
  }
}

export { PerformanceMonitor, performanceMonitor, measureTime, BundleAnalyzer };

// CommonJS compatibility for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PerformanceMonitor, performanceMonitor, measureTime, BundleAnalyzer };
  module.exports.default = { PerformanceMonitor, performanceMonitor, measureTime, BundleAnalyzer };
} 