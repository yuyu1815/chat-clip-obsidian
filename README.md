# ChatVault Clip — AI Chat to Obsidian

Save AI chat conversations from ChatGPT, Claude, and other AI services directly to your Obsidian vault, along with traditional web clipping functionality.

## Description

ChatVault Clip is a browser extension that extends the original [Obsidian Web Clipper](https://github.com/mvavassori/obsidian-web-clipper) with powerful AI chat capture capabilities. With this extension, you can:

- **Save AI Conversations**: Capture single messages, selected text, recent messages, or entire chat threads from ChatGPT and Claude
- **Traditional Web Clipping**: Continue to clip regular web pages just like the original Obsidian Web Clipper
- **Smart Organization**: Automatically organize content with customizable folder structures using placeholders like `{service}`, `{date}`, and `{title}`
- **Markdown Formatting**: Convert chat messages to clean Markdown with proper formatting for code blocks, math expressions, and more
- **One-Click Save**: Save individual messages with floating buttons that appear on hover

## Features

### AI Chat Features (New!)
- **Multiple Capture Modes**:
  - Single Message: Save individual AI responses or user prompts
  - Selected Text: Highlight and save specific portions of conversations
  - Recent Messages: Capture the last N messages (customizable)
  - Full Thread: Save entire conversations
- **Service Support**: Currently supports ChatGPT and Claude, with more services planned
- **Smart Formatting**: Preserves code blocks, math expressions (LaTeX), and formatting
- **Hover Buttons**: Convenient save buttons appear when hovering over chat messages

### Web Clipping Features (Original)
- **Efficient Note-Taking**: Click the extension icon to open a popup where you can jot down notes related to the current webpage
- **Customizable Titles**: The title of the note defaults to the webpage title, but can be easily edited
- **Page Link Tracking**: The link to the current webpage is automatically added at the top of the note content
- **Direct Obsidian Integration**: Define the Obsidian vault and folder structure for your clippings

## Installation

### From Web Store (Coming Soon)
The extension will be available on:
- Chrome Web Store
- Microsoft Edge Add-ons
- Firefox Add-ons

### Manual Installation (Development)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/chatvault-clip.git
cd chatvault-clip
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
# For Chrome/Edge
npm run build:chromium

# For Firefox
npm run build:firefox
```

4. Load the extension:
   - Chrome/Edge: Go to `chrome://extensions/`, enable Developer mode, click "Load unpacked" and select the `dist-chromium` folder
   - Firefox: Go to `about:debugging`, click "This Firefox", click "Load Temporary Add-on" and select the `manifest.json` file in `dist-firefox`

## Configuration

1. After installation, click the extension icon and select **Options**
2. Configure your settings:
   - **Obsidian Vault Name**: The name of your Obsidian vault
   - **Web Clips Folder**: Path for traditional web clippings (e.g., `Web Clips/{title}`)
   - **Enable ChatVault Features**: Toggle to enable AI chat capture
   - **Chat Messages Folder**: Path for AI chat saves (e.g., `ChatVault/{service}/{date}/{title}`)
   - **Default Capture Mode**: Choose your preferred capture mode
   - **Save Button Settings**: Configure the floating save buttons

## Usage

### For AI Chats (ChatGPT, Claude)
1. Navigate to ChatGPT or Claude
2. Use one of these methods:
   - **Hover Save**: Hover over any message to see the save button
   - **Extension Popup**: Click the extension icon and choose a capture mode
   - **Right-Click**: Select text and right-click to save selection

### For Web Pages
1. Click the extension icon while on any webpage
2. Add notes in the popup
3. Click Save to send to Obsidian

## Development

### Available Scripts

- `npm run dev:chromium` - Start development mode for Chrome/Edge
- `npm run dev:firefox` - Start development mode for Firefox
- `npm run build:chromium` - Build for Chrome/Edge
- `npm run build:firefox` - Build for Firefox

### Project Structure

```
src/
├── chromium/           # Chrome/Edge specific code
├── firefox/            # Firefox specific code
├── contentScripts/     # Content scripts for chat injection
├── services/           # Service-specific DOM extraction
└── utils/              # Shared utilities (Markdown conversion, etc.)
```

## Roadmap

- [x] ChatGPT support
- [x] Claude support
- [ ] Google Gemini support
- [ ] Perplexity AI support
- [ ] Bulk export functionality
- [ ] Custom CSS for saved notes
- [ ] API integration options

## Credits

This project is based on the excellent [Obsidian Web Clipper](https://github.com/mvavassori/obsidian-web-clipper) by [Massimiliano Vavassori](https://github.com/mvavassori). The original MIT license has been preserved, and all original functionality remains intact.

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Support

If you find this extension helpful, consider:
- Starring the repository
- Reporting issues or suggesting features
- Contributing to the codebase

For the original Obsidian Web Clipper, you can support the author through [PayPal](https://www.paypal.com/donate/?hosted_button_id=M8RTMTXKV46EC).