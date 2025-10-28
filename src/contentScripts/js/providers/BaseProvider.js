// Abstract base provider to define the interface expected by the content script
// Concrete providers (ChatGPT, Gemini, etc.) should implement these methods.

export default class BaseProvider {
  // Return a set of CSS selectors used to find message containers, etc.
  static getSelectors() {
    throw new Error('getSelectors() must be implemented by provider');
  }

  // Add a save button to the given message element
  // Should return { added: boolean, target: HTMLElement|null }
  static addSaveButton(messageElement, createButtonFn) { // eslint-disable-line no-unused-vars
    return { added: false, target: null };
  }

  // Create the provider-specific save button element
  static createSaveButton() {
    const btn = document.createElement('button');
    btn.textContent = 'Save';
    btn.className = 'chatvault-save-btn';
    return btn;
  }

  // Given a clicked button, resolve its parent message element when not obvious
  static resolveMessageElementFromButton(/* btn */) {
    return null;
  }

  // Extract a single message's data from the DOM element
  static extractSingleMessage(/* messageElement */) {
    throw new Error('extractSingleMessage() must be implemented by provider');
  }

  // Capture multiple messages (mode: 'all' | 'recent', count?: number)
  static captureMessages(/* mode, count */) {
    throw new Error('captureMessages() must be implemented by provider');
  }
}
