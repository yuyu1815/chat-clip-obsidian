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
    const baseFolderPath = settings.folderPath || 'LLM Chats';
    const chatFolderPath = settings.chatFolderPath || 'ChatVault/{service}';
    
    // Create markdown content from message data
    const { messageContent, messageType, conversationTitle, service, metadata } = request;
    const isSelection = metadata?.type === 'selection';
    
    // Generate filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const sanitizedTitle = (conversationTitle || 'untitled').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
    const typePrefix = isSelection ? 'selection_' : '';
    const filename = `${dateStr}_${timeStr}_${typePrefix}${service}_${sanitizedTitle}.md`;
    
    // Create full folder path using ChatVault settings
    const fullFolderPath = chatFolderPath
      .replace('{service}', service.toUpperCase())
      .replace('{date}', dateStr)
      .replace('{title}', sanitizedTitle);
    
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
    const encodedContent = encodeURIComponent(fullContent);
    
    const obsidianUri = `obsidian://new?vault=${encodedVault}&file=${encodedFile}&content=${encodedContent}`;
    
    // Also create a test URI without content to see if that works
    const testUriWithoutContent = `obsidian://new?vault=${encodedVault}&file=${encodedFile}&content=${encodeURIComponent('Test content')}`;
    
    console.log('[ChatVault Background] 🔗 Generated URI length:', obsidianUri.length);
    console.log('[ChatVault Background] 🔗 URI preview:', obsidianUri.substring(0, 200) + '...');
    console.log('[ChatVault Background] 📁 Full folder path:', fullFolderPath);
    console.log('[ChatVault Background] 📝 Filename:', filename);
    console.log('[ChatVault Background] 📝 Content length:', fullContent.length);
    console.log('[ChatVault Background] 🏠 Vault name (encoded):', encodedVault);
    console.log('[ChatVault Background] 🏠 Vault name (raw):', vaultName);
    console.log('[ChatVault Background] 🧪 Test URI (without content):', testUriWithoutContent);
    console.log('[ChatVault Background] 🧪 Test URI length:', testUriWithoutContent.length);
    
    // Test URI by copying to clipboard for manual testing
    console.log('[ChatVault Background] 📋 Full URI for testing:', obsidianUri);
    
    // SAFE MODE: Use more conservative URI length limit
    // Most browsers have practical limits around 2000-4000 characters for URLs
    // Japanese text can triple in size when encoded
    const URI_LENGTH_LIMIT = 8000; // Temporarily increased for testing
    
    console.log('[ChatVault Background] 🔍 URI length check:', {
      uriLength: obsidianUri.length,
      limit: URI_LENGTH_LIMIT,
      willUseClipboard: obsidianUri.length > URI_LENGTH_LIMIT
    });
    
    if (obsidianUri.length > URI_LENGTH_LIMIT) { // Use clipboard for URIs over 2000 chars
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
      
      // Create clipboard content with instructions
      const clipboardContent = `URI: ${obsidianUri}

--- CONTENT BELOW ---
${fullContent}`;
      
      chrome.tabs.sendMessage(tabId, {
        action: 'copyToClipboard',
        content: clipboardContent
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('[ChatVault Background] ❌ Clipboard error:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message
          });
        } else {
          console.log('[ChatVault Background] ✅ Clipboard success');
          sendResponse({ 
            success: true, 
            method: 'clipboard',
            message: `Content copied to clipboard!\n\nTo test: Copy the URI from clipboard and paste in browser address bar\n\nFile: ${filename}`,
            filename: filename,
            uri: obsidianUri
          });
        }
      });
      return; // Don't continue to URI method
    } else {
      // Create tab for Obsidian URI
      console.log('[ChatVault Background] 🚀 Creating tab with Obsidian URI...');
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
          setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(updateListener);
            chrome.tabs.remove(tabId, () => {
              if (chrome.runtime.lastError) {
                console.error('[ChatVault Background] ❌ Tab close error:', chrome.runtime.lastError.message);
              } else {
                console.log('[ChatVault Background] ✅ Tab closed successfully');
              }
            });
          }, 3000); // 3 seconds to ensure Obsidian processes the request
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
  const URI_LENGTH_LIMIT = 8000; // Temporarily increased for testing
  
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
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'copyToClipboard',
        content: finalContent
      }, (response) => {
        sendResponse({ 
          success: true, 
          method: 'clipboard',
          message: `${messages.length} messages copied to clipboard (URI too long)`,
          filename: filename
        });
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
