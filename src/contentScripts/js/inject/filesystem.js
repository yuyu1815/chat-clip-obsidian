// File System Access API helpers isolated from inject.js

async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatVaultDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('handles')) {
        db.createObjectStore('handles');
      }
    };
  });
}

export async function loadDirectoryHandle() {
  try {
    const db = await openDB();
    const tx = db.transaction(['handles'], 'readonly');
    const store = tx.objectStore('handles');
    const request = store.get('vaultDirectory');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close();
        resolve(request.result);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('[ChatVault] ディレクトリハンドル読み込みエラー:', error);
    return null;
  }
}

export async function saveDirectoryHandle(handle) {
  try {
    const db = await openDB();
    const tx = db.transaction(['handles'], 'readwrite');
    const store = tx.objectStore('handles');
    await new Promise((resolve, reject) => {
      const req = store.put(handle, 'vaultDirectory');
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    db.close();
  } catch (error) {
    console.error('[ChatVault] ディレクトリハンドル保存エラー:', error);
  }
}

export async function ensureDirectoryHandleIfNeeded() {
  try {
    // Guard against missing chrome or storage API (e.g., context invalidated)
    const hasStorageGet = typeof chrome === 'object' && chrome && chrome.storage && chrome.storage.sync && typeof chrome.storage.sync.get === 'function';

    let method;
    if (hasStorageGet) {
      const prefs = await new Promise((resolve) => {
        chrome.storage.sync.get(['saveMethod'], resolve);
      });
      method = prefs?.saveMethod || 'filesystem';
    } else {
      // If we cannot read settings, avoid prompting the directory picker here
      // and let background fall back to other methods.
      method = 'auto';
    }

    if (method !== 'filesystem' && method !== 'auto') return;

    const existing = await loadDirectoryHandle();
    if (existing) {
      const perm = await existing.queryPermission?.({ mode: 'readwrite' });
      if (perm === 'granted') return;
      const req = await existing.requestPermission?.({ mode: 'readwrite' });
      if (req === 'granted') return;
    }

    if (typeof window.showDirectoryPicker === 'function' && method !== 'auto') {
      const dir = await window.showDirectoryPicker({ mode: 'readwrite' });
      await saveDirectoryHandle(dir);
    }
  } catch (e) {
    // Non-fatal: background will fall back to other save methods
    console.warn('[ChatVault] ensureDirectoryHandleIfNeeded skipped quietly:', e?.message || e);
  }
}

export async function handleFileSystemSave(content, relativePath) {
  try {
    console.log('[ChatVault] File System Access API保存を試行中...');

    let dirHandle = await loadDirectoryHandle();
    if (!dirHandle) {
      if (typeof window.showDirectoryPicker === 'function') {
        try {
          dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
          await saveDirectoryHandle(dirHandle);
        } catch (e) {
          throw new Error('Vaultフォルダが未設定です。オプションで設定するか、保存時に表示されるダイアログで許可してください。');
        }
      } else {
        throw new Error('このブラウザはFile System Access APIをサポートしていません。オプションから別の保存方法を選択してください。');
      }
    }

    const permission = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (permission !== 'granted') {
      const newPermission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (newPermission !== 'granted') {
        throw new Error('ファイルシステム権限が拒否されました');
      }
    }

    const pathSegments = relativePath.split('/').filter(segment => segment);
    const fileName = pathSegments.pop();

    let currentDir = dirHandle;
    for (const segment of pathSegments) {
      currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
    }

    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();

    console.log('[ChatVault] File System Access API経由でファイルを保存しました');
    return { success: true, method: 'filesystem' };
  } catch (error) {
    console.error('[ChatVault] File System Access APIエラー:', error);
    return { success: false, error: error.message };
  }
}

export default {
  loadDirectoryHandle,
  saveDirectoryHandle,
  ensureDirectoryHandleIfNeeded,
  handleFileSystemSave,
};
