# manifests

Chrome拡張機能のマニフェストファイルを含むディレクトリです。

## ファイル

### manifest_chromium.json
Chrome拡張機能のマニフェスト（1.6KB、58行）
- **対象**: Chrome、Edge、その他のChromiumベースブラウザ
- **機能**: 拡張機能の設定と権限定義

### manifest_firefox.json
Firefox拡張機能のマニフェスト（1.2KB、40行）
- **対象**: Firefoxブラウザ
- **機能**: Firefox固有の設定と権限

## 主な設定

### 基本情報
- **name**: 拡張機能名
- **version**: バージョン番号
- **description**: 機能説明
- **manifest_version**: マニフェストバージョン

### 権限設定
- **activeTab**: アクティブタブへのアクセス
- **storage**: データの永続化
- **notifications**: 通知機能
- **scripting**: スクリプト注入

### コンテンツスクリプト
- **matches**: 注入対象のURLパターン
- **js**: 注入するJavaScriptファイル
- **css**: 注入するCSSファイル
- **run_at**: 注入タイミング

### バックグラウンドスクリプト
- **service_worker**: サービスワーカーファイル
- **persistent**: 永続的な実行

## ブラウザ固有の設定

### Chrome/Chromium
- **manifest_version**: 3
- **service_worker**: バックグラウンドスクリプト
- **host_permissions**: ホスト権限

### Firefox
- **manifest_version**: 2
- **background**: バックグラウンドスクリプト
- **permissions**: 権限設定

## 開発ガイドライン

- 必要最小限の権限を要求
- セキュリティを考慮した設定
- ブラウザ互換性を確保
- 適切なバージョン管理
