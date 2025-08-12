// Central error codes and user-facing messages

export const ErrorCodes = {
  NoServiceDetected: 'NO_SERVICE',
  MissingVaultHandle: 'MISSING_VAULT_HANDLE',
  ClipboardFailed: 'CLIPBOARD_FAILED',
  FilesystemPermission: 'FILESYSTEM_PERMISSION',
  ObsidianUriTooLong: 'URI_TOO_LONG',
  BackgroundNoTabId: 'NO_TAB_ID',
  SaveFailed: 'SAVE_FAILED',
};

export function toUserMessage(code, detail) {
  switch (code) {
    case ErrorCodes.NoServiceDetected:
      return '対応サイトではありません（ChatGPT/Claudeで使用してください）';
    case ErrorCodes.MissingVaultHandle:
      return 'Vaultフォルダが未設定です。オプションからVaultを選択してください。';
    case ErrorCodes.ClipboardFailed:
      return 'クリップボードへのコピーに失敗しました。再度お試しください。';
    case ErrorCodes.FilesystemPermission:
      return 'ファイル保存の権限がありません。Vaultフォルダの権限を再承認してください。';
    case ErrorCodes.ObsidianUriTooLong:
      return 'コンテンツが大きすぎてURIに載せられません。クリップボード保存に切り替えます。';
    case ErrorCodes.BackgroundNoTabId:
      return '有効なタブが見つかりません。ページをリロードして再試行してください。';
    case ErrorCodes.SaveFailed:
      return '保存に失敗しました。コンソールのログを確認してください。';
    default:
      return detail || '不明なエラーが発生しました。';
  }
}


