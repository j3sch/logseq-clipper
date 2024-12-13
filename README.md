A fork of the official [Obsidian Web Clipper](https://github.com/obsidianmd/obsidian-clipper), adapted for Logseq. Logseq Web Clipper is a browser extension that helps you highlight and save web pages. 

## Installation
Available for Chromium-based browsers like Chrome, Brave, and Arc, as well as Firefox:
- [Chrome Web Store](https://chromewebstore.google.com/detail/logseq-web-clipper/fhjehofpeafndgabgbehflkncpmdldgg)  
- [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/logseq-web-clipper/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search)

## Developers

To build the extension:

```
npm run build
```

This will create three directories:
- `dist/` for the Chromium version
- `dist_firefox/` for the Firefox version
- `dist_safari/` for the Safari version

### Install the extension locally

For Chromium browsers, such as Chrome, Brave, Edge, and Arc:

1. Open your browser and navigate to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist` directory

For Firefox:

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Navigate to the `dist_firefox` directory and select the `manifest.json` file

## Third-party libraries

- [webextension-polyfill](https://github.com/mozilla/webextension-polyfill) for browser compatibility
- [readability](https://github.com/mozilla/readability) for content extraction
- [turndown](https://github.com/mixmark-io/turndown) for HTML to Markdown conversion
- [dayjs](https://github.com/iamkun/dayjs) for date parsing and formatting
- [lz-string](https://github.com/pieroxy/lz-string) to compress templates to reduce storage space
- [lucide](https://github.com/lucide-icons/lucide) for icons
- [mathml-to-latex](https://github.com/asnunes/mathml-to-latex) for MathML to LaTeX conversion
- [dompurify](https://github.com/cure53/DOMPurify) for sanitizing HTML
