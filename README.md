# Better Diagrams as Code to Image

[繁體中文](./README.zh-TW.md) | [English](./README.md)

![Version](https://img.shields.io/badge/version-1.7.0-blue)
![React](https://img.shields.io/badge/react-18.3.1-61DAFB?logo=react)

A powerful tool to render Mermaid, PlantUML, and D2 code in real-time and export them as high-quality images.

## Features
* **Multi-Engine Support**: Built-in support for Mermaid, PlantUML, and D2.
* **Multi-Language Interface**: English, Traditional Chinese, and Simplified Chinese are natively supported.
* **PlantUML Server**: A public PlantUML server (default: `http://www.plantuml.com/plantuml`) is used.
  - ⚠️ **Warning**: Do not enter any sensitive or confidential data.
* **Real-time Preview**: See the rendered diagram instantly as you write code.
* **Smart Color Palette**: The editor features an inline color picker. It automatically detects hex codes and allows you to change colors with a simple click.
* **Multi-Format Export**: Export your diagrams in PNG, JPG, and SVG formats.
* **High-Resolution Download**: Set the scale factor (up to 20x) to download crystal clear, high-definition images.
* **Seamless Clipboard Support**: One-click copy high-quality PNGs directly to your clipboard for easy pasting into reports or documents.
* **Shareable Links**: Encode your code into a URL for instant sharing.
* **Dark Mode**: Automatically syncs with your system theme, or manually toggleable.

### Known Edge Cases

- **Brave Browser & Mermaid**: When using the Brave browser with aggressive "Brave Shields" settings (such as strict tracker or Canvas fingerprinting blocking), Mermaid's engine may fail to initialize (showing a `Failed to fetch dynamically imported module` error). **Workaround**: Disable Brave Shields for the application or allow Canvas fingerprinting for the site to render properly.

## Development
This project is built with React + TypeScript + Vite.

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```
