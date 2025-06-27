/* global chrome */
import React, { useState, useEffect } from "react";

const OptionsApp = () => {

  // Original settings
  const [vault, setVault] = useState("");
  const [folder, setFolder] = useState("ChatVault");
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(false);
  const [noteContentFormat, setNoteContentFormat] = useState("");

  // ChatVault settings
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [defaultMode, setDefaultMode] = useState("single");
  const [showSaveButton, setShowSaveButton] = useState(true);
  const [buttonPosition, setButtonPosition] = useState("top-right");
  const [chatFolderPath, setChatFolderPath] = useState("ChatVault/{service}/{title}");
  const [chatNoteFormat, setChatNoteFormat] = useState("---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\n---\n\n{content}");
  const [showPreview, setShowPreview] = useState(true);
  const [defaultMessageCount, setDefaultMessageCount] = useState(30);
  const [autoTagging, setAutoTagging] = useState(true);
  
  // Save method settings  
  const [saveMethod, setSaveMethod] = useState("filesystem");
  const [downloadsFolder, setDownloadsFolder] = useState("ChatVault");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folderPath, setFolderPath] = useState("");

  const defaultNoteContentFormat = "{url}\n\n{content}";

  useEffect(() => {
    console.log('[ChatVault Options] 🔄 Loading settings from storage...');
    
    // Load the settings from browser storage
    chrome.storage.sync.get(
      [
        "obsidianVault",
        "folderPath",
        "showAdvancedFeatures",
        "noteContentFormat",
        "showChatSettings",
        "defaultMode",
        "showSaveButton",
        "buttonPosition",
        "chatFolderPath",
        "chatNoteFormat",
        "showPreview",
        "defaultMessageCount",
        "autoTagging",
        "saveMethod",
        "downloadsFolder",
        "selectedFolderPath"
      ],
      (result) => {
        console.log('[ChatVault Options] 📞 Loaded settings:', result);
        if (result.obsidianVault) {
          console.log('[ChatVault Options] 🏠 Setting vault:', result.obsidianVault);
          setVault(result.obsidianVault);
        } else {
          console.log('[ChatVault Options] ⚠️ No vault found in storage');
        }
        if (result.folderPath) {
          setFolder(result.folderPath);
        }
        // ChatVault settings
        if (result.showChatSettings !== undefined) {
          setShowChatSettings(result.showChatSettings);
        }
        if (result.defaultMode) {
          setDefaultMode(result.defaultMode);
        }
        if (result.showSaveButton !== undefined) {
          setShowSaveButton(result.showSaveButton);
        }
        if (result.buttonPosition) {
          setButtonPosition(result.buttonPosition);
        }
        if (result.chatFolderPath) {
          setChatFolderPath(result.chatFolderPath);
        }
        if (result.chatNoteFormat) {
          setChatNoteFormat(result.chatNoteFormat);
        }
        if (result.showPreview !== undefined) {
          setShowPreview(result.showPreview);
        }
        if (result.defaultMessageCount) {
          setDefaultMessageCount(result.defaultMessageCount);
        }
        if (result.autoTagging !== undefined) {
          setAutoTagging(result.autoTagging);
        }
        if (result.saveMethod) {
          setSaveMethod(result.saveMethod);
        }
        if (result.downloadsFolder) {
          setDownloadsFolder(result.downloadsFolder);
        }
        if (result.selectedFolderPath) {
          setFolderPath(result.selectedFolderPath);
        }
      }
    );
  }, []);

  const handleSelectFolder = async () => {
    try {
      console.log('[ChatVault Options] 📁 Opening folder picker...');
      // Check if File System Access API is available
      if (!('showDirectoryPicker' in window)) {
        alert('File System Access APIはサポートされていません。Chrome 86+またはEdge 86+を使用してください。');
        return;
      }

      // Open folder picker
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents'
      });
      
      console.log('[ChatVault Options] 📁 Folder selected:', dirHandle.name);
      setSelectedFolder(dirHandle);
      setFolderPath(dirHandle.name);
      
      // Store folder path in chrome storage
      chrome.storage.sync.set({ selectedFolderPath: dirHandle.name }, () => {
        console.log('[ChatVault Options] 💾 Folder path saved to storage');
      });
      
      // Store the directory handle in IndexedDB for persistence
      const db = await openDB();
      await saveDirectoryHandle(db, dirHandle);
      
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[ChatVault Options] 📁 Folder selection cancelled');
      } else {
        console.error('[ChatVault Options] ❌ Error selecting folder:', err);
        alert('フォルダ選択エラー: ' + err.message);
      }
    }
  };

  // IndexedDB functions for storing directory handle
  const openDB = () => {
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
  };

  const saveDirectoryHandle = async (db, handle) => {
    const tx = db.transaction(['handles'], 'readwrite');
    const store = tx.objectStore('handles');
    await store.put(handle, 'vaultDirectory');
    return tx.complete;
  };

  const handleSave = () => {
    console.log('[ChatVault Options] 🔥 handleSave called');
    console.log('[ChatVault Options] 📝 Current state:', {
      vault: vault,
      folder: folder,
      showChatSettings: showChatSettings,
      chatFolderPath: chatFolderPath
    });
    
    // Check if the required fields are empty
    if (vault.trim() === "" || folder.trim() === "") {
      console.error('[ChatVault Options] ❌ Required fields empty');
      alert(
        "Obsidian Vault名と基本フォルダ名の両方を入力してください。"
      );
      return;
    }

    const invalidCharacterPattern = /[\\:*?"<>|]/;

    if (invalidCharacterPattern.test(vault)) {
      alert(
        "無効な文字が検出されました。Vault名には次の文字を使用しないでください: /, \\, :, *, ?, \", <, >, |"
      );
      return;
    }

    // ChatVault specific validation
    if (showChatSettings) {
      const chatFolderPattern = /\{(title|service|date)\}/;
      if (!chatFolderPattern.test(chatFolderPath)) {
        alert("チャットフォルダパスには、少なくとも1つのプレースホルダー（{title}、{service}、または{date}）を含める必要があります");
        return;
      }
    }


    // Save the settings to browser storage
    chrome.storage.sync.set(
      {
        obsidianVault: vault,
        folderPath: folder,
        showAdvancedFeatures: showAdvancedFeatures,
        noteContentFormat: noteContentFormat,
        // ChatVault settings
        showChatSettings: showChatSettings,
        defaultMode: defaultMode,
        showSaveButton: showSaveButton,
        buttonPosition: buttonPosition,
        chatFolderPath: chatFolderPath,
        chatNoteFormat: chatNoteFormat,
        showPreview: showPreview,
        defaultMessageCount: defaultMessageCount,
        autoTagging: autoTagging,
        saveMethod: saveMethod,
        downloadsFolder: downloadsFolder.trim() || "ChatVault",
        selectedFolderPath: folderPath
      },
      () => {
        if (chrome.runtime.lastError) {
          console.error(`Error: ${chrome.runtime.lastError}`);
        } else {
          alert(
            `設定を保存しました！🎉\n\nチャットメッセージは次のフォルダに保存されます: "${chatFolderPath}"`
          );
          
          // Notify content scripts to update
          chrome.runtime.sendMessage({ action: 'saveSettings', settings: {} });
        }
      }
    );
  };

  const handleTest = () => {
    if (vault.trim() === "") {
      alert(
        "Obsidian Vault名を入力してください。"
      );
      return;
    }

    const title = "Chat Clip Test Note";
    const url = "https://chat.openai.com/test";
    const content = "### User\n\nTest question\n\n### Assistant\n\nThis is a test response from Chat Clip Obsidian!";
    const date = new Date().toISOString().split("T")[0];
    const service = "ChatGPT";

    let formattedContent = chatNoteFormat
      .replace("{url}", url)
      .replace("{title}", title)
      .replace("{content}", content)
      .replace("{date}", date)
      .replace("{service}", service);
    
    let folderPath = chatFolderPath.trim()
      .replace("{title}", title)
      .replace("{service}", service)
      .replace("{date}", date);

    if (!folderPath.endsWith(title)) {
      folderPath = folderPath + "/" + title;
    }

    const obsidianUri = `obsidian://new?vault=${encodeURIComponent(
      vault
    )}&file=${encodeURIComponent(
      folderPath
    )}&content=${encodeURIComponent(formattedContent)}`;
    
    if (vault.trim() !== "") {
      window.open(obsidianUri, "_blank");
    } else {
      alert("有効なObsidian Vault名を入力してください。");
    }
  };

  // New state for status message
  const [statusMessage, setStatusMessage] = useState("");

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">
            Chat Clip Obsidian 設定
          </h1>
          <p className="text-gray-400">
            コンテンツとチャットをObsidianに保存する方法を設定します。
          </p>
        </header>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2 text-purple-300">
            基本設定
          </h2>

          <div className="mb-4">
            <label htmlFor="vault" className="block text-lg font-medium mb-1">
              Obsidian Vault名
            </label>
            <p className="text-sm text-gray-400 mb-2">
              ( Obsidianで使用しているVault名を入力してください )
            </p>
            <input
              type="text"
              id="vault"
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={vault}
              onChange={(e) => setVault(e.target.value)}
              placeholder="My Obsidian Vault"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="folder"
              className="block text-lg font-medium mb-1"
            >
              基本フォルダ名
            </label>
            <p className="text-sm text-gray-400 mb-2">
              ( WebページをクリップするデフォルトのフォルダーLLM Chats/{service}/{title} )
            </p>
            <input
              type="text"
              id="folder"
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="Clippings"
            />
          </div>
        </div>
        
        {/* AI Chat Capture Settings */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-purple-300">
              AIチャット機能を有効化
            </h2>
            <label className="switch">
              <input
                type="checkbox"
                checked={showChatSettings}
                onChange={() => setShowChatSettings(!showChatSettings)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {showChatSettings && (
            <div className="border-t border-gray-700 pt-4">
              <div className="mb-4">
                <label htmlFor="chatFolderPath" className="block text-lg font-medium mb-1">
                  チャットメッセージの保存先フォルダ
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( 使用可能なプレースホルダー: {service}, {title}, {date} )
                </p>
                <input
                  type="text"
                  id="chatFolderPath"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={chatFolderPath}
                  onChange={(e) => setChatFolderPath(e.target.value)}
                  placeholder="ChatVault/{service}/{title}"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="saveMethod" className="block text-lg font-medium mb-1">
                  保存方法
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( Obsidianへのファイル保存方法を選択してください )
                </p>
                <select
                  id="saveMethod"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={saveMethod}
                  onChange={(e) => setSaveMethod(e.target.value)}
                >
                  <option value="filesystem">File System API (推奨)</option>
                  <option value="advanced-uri">Advanced URI プラグイン</option>
                  <option value="downloads">ダウンロードフォルダ経由</option>
                  <option value="clipboard">クリップボード経由</option>
                  <option value="auto">自動選択</option>
                </select>
              </div>
              
              {saveMethod === 'filesystem' && (
                <div className="mb-4 p-4 bg-gray-700 rounded">
                  <label className="block text-lg font-medium mb-1">
                    Obsidian Vaultフォルダ
                  </label>
                  <p className="text-sm text-gray-400 mb-2">
                    ( Obsidian Vaultのルートディレクトリを選択してください )
                  </p>
                  <button
                    onClick={handleSelectFolder}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                  >
                    {folderPath ? `${folderPath} (変更)` : 'Vault フォルダを選択'}
                  </button>
                   <p className="text-sm text-gray-400 mt-2">
                    このフォルダはObsidian Vaultのルートディレクトリである必要があります。ファイルは直接ここに保存されます。
                  </p>
                </div>
              )}
              
              <div className="mb-4">
                <label htmlFor="defaultMode" className="block text-lg font-medium mb-1">
                  デフォルトキャプチャモード
                </label>
                <select
                  id="defaultMode"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={defaultMode}
                  onChange={(e) => setDefaultMode(e.target.value)}
                >
                  <option value="single">単一メッセージ</option>
                  <option value="last3">最新3件</option>
                  <option value="last5">最新5件</option>
                  <option value="full">会話全体</option>
                  <option value="selection">選択範囲</option>
                </select>
              </div>

              {/* More settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label htmlFor="defaultMessageCount" className="block text-lg font-medium mb-1">
                    デフォルトメッセージ数
                  </label>
                  <p className="text-sm text-gray-400 mb-2">
                    ( 「最新N件」モードで保存するメッセージ数 )
                  </p>
                  <input
                    type="number"
                    id="defaultMessageCount"
                    min="1"
                    max="100"
                    className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                    value={defaultMessageCount}
                    onChange={(e) => setDefaultMessageCount(parseInt(e.target.value, 10))}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium mb-1">保存ボタン設定</label>
                  <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                    <input
                      type="checkbox"
                      id="showSaveButton"
                      className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                      checked={showSaveButton}
                      onChange={(e) => setShowSaveButton(e.target.checked)}
                    />
                    <label htmlFor="showSaveButton" className="ml-3 text-white">
                      チャットページに保存ボタンを表示
                    </label>
                  </div>
                  {showSaveButton && (
                    <div className="mt-2">
                      <label htmlFor="buttonPosition" className="block text-sm font-medium mb-1">ボタン位置</label>
                      <select
                        id="buttonPosition"
                        className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                        value={buttonPosition}
                        onChange={(e) => setButtonPosition(e.target.value)}
                      >
                        <option value="top-right">右上</option>
                        <option value="bottom-right">右下</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div>
                    <label className="block text-lg font-medium mb-1">自動タグ付け</label>
                     <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                        <input
                          type="checkbox"
                          id="autoTagging"
                          className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                          checked={autoTagging}
                          onChange={(e) => setAutoTagging(e.target.checked)}
                        />
                        <label htmlFor="autoTagging" className="ml-3 text-white">
                          サービス名を自動的にタグとして追加
                        </label>
                      </div>
                  </div>
                   <div>
                    <label className="block text-lg font-medium mb-1">プレビュー設定</label>
                     <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                        <input
                          type="checkbox"
                          id="showPreview"
                          className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                          checked={showPreview}
                          onChange={(e) => setShowPreview(e.target.checked)}
                        />
                        <label htmlFor="showPreview" className="ml-3 text-white">
                          保存前にMarkdownプレビューを表示
                        </label>
                      </div>
                  </div>
              </div>

              <div className="mb-4 mt-6">
                <label htmlFor="chatNoteFormat" className="block text-lg font-medium mb-1">
                  チャットノートフォーマット
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( 使用可能なプレースホルダー: {title}, {content}, {url}, {date}, {service} )
                </p>
                <div className="flex gap-2 my-2">
                    <button onClick={() => setChatNoteFormat('---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\n---\n\n{content}')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">デフォルト</button>
                    <button onClick={() => setChatNoteFormat('---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\ntags: [ai-chat, {service}]\n---\n\n# {title}\n\n{content}')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">タグ付き</button>
                    <button onClick={() => setChatNoteFormat('# {title}\\n\\n- **Date**: {date}\\n- **Service**: {service}\\n- **URL**: [{url}]({url})\\n\\n---\\n\\n{content}')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">シンプル</button>
                </div>
                <textarea
                  id="chatNoteFormat"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 font-mono"
                  rows="8"
                  value={chatNoteFormat}
                  onChange={(e) => setChatNoteFormat(e.target.value)}
                />
              </div>

            </div>
          )}
        </div>
        
        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={handleSave}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200 text-lg"
          >
            設定を保存
          </button>
        </div>
        
        {statusMessage && (
          <div className={`mt-4 p-3 rounded-lg text-center ${
            statusMessage.includes('Error') ? 'bg-red-500' : 'bg-green-500'
          }`}>
            {statusMessage}
          </div>
        )}
        
      </div>
    </div>
  );
};

export default OptionsApp;