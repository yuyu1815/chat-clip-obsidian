# Chromium Extension Directory Structure

This directory contains the code for the Chrome/Chromium extension. The structure is organized as follows:

## Directory Structure

```
src/chromium/
├── background/       # Background script
│   └── background.js # Main background script for the extension
├── popup/            # Popup UI
│   ├── components/   # React components for the popup
│   │   ├── ChatModeSelector.js
│   │   └── MarkdownPreview.js
│   ├── App.css       # Styles for the popup
│   ├── App.js        # Main popup component
│   ├── index.css     # Global styles
│   └── index.js      # Entry point for the popup
└── options/          # Options page
    ├── OptionsApp.js # Main options page component
    └── options.js    # Entry point for the options page
```

## Components

### Background

The `background` directory contains the background script for the extension. This script runs in the background and handles:
- Message passing between content scripts and popup
- Saving content to Obsidian
- Managing extension settings

### Popup

The `popup` directory contains the code for the extension's popup UI. This includes:
- The main App component
- UI components for selecting chat modes and previewing markdown
- Styles for the popup

### Options

The `options` directory contains the code for the extension's options page. This includes:
- The main OptionsApp component
- Configuration for Obsidian vault and folder paths
- Settings for chat modes and save behavior

## Entry Points

The extension has three main entry points:
1. `popup/index.js` - Entry point for the popup UI
2. `options/options.js` - Entry point for the options page
3. `background/background.js` - Entry point for the background script

These entry points are configured in the webpack.config.js file.
