/* global chrome */

// Handle extension installation
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "install") {
    // Redirect to the options page
    chrome.runtime.openOptionsPage();
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'openOptions':
      chrome.runtime.openOptionsPage();
      break;
    
    case 'getSettings':
      chrome.storage.sync.get([
        'obsidianVault',
        'folderPath',
        'noteContentFormat',
        'showSaveButton',
        'buttonPosition'
      ], (settings) => {
        sendResponse(settings);
      });
      return true; // Keep channel open for async response
    
    case 'saveSettings':
      chrome.storage.sync.set(request.settings, () => {
        sendResponse({ success: true });
        // Notify all tabs to update settings
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.url && (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com') || tab.url.includes('claude.ai'))) {
              chrome.tabs.sendMessage(tab.id, { action: 'updateSettings' });
            }
          });
        });
      });
      return true;
    
    case 'getCurrentTab':
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        sendResponse(tabs[0]);
      });
      return true;
    
    case 'saveSingleMessage':
      handleSaveMessage(request, sender, sendResponse);
      return true;
    
    case 'saveMultipleMessages':
      handleSaveMultipleMessages(request, sender, sendResponse);
      return true;
    
    case 'saveSelection':
      handleSaveSelection(request, sender, sendResponse);
      return true;
    
    case 'requestMessages':
      requestMessagesFromTab(request, sender, sendResponse);
      return true;
  }
});

