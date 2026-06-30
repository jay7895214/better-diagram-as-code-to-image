# Better Diagrams as Code to Image

[繁體中文](./README.zh-TW.md) | [English](./README.md)

![Version](https://img.shields.io/badge/version-1.4.0-blue)
![React](https://img.shields.io/badge/react-18.3.1-61DAFB?logo=react)

將 Mermaid 與 PlantUML 程式碼即時渲染並匯出為高品質圖片的強大工具。

## 功能特色
* **支援多種引擎**：內建支援 Mermaid 與 PlantUML。
  - **PlantUML Server**：預設使用公開的 PlantUML 伺服器 (`http://www.plantuml.com/plantuml`) 進行轉譯。
  - ⚠️ **警告**：請勿在此輸入任何機密或敏感的資料，因資料將被傳送至外部伺服器。
* **多語系支援**：內建英文、繁體中文與簡體中文介面。
* **即時預覽**：一邊編寫程式碼，一邊即時查看渲染結果。
* **智慧調色盤**：編輯器內建行內選色器，偵測到色碼即可點擊切換顏色，所見即所得。
* **多格式匯出**：支援將圖表匯出為 PNG、JPG 與 SVG 格式。
* **高解析度下載**：可自由設定解析度倍率（最高 20 倍）下載高清圖片。
* **無縫剪貼簿支援**：一鍵將高畫質 PNG 複製到剪貼簿，輕鬆貼入報告或文件中。
* **分享連結**：將您的程式碼打包成 URL，方便與他人分享。
* **深淺色模式**：自動同步作業系統主題，亦可手動切換。

### 已知邊緣情況 (Edge Cases)

- **Brave 瀏覽器與 Mermaid**：當您使用 Brave 瀏覽器並開啟了嚴格的「Brave 盾牌」防護功能（例如阻擋 Canvas 指紋辨識或嚴格追蹤保護）時，Mermaid 引擎可能會初始化失敗（顯示 `Failed to fetch dynamically imported module` 錯誤）。**解決方案**：請針對本應用程式暫時關閉 Brave 盾牌，或放行 Canvas 指紋辨識，即可恢復正常渲染。

## 開發指令
本專案基於 React + TypeScript + Vite 構建。

```bash
# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev

# 編譯打包
npm run build
```
