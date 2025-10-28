/* global chrome */
import "./App.css";
import React, { useState, useEffect, useRef, Suspense } from "react";
import { sanitizeTitle } from "../../utils/data/validation.js";
import { queryActiveTab, getSync } from "../../utils/browser/chrome.js";
import { toast } from "../../utils/notifications/toast.js";
import ChatModeSelector from "./components/ChatModeSelector";

// Lazy load MarkdownPreview to reduce initial bundle size
const MarkdownPreview = React.lazy(() => import("./components/MarkdownPreview"));

function App() {
  // Original state
  const [pageInfo, setPageInfo] = useState({ title: "", url: "" });
  const [title, setTitle] = useState("");
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(true);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);

  const [obsidianVault, setObsidianVault] = useState(null);
  const [chatFolderPath, setChatFolderPath] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // New ChatVault state
  const [mode, setMode] = useState('single');
  const [isOnChatPage, setIsOnChatPage] = useState(false);
  const [messageCount, setMessageCount] = useState(30);
  const [markdownContent, setMarkdownContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [chatPreviewContent, setChatPreviewContent] = useState('');
  const [saveHistory, setSaveHistory] = useState([]);
  const [autoTagging, setAutoTagging] = useState(true);
  const [notification, setNotification] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  const containerRef = useRef();
  const menuRef = useRef();
  const saveButtonRef = useRef(null);
  const hamburgerMenuButtonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        hamburgerMenuButtonRef.current &&
        !hamburgerMenuButtonRef.current.contains(e.target)
      ) {
        setShowHamburgerMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (errorMsg) {
      setSaveButtonDisabled(true);
    } else if (!isOnChatPage) {
      setSaveButtonDisabled(true);
    } else {
      setSaveButtonDisabled(false);
    }
  }, [title, errorMsg, mode, isOnChatPage]);


  useEffect(() => {
    const getPageInfo = async () => {
      setLoading(true);
      try {
        const tabs = await queryActiveTab();
        const tab = tabs[0];
        setPageInfo({ title: tab.title, url: tab.url });
        setTitle(sanitizeTitle(tab.title));

        // Determine if we're on a supported chat page using manifest host_permissions
        const manifest = chrome.runtime.getManifest();
        const hostPerms = (manifest && manifest.host_permissions) ? manifest.host_permissions : [];
        const supportedHosts = hostPerms
          .map((pattern) => {
            try {
              const urlLike = pattern.replace('*', '');
              return new URL(urlLike).hostname;
            } catch (e) {
              return null;
            }
          })
          .filter(Boolean);

        let isChat = false;
        try {
          const tabHost = new URL(tab.url).hostname;
          isChat = supportedHosts.some((host) => tabHost === host || tabHost.endsWith('.' + host));
        } catch (e) {
          // Fallback when URL parsing fails
          isChat = supportedHosts.some((host) => tab.url.includes(host));
        }
        setIsOnChatPage(isChat);

        // Auto-switch to chat mode if on chat page
        if (isChat && mode === 'webpage') {
          setMode('single');
        }
      } catch (error) {
        console.error("[ChatVault Popup] Error getting page info: ", error);
      } finally {
        setLoading(false);
      }
    };

    getPageInfo();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      try {
        const result = await getSync(["obsidianVault", "chatFolderPath", "defaultMode", "showPreview", "defaultMessageCount", "autoTagging"]);
        if (result.obsidianVault) {
          setObsidianVault(result.obsidianVault);
        }
        if (result.chatFolderPath) {
          setChatFolderPath(result.chatFolderPath);
        }
        if (result.defaultMode && isOnChatPage) {
          setMode(result.defaultMode);
        }
        if (result.showPreview !== undefined) {
          setShowPreview(result.showPreview);
        }
        if (result.defaultMessageCount) {
          setMessageCount(result.defaultMessageCount);
        }
        if (result.autoTagging !== undefined) {
          setAutoTagging(result.autoTagging);
        }
        // Load save history and theme
        chrome.storage.local.get(['saveHistory', 'darkMode'], (result) => {
          if (result.saveHistory) {
            setSaveHistory(result.saveHistory.slice(0, 5)); // Keep only last 5
          }
          if (result.darkMode !== undefined) {
            setDarkMode(result.darkMode);
          }
        });
      } catch (error) {
        console.error("[ChatVault Popup] Error loading settings: ", error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [isOnChatPage]);

  // Generate markdown preview
  useEffect(() => {
    // Remove this since we don't have webpage mode anymore
  }, []);

  // Generate chat preview content
  useEffect(() => {
    if (isOnChatPage) {
      const service = pageInfo.url.includes('chatgpt.com') ? 'ChatGPT' :
                      pageInfo.url.includes('claude.ai') ? 'Claude' : 'Unknown';
      const date = new Date().toISOString().split('T')[0];
      const chatTitle = title || `${service} Chat - ${date}`;

      let preview = `---
title: ${chatTitle}
date: ${date}
service: ${service}
url: ${pageInfo.url}
`;
      if (autoTagging) {
        preview += `tags: [ai-chat, ${service.toLowerCase()}]
`;
      }
      preview += `---

`;

      if (mode === 'single') {
        preview += '### Message Content\n\nCurrent message will be saved here.';
      } else if (mode === 'selection') {
        preview += '### Selected Text\n\nSelected text will be saved here.';
      } else if (mode === 'recent') {
        preview += `### Recent Messages\n\nLast ${messageCount} messages will be saved here.`;
      } else if (mode === 'full') {
        preview += '### Full Conversation\n\nFull conversation will be saved here.';
      }

      setChatPreviewContent(preview);
    }
  }, [mode, isOnChatPage, pageInfo.url, title, messageCount, autoTagging]);

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Apply dark mode theme
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.setAttribute('data-theme', darkMode ? 'dark' : 'light');
      container.classList.add('theme-transition');
    }
  }, [darkMode]);

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    chrome.storage.local.set({ darkMode: newDarkMode });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboard = (e) => {
      // Alt+S: Save
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        if (!saveButtonDisabled) {
          saveNote();
        }
      }
      // Alt+P: Toggle Preview
      else if (e.altKey && e.key === 'p') {
        e.preventDefault();
        setShowPreview(!showPreview);
      }
      // Alt+D: Toggle Dark Mode
      else if (e.altKey && e.key === 'd') {
        e.preventDefault();
        toggleDarkMode();
      }
      // Escape: Close popup
      else if (e.key === 'Escape') {
        e.preventDefault();
        window.close();
      }
    };

    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, [saveButtonDisabled, showPreview, darkMode]);

  if (loading) {
    return (
      <div className="h-44 flex items-center justify-center">
        <div className="my-spinner w-5 h-5 border-t-2 border-zinc-700 border-solid rounded-full"></div>
      </div>
    );
  }

  const saveNote = async () => {
    if (!obsidianVault || !chatFolderPath) {
      chrome.runtime.openOptionsPage();
      return;
    }

    // Chat mode save - send message to content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const action = mode === 'single' ? 'saveActive' :
                      mode === 'selection' ? 'saveSelected' :
                      mode === 'recent' ? 'saveLastN' :
                      mode === 'full' ? 'saveAll' : null;

        if (action) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: action,
            count: mode === 'recent' ? messageCount : undefined
          }, (response) => {
            if (chrome.runtime.lastError) {
              setNotification({ type: 'error', message: 'Failed to save: ' + chrome.runtime.lastError.message });
              toast.show('保存に失敗しました: ' + chrome.runtime.lastError.message, 'error');
              return;
            }

            if (response && response.success) {
              // Add to save history
              const historyItem = {
                timestamp: new Date().toISOString(),
                mode: mode,
                service: pageInfo.url.includes('chatgpt.com') ? 'ChatGPT' : 'Claude',
                title: title || `Chat - ${new Date().toLocaleDateString()}`
              };

              const newHistory = [historyItem, ...saveHistory.slice(0, 4)];
              setSaveHistory(newHistory);
              chrome.storage.local.set({ saveHistory: newHistory });

              // Customize message based on method used
              let message = 'チャットが正常に保存されました！';
              if (response.method === 'clipboard') {
                message = 'コンテンツをコピーしました！Obsidianを開いています...';
                // Show extended message
                if (response.message) {
                  alert(response.message);
                }
              }

              setNotification({ type: 'success', message: message });
              toast.show(message, 'success');

              setTimeout(() => window.close(), response.method === 'clipboard' ? 2500 : 1500);
            } else {
              const msg = response?.userMessage || (response?.error ? '保存に失敗しました: ' + response.error : 'チャットの保存に失敗しました');
              setNotification({ type: 'error', message: msg });
              toast.show(msg, 'error');
            }
          });
        }
      });
  };

  const handleCancel = () => {
    window.close();
  };


  // moved to utils/validation.js

  const handleTitleChange = (e) => {
    const sanitizedValue = sanitizeTitle(e.target.value);
    if (sanitizedValue !== e.target.value) {
      setErrorMsg(
        'タイトルに無効な文字が含まれています。これらの文字は使用しないでください: \\ : * ? " < > | /'
      );
    } else if (sanitizedValue.length > 250) {
      setErrorMsg("タイトルが長すぎます");
    } else {
      setErrorMsg("");
    }
    setTitle(e.target.value);
  };

  const donateRedirect = () => {
    chrome.tabs.create({
      url: "https://www.paypal.com/donate/?hosted_button_id=M8RTMTXKV46EC",
    });
  };

  const optionsRedirect = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div
      ref={containerRef}
      className={`relative max-w-lg mx-auto border-2 shadow-xl theme-transition ${
        darkMode 
          ? 'border-zinc-600 bg-zinc-800 text-white' 
          : 'border-zinc-700 bg-zinc-50 text-black'
      }`}
    >
      {/* Header */}
      <div className={`px-4 py-3 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <h1 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
            ChatVault クリップ
          </h1>
          <div className="flex items-center space-x-2">
            <span className={`text-xs px-2 py-1 rounded-full ${
              isOnChatPage 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-gray-500/20 text-gray-400'
            }`}>
              {isOnChatPage ? '準備完了' : 'チャットページではありません'}
            </span>
          </div>
        </div>
      </div>

      {isOnChatPage && (
        <div className="p-4">
          <ChatModeSelector
            onModeChange={setMode}
            onCountChange={setMessageCount}
            defaultMode={mode}
            defaultCount={messageCount}
            darkMode={darkMode}
          />
        </div>
      )}

      <div className="p-4">
          <div className="text-center">
            <div className="text-sm text-zinc-600 mb-2">
              {mode === 'single' && "「保存」をクリックして現在のメッセージを取得します"}
              {mode === 'selection' && "ページ上のテキストを選択してから「保存」をクリックしてください"}
              {mode === 'recent' && `最新の${messageCount}件のメッセージを保存します`}
              {mode === 'full' && "会話全体を保存します"}
            </div>
            {!isOnChatPage && (
              <div className="text-xs text-red-500">
                この機能はサポートされているチャットページでのみ動作します（ChatGPT、Claude）
              </div>
            )}
          </div>

          {saveHistory.length > 0 && (
            <div className={`mt-4 pt-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className={`text-xs mb-2 font-medium ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                最近の保存
              </div>
              <div className="space-y-1">
                {saveHistory.map((item, index) => (
                  <div key={index} className={`text-xs rounded-lg px-3 py-2 flex items-center justify-between ${
                    darkMode ? 'bg-gray-700/50' : 'bg-gray-100'
                  }`}>
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        item.service === 'ChatGPT' 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {item.service}
                      </span>
                      <span className="truncate flex-1">{item.title}</span>
                    </div>
                    <span className={`text-xs ml-2 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      {showPreview && isOnChatPage && (
        <div className="p-4 pt-0">
          <Suspense fallback={
            <div className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
          }>
            <MarkdownPreview
              content={chatPreviewContent}
              isLoading={loading}
              maxHeight="300px"
              darkMode={darkMode}
            />
          </Suspense>
        </div>
      )}

      {notification && (
        <div className={`notification fixed top-2 right-2 px-4 py-2 rounded-md text-white z-50 ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {notification.message}
        </div>
      )}

      <div className={`flex justify-between w-full px-4 py-3 items-center border-t ${
        darkMode ? 'border-gray-700 bg-gray-900/50' : 'border-gray-200 bg-gray-50'
      }`}>
        <div>
          <button
            ref={hamburgerMenuButtonRef}
            className={`p-2 rounded-lg transition-colors ${
              darkMode 
                ? 'hover:bg-gray-700 active:bg-gray-600' 
                : 'hover:bg-gray-200 active:bg-gray-300'
            } ${showHamburgerMenu ? (darkMode ? 'bg-gray-700' : 'bg-gray-200') : ''}`}
            onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          {showHamburgerMenu && (
            <div
              ref={menuRef}
              className={`fixed bottom-14 left-4 rounded-lg shadow-xl min-w-[200px] ${
                darkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
              }`}
            >
              <button
                className={`block w-full text-left py-3 px-4 rounded-t-lg transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={optionsRedirect}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>オプション</span>
                </div>
              </button>
              <button
                className={`block w-full text-left py-3 px-4 transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={() => setShowPreview(!showPreview)}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>プレビューを{showPreview ? '非表示' : '表示'}</span>
                </div>
              </button>
              <button
                className={`block w-full text-left py-3 px-4 transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={toggleDarkMode}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{darkMode ? '☀️' : '🌙'}</span>
                  <span>{darkMode ? 'ライトモード' : 'ダークモード'}</span>
                </div>
              </button>
              <button
                className={`block w-full text-left py-3 px-4 rounded-b-lg transition-colors ${
                  darkMode 
                    ? 'hover:bg-gray-700 text-gray-200' 
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
                onClick={donateRedirect}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span>サポート</span>
                </div>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
              darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
            }`}
            onClick={handleCancel}
          >
            キャンセル
          </button>
          <button
            ref={saveButtonRef}
            className={`py-2 px-5 rounded-lg font-medium transition-all relative ${
              saveButtonDisabled
                ? darkMode 
                  ? "opacity-50 cursor-not-allowed bg-gray-700 text-gray-500"
                  : "opacity-50 cursor-not-allowed bg-gray-200 text-gray-400"
                : darkMode
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl"
                  : "bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl"
            }`}
            onClick={saveNote}
            disabled={saveButtonDisabled}
            title="保存 (Alt+S)"
          >
            <span className="flex items-center space-x-2">
              <span>保存</span>
              <span className="text-xs opacity-75">⌥S</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