// Handle message saving to Obsidian
async function handleSaveMessage(request, sender, sendResponse) {
  console.log('[ChatVault Background] 🚀 handleSaveMessage called with:', request);
  console.log('[ChatVault Background] 🖺 Sender:', sender);
  console.log('[ChatVault Background] 🔍 Request details:', JSON.stringify(request, null, 2));
  
  try {
    // Get settings
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get([
        'obsidianVault',
        'folderPath',
        'noteContentFormat',
        'chatFolderPath'
      ], resolve);
    });
    
    console.log('[ChatVault Background] 🔧 Settings:', settings);

    const vaultName = settings.obsidianVault || 'MyVault';
    const chatFolderPath = settings.chatFolderPath || 'ChatVault/{service}';
    
    // Log the actual vault name to help debug
    console.log('[ChatVault Background] 🏠 Vault name from settings:', settings.obsidianVault);
    console.log('[ChatVault Background] 🏠 Using vault name:', vaultName);
    console.log('[ChatVault Background] 📁 Chat folder path:', chatFolderPath);
    
    // Create markdown content from message data
    const { messageContent, messageType, conversationTitle, service, metadata } = request;
    const isSelection = metadata?.type === 'selection';
    
    // Generate filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    // Sanitize title - allow Japanese characters
    const sanitizedTitle = (conversationTitle || 'untitled')
      .replace(/[\/\\:*?"<>|]/g, '') // Remove file system unsafe characters only
      .replace(/\s+/g, '_')
      .trim() || 'untitled';
    const typePrefix = isSelection ? 'selection_' : '';
    const filename = `${dateStr}_${timeStr}_${typePrefix}${service}_${sanitizedTitle}.md`;
    
    // Create full folder path using ChatVault settings
    const fullFolderPath = chatFolderPath
      .replace('{service}', service.toUpperCase())
      .replace('{date}', dateStr)
      .replace('{title}', sanitizedTitle)
      .replace(/\/+/g, '/') // Remove duplicate slashes
      .replace(/\/$/, ''); // Remove trailing slash
    
    // Create markdown content with frontmatter
    let frontmatter = `---
title: ${conversationTitle || 'Untitled Conversation'}
service: ${service}
date: ${now.toISOString()}
type: ${messageType || (isSelection ? 'selection' : 'single')}
`;
    
    if (isSelection && metadata) {
      frontmatter += `url: ${metadata.url}
source: text selection
`;
    }
    
    frontmatter += `---

`;
    
    const fullContent = frontmatter + messageContent;
    
    // Try Obsidian URI first  
    const fullFilePath = `${fullFolderPath}/${filename}`;
    
    // Build URI step by step for better debugging
    const encodedVault = encodeURIComponent(vaultName);
    const encodedFile = encodeURIComponent(fullFilePath);
    
    // Process content to handle line breaks and special characters
    // Replace problematic characters that might break the URI
    const processedContent = fullContent
      .replace(/\r\n/g, '\n')  // Normalize line breaks
      .replace(/\r/g, '\n')     // Convert remaining \r to \n
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
      .trim();
    
    const encodedContent = encodeURIComponent(processedContent);
    
    const obsidianUri = `obsidian://new?vault=${encodedVault}&file=${encodedFile}&content=${encodedContent}`;
    
    // Also create a test URI without content to see if that works
    const testUriWithoutContent = `obsidian://new?vault=${encodedVault}&file=${encodedFile}&content=${encodeURIComponent('Test content')}`;
    
    console.log('[ChatVault Background] 🔗 Generated URI length:', obsidianUri.length);
    console.log('[ChatVault Background] 🔗 URI preview:', obsidianUri.substring(0, 200) + '...');
    console.log('[ChatVault Background] 📁 Full folder path:', fullFolderPath);
    console.log('[ChatVault Background] 📝 Filename:', filename);
    console.log('[ChatVault Background] 📝 Content length:', fullContent.length);
    console.log('[ChatVault Background] 📝 Processed content length:', processedContent.length);
    console.log('[ChatVault Background] 🏠 Vault name (encoded):', encodedVault);
    console.log('[ChatVault Background] 🏠 Vault name (raw):', vaultName);
    console.log('[ChatVault Background] 📝 Sanitized title:', sanitizedTitle);
    console.log('[ChatVault Background] 📝 Original title:', conversationTitle);
    console.log('[ChatVault Background] 🧪 Test URI (without content):', testUriWithoutContent);
    console.log('[ChatVault Background] 🧪 Test URI length:', testUriWithoutContent.length);
    
    // Log content sample for debugging
    console.log('[ChatVault Background] 📄 Content sample (first 200 chars):', processedContent.substring(0, 200));
    console.log('[ChatVault Background] 📄 Content has line breaks:', processedContent.includes('\n'));
    
    // Alert user about vault name
    if (vaultName === 'MyVault') {
      console.warn('[ChatVault Background] ⚠️ Using default vault name "MyVault". Please set your actual vault name in options!');
    }
    
    // Test URI by copying to clipboard for manual testing
    console.log('[ChatVault Background] 📋 Full URI for testing:', obsidianUri);
    
    // IMPORTANT: The native Obsidian URI scheme has a known issue where content parameter
    // doesn't work reliably - it creates the file but doesn't add content
    // For now, we'll use clipboard as the most reliable method
    const USE_CLIPBOARD_ALWAYS = true; // Force clipboard for reliability
    
    console.log('[ChatVault Background] 🔍 URI method check:', {
      uriLength: obsidianUri.length,
      forceClipboard: USE_CLIPBOARD_ALWAYS,
      reason: 'Native Obsidian URI content parameter is unreliable'
    });
    
    // Try Advanced URI plugin format first (if user has it installed)
    // Try both methods: with base64 and without
    const base64Content = btoa(unescape(encodeURIComponent(processedContent)));
    
    // Method 1: Use 'text' parameter (some versions prefer this)
    const advancedUriText = `obsidian://advanced-uri?vault=${encodedVault}&filepath=${encodeURIComponent(fullFilePath)}&text=${encodedContent}&mode=new`;
    
    // Method 2: Use 'data' parameter with base64
    const advancedUriData = `obsidian://advanced-uri?vault=${encodedVault}&filepath=${encodeURIComponent(fullFilePath)}&data=${base64Content}&mode=new`;
    
    // Choose shorter URI or text-based one
    const advancedUri = advancedUriText.length < advancedUriData.length ? advancedUriText : advancedUriData;
    const uriMethod = advancedUriText.length < advancedUriData.length ? 'text' : 'data';
    console.log('[ChatVault Background] 🎆 Advanced URI format (requires plugin):', advancedUri.substring(0, 200) + '...');
    console.log('[ChatVault Background] 📊 Advanced URI length:', advancedUri.length);
    console.log('[ChatVault Background] 🔧 Advanced URI method:', uriMethod);
    
    // First, let's try Advanced URI if it's not too long
    const ADVANCED_URI_LIMIT = 30000; // Advanced URI can handle longer URLs
    
    // First check if Advanced URI plugin might be installed by trying a simple test
    const testAdvancedUri = `obsidian://advanced-uri?vault=${encodedVault}&filepath=test.md&text=test&mode=overwrite`;
    console.log('[ChatVault Background] 🧪 Testing Advanced URI availability...');
    
    if (advancedUri.length < ADVANCED_URI_LIMIT) {
      console.log('[ChatVault Background] 🚀 Trying Advanced URI method first...');
      
      // Try Advanced URI
      chrome.tabs.create({ url: advancedUri }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('[ChatVault Background] ❌ Advanced URI failed:', chrome.runtime.lastError);
          // Fall back to clipboard method
          fallbackToClipboard();
          return;
        }
        
        console.log('[ChatVault Background] ✅ Advanced URI tab created');
        
        // Close the tab after a delay
        if (tab?.id) {
          setTimeout(() => {
            chrome.tabs.remove(tab.id, () => {
              if (chrome.runtime.lastError) {
                console.error('[ChatVault Background] Tab close error:', chrome.runtime.lastError.message);
              }
            });
          }, 3000);
        }
        
        sendResponse({ 
          success: true, 
          method: 'advanced-uri',
          message: `Saved to Obsidian via Advanced URI plugin (${uriMethod} method)`,
          filename: filename
        });
      });
      return;
    }
    
    // Define fallback function
    const fallbackToClipboard = () => {
      // Fallback to clipboard via content script
      const tabId = sender.tab?.id;
      if (!tabId) {
        sendResponse({ 
          success: false, 
          error: 'No valid tab ID'
        });
        return;
      }
      
      console.log('[ChatVault Background] 📋 Using clipboard fallback...');
      console.log('[ChatVault Background] ℹ️ Reason: Content too long or Advanced URI not available');
      
      // Copy just the markdown content to clipboard
      console.log('[ChatVault Background] 📋 Preparing clipboard content...');
      
      chrome.tabs.sendMessage(tabId, {
        action: 'copyToClipboard',
        content: processedContent  // Copy processed content
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[ChatVault Background] ❌ Clipboard error:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message
          });
        } else {
          console.log('[ChatVault Background] ✅ Clipboard success, now opening Obsidian...');
          
          // Create a simple URI to open Obsidian and prompt for new note
          const simpleUri = `obsidian://new?vault=${encodedVault}&file=${encodedFile}`;
          console.log('[ChatVault Background] 📝 Opening Obsidian with simple URI:', simpleUri);
          
          // Open Obsidian with the simple URI (no content)
          chrome.tabs.create({ url: simpleUri }, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('[ChatVault Background] ❌ Failed to open Obsidian:', chrome.runtime.lastError);
              sendResponse({ 
                success: false, 
                error: 'Failed to open Obsidian: ' + chrome.runtime.lastError.message
              });
              return;
            }
            
            console.log('[ChatVault Background] ✅ Obsidian opened with empty file, content in clipboard');
            console.log('[ChatVault Background] 📋 User needs to paste content manually with Ctrl/Cmd+V');
            
            // Close the tab after a delay
            if (tab?.id) {
              setTimeout(() => {
                chrome.tabs.remove(tab.id, () => {
                  if (chrome.runtime.lastError) {
                    console.error('[ChatVault Background] Tab close error:', chrome.runtime.lastError.message);
                  }
                });
              }, 3000);
            }
            
            sendResponse({ 
              success: true, 
              method: 'clipboard',
              message: `Content copied to clipboard!\n\nObsidian will open with an empty file. Please paste the content with Ctrl/Cmd+V\n\nFile: ${filename}\n\nNote: This is due to a limitation in Obsidian's URI scheme. For automatic content insertion, consider installing the Advanced URI plugin.`,
              filename: filename,
              tip: 'Install Advanced URI plugin for better integration'
            });
          });
        }
      });
    };
    
    // Use clipboard if content is too long
    if (USE_CLIPBOARD_ALWAYS || obsidianUri.length > 2000) {
      fallbackToClipboard();
    } else {
      // This path is now unlikely to be reached due to USE_CLIPBOARD_ALWAYS flag
      // But keeping it for future when Obsidian fixes the content parameter issue
      console.log('[ChatVault Background] ⚠️ WARNING: Using native URI method - content may not be saved!');
      console.log('[ChatVault Background] 💡 TIP: Install Advanced URI plugin for better compatibility');
      
      // First, try a simple test URI to see if Obsidian responds at all
      const simpleTestUri = `obsidian://open?vault=${encodedVault}`;
      console.log('[ChatVault Background] 🧪 Testing with simple URI first:', simpleTestUri);
      
      // Create tab for Obsidian URI
      console.log('[ChatVault Background] 🚀 Creating tab with Obsidian URI...');
      console.log('[ChatVault Background] 📝 Full URI being used:', obsidianUri);
      
      // For debugging: Create a simpler version with base64 encoded content
      const base64Content = btoa(unescape(encodeURIComponent(processedContent)));
      const base64Uri = `obsidian://new?vault=${encodedVault}&file=${encodedFile}&content=base64:${base64Content}`;
      
      console.log('[ChatVault Background] 🔍 Debugging different URI formats:');
      console.log('[ChatVault Background] 1️⃣ Standard URI length:', obsidianUri.length);
      console.log('[ChatVault Background] 2️⃣ Base64 URI length:', base64Uri.length);
      
      // Test with a minimal content first
      const minimalContent = 'Test\nMultiple\nLines\nContent';
      const minimalUri = `obsidian://new?vault=${encodedVault}&file=${encodedFile}&content=${encodeURIComponent(minimalContent)}`;
      console.log('[ChatVault Background] 3️⃣ Minimal test URI:', minimalUri);
      
      // Copy debug info to clipboard for manual testing
      const debugInfo = `Debug Info for ChatVault Clip:\n\nVault: ${vaultName}\nFile Path: ${fullFilePath}\nContent Length: ${processedContent.length} chars\nURI Length: ${obsidianUri.length} chars\n\nTest URIs:\n1. Minimal: ${minimalUri}\n2. Full: ${obsidianUri.substring(0, 500)}...\n\nContent Preview:\n${processedContent.substring(0, 300)}...`;
      
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'copyToClipboard',
            content: debugInfo
          }, (response) => {
            console.log('[ChatVault Background] 📋 Debug info copied to clipboard for manual testing');
          });
        }
      });
      
      // Try opening with the processed URI
      console.log('[ChatVault Background] 🚀 Opening Obsidian with URI method...');
      console.log('[ChatVault Background] 🔗 Final URI components:', {
        vault: vaultName,
        encodedVault: encodedVault,
        filePath: fullFilePath,
        encodedFile: encodedFile,
        contentLength: processedContent.length,
        uriLength: obsidianUri.length
      });
      
      chrome.tabs.create({ url: obsidianUri }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('[ChatVault Background] ❌ Tab creation error:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: 'Failed to create tab: ' + chrome.runtime.lastError.message 
          });
          return;
        }
        
        console.log('[ChatVault Background] ✅ Tab created successfully:', tab);
        console.log('[ChatVault Background] 📊 Tab details:', {
          id: tab?.id,
          url: tab?.url,
          status: tab?.status,
          pendingUrl: tab?.pendingUrl
        });
        
        // Monitor tab updates to see if Obsidian URI is being processed
        if (tab?.id) {
          const tabId = tab.id;
          
          // Listen for tab updates
          const updateListener = (updatedTabId, changeInfo, updatedTab) => {
            if (updatedTabId === tabId) {
              console.log('[ChatVault Background] 📍 Tab update:', changeInfo);
              if (changeInfo.url) {
                console.log('[ChatVault Background] 🔗 Tab URL changed to:', changeInfo.url);
              }
            }
          };
          
          chrome.tabs.onUpdated.addListener(updateListener);
          
          // Close after delay to ensure Obsidian processes the URI
          // Wait longer and check if the tab navigated to about:blank (Obsidian handled it)
          setTimeout(() => {
            chrome.tabs.get(tabId, (tab) => {
              if (chrome.runtime.lastError) {
                // Tab already closed by Obsidian, which is good
                console.log('[ChatVault Background] ✅ Tab already closed (likely by Obsidian)');
                chrome.tabs.onUpdated.removeListener(updateListener);
                return;
              }
              
              // Only close if tab still exists and shows obsidian:// URL
              if (tab && (tab.url?.startsWith('obsidian://') || tab.url === 'about:blank')) {
                chrome.tabs.onUpdated.removeListener(updateListener);
                chrome.tabs.remove(tabId, () => {
                  if (chrome.runtime.lastError) {
                    console.error('[ChatVault Background] ❌ Tab close error:', chrome.runtime.lastError.message);
                  } else {
                    console.log('[ChatVault Background] ✅ Tab closed successfully');
                  }
                });
              }
            });
          }, 5000); // 5 seconds to ensure Obsidian has time to process
        }
      });
      
      console.log('[ChatVault Background] ✅ Success! Sending positive response');
      sendResponse({ 
        success: true, 
        method: 'uri',
        message: 'Saved to Obsidian via URI',
        filename: filename
      });
    }
    
  } catch (error) {
    console.error('[ChatVault Background] ❌ Error saving message:', error);
    console.error('[ChatVault Background] ❌ Error stack:', error.stack);
    sendResponse({ 
      success: false, 
      error: error.message 
    });
  }
}

