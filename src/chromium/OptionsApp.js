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
        alert('File System Access API is not supported in your browser. Please use Chrome 86+ or Edge 86+.');
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
        alert('Error selecting folder: ' + err.message);
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
        "Please provide a value for both Obsidian Vault Name and Clip Notes to fields."
      );
      return;
    }

    const invalidCharacterPattern = /[\\:*?"<>|]/;

    if (invalidCharacterPattern.test(vault)) {
      alert(
        'Invalid character detected. Please avoid using the following characters in the Vault Name: /, \\, :, *, ?, ", <, >, |'
      );
      return;
    }

    // ChatVault specific validation
    if (showChatSettings) {
      const chatFolderPattern = /\{(title|service|date)\}/;
      if (!chatFolderPattern.test(chatFolderPath)) {
        alert("Chat folder path must contain at least one placeholder: {title}, {service}, or {date}");
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
            `Success! 🎉\n\nYour settings have been saved.\n\nChat messages will be saved to: "${chatFolderPath}"`
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
        "Please provide a value for Obsidian Vault Name."
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
      alert("Please provide a valid Obsidian Vault Name.");
    }
  };

  return (
    <div className="bg-zinc-800 px-32 py-8 min-h-screen">
      <h1 className="text-6xl font-bold text-white">ChatVault Clip</h1>
      <p className="text-gray-400 mt-8 text-xl">
        Save AI chat conversations and web pages directly to your Obsidian vault.
        This extension supports ChatGPT, Claude, and traditional web clipping.
        <br />
        <br />
        This is a fork of the original{" "}
        <a
          href="https://github.com/mvavassori/obsidian-web-clipper"
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-500 hover:underline"
        >
          Obsidian Web Clipper
        </a>{" "}
        by mvavassori, enhanced with AI chat capture capabilities.
      </p>
      
      <p className="mt-8 text-white text-3xl font-bold">Core Settings</p>
      
      <div className="my-8">
        <label className="text-white text-lg">
          Obsidian Vault Name{" "}
          <span className="text-gray-500 text-base">
            ( Enter the name of the Obsidian vault where you wish to save your content )
          </span>
        </label>
        <input
          required
          className="w-full px-4 py-2 mt-2 rounded-md bg-zinc-700 text-white text-lg"
          type="text"
          placeholder="My Vault"
          value={vault}
          onChange={(e) => setVault(e.target.value)}
        />
      </div>
      
      <div className="my-8">
        <label className="text-white text-lg">
          Base Folder Name{" "}
          <span className="text-gray-500 text-base">
            ( The base folder for all saved content )
          </span>
        </label>
        <input
          required
          className="w-full px-4 py-2 mt-2 rounded-md bg-zinc-700 text-white text-lg"
          type="text"
          placeholder="ChatVault"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        />
      </div>

      {/* ChatVault Settings Section */}
      <div className="mt-8 bg-indigo-950 p-4 rounded-md flex items-center justify-between text-white">
        <label className="text-lg">
          <input
            type="checkbox"
            className="mr-2"
            checked={showChatSettings}
            onChange={(e) => setShowChatSettings(e.target.checked)}
          />
          Enable ChatVault Features (AI Chat Capture)
        </label>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
      </div>

      {showChatSettings && (
        <div className="my-4 ml-8 border-l-4 border-indigo-600 pl-4">
          <div className="my-6">
            <label className="text-white text-lg">
              Chat Messages Folder{" "}
              <span className="text-gray-500 text-base">
                ( Use placeholders: {"{service}"}, {"{date}"}, {"{title}"} )
              </span>
            </label>
            <input
              className="w-full px-4 py-2 mt-2 rounded-md bg-zinc-700 text-white text-lg"
              type="text"
              placeholder="ChatVault/{service}/{title}"
              value={chatFolderPath}
              onChange={(e) => setChatFolderPath(e.target.value)}
            />
          </div>

          <div className="my-6">
            <label className="text-white text-lg">
              Save Method{" "}
              <span className="text-gray-500 text-base">
                ( Choose how to save files to Obsidian )
              </span>
            </label>
            <select
              className="w-full px-4 py-2 mt-2 rounded-md bg-zinc-700 text-white text-lg"
              value={saveMethod}
              onChange={(e) => setSaveMethod(e.target.value)}
            >
              <option value="filesystem">Direct Save (File System Access API)</option>
              <option value="auto">Auto (Try all methods)</option>
              <option value="downloads">Downloads API</option>
              <option value="advanced-uri">Advanced URI Plugin</option>
              <option value="clipboard">Clipboard (Manual paste)</option>
            </select>
            <p className="text-gray-400 mt-2 text-sm">
              {saveMethod === "filesystem" ? "Saves files directly to your chosen Obsidian vault folder. Requires folder selection below." :
               saveMethod === "downloads" ? "Files will be saved to your Downloads folder. You can then move them to your Obsidian vault." : 
               saveMethod === "advanced-uri" ? "Requires the Advanced URI plugin to be installed in Obsidian." :
               saveMethod === "clipboard" ? "Content will be copied to clipboard. You'll need to paste manually in Obsidian." :
               saveMethod === "auto" ? "Tries File System API first, then Downloads API, then Advanced URI, then falls back to clipboard." : ""}
            </p>
          </div>

          {(saveMethod === "filesystem" || saveMethod === "auto") && (
            <div className="my-6">
              <label className="text-white text-lg">
                Obsidian Vault Folder{" "}
                <span className="text-gray-500 text-base">
                  ( Select your Obsidian vault folder for direct saving )
                </span>
              </label>
              <div className="flex items-center mt-2">
                <button
                  type="button"
                  onClick={handleSelectFolder}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  Select Vault Folder
                </button>
                {folderPath && (
                  <span className="ml-4 text-gray-400">
                    Selected: {folderPath}
                  </span>
                )}
              </div>
              <p className="text-gray-400 mt-2 text-sm">
                This folder should be your Obsidian vault root directory. Files will be saved directly here.
              </p>
            </div>
          )}

          {(saveMethod === "downloads" || saveMethod === "auto") && (
            <div className="my-6">
              <label className="text-white text-lg">
                Downloads Subfolder{" "}
                <span className="text-gray-500 text-base">
                  ( Subfolder in Downloads directory for saved files )
                </span>
              </label>
              <input
                className="w-full px-4 py-2 mt-2 rounded-md bg-zinc-700 text-white text-lg"
                type="text"
                placeholder="ChatVault"
                value={downloadsFolder}
                onChange={(e) => setDownloadsFolder(e.target.value)}
              />
              <p className="text-gray-400 mt-2 text-sm">
                Files will be saved to: Downloads/{downloadsFolder}/{'{service}'}/{'{filename}'}
              </p>
            </div>
          )}

          <div className="my-6">
            <label className="text-white text-lg">
              Default Capture Mode
            </label>
            <select
              className="w-full px-4 py-2 mt-2 rounded-md bg-zinc-700 text-white text-lg"
              value={defaultMode}
              onChange={(e) => setDefaultMode(e.target.value)}
            >
              <option value="single">Single Message</option>
              <option value="selection">Selected Text</option>
              <option value="lastN">Recent Messages</option>
              <option value="full">Full Conversation</option>
            </select>
          </div>

          <div className="my-6">
            <label className="text-white text-lg">
              Save Button Settings
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                className="mr-2"
                checked={showSaveButton}
                onChange={(e) => setShowSaveButton(e.target.checked)}
              />
              <span className="text-gray-400">Show save buttons on chat messages</span>
            </div>
            {showSaveButton && (
              <select
                className="mt-2 px-4 py-2 rounded-md bg-zinc-700 text-white"
                value={buttonPosition}
                onChange={(e) => setButtonPosition(e.target.value)}
              >
                <option value="top-right">Top Right</option>
                <option value="bottom-right">Bottom Right</option>
              </select>
            )}
          </div>

          <div className="my-6">
            <label className="text-white text-lg">
              Default Message Count (for "Recent Messages" mode)
            </label>
            <input
              type="number"
              min="1"
              max="100"
              className="w-full px-4 py-2 mt-2 rounded-md bg-zinc-700 text-white text-lg"
              value={defaultMessageCount}
              onChange={(e) => setDefaultMessageCount(parseInt(e.target.value) || 30)}
            />
          </div>

          <div className="my-6">
            <label className="text-white text-lg">
              Advanced Template Settings
            </label>
            <div className="mt-3 space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeMetadata"
                  className="mr-2"
                  checked={chatNoteFormat.includes('metadata')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setChatNoteFormat(prev => prev.replace('---\n', '---\nmetadata:\n  model: {model}\n  tokens: {tokens}\n  exported: {timestamp}\n'));
                    } else {
                      setChatNoteFormat(prev => prev.replace(/metadata:[\s\S]*?exported: \{timestamp\}\n/g, ''));
                    }
                  }}
                />
                <label htmlFor="includeMetadata" className="text-gray-400">Include metadata section</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeLinks"
                  className="mr-2"
                  checked={chatNoteFormat.includes('[[Daily Notes]]')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setChatNoteFormat(prev => prev + '\n\n## Links\n- [[Daily Notes/{date}]]\n- [[AI Conversations]]\n');
                    } else {
                      setChatNoteFormat(prev => prev.replace(/\n\n## Links[\s\S]*?\]\]\n/g, ''));
                    }
                  }}
                />
                <label htmlFor="includeLinks" className="text-gray-400">Add Obsidian wiki links</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="includeFooter"
                  className="mr-2"
                  checked={chatNoteFormat.includes('---\n\n*Generated')}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setChatNoteFormat(prev => prev + '\n\n---\n\n*Generated by ChatVault Clip on {timestamp}*');
                    } else {
                      setChatNoteFormat(prev => prev.replace(/\n\n---\n\n\*Generated[\s\S]*?\*/g, ''));
                    }
                  }}
                />
                <label htmlFor="includeFooter" className="text-gray-400">Add generation footer</label>
              </div>
            </div>
          </div>

          <div className="my-6">
            <label className="text-white text-lg">
              Preview Settings
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                className="mr-2"
                checked={showPreview}
                onChange={(e) => setShowPreview(e.target.checked)}
              />
              <span className="text-gray-400">Show markdown preview in popup</span>
            </div>
          </div>

          <div className="my-6">
            <label className="text-white text-lg">
              Auto-tagging
            </label>
            <div className="flex items-center mt-2">
              <input
                type="checkbox"
                className="mr-2"
                checked={autoTagging}
                onChange={(e) => setAutoTagging(e.target.checked)}
              />
              <span className="text-gray-400">Automatically add tags based on chat content</span>
            </div>
          </div>

          <div className="my-6">
            <label className="text-white text-lg">
              Chat Note Format{" "}
              <span className="text-gray-500 text-base">
                ( Available: {"{title}"}, {"{url}"}, {"{date}"}, {"{service}"}, {"{content}"} )
              </span>
            </label>
            <div className="flex gap-2 mt-2 mb-2">
              <button
                type="button"
                onClick={() => setChatNoteFormat('---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\n---\n\n{content}')}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
              >
                Default Template
              </button>
              <button
                type="button"
                onClick={() => setChatNoteFormat('---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\ntags: [ai-chat, {service}]\n---\n\n# {title}\n\n{content}')}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
              >
                With Tags
              </button>
              <button
                type="button"
                onClick={() => setChatNoteFormat('# {title}\n\n- **Date**: {date}\n- **Service**: {service}\n- **URL**: [{url}]({url})\n\n---\n\n{content}')}
                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md"
              >
                Simple
              </button>
            </div>
            <textarea
              className="w-full px-4 py-2 rounded-md bg-zinc-700 text-white text-lg font-mono"
              rows="8"
              value={chatNoteFormat}
              onChange={(e) => setChatNoteFormat(e.target.value)}
            />
            <div className="mt-3 p-3 bg-zinc-800 rounded-md">
              <p className="text-sm font-medium text-gray-300 mb-2">Template Variables:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
                <div><code className="bg-zinc-700 px-1 rounded">{"{title}"}</code> - Conversation title</div>
                <div><code className="bg-zinc-700 px-1 rounded">{"{date}"}</code> - Current date (YYYY-MM-DD)</div>
                <div><code className="bg-zinc-700 px-1 rounded">{"{service}"}</code> - ChatGPT or Claude</div>
                <div><code className="bg-zinc-700 px-1 rounded">{"{url}"}</code> - Original chat URL</div>
                <div><code className="bg-zinc-700 px-1 rounded">{"{content}"}</code> - Message content</div>
                <div><code className="bg-zinc-700 px-1 rounded">{"{timestamp}"}</code> - Full timestamp</div>
              </div>
            </div>
          </div>
        </div>
      )}

      
      <div className="flex mt-8">
        <button
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-md text-lg font-bold"
          type="button"
          onClick={handleTest}
        >
          Test Settings
        </button>
        <button
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-md text-lg font-bold ml-4"
          type="button"
          onClick={handleSave}
        >
          Save Settings
        </button>
        <button
          className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-md text-lg font-bold ml-4"
          type="button"
          onClick={() => {
            console.log('[ChatVault Options] 🧪 Testing storage...');
            const testData = { obsidianVault: 'TestVault123', folderPath: 'TestFolder/{title}' };
            chrome.storage.sync.set(testData, () => {
              if (chrome.runtime.lastError) {
                alert('❌ Storage test failed: ' + chrome.runtime.lastError.message);
              } else {
                chrome.storage.sync.get(['obsidianVault', 'folderPath'], (result) => {
                  console.log('[ChatVault Options] 🔍 Test result:', result);
                  alert(result.obsidianVault === 'TestVault123' ? '✅ Storage works!' : '❌ Storage failed!');
                });
              }
            });
          }}
        >
          🧪 Test Storage
        </button>
      </div>
      
      <div className="mt-16 pt-8 border-t border-zinc-700 text-gray-400 text-sm">
        <p>
          ChatVault Clip is open source and available on{" "}
          <a
            href="https://github.com/yourusername/chatvault-clip"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-500 hover:underline"
          >
            GitHub
          </a>
          .
        </p>
        <p className="mt-2">
          Based on the original Obsidian Web Clipper by mvavassori.
          Licensed under MIT License.
        </p>
      </div>
    </div>
  );
};

export default OptionsApp;