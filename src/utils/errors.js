// Common error codes used across content scripts and background
// Centralized to avoid duplication and ensure consistent error handling

export const ErrorCodes = {
  NoServiceDetected: 'NO_SERVICE',
  MissingVaultHandle: 'MISSING_VAULT_HANDLE',
  ClipboardFailed: 'CLIPBOARD_FAILED',
  FilesystemPermission: 'FILESYSTEM_PERMISSION',
  ObsidianUriTooLong: 'URI_TOO_LONG',
  BackgroundNoTabId: 'NO_TAB_ID',
  SaveFailed: 'SAVE_FAILED',
};

export default ErrorCodes;
