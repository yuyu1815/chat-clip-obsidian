# ChatVault Clip UI/UX改善計画

## 🎯 改善方針
基本機能は完成しているため、日常使いの快適性向上に集中する。
複雑な新機能より、細かな使い勝手の改善を優先。

---

## 📋 改善項目リスト

### 1. 保存ボタンの状態管理 🔴 優先度：高

#### 現状の問題
- 保存ボタンクリック後、「⏳ Saving...」のまま戻らない
- 保存成功/失敗が分かりにくい
- 連続クリックでの重複保存の可能性

#### 改善案
```javascript
// inject.js の改善
async function handleSaveClick(messageElement) {
  const button = messageElement.querySelector(BUTTON_SELECTOR);
  const originalContent = button.innerHTML;
  
  // 1. 保存中の状態
  button.disabled = true;
  button.classList.add('saving');
  button.innerHTML = '⏳';
  
  try {
    // 保存処理...
    chrome.runtime.sendMessage({...}, (response) => {
      if (response && response.success) {
        // 2. 成功状態
        button.classList.remove('saving');
        button.classList.add('saved');
        button.innerHTML = '✓';
        
        // 3. 2秒後に元に戻す
        setTimeout(() => {
          button.innerHTML = originalContent;
          button.classList.remove('saved');
          button.disabled = false;
        }, 2000);
      } else {
        // 4. エラー状態
        button.classList.add('error');
        button.innerHTML = '❌';
        setTimeout(() => {
          button.innerHTML = originalContent;
          button.classList.remove('error');
          button.disabled = false;
        }, 3000);
      }
    });
  } catch (error) {
    // エラー処理
  }
  
  // 5. タイムアウト処理（5秒）
  setTimeout(() => {
    if (button.disabled && button.classList.contains('saving')) {
      button.innerHTML = originalContent;
      button.classList.remove('saving');
      button.disabled = false;
    }
  }, 5000);
}
```

#### CSS追加
```css
.chatvault-save-btn.saving {
  animation: pulse 1s infinite;
}

.chatvault-save-btn.saved {
  color: #10b981;
}

.chatvault-save-btn.error {
  color: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
```

---

### 2. ページ読み込みパフォーマンス 🟡 優先度：中

#### 現状の問題
- 500ms間隔×20回のリトライが非効率
- 初回読み込み時の遅延
- 不要な再スキャンによるパフォーマンス低下

#### 改善案

##### A. 段階的リトライ間隔
```javascript
function initializeWithSmartRetry() {
  const retrySchedule = [
    { interval: 100, count: 3 },   // 最初は高速で3回
    { interval: 500, count: 5 },   // 中速で5回
    { interval: 1000, count: 5 },  // 低速で5回
  ];
  
  let totalRetries = 0;
  
  function tryAddButtons() {
    const messages = document.querySelectorAll(selectors.container);
    const hasNewMessages = messages.length > document.querySelectorAll('.chatvault-save-btn').length;
    
    if (hasNewMessages) {
      messages.forEach(addSaveButton);
    }
    
    // すべてのメッセージにボタンがある場合は終了
    if (!hasNewMessages && messages.length > 0) {
      return true;
    }
    
    return false;
  }
  
  // 段階的なリトライ実行
  async function executeRetrySchedule() {
    for (const phase of retrySchedule) {
      for (let i = 0; i < phase.count; i++) {
        if (tryAddButtons()) return;
        await new Promise(resolve => setTimeout(resolve, phase.interval));
        totalRetries++;
      }
    }
  }
  
  executeRetrySchedule();
}
```

##### B. IntersectionObserver による遅延読み込み対応
```javascript
// スクロールで表示されたメッセージにのみボタンを追加
const messageObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.querySelector('.chatvault-save-btn')) {
      addSaveButton(entry.target);
    }
  });
}, {
  rootMargin: '100px' // 表示前100pxから準備開始
});

// メッセージ要素を監視対象に追加
function observeMessage(messageElement) {
  messageObserver.observe(messageElement);
}
```

---

### 3. ボタンの表示/非表示アニメーション 🟢 優先度：低

#### 現状の問題
- ボタンの表示が唐突
- ホバー時の反応が遅い

#### 改善案
```css
.chatvault-save-btn {
  opacity: 0;
  transform: scale(0.8);
  transition: all 0.2s ease-out;
}

/* メッセージホバー時に表示 */
[data-message-author-role]:hover .chatvault-save-btn,
.chatvault-save-btn:hover,
.chatvault-save-btn.show {
  opacity: 0.7;
  transform: scale(1);
}

.chatvault-save-btn:hover {
  opacity: 1;
}

/* 保存済みは常に表示 */
.chatvault-save-btn.saved {
  opacity: 0.5;
}
```

---

### 4. 重複保存の防止 🔴 優先度：高

#### 現状の問題
- 連続クリックで同じメッセージを複数回保存可能
- ネットワーク遅延時の重複リクエスト

