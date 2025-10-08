/**
 * File System Access API service for direct vault writing
 * Handles saving files directly to the user's Obsidian vault
 */

class FileSystemService {
  constructor() {
    this.directoryHandle = null;
    this.dbName = 'ChatVaultDB';
    this.storeName = 'handles';
  }

  /**
   * Initialize the service by loading the stored directory handle
   */
  async init() {
    try {
      const handle = await this.loadDirectoryHandle();
      if (handle) {
        // Verify we still have permission
        const permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          this.directoryHandle = handle;
          return true;
        } else if (permission === 'prompt') {
          // Request permission again
          const newPermission = await handle.requestPermission({ mode: 'readwrite' });
          if (newPermission === 'granted') {
            this.directoryHandle = handle;
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      console.error('[FileSystemService] Error initializing:', error);
      return false;
    }
  }

  /**
   * Load the directory handle from IndexedDB
   */
  async loadDirectoryHandle() {
    try {
      const db = await this.openDB();
      const tx = db.transaction([this.storeName], 'readonly');
      const store = tx.objectStore(this.storeName);
      const handle = await this.promisifyRequest(store.get('vaultDirectory'));
      db.close();
      return handle;
    } catch (error) {
      console.error('[FileSystemService] Error loading directory handle:', error);
      return null;
    }
  }

  /**
   * Open IndexedDB
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  /**
   * Convert IndexedDB request to promise
   */
  promisifyRequest(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save a file to the vault
   * @param {string} relativePath - Path relative to vault root (e.g., "ChatVault/ChatGPT/2024-01-01_Title.md")
   * @param {string} content - File content
   */
  async saveFile(relativePath, content) {
    try {
      if (!this.directoryHandle) {
        throw new Error('No directory handle available. Please select a vault folder first.');
      }

      // Parse the path into segments
      const pathSegments = relativePath.split('/').filter(segment => segment);
      const fileName = pathSegments.pop();
      
      // Navigate/create subdirectories
      let currentDir = this.directoryHandle;
      for (const segment of pathSegments) {
        try {
          currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
        } catch (error) {
          console.error(`[FileSystemService] Error creating directory ${segment}:`, error);
          throw error;
        }
      }

      // Create or overwrite the file
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      console.log(`[FileSystemService] File saved successfully: ${relativePath}`);
      return true;
    } catch (error) {
      console.error('[FileSystemService] Error saving file:', error);
      throw error;
    }
  }

  /**
   * Check if we have a valid directory handle
   */
  hasValidHandle() {
    return this.directoryHandle !== null;
  }

  /**
   * Get the name of the selected directory
   */
  getDirectoryName() {
    return this.directoryHandle ? this.directoryHandle.name : null;
  }
}

// Export singleton instance
export default new FileSystemService();