// Jest setup file
import '@testing-library/jest-dom';

// Mock fetch globally for tests
global.fetch = jest.fn();

// Mock chrome extension APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  }
};

// Mock console to reduce noise in tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn()
};