#### 改善案
```javascript
// メッセージIDベースの保存履歴管理
const savedMessages = new Set();

function handleSaveClick(messageElement) {
  // メッセージIDを取得
  const messageId = messageElement.getAttribute('data-message-id') || 
                    generateMessageHash(messageElement.textContent);
  
  // 既に保存済みかチェック
  if (savedMessages.has(messageId)) {
    showNotification('Already saved!', 'info');
    return;
  }
  
  // 保存処理
  savedMessages.add(messageId);
  // ...
}

// ローカルストレージに保存履歴を記録
function persistSaveHistory() {
  const history = Array.from(savedMessages).slice(-100); // 最新100件のみ
  localStorage.setItem('chatvault-saved-messages', JSON.stringify(history));
}
```

---

### 5. エラーハンドリングとユーザーフィードバック 🟡 優先度：中

#### 現状の問題
- エラー時のフィードバックが不親切
- ネットワークエラーと設定エラーの区別がない

#### 改善案

##### A. トースト通知システム
```javascript
// 通知表示用の軽量システム
class ToastNotification {
  static show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `chatvault-toast chatvault-toast-${type}`;
    toast.textContent = message;
    
    // スタイル設定
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      background: ${type === 'error' ? '#ef4444' : '#10b981'};
      color: white;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }
}

// 使用例
ToastNotification.show('Saved to Obsidian!', 'success');
ToastNotification.show('Vault not configured', 'error');
```

##### B. エラータイプ別メッセージ
```javascript
function handleError(error, response) {
  if (!response) {
    ToastNotification.show('Extension error. Please reload.', 'error');
  } else if (response.error?.includes('vault')) {
    ToastNotification.show('Check Obsidian vault settings', 'error');
  } else if (response.error?.includes('network')) {
    ToastNotification.show('Network error. Please retry.', 'error');
  } else {
    ToastNotification.show('Save failed. Check console.', 'error');
  }
}
```

---

### 6. キーボードショートカット 🟢 優先度：低

#### 追加するショートカット
- `Ctrl/Cmd + Shift + S`: 現在のメッセージを保存
- `Ctrl/Cmd + Shift + A`: すべてのメッセージを保存
- `Esc`: 選択モードをキャンセル

```javascript
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Shift + S
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    const currentMessage = findCurrentMessage();
    if (currentMessage) {
      handleSaveClick(currentMessage);
    }
  }
});
```

---

### 7. メモリ使用量の最適化 🟡 優先度：中

#### 現状の問題
- 長時間使用でのメモリリーク可能性
- 不要なイベントリスナーの蓄積

#### 改善案
```javascript
// WeakMapを使用してメモリリークを防ぐ
const messageButtonMap = new WeakMap();

function addSaveButton(messageElement) {
  // 既存のボタンチェック
  if (messageButtonMap.has(messageElement)) return;
  
  const button = createSaveButton();
  messageButtonMap.set(messageElement, button);
  
  // クリーンアップ
  const cleanup = () => {
    button.removeEventListener('click', handleClick);
    messageButtonMap.delete(messageElement);
  };
  
  // MutationObserverでメッセージ削除を検知
  const cleanupObserver = new MutationObserver(() => {
    if (!document.contains(messageElement)) {
      cleanup();
      cleanupObserver.disconnect();
    }
  });
  
  cleanupObserver.observe(messageElement.parentNode, { childList: true });
}
```

---

## 🚀 実装順序

### Phase 1: 即効性のある改善（1週間）
1. ✅ 保存ボタンの状態管理
2. ✅ 重複保存の防止
3. ✅ 基本的なエラーハンドリング

### Phase 2: パフォーマンス改善（1週間）
1. ✅ ページ読み込みの最適化
2. ✅ メモリ使用量の最適化
3. ✅ IntersectionObserverの実装

### Phase 3: UX向上（1週間）
1. ✅ トースト通知システム
2. ✅ ボタンアニメーション
3. ✅ キーボードショートカット

---

## 📊 成功指標

### 定量的指標
- 初回ボタン表示時間: 3秒以内 → 1秒以内
- メモリ使用量: 50MB以下を維持
- エラー率: 1%以下

### 定性的指標
- 保存の成功/失敗が一目で分かる
- 操作がスムーズで違和感がない
- 長時間使用でも快適

---

## 🛠 テスト項目

### 機能テスト
- [ ] 保存ボタンの状態遷移（通常→保存中→成功/失敗→通常）
- [ ] 重複保存の防止機能
- [ ] エラー時の復帰
- [ ] キーボードショートカット

### パフォーマンステスト
- [ ] 100メッセージでの動作速度
- [ ] 1時間使用後のメモリ使用量
- [ ] スクロール時の描画パフォーマンス

### ブラウザ互換性
- [ ] Chrome
- [ ] Edge
- [ ] Brave
- [ ] Firefox（将来）

---

## 📝 メモ

- シンプルさを保つ - 機能追加より改善を優先
- ユーザーフィードバックを大切に
- 小さな改善の積み重ねが大きな価値を生む

---

**作成日**: 2025-06-19
**最終更新**: 2025-06-19