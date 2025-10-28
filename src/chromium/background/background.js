/* global chrome */
import { notifyBasic } from '../../utils/notifications/notifications.js';
import { toBase64Utf8 } from '../../utils/data/encoding.js';
import { buildObsidianNewUri, buildAdvancedUriText, buildAdvancedUriClipboard } from '../../utils/browser/obsidian.js';
import { sanitizeForFilename } from '../../utils/data/validation.js';
import { openUrlWithAutoClose, getSync } from '../../utils/browser/chrome.js';
import { createLogger } from '../../utils/logger.js';

// ロガー
const log = createLogger('ChatVault Background');

// Content hash function for duplicate prevention
async function createContentHash(content) {
  try {
    // Use built-in crypto.subtle API for content hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    log.warn('Content hash generation failed, using timestamp fallback:', error);
    // Fallback to timestamp-based hash
    return Date.now().toString(16);
  }
}

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
      // Reply to avoid "message port closed" errors if the sender expects a response
      try { sendResponse({ success: true }); } catch (_) {}
      return true;

    case 'getSettings':
      (async () => {
        const settings = await getSync([
          'obsidianVault',
          'folderPath',
          'noteContentFormat',
          'showSaveButton',
          'buttonPosition'
        ]);
        sendResponse(settings);
      })();
      return true; // Keep channel open for async response

    case 'saveSettings':
      chrome.storage.sync.set(request.settings, () => {
        sendResponse({ success: true });
        // Notify supported tabs to update settings based on manifest host_permissions
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

        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (!tab.url) return;
            let shouldNotify = false;
            try {
              const tabHost = new URL(tab.url).hostname;
              shouldNotify = supportedHosts.some((host) => tabHost === host || tabHost.endsWith('.' + host));
            } catch (e) {
              shouldNotify = supportedHosts.some((host) => tab.url.includes(host));
            }
            if (shouldNotify) {
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

    case 'getClaudeOrgId':
      (async () => {
        try {
          // より詳細なCookie取得オプション
          const cookies = await chrome.cookies.getAll({
            domain: 'claude.ai',
            secure: true
          });

          // 必要なCookieを探す
          const lastActiveOrg = cookies.find(cookie => cookie.name === 'lastActiveOrg');
          const sessionKey = cookies.find(cookie => cookie.name === 'sessionKey');
          const anthropicAuth = cookies.find(cookie => cookie.name === '__Secure-anthropic-auth');

          const orgId = lastActiveOrg ? lastActiveOrg.value : null;

          console.log('[ChatVault Background] Cookie取得結果:', {
            orgId,
            hasSessionKey: !!sessionKey,
            hasAuth: !!anthropicAuth,
            totalCookies: cookies.length
          });

          sendResponse({
            success: true,
            orgId,
            hasSessionKey: !!sessionKey,
            hasAuth: !!anthropicAuth
          });
        } catch (error) {
          console.error('[ChatVault Background] Cookie取得エラー:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    case 'openObsidianTab':
      // Content scriptからの依頼でObsidianタブを開く
      (async () => {
        try {
          const { url, autoClose = true, delayMs = 2000 } = request;
          if (!url) {
            sendResponse({ success: false, error: 'URL is required' });
            return;
          }

          console.log('[ChatVault Background] Opening Obsidian tab:', url);
          
          if (autoClose) {
            const tab = await openUrlWithAutoClose(url, delayMs, { active: false });
            sendResponse({ 
              success: true, 
              tabId: tab?.id,
              message: 'Obsidian tab opened with auto-close'
            });
          } else {
            chrome.tabs.create({ url, active: false }, (tab) => {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ 
                  success: true, 
                  tabId: tab?.id,
                  message: 'Obsidian tab opened'
                });
              }
            });
          }
        } catch (error) {
          console.error('[ChatVault Background] Error opening Obsidian tab:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true;

    default:
      try {
        sendResponse({ success: false, error: 'Unknown action', action: request.action });
      } catch (_) {}
      // No async work to keep, close channel
      return false;
  }
});

// Save via Chrome Downloads API using Data URL (compatible with Service Workers)
async function saveViaDownloadAPI(content, filename, folderPath) {
  try {
    console.log('[ChatVault Background] 💾 Attempting to save via Downloads API...');
    console.log('[ChatVault Background] 📁 Folder path:', folderPath);
    console.log('[ChatVault Background] 📝 Filename:', filename);
    console.log('[ChatVault Background] 📏 Content length:', content.length);

    // Service Workers don't support URL.createObjectURL() with Blobs
    // Use Data URL instead for Manifest V3 compatibility
    const base64Content = toBase64Utf8(content);
    const dataUrl = `data:text/markdown;charset=utf-8;base64,${base64Content}`;

    console.log('[ChatVault Background] 🔄 Converted to Data URL, length:', dataUrl.length);

    // Check if content is too large for Data URL (Chrome limit ~64MB)
    const maxDataUrlSize = 64 * 1024 * 1024; // 64MB in bytes
    if (dataUrl.length > maxDataUrlSize) {
      throw new Error(`Content too large for Data URL (${dataUrl.length} bytes, max ${maxDataUrlSize})`);
    }

    // Prepare download options
    const downloadPath = folderPath ? `${folderPath}/${filename}` : filename;
    const downloadOptions = {
      url: dataUrl,
      filename: downloadPath,
      saveAs: false, // Auto-save without dialog (if user settings allow)
      conflictAction: 'uniquify' // Automatically rename if file exists - 重複回避
    };

    console.log('[ChatVault Background] 📥 Download path:', downloadPath);
    console.log('[ChatVault Background] 🔗 Using Data URL method (Service Worker compatible)');

    // Start download
    const downloadId = await chrome.downloads.download(downloadOptions);
    console.log('[ChatVault Background] 🆔 Download started with ID:', downloadId);

    // Return promise that resolves when download completes
    return new Promise((resolve, reject) => {
      const downloadListener = (delta) => {
        if (delta.id === downloadId) {
          console.log('[ChatVault Background] 📊 Download state change:', delta);

          if (delta.state?.current === 'complete') {
            console.log('[ChatVault Background] ✅ Download completed successfully with content');
            chrome.downloads.onChanged.removeListener(downloadListener);
            resolve({ success: true, downloadId: downloadId });
          } else if (delta.state?.current === 'interrupted') {
            console.error('[ChatVault Background] ❌ Download interrupted:', delta.error);
            chrome.downloads.onChanged.removeListener(downloadListener);
            reject(new Error(delta.error?.current || 'Download interrupted'));
          }
        }
      };

      chrome.downloads.onChanged.addListener(downloadListener);

      // Timeout after 30 seconds
      setTimeout(() => {
        chrome.downloads.onChanged.removeListener(downloadListener);
        reject(new Error('Download timeout - file may have been created but listener timed out'));
      }, 30000);
    });
  } catch (error) {
    console.error('[ChatVault Background] ❌ Download API error:', error);
    throw error;
  }
}

// Handle message saving to Obsidian
async function handleSaveMessage(request, sender, sendResponse) {
  console.log('[ChatVault Background] 🚫 Guard check before saving');
  console.log('[ChatVault Background] 🚀 handleSaveMessage called with:', request);
  console.log('[ChatVault Background] 🖺 Sender:', sender);
  console.log('[ChatVault Background] 🔍 Request details:', JSON.stringify(request, null, 2));

  // Allow Claude saves (guard removed)
  try {
    const svc = request && request.service;
    if (!svc) {
      console.warn('[ChatVault Background] No service specified in save request. Proceeding with defaults.');
    }
  } catch (e) {
    console.warn('[ChatVault Background] Service check error:', e);
  }

  try {
    // Get settings
    const settings = await getSync([
      'obsidianVault',
      'folderPath',
      'noteContentFormat',
      'chatFolderPath'
    ]);

    log.debug('Settings:', settings);

    const vaultName = settings.obsidianVault || 'MyVault';
    const chatFolderPath = settings.chatFolderPath || 'ChatVault/{service}';

    // Log the actual vault name to help debug
    log.info('Vault:', settings.obsidianVault, 'Using:', vaultName);
    log.debug('Chat folder path:', chatFolderPath);

    // Create markdown content from message data
    const { messageContent, messageType, conversationTitle, service, metadata } = request;

    // Content should already be Markdown if conversion was needed (performed in content script)
    const normalizedMessageContent = messageContent || '';

    const isSelection = metadata?.type === 'selection';
    const normalizedType = messageType || (isSelection ? 'selection' : 'single');

    // Generate filename with timestamp and content hash for better duplicate prevention
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    
    // Sanitize title - allow Japanese characters
    const sanitizedTitle = sanitizeForFilename(conversationTitle, 'untitled');
    const typePrefix = normalizedType === 'artifact' ? 'artifact_' : (normalizedType === 'selection' ? 'selection_' : '');
    
    // Create content hash for better duplicate detection
    const contentHash = await createContentHash(normalizedMessageContent);
    const shortHash = contentHash.substring(0, 8); // 8文字のハッシュ
    
    const filename = `${dateStr}_${timeStr}_${typePrefix}${service}_${sanitizedTitle}_${shortHash}.md`;
    
    log.debug('Generated filename with hash:', filename);

    // Create full folder path using ChatVault settings
    const fullFolderPath = chatFolderPath
      .replace('{service}', service.toUpperCase())
      .replace('{date}', dateStr)
      .replace('{title}', sanitizedTitle)
      .replace('{type}', normalizedType)
      .replace(/\/+/g, '/') // Remove duplicate slashes
      .replace(/\/$/, ''); // Remove trailing slash

    // Create markdown content with frontmatter
    let frontmatter = `---
title: ${conversationTitle || 'Untitled Conversation'}
service: ${service}
date: ${now.toISOString()}
type: ${normalizedType}
`;

    // Additional metadata for specific types
    if (metadata) {
      if (normalizedType === 'artifact') {
        if (metadata.artifactTitle) frontmatter += `artifact_title: ${metadata.artifactTitle}\n`;
        if (metadata.artifactLanguage) frontmatter += `artifact_language: ${metadata.artifactLanguage}\n`;
        if (metadata.artifactFilename) frontmatter += `artifact_filename: ${metadata.artifactFilename}\n`;
        if (Number.isInteger(metadata.part) && Number.isInteger(metadata.totalParts)) {
          frontmatter += `part: ${metadata.part}\n`;
          frontmatter += `totalParts: ${metadata.totalParts}\n`;
        }
      } else if (isSelection) {
        if (metadata.url) frontmatter += `url: ${metadata.url}\n`;
        frontmatter += `source: text selection\n`;
      }
    }

    frontmatter += `---\n\n`;

    const fullContent = frontmatter + normalizedMessageContent;

    // Debug: Log the actual content being saved
    console.log('[ChatVault Background] 🔍 DEBUG: fullContent sample:', fullContent.substring(0, 300) + '...');
    console.log('[ChatVault Background] 🔍 DEBUG: fullContent length:', fullContent.length);
    console.log('[ChatVault Background] 🔍 DEBUG: messageContent sample:', (normalizedMessageContent || '').substring(0, 200) + '...');
    console.log('[ChatVault Background] 🔍 DEBUG: frontmatter:', frontmatter);

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

    const obsidianUri = buildObsidianNewUri({ vaultName, filePath: fullFilePath, content: processedContent });

    log.debug('URI length:', obsidianUri.length);
    log.debug('Folder:', fullFolderPath, 'Filename:', filename);

    // Log content sample for debugging
    console.log('[ChatVault Background] 📄 Content sample (first 200 chars):', processedContent.substring(0, 200));
    console.log('[ChatVault Background] 📄 Content has line breaks:', processedContent.includes('\n'));

    // Alert user about vault name
    if (vaultName === 'MyVault') {
      log.warn('Using default vault name "MyVault". Please set your actual vault name in options!');
    }

    // Test URI by copying to clipboard for manual testing
    log.debug('URI for testing:', obsidianUri);

    // IMPORTANT: The native Obsidian URI scheme has a known issue where content parameter
    // doesn't work reliably - it creates the file but doesn't add content
    // We'll try multiple methods in order of preference
    const USE_DOWNLOADS_API = true; // Try Downloads API first for better UX

    log.debug('URI method check', { uriLength: obsidianUri.length, useDownloadsAPI: USE_DOWNLOADS_API });

    // Try Advanced URI plugin format first (if user has it installed)
    // Try both methods: with base64 and without
    const base64ContentForAdvanced = toBase64Utf8(processedContent);

    // Method 1: Use 'text' parameter (some versions prefer this)
    const advancedUriText = buildAdvancedUriText({ vaultName, filePath: fullFilePath, text: processedContent, mode: 'new' });

    // Prefer text method over base64 data method (better compatibility)
    const advancedUri = advancedUriText;
    const uriMethod = 'text';
    log.debug('Advanced URI length:', advancedUri.length, 'method:', uriMethod);

    // Save method selection based on user preferences and content size
    const ADVANCED_URI_LIMIT = 30000; // Advanced URI can handle longer URLs
    const URI_LENGTH_LIMIT = 8000; // Standard URI limit

    // Get user preferences for save method
    const prefs = await getSync(['saveMethod', 'downloadsFolder']);
    const savePreferences = {
      method: prefs.saveMethod || 'filesystem', // filesystem (default), advanced-uri, auto, downloads, clipboard
      downloadsFolder: prefs.downloadsFolder || 'ChatVault'
    };

    log.debug('Save preferences:', savePreferences);

    // Try File System Access API first if configured
    if (savePreferences.method === 'filesystem' || savePreferences.method === 'auto') {
      try {
        console.log('[ChatVault Background] 📁 Attempting File System Access API method...');

        // Send message to content script to handle file system save
        const tabId = sender.tab?.id;
        if (!tabId) {
          throw new Error('No valid tab ID for filesystem operation');
        }

        const result = await new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, {
            action: 'saveViaFileSystem',
            content: fullContent,
            relativePath: `${fullFolderPath}/${filename}`
          }, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else if (!response.success) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        });

        console.log('[ChatVault Background] ✅ File System Access API save successful');

        // Show success notification
        notifyBasic({ message: `Saved to Obsidian vault: ${filename}` });

        sendResponse({
          success: true,
          method: 'filesystem',
          message: `Saved directly to your Obsidian vault: ${filename}`,
          filename: filename,
          path: `${fullFolderPath}/${filename}`
        });
        return;
      } catch (error) {
        console.error('[ChatVault Background] ⚠️ File System Access API failed:', error);
        // Continue to next method if filesystem fails
      }
    }

    // Define Advanced URI clipboard function
    const tryAdvancedUriClipboard = async () => {
      console.log('[ChatVault Background] 🎯 Attempting Advanced URI with clipboard=true...');

      // First copy to clipboard
      const tabId = sender.tab?.id;
      if (!tabId) {
        throw new Error('No valid tab ID for clipboard operation');
      }

      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabId, {
          action: 'copyToClipboard',
          content: fullContent // Use fullContent instead of processedContent
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      // Create Advanced URI with clipboard=true
      const advancedUriClipboard = buildAdvancedUriClipboard({ vaultName, filePath: fullFilePath, mode: 'new' });
      console.log('[ChatVault Background] 🔗 Advanced URI (clipboard):', advancedUriClipboard);

      return new Promise((resolve, reject) => {
        openUrlWithAutoClose(advancedUriClipboard, 3000).then(() => {
          sendResponse({
            success: true,
            method: 'advanced-uri-clipboard',
            message: `Saved to Obsidian via Advanced URI plugin (clipboard method)`,
            filename: filename
          });
          resolve();
        }).catch((err) => {
          console.error('[ChatVault Background] ❌ Advanced URI clipboard failed:', err);
          sendResponse({
            success: false,
            error: 'Failed to open Obsidian: ' + (err.message || err)
          });
          reject(err);
        });
      });
    };

    // Try Advanced URI first (for direct Obsidian saving)
    if (savePreferences.method === 'advanced-uri' || savePreferences.method === 'auto') {
      // First try clipboard method for Advanced URI (most reliable for content)
      try {
        await tryAdvancedUriClipboard();
        return;
      } catch (error) {
        console.error('[ChatVault Background] ⚠️ Advanced URI clipboard method failed:', error);
        // Continue to next method instead of throwing
      }

      // Fallback: check with regular text parameter if content is small enough
      if (advancedUri.length < ADVANCED_URI_LIMIT && encodedContent.length < URI_LENGTH_LIMIT) {
        console.log('[ChatVault Background] 🚀 Trying Advanced URI with direct text content...');

        try {
          await new Promise((resolve, reject) => {
            openUrlWithAutoClose(advancedUri, 3000).then(() => {
              sendResponse({
                success: true,
                method: 'advanced-uri',
                message: `Saved to Obsidian via Advanced URI plugin (${uriMethod} method)`,
                filename: filename
              });
              resolve();
            }).catch((e) => {
              console.error('[ChatVault Background] ❌ Advanced URI with content failed:', e);
              reject(e);
            });
          });
          return;
        } catch (error) {
          console.error('[ChatVault Background] ⚠️ Advanced URI with content failed:', error);
          // Continue to next method
        }
      }
    }

    // Try Downloads API as fallback (saves to Downloads folder)
    if (savePreferences.method === 'auto' || savePreferences.method === 'downloads') {
      try {
        console.log('[ChatVault Background] 🎯 Attempting Downloads API method (fallback)...');
        const downloadResult = await saveViaDownloadAPI(
          fullContent, // Use full content including frontmatter
          filename,
          `${savePreferences.downloadsFolder}/${service.toUpperCase()}`
        );

        if (downloadResult.success) {
          console.log('[ChatVault Background] ✅ Successfully saved via Downloads API');

          // Show notification for Downloads API save
          notifyBasic({ message: `Saved to Downloads: ${filename}` });

          sendResponse({
            success: true,
            method: 'downloads',
            message: `Saved to Downloads folder: ${savePreferences.downloadsFolder}/${service.toUpperCase()}/${filename}\n\nNote: File saved to Downloads folder. Move to your Obsidian vault manually.`,
            filename: filename,
            downloadId: downloadResult.downloadId,
            path: `${savePreferences.downloadsFolder}/${service.toUpperCase()}/${filename}`
          });
          return;
        }
      } catch (error) {
        console.error('[ChatVault Background] ⚠️ Downloads API failed, trying next method:', error);
        // Continue to next method
      }
    }

    // First check if Advanced URI plugin might be installed
    console.log('[ChatVault Background] 🧪 Testing Advanced URI availability...');

    if (advancedUri.length < ADVANCED_URI_LIMIT) {
      console.log('[ChatVault Background] 🚀 Trying Advanced URI method first...');

      // Try Advanced URI
      openUrlWithAutoClose(advancedUri, 3000)
        .then(() => {
          console.log('[ChatVault Background] ✅ Advanced URI tab created');
          sendResponse({
            success: true,
            method: 'advanced-uri',
            message: `Saved to Obsidian via Advanced URI plugin (${uriMethod} method)`,
            filename: filename
          });
        })
        .catch((err) => {
          console.error('[ChatVault Background] ❌ Advanced URI failed:', err);
          // Fall back to clipboard method
          fallbackToClipboard();
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
      }, (_) => {
        if (chrome.runtime.lastError) {
          console.error('[ChatVault Background] ❌ Clipboard error:', chrome.runtime.lastError);
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
            errorCode: 'CLIPBOARD_FAILED',
            userMessage: 'クリップボードへのコピーに失敗しました。再度お試しください。'
          });
        } else {
          console.log('[ChatVault Background] ✅ Clipboard success, now opening Obsidian...');

          // Create a simple URI to open Obsidian and prompt for new note
          const simpleUri = `obsidian://new?vault=${encodedVault}&file=${encodedFile}`;
          console.log('[ChatVault Background] 📝 Opening Obsidian with simple URI:', simpleUri);

          // Open Obsidian with the simple URI (no content)
          openUrlWithAutoClose(simpleUri, 3000)
            .then(() => {
              console.log('[ChatVault Background] ✅ Obsidian opened with empty file, content in clipboard');
              console.log('[ChatVault Background] 📋 User needs to paste content manually with Ctrl/Cmd+V');
              sendResponse({
                success: true,
                method: 'clipboard',
                message: `Content copied to clipboard!\n\nObsidian will open with an empty file. Please paste the content with Ctrl/Cmd+V\n\nFile: ${filename}\n\nNote: This is due to a limitation in Obsidian's URI scheme. For automatic content insertion, consider installing the Advanced URI plugin.`,
                filename: filename,
                tip: 'Install Advanced URI plugin for better integration'
              });
            })
            .catch((err) => {
              console.error('[ChatVault Background] ❌ Failed to open Obsidian:', err);
              sendResponse({
                success: false,
                error: 'Failed to open Obsidian: ' + (err.message || err),
                errorCode: 'SAVE_FAILED',
                userMessage: '保存に失敗しました。コンソールのログを確認してください。'
              });
            });
        }
      });
    };

    // Final fallback: clipboard method
    console.log('[ChatVault Background] 📋 Using final fallback: clipboard method');
    fallbackToClipboard();
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
      const base64Content = toBase64Utf8(processedContent);
      const base64Uri = `obsidian://new?vault=${encodedVault}&file=${encodedFile}&content=base64:${base64Content}`;

      console.log('[ChatVault Background] 🔍 Debugging different URI formats:');
      console.log('[ChatVault Background] 1️⃣ Standard URI length:', obsidianUri.length);
      console.log('[ChatVault Background] 2️⃣ Base64 URI length:', base64Uri.length);

      // Test with a minimal content first
      const minimalContent = 'Test\nMultiple\nLines\nContent';
      const minimalUri = buildObsidianNewUri({ vaultName, filePath: fullFilePath, content: minimalContent });
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

      openUrlWithAutoClose(obsidianUri, 5000)
        .then((tab) => {
          console.log('[ChatVault Background] ✅ Tab created successfully:', tab);
          console.log('[ChatVault Background] 📊 Tab details:', {
            id: tab?.id,
            url: tab?.url,
            status: tab?.status,
            pendingUrl: tab?.pendingUrl
          });

          // Send success response
          sendResponse({
            success: true,
            method: 'obsidian-uri',
            message: `Saved to Obsidian via URI method`,
            filename: filename
          });
        })
        .catch((err) => {
          console.error('[ChatVault Background] ❌ Tab creation error:', err);
          sendResponse({
            success: false,
            error: 'Failed to create tab: ' + (err.message || err)
          });
        });

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
    const { messages, service, conversationTitle, messageType, count } = request;

    if (!messages || messages.length === 0) {
      sendResponse({ success: false, error: 'No messages to save' });
      return;
    }

    // Get settings
    const settings = await getSync([
      'obsidianVault',
      'chatFolderPath',
      'chatNoteFormat'
    ]);

    const vaultName = settings.obsidianVault || 'MyVault';
    const folderTemplate = settings.chatFolderPath || 'ChatVault/{service}';
    const noteTemplate = settings.chatNoteFormat || '---\ntitle: {title}\ndate: {date}\nservice: {service}\nurl: {url}\n---\n\n{content}';

    // Generate content
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const title = conversationTitle || `${service} Chat - ${dateStr}`;

    let content = '';
    if (messageType === 'recent') {
      content += `# Last ${count || messages.length} Messages\n\n`;
    } else if (messageType === 'all') {
      content += `# Full Conversation\n\n`;
    } else if (messageType === 'selection') {
      content += `# Selected Messages\n\n`;
    }

    messages.forEach((msg, index) => {
      const speaker = msg.speaker || (msg.role === 'user' ? 'User' : 'Assistant');
      const body = (msg.content || '');
      content += `### ${speaker}\n\n${body}\n\n`;
      if (index < messages.length - 1) {
        content += '---\n\n';
      }
    });

    // Apply template
    const finalContent = noteTemplate
      .replace('{title}', title)
      .replace('{date}', dateStr)
      .replace('{service}', service)
      .replace('{url}', sender.tab?.url || '')
      .replace('{type}', messageType || 'single')
      .replace('{content}', content);

    // Generate folder path and filename
    const folderPath = folderTemplate
      .replace('{service}', service.toUpperCase())
      .replace('{date}', dateStr)
      .replace('{title}', title)
      .replace('{type}', messageType || 'single');

    // Sanitize title for filename
    const sanitizedTitle = title
      .replace(/[\/\\:*?"<>|]/g, '') // Remove file system unsafe characters
      .replace(/\s+/g, '_')
      .trim() || 'untitled';

    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `${dateStr}_${timeStr}_${messageType}_${service}_${sanitizedTitle}.md`;

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
          const simpleUri = buildObsidianNewUri({ vaultName, filePath: fullFilePath });

          openUrlWithAutoClose(simpleUri, 3000).then(() => {
            sendResponse({
              success: true,
              method: 'clipboard',
              message: `${messages.length} messages copied to clipboard!\n\nObsidian should open now. Paste with Ctrl/Cmd+V`,
              filename: filename
            });
          }).catch((err) => {
            console.error('[ChatVault Background] ❌ Failed to open Obsidian:', err);
            sendResponse({ success: false, error: 'Failed to open Obsidian: ' + (err.message || err) });
          });
        }
      });
    } else {
      openUrlWithAutoClose(obsidianUri, 3000)
        .then(() => {
          sendResponse({
            success: true,
            method: 'uri',
            message: `${messages.length} messages saved to Obsidian`,
            filename: filename
          });
        })
        .catch((err) => {
          console.error('[ChatVault Background] ❌ Failed to open Obsidian:', err);
          sendResponse({ success: false, error: 'Failed to open Obsidian: ' + (err.message || err) });
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
