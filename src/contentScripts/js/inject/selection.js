// Selection mode helpers isolated from inject.js
let selectionOverlay = null;
let isSelectionMode = false;

export function enableSelectionMode() {
  isSelectionMode = true;
  document.body.style.cursor = 'crosshair';

  if (!selectionOverlay) {
    selectionOverlay = document.createElement('div');
    selectionOverlay.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(59, 130, 246, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    selectionOverlay.textContent = '選択モード: テキストをハイライトして保存を押してください';
    document.body.appendChild(selectionOverlay);
  }
}

export function disableSelectionMode() {
  isSelectionMode = false;
  document.body.style.cursor = '';

  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
}

export function getSelectedContent() {
  const selection = window.getSelection();
  if (selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const container = document.createElement('div');
  container.appendChild(range.cloneContents());

  // Keep formatting when possible
  let content = container.innerHTML;
  if (!content.trim()) {
    content = selection.toString();
  }

  return {
    text: selection.toString().trim(),
    html: content,
    range: {
      startContainer: range.startContainer.nodeType === Node.TEXT_NODE ?
                     range.startContainer.parentElement?.tagName : range.startContainer.tagName,
      endContainer: range.endContainer.nodeType === Node.TEXT_NODE ?
                   range.endContainer.parentElement?.tagName : range.endContainer.tagName
    }
  };
}

export default { enableSelectionMode, disableSelectionMode, getSelectedContent };
