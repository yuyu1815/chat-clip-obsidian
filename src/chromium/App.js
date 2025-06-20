/* global chrome */
import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import ChatModeSelector from "./ChatModeSelector";
import MarkdownPreview from "./MarkdownPreview";

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
        const tabs = await new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs);
          });
        });
        const tab = tabs[0];
        setPageInfo({ title: tab.title, url: tab.url });
        setTitle(sanitizeTitle(tab.title));
        
        // Check if we're on a supported chat page
        const chatPages = ['chat.openai.com', 'claude.ai'];
        const isChat = chatPages.some(domain => tab.url.includes(domain));
        setIsOnChatPage(isChat);
        
        // Auto-switch to chat mode if on chat page
        if (isChat && mode === 'webpage') {
          setMode('single');
        }
      } catch (error) {
        console.error("Error getting page info: ", error);
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
        const result = await new Promise((resolve) => {
          chrome.storage.sync.get(
            ["obsidianVault", "chatFolderPath", "defaultMode", "showPreview", "defaultMessageCount"],
            (result) => {
              resolve(result);
            }
          );
        });
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
        console.error("Error loading settings: ", error);
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
        preview += 'Current message will be saved here.';
      } else if (mode === 'selection') {
        preview += 'Selected text will be saved here.';
      } else if (mode === 'lastN') {
        preview += `Last ${messageCount} messages will be saved here.`;
      } else if (mode === 'full') {
        preview += 'Full conversation will be saved here.';
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
                      mode === 'lastN' ? 'saveLastN' :
                      mode === 'full' ? 'saveAll' : null;
        
        if (action) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: action,
            count: mode === 'lastN' ? messageCount : undefined
          }, (response) => {
            if (chrome.runtime.lastError) {
              setNotification({ 
                type: 'error', 
                message: 'Failed to save: ' + chrome.runtime.lastError.message 
              });
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
              let message = 'Chat saved successfully!';
              if (response.method === 'clipboard') {
                message = 'Content copied! Opening Obsidian...';
                // Show extended message
                if (response.message) {
                  alert(response.message);
                }
              }
              
              setNotification({ type: 'success', message: message });
              
              setTimeout(() => window.close(), response.method === 'clipboard' ? 2500 : 1500);
            } else {
              setNotification({ 
                type: 'error', 
                message: response?.error || 'Failed to save chat' 
              });
            }
          });
        }
      });
  };

  const handleCancel = () => {
    window.close();
  };


  const sanitizeTitle = (title) => {
    const invalidCharacterPattern = /[\\:*?"<>|/]/g;
    return title.replace(invalidCharacterPattern, "-");
  };

  const handleTitleChange = (e) => {
    const sanitizedValue = sanitizeTitle(e.target.value);
    if (sanitizedValue !== e.target.value) {
      setErrorMsg(
        'The title contains invalid characters. Please avoid using these characters in the title: \\ : * ? " < > | /'
      );
    } else if (sanitizedValue.length > 250) {
      setErrorMsg("The title is too long");
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
      {isOnChatPage && (
        <ChatModeSelector 
          mode={mode}
          onModeChange={setMode}
          messageCount={messageCount}
          onMessageCountChange={setMessageCount}
          isOnChatPage={isOnChatPage}
        />
      )}
      
      <div className="p-4">
          <div className="text-center">
            <div className="text-sm text-zinc-600 mb-2">
              {mode === 'single' && "Click 'Save' to capture the current message"}
              {mode === 'selection' && "Select text on the page, then click 'Save'"}
              {mode === 'lastN' && `Will save the last ${messageCount} messages`}
              {mode === 'full' && "Will save the entire conversation"}
            </div>
            {!isOnChatPage && (
              <div className="text-xs text-red-500">
                This feature only works on supported chat pages (ChatGPT, Claude)
              </div>
            )}
          </div>
          
          {saveHistory.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="text-xs text-zinc-600 mb-2">Recent Saves:</div>
              <div className="space-y-1">
                {saveHistory.map((item, index) => (
                  <div key={index} className="text-xs bg-zinc-100 rounded px-2 py-1 flex justify-between">
                    <span className="truncate">{item.title}</span>
                    <span className="text-zinc-500 ml-2">{item.service}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      
      {showPreview && (
        <MarkdownPreview content={chatPreviewContent} title={title || 'Chat Preview'} />
      )}
      
      {notification && (
        <div className={`notification fixed top-2 right-2 px-4 py-2 rounded-md text-white z-50 ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {notification.message}
        </div>
      )}
      
      <div className="flex justify-between w-full pr-2 pb-1 items-center">
        <div>
          <button
            ref={hamburgerMenuButtonRef}
            className={`p-1 rounded-full hover:bg-zinc-200 active:bg-zinc-300 ${
              showHamburgerMenu ? "bg-zinc-200" : ""
            }`}
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
              className="fixed bottom-11 left-1 bg-zinc-200 rounded-md shadow-lg"
            >
              <button
                className="block w-full text-left py-2 px-2 hover:bg-zinc-300 active:bg-zinc-400 rounded-md"
                onClick={optionsRedirect}
              >
                Options
              </button>
              <button
                className="block w-full text-left py-2 px-2 hover:bg-zinc-300 active:bg-zinc-400 rounded-md"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
              <button
                className="block w-full text-left py-2 px-2 hover:bg-zinc-300 active:bg-zinc-400 rounded-md flex items-center"
                onClick={toggleDarkMode}
              >
                <span className="mr-2">
                  {darkMode ? '☀️' : '🌙'}
                </span>
                {darkMode ? 'Light Mode' : 'Dark Mode'}
              </button>
              <button
                className="block w-full text-left py-2 px-2 hover:bg-zinc-300 active:bg-zinc-400 rounded-md"
                onClick={donateRedirect}
              >
                Donate
              </button>
            </div>
          )}
        </div>
        <div className="text-sm">
          <button
            className="py-1 px-2 mr-2 bg-zinc-50 rounded hover:bg-zinc-200 active:bg-zinc-300 font-semibold text-zinc-800"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            ref={saveButtonRef}
            className={`py-1 px-2 bg-white rounded font-semibold relative ${
              saveButtonDisabled
                ? "opacity-50 cursor-not-allowed bg-zinc-50 hover:bg-zinc-50 text-zinc-800"
                : "bg-zinc-50 hover:bg-indigo-100 hover:text-indigo-700 active:bg-indigo-200"
            }`}
            onClick={saveNote}
            disabled={saveButtonDisabled}
            title="Save (Alt+S)"
          >
            Save
            <span className="text-xs opacity-60 ml-1">⌥S</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;