// Note: Clipboard functionality moved to content script
// Service Workers don't have access to DOM APIs like document or navigator

// Optional: Add context menu for additional functionality
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'saveToObsidian',
    title: 'Save to Obsidian',
    contexts: ['selection'],
    documentUrlPatterns: [
      'https://chat.openai.com/*',
      'https://chatgpt.com/*',
      'https://claude.ai/*'
    ]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'saveToObsidian') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'saveSelected',
      selectionText: info.selectionText
    });
  }
});

// Handle multiple messages saving
async function handleSaveMultipleMessages(request, sender, sendResponse) {
  console.log('[ChatVault Background] handleSaveMultipleMessages called with:', request);
  
  // Define URI length limit (same as in handleSaveMessage)
  const URI_LENGTH_LIMIT = 8000; // Increased limit - most browsers can handle this
  
  try {
    const { messages, service, mode, count } = request;
    
    if (!messages || messages.length === 0) {
      sendResponse({ success: false, error: 'No messages to save' });
      return;
    }
    
    // Get settings
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get([
        'obsidianVault',
        'chatFolderPath',
        'chatNoteFormat'
      ], resolve);
    });
    
    const vaultName = settings.obsidianVault || 'MyVault';
    const folderTemplate = settings.chatFolderPath || 'ChatVault/{service}/{title}';
    const noteTemplate = settings.chatNoteFormat || '---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\n---\n\n{content}';
    
    // Generate content
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const conversationTitle = `${service} Chat - ${dateStr}`;
    
    let content = '';
    if (mode === 'recent') {
      content += `# Last ${count} Messages\n\n`;
    } else if (mode === 'full') {
      content += `# Full Conversation\n\n`;
    }
    
    messages.forEach((msg, index) => {
      content += `### ${msg.role === 'user' ? 'User' : 'Assistant'}\n\n${msg.content}\n\n`;
    });
    
    // Apply template
    const finalContent = noteTemplate
      .replace('{title}', conversationTitle)
      .replace('{date}', dateStr)
      .replace('{service}', service)
      .replace('{url}', sender.tab?.url || '')
      .replace('{content}', content);
    
    // Generate folder path and filename
    const folderPath = folderTemplate
      .replace('{service}', service)
      .replace('{date}', dateStr)
      .replace('{title}', conversationTitle);
    
    const filename = `${dateStr}_${mode}_${service}_conversation.md`;
    
    // Create URI
    const fullFilePath = `${folderPath}/${filename}`;
    const obsidianUri = `obsidian://new?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(fullFilePath)}&content=${encodeURIComponent(finalContent)}`;
    
    if (obsidianUri.length > URI_LENGTH_LIMIT) {
      // Fallback to clipboard
      console.log('[ChatVault Background] 📋 URI too long, using clipboard fallback...');
      
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'copyToClipboard',
        content: finalContent
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[ChatVault Background] ❌ Clipboard error:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message
          });
        } else {
          console.log('[ChatVault Background] ✅ Clipboard success, opening Obsidian...');
          
          // Create a simple URI to open Obsidian
          const simpleUri = `obsidian://new?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(fullFilePath)}`;
          
          chrome.tabs.create({ url: simpleUri }, (tab) => {
            if (chrome.runtime.lastError) {
              console.error('[ChatVault Background] ❌ Failed to open Obsidian:', chrome.runtime.lastError);
              sendResponse({ 
                success: false, 
                error: 'Failed to open Obsidian: ' + chrome.runtime.lastError.message
              });
              return;
            }
            
            // Close the tab after a delay
            if (tab?.id) {
              setTimeout(() => {
                chrome.tabs.remove(tab.id, () => {
                  if (chrome.runtime.lastError) {
                    console.error('[ChatVault Background] Tab close error:', chrome.runtime.lastError.message);
                  }
                });
              }, 3000);
            }
            
            sendResponse({ 
              success: true, 
              method: 'clipboard',
              message: `${messages.length} messages copied to clipboard!\n\nObsidian should open now. Paste with Ctrl/Cmd+V`,
              filename: filename
            });
          });
        }
      });
    } else {
      chrome.tabs.create({ url: obsidianUri, active: false }, (tab) => {
        if (tab?.id) {
          setTimeout(() => {
            chrome.tabs.remove(tab.id, () => {
              if (chrome.runtime.lastError) {
                console.error('[ChatVault Background] Tab close error:', chrome.runtime.lastError.message);
              }
            });
          }, 3000); // 3 seconds delay to ensure Obsidian processes the request
        }
      });
      
      sendResponse({ 
        success: true, 
        method: 'uri',
        message: `${messages.length} messages saved to Obsidian`,
        filename: filename
      });
    }
    
  } catch (error) {
    console.error('[ChatVault Background] Error saving multiple messages:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle selection saving
async function handleSaveSelection(request, sender, sendResponse) {
  console.log('[ChatVault Background] handleSaveSelection called');
  
  const selectionRequest = {
    ...request,
    messageType: 'selection',
    metadata: {
      type: 'selection',
      url: sender.tab?.url,
      title: request.title || 'Text Selection',
      timestamp: new Date().toISOString()
    }
  };
  
  return handleSaveMessage(selectionRequest, sender, sendResponse);
}

// Request messages from content script
async function requestMessagesFromTab(request, sender, sendResponse) {
  const { mode, count } = request;
  
  chrome.tabs.sendMessage(sender.tab.id, {
    action: mode === 'recent' ? 'captureRecentMessages' : 'captureAllMessages',
    count: count
  }, (response) => {
    if (response && response.success) {
      handleSaveMultipleMessages({
        messages: response.messages,
        service: response.service,
        mode: mode,
        count: count
      }, sender, sendResponse);
    } else {
      sendResponse({ success: false, error: response?.error || 'Failed to capture messages' });
    }
  });
}
