// jest-dom adds custom jest matchers for asserting on DOM nodes.
require('@testing-library/jest-dom');

// Chrome Extension API のモック
global.chrome = {
  storage: {
    local: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve())
    },
    sync: {
      get: jest.fn(() => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve())
    }
  },
  runtime: {
    sendMessage: jest.fn(() => Promise.resolve()),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([])),
    sendMessage: jest.fn(() => Promise.resolve())
  }
};

// File System Access API のモック
global.showDirectoryPicker = jest.fn();
global.showSaveFilePicker = jest.fn(); 