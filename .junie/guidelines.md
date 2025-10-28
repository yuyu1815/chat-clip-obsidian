# Development Guidelines — Chat Clip Obsidian

Last updated: 2025-08-28 14:20

This document captures project-specific knowledge to speed up advanced development work. It focuses on non-obvious build/configuration details, test setup, and debugging practices for this browser extension.

## 1. Build and Configuration

- Tooling:
  - Bundler: Webpack 5 (webpack.config.js for production, webpack.dev.js for watch builds)
  - UI: React 18
  - Targets: Chromium and Firefox builds
- Commands (package.json):
  - Development watch build
    - Chromium: `npm run dev:chromium`
    - Firefox: `npm run dev:firefox`
  - Production build
    - Chromium: `npm run build:chromium` → outputs to `dist-chromium`
    - Firefox: `npm run build:firefox` → outputs to `dist-firefox`
  - Bundle analysis
    - Chromium: `npm run analyze:chromium`
    - Firefox: `npm run analyze:firefox`
- Loading the extension (Chromium):
  - Build first: `npm run build:chromium`
  - Load at chrome://extensions → Enable Developer Mode → Load unpacked → select `dist-chromium`.
- Environment/Secrets:
  - No .env is required for builds. Provider-specific secrets (e.g., Obsidian vault path) are set via the extension UI/options and stored in `chrome.storage.local`. Avoid hardcoding service tokens or vault paths.
- Browser-specific notes:
  - The code uses some Chrome extension APIs. When testing on Firefox, ensure polyfilled or compatible APIs where available. Webpack emits browser-specific bundles based on `--env browser=chromium|firefox`.

## 2. Testing

Project uses Jest (jsdom) for unit tests and Playwright for e2e (not mandatory for routine development).

- Jest configuration (package.json > jest):
  - environment: `jsdom`
  - setup: `src/setupTests.js` (mocks fetch and chrome APIs)
  - transform: `babel-jest` for .js/.jsx
  - patterns: `src/**/__tests__/**/*.{js,jsx}` and `src/**/*.{test,spec}.{js,jsx}`
- Commands:
  - Unit tests: `npm test`
  - Watch mode: `npm run test:watch`
  - Coverage: `npm run test:coverage`
  - E2E (if/when needed): `npm run test:e2e` or `npm run test:e2e:ui`

### Adding a New Unit Test

- Place tests under `src/**/__tests__/` or name files `*.test.js` in relevant src folders.
- Import only the module(s) under test; avoid importing the whole provider bundles that depend on actual DOM of third-party pages.
- If your module expects DOM nodes, prefer constructing small HTML snippets and using jsdom APIs (document.createElement or document.body.innerHTML) in the test.
- The Jest setup mocks window.fetch and chrome.* APIs. Add more mocks in `src/setupTests.js` if your test requires additional extension or network behaviors.

### Example Test (verified)

We verified a simple test targeting the HTML→Markdown utility, which already exists in the repo. You can use it as a reference for writing more tests.

- File: `src/utils/__tests__/markdown.test.js`
- What it checks: basic conversion of headings and strong text, and pass-through behavior for plain text.
- How to run:
  1. Ensure dependencies are installed: `npm install`
  2. Run: `npm test`
  3. Expected behavior: The markdown test passes. Note: There are also other tests in this repository that may currently fail if they reference WIP APIs; see the next note.

Note on existing tests: There is a suite under `src/__tests__/claude-ai-news-extractor.test.js` that currently fails because it imports functions not exported by the corresponding module. This is known and unrelated to the markdown utilities. When working on those features, either export the tested functions properly or adjust the tests to the current API.

## 3. Additional Development Information

- Code Style & Linting:
  - The project uses the React App ESLint presets (react-app, react-app/jest). Run your editor’s ESLint integration; there is no explicit lint script.
  - Prefer modern ES modules and React 18 patterns. Keep provider-specific logic in the respective `src/contentScripts/js/providers/*` directories.
- Architecture Highlights:
  - Content scripts per provider (e.g., `src/contentScripts/js/providers/claude/*`, `gemini/*`):
    - These inject UI elements (e.g., Save buttons) into third-party chat UIs. Selectors are brittle; isolate selectors in provider files and document changes when third-party DOM updates.
  - Utilities like `src/utils/markdown.js` perform HTML→Markdown conversion using Turndown with GFM plugin and custom rules for code blocks, hr, and Chat UI wrapper unwrapping.
  - Popup/UI code under `src/chromium/popup/App.js` manages user-facing settings and actions.
- Debugging Tips:
  - Use Chrome DevTools on the target chat page. Enable “Allow access to file URLs” if you’re testing File System Access flows.
  - For content script debugging, rely on console logs within provider modules and observe the injected DOM (classes like `.buttons-container-v2`, action button containers, etc.).
  - If Save buttons don’t appear, inspect whether the mutation observers are attached and whether provider selectors still match. Changes in upstream UIs (Claude/Gemini) often require updating selector logic.
  - Markdown issues: test isolated conversions with `htmlToMarkdown` by pasting small HTML fragments in tests or the console; check fenced code block handling for language classes `language-xyz`.
- Pitfalls:
  - Don’t import browser-only modules in Node contexts (tests). Keep modules pure or behind guards when possible.
  - When modifying selector logic in providers, ensure styles are applied appropriately in special panels (e.g., deep-research panel, extended-response panel) to maintain consistent button placement.
  - Keep `chrome.storage` schemas stable; when changing settings shape, add migration logic and defaulting.

## 4. Releasing / Packaging (quick notes)

- Always produce fresh builds for both Chromium and Firefox targets.
- Use the bundle analyzer when large dependencies are added to avoid bloating the extension.
- Sanity-check the dist output: manifest correctness, assets presence, and popup/options UIs.

