/* global chrome */
import "./App.css";
import React, { useState, useEffect, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import ChatModeSelector from "./ChatModeSelector";
import MarkdownPreview from "./MarkdownPreview";

function App() {
  // Original state
  const [pageInfo, setPageInfo] = useState({ title: "", url: "" });
  const [headerVisible, setHeaderVisible] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(true);
  const [showRemoveLinkTooltip, setShowRemoveLinkTooltip] = useState(false);
  const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);
  const [showEditTitleIcon, setShowEditTitleIcon] = useState(false);
  const [isTitleInFocus, setIsTitleInFocus] = useState(false);

  const [obsidianVault, setObsidianVault] = useState(null);
  const [folderPath, setFolderPath] = useState(null);
  const [noteContentFormat, setNoteContentFormat] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(true);

  // New ChatVault state
  const [mode, setMode] = useState('webpage');
  const [isOnChatPage, setIsOnChatPage] = useState(false);
  const [messageCount, setMessageCount] = useState(30);
  const [markdownContent, setMarkdownContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [chatPreviewContent, setChatPreviewContent] = useState('');
  const [saveHistory, setSaveHistory] = useState([]);
  const [autoTagging, setAutoTagging] = useState(true);
  const [notification, setNotification] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  const titleInputRef = useRef();
  const textAreaRef = useRef();
  const containerRef = useRef();
  const menuRef = useRef();

  const removeLinkButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);
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
    if (title.trim() === "" && content.trim() === "" && !headerVisible && mode === 'webpage') {
      setSaveButtonDisabled(true);
    } else if (errorMsg) {
      setSaveButtonDisabled(true);
    } else if (mode !== 'webpage' && !isOnChatPage) {
      setSaveButtonDisabled(true);
    } else {
      setSaveButtonDisabled(false);
    }
  }, [title, content, headerVisible, errorMsg, mode, isOnChatPage]);

  useEffect(() => {
    if (textAreaRef.current && mode === 'webpage') {
      textAreaRef.current.focus();
    }
  }, [mode]);

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
            ["obsidianVault", "folderPath", "noteContentFormat", "defaultMode", "showPreview"],
            (result) => {
              resolve(result);
            }
          );
        });
        if (result.obsidianVault) {
          setObsidianVault(result.obsidianVault);
        }
        if (result.folderPath) {
          setFolderPath(result.folderPath);
        }
        if (result.noteContentFormat) {
          setNoteContentFormat(result.noteContentFormat);
        } else {
          setNoteContentFormat("{url}\n\n{content}");
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
    if (mode === 'webpage') {
      const date = new Date().toLocaleDateString("en-CA");
      let preview = noteContentFormat
        .replace("{url}", headerVisible ? pageInfo.url : "")
        .replace("{title}", title)
        .replace("{content}", content)
        .replace("{date}", date);
      setMarkdownContent(preview);
    }
  }, [title, content, headerVisible, noteContentFormat, pageInfo.url, mode]);

  // Generate chat preview content
  useEffect(() => {
    if (mode !== 'webpage' && isOnChatPage) {
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
    if (!obsidianVault || !folderPath) {
      chrome.runtime.openOptionsPage();
      return;
    }

    if (mode === 'webpage') {
      // Original webpage save logic
      if (title.length > 250) {
        setErrorMsg("Title is too long");
        return;
      }

      const date = new Date().toLocaleDateString("en-CA");
      let newContent = noteContentFormat
        .replace("{url}", headerVisible ? pageInfo.url : "")
        .replace("{title}", title)
        .replace("{content}", content)
        .replace("{date}", date);

      if (!headerVisible) {
        const lines = newContent.split("\n");
        const urlIndex = lines.findIndex((line) => line.trim() === "");
        if (urlIndex !== -1) {
          lines.splice(urlIndex, 1);
        }
        newContent = lines.join("\n");
      }

      if (content.trim() === "") {
        const lines = newContent.split("\n");
        const contentIndex = lines.findIndex((line) => line.trim() === "");
        if (contentIndex !== -1) {
          lines.splice(contentIndex, 1);
        }
        newContent = lines.join("\n");
      }

      const sanitizedTitle = sanitizeTitle(title);
      const finalFolderPath = folderPath.replace("{title}", sanitizedTitle);

      try {
        const obsidianUri = `obsidian://new?vault=${encodeURIComponent(
          obsidianVault
        )}&file=${encodeURIComponent(
          finalFolderPath
        )}&content=${encodeURIComponent(newContent)}`;

        window.open(obsidianUri, "_blank");
        setTitle("");
        setContent("");
      } catch (error) {
        console.error("Error adding note: ", error);
      }
    } else {
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
          });
          
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
          
          setNotification({ type: 'success', message: 'Chat saved successfully!' });
          
          setTimeout(() => window.close(), 1500);
        }
      });
    }
  };

  const handleCancel = () => {
    setTitle("");
    setContent("");
    window.close();
  };

  const selectAllInputText = () => {
    titleInputRef.current.select();
    setShowEditTitleIcon(false);
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
      
      {mode === 'webpage' && (
        <>
          {headerVisible && (
            <div className="flex justify-between mb-1 border-b-2 border-zinc-700 bg-zinc-100">
              <div className="text-xs p-2 truncate">{pageInfo.url}</div>
              <button
                ref={removeLinkButtonRef}
                className="text-black rounded-full p-1 hover:bg-zinc-200 active:bg-zinc-300 relative"
                onClick={() => setHeaderVisible(false)}
                onMouseEnter={() => setShowRemoveLinkTooltip(true)}
                onMouseLeave={() => setShowRemoveLinkTooltip(false)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                >
                  <g
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  >
                    <path d="M14 11.998C14 9.506 11.683 7 8.857 7H7.143C4.303 7 2 9.238 2 11.998c0 2.378 1.71 4.368 4 4.873a5.3 5.3 0 0 0 1.143.124M16.857 7c.393 0 .775.043 1.143.124c2.29.505 4 2.495 4 4.874a4.92 4.92 0 0 1-1.634 3.653" />
                    <path d="M10 11.998c0 2.491 2.317 4.997 5.143 4.997M18 22.243l2.121-2.122m0 0L22.243 18m-2.122 2.121L18 18m2.121 2.121l2.122 2.122" />
                  </g>
                </svg>
              </button>
              {showRemoveLinkTooltip && (
                <div className="absolute top-8 right-0 text-xs bg-zinc-700 text-white p-2 rounded whitespace-nowrap z-10">
                  Remove page link
                </div>
              )}
            </div>
          )}
          
          <div
            className="relative flex items-center"
            onMouseEnter={() => !isTitleInFocus && setShowEditTitleIcon(true)}
            onMouseLeave={() => setShowEditTitleIcon(false)}
          >
            <input
              ref={titleInputRef}
              type="text"
              name="title"
              value={title}
              onChange={handleTitleChange}
              className="w-full p-2 mb-0 focus:border-none focus:ring-0 textarea-title font-semibold bg-zinc-50 text-base"
              placeholder="Add title"
              autoComplete="no-autocomplete-please"
              maxLength={250}
              onFocus={() => {
                setIsTitleInFocus(true);
                setShowEditTitleIcon(false);
              }}
              onBlur={() => {
                setIsTitleInFocus(false);
                setShowEditTitleIcon(false);
              }}
            />
            {showEditTitleIcon && (
              <div className="absolute right-0 transform translate-y-[-50%] cursor-pointer top-5">
                <button
                  onClick={selectAllInputText}
                  className="text-black rounded-full p-1 hover:bg-zinc-200 active:bg-zinc-300"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="currentColor"
                      d="m19.3 8.925l-4.25-4.2l1.4-1.4q.575-.575 1.413-.575t1.412.575l1.4 1.4q.575.575.6 1.388t-.55 1.387L19.3 8.925ZM17.85 10.4L7.25 21H3v-4.25l10.6-10.6l4.25 4.25Z"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
          
          {errorMsg && (
            <div className="text-red-500 text-xs m-2 p-0.5 rounded-md bg-zinc-100">
              {errorMsg}
            </div>
          )}
          
          <TextareaAutosize
            ref={textAreaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-2 focus:border-none focus:ring-0 textarea-content resize-none bg-zinc-50 text-sm"
            placeholder="Take a brief note..."
            minRows={4}
            autoComplete="no-autocomplete-please"
            maxLength={1500}
          />
        </>
      )}
      
      {mode !== 'webpage' && (
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
      )}
      
      {showPreview && mode === 'webpage' && (
        <MarkdownPreview content={markdownContent} title={title} />
      )}
      
      {showPreview && mode !== 'webpage' && (
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
            ref={cancelButtonRef}
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