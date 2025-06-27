/* global chrome */
import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';

const OptionsApp = () => {
  const { t } = useTranslation();

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

  // New state for status message
  const [statusMessage, setStatusMessage] = useState("");

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto p-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">
            {t('options_title')}
          </h1>
          <p className="text-gray-400">
            Configure how you clip content and chats to Obsidian.
          </p>
        </header>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
          <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2 text-purple-300">
            {t('core_settings')}
          </h2>

          <div className="mb-4">
            <label htmlFor="vault" className="block text-lg font-medium mb-1">
              {t('obsidian_vault_name')}
            </label>
            <p className="text-sm text-gray-400 mb-2">
              ( {t('obsidian_vault_name_desc')} )
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
              {t('base_folder_name')}
            </label>
            <p className="text-sm text-gray-400 mb-2">
              ( {t('base_folder_name_desc')} )
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
              {t('enable_chat_features')}
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
                  {t('chat_messages_folder')}
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( {t('chat_messages_folder_desc')} )
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
                  {t('save_method')}
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( {t('save_method_desc')} )
                </p>
                <select
                  id="saveMethod"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={saveMethod}
                  onChange={(e) => setSaveMethod(e.target.value)}
                >
                  <option value="filesystem">{t('method_filesystem')}</option>
                  <option value="advanced-uri">{t('method_advanced_uri')}</option>
                  <option value="downloads">{t('method_downloads')}</option>
                  <option value="clipboard">{t('method_clipboard')}</option>
                  <option value="auto">{t('method_auto')}</option>
                </select>
              </div>
              
              {saveMethod === 'filesystem' && (
                <div className="mb-4 p-4 bg-gray-700 rounded">
                  <label className="block text-lg font-medium mb-1">
                    {t('obsidian_vault_folder')}
                  </label>
                  <p className="text-sm text-gray-400 mb-2">
                    ( {t('obsidian_vault_folder_desc')} )
                  </p>
                  <button
                    onClick={handleSelectFolder}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                  >
                    {folderPath ? `${folderPath} (Change)` : t('select_vault_folder')}
                  </button>
                   <p className="text-sm text-gray-400 mt-2">
                    This folder should be your Obsidian vault root directory. Files will be saved directly here.
                  </p>
                </div>
              )}
              
              <div className="mb-4">
                <label htmlFor="defaultMode" className="block text-lg font-medium mb-1">
                  {t('default_capture_mode')}
                </label>
                <select
                  id="defaultMode"
                  className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400"
                  value={defaultMode}
                  onChange={(e) => setDefaultMode(e.target.value)}
                >
                  <option value="single">Single Message</option>
                  <option value="last3">Last 3 Messages</option>
                  <option value="last5">Last 5 Messages</option>
                  <option value="full">Full Conversation</option>
                  <option value="selection">Selection</option>
                </select>
              </div>

              {/* More settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div>
                  <label htmlFor="defaultMessageCount" className="block text-lg font-medium mb-1">
                    {t('default_msg_count')}
                  </label>
                  <p className="text-sm text-gray-400 mb-2">
                    ( {t('default_msg_count_desc')} )
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
                  <label className="block text-lg font-medium mb-1">{t('save_button_settings')}</label>
                  <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                    <input
                      type="checkbox"
                      id="showSaveButton"
                      className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                      checked={showSaveButton}
                      onChange={(e) => setShowSaveButton(e.target.checked)}
                    />
                    <label htmlFor="showSaveButton" className="ml-3 text-white">
                      {t('show_save_button')}
                    </label>
                  </div>
                  {showSaveButton && (
                    <div className="mt-2">
                      <label htmlFor="buttonPosition" className="block text-sm font-medium mb-1">{t('button_position')}</label>
                      <select
                        id="buttonPosition"
                        className="w-full p-2 bg-gray-700 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                        value={buttonPosition}
                        onChange={(e) => setButtonPosition(e.target.value)}
                      >
                        <option value="top-right">{t('top_right')}</option>
                        <option value="bottom-right">{t('bottom_right')}</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                  <div>
                    <label className="block text-lg font-medium mb-1">{t('auto_tagging')}</label>
                     <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                        <input
                          type="checkbox"
                          id="autoTagging"
                          className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                          checked={autoTagging}
                          onChange={(e) => setAutoTagging(e.target.checked)}
                        />
                        <label htmlFor="autoTagging" className="ml-3 text-white">
                          {t('auto_tagging_desc')}
                        </label>
                      </div>
                  </div>
                   <div>
                    <label className="block text-lg font-medium mb-1">{t('preview_settings')}</label>
                     <div className="flex items-center mt-2 bg-gray-700 p-2 rounded">
                        <input
                          type="checkbox"
                          id="showPreview"
                          className="form-checkbox h-5 w-5 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                          checked={showPreview}
                          onChange={(e) => setShowPreview(e.target.checked)}
                        />
                        <label htmlFor="showPreview" className="ml-3 text-white">
                          {t('show_markdown_preview')}
                        </label>
                      </div>
                  </div>
              </div>

              <div className="mb-4 mt-6">
                <label htmlFor="chatNoteFormat" className="block text-lg font-medium mb-1">
                  {t('chat_note_format')}
                </label>
                <p className="text-sm text-gray-400 mb-2">
                  ( {t('chat_note_format_desc')} )
                </p>
                <div className="flex gap-2 my-2">
                    <button onClick={() => setChatNoteFormat('---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\n---\n\n{content}')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">{t('default_template')}</button>
                    <button onClick={() => setChatNoteFormat('---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\ntags: [ai-chat, {service}]\n---\n\n# {title}\n\n{content}')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">{t('with_tags_template')}</button>
                    <button onClick={() => setChatNoteFormat('# {title}\\n\\n- **Date**: {date}\\n- **Service**: {service}\\n- **URL**: [{url}]({url})\\n\\n---\\n\\n{content}')} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-md">{t('simple_template')}</button>
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
            {t('save_settings')}
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