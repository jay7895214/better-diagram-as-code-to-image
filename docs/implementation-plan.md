# Diagrams as Code 轉圖片工具 — Implementation Plan

> 本文件為交接文件，請完整閱讀後再開始實作。文件中包含明確的技術決策、架構規範與分階段任務清單，請依序執行，不要跳步驟。如有任何決策點標註為「待確認」，請先回報給使用者，不要自行假設。

---

## 1. 專案目標

開發一個**純前端**的網站工具，讓使用者輸入 Diagrams as Code（例如 Mermaid、PlantUML）的程式碼，即時預覽渲染結果，並可將結果匯出成 SVG / PNG / JPG，支援下載與複製到剪貼簿，支援解析度倍率設定，並支援切換不同的渲染引擎版本。

**部署目標**：GitHub Pages（純靜態網站，無後端伺服器）。

---

## 2. 技術棧（已決定，不需要再討論）

| 項目 | 選擇 | 理由 |
|---|---|---|
| 建置工具 | Vite | 快速、原生支援 ESM、適合純前端 SPA |
| 框架 | React + TypeScript | 生態成熟、元件化適合這種多模組工具 |
| 編輯器 | CodeMirror 6 | 比 Monaco 輕量很多（Monaco 打包後動辄 2-3MB+），模組化可只載入需要的語言高光套件，適合輕量工具 |
| 樣式 | 任選（建議 Tailwind CSS，開發速度快） | — |
| 部署 | GitHub Pages + GitHub Actions | 自動化 build & deploy |
| 狀態管理 | React 內建 useState/useContext 即可，不需要 Redux 等重型方案（專案規模不大） |

**重要：全程不需要任何後端伺服器、資料庫、API server。所有運算（除了 PlantUML 渲染，見下方說明）都在使用者瀏覽器端完成。**

---

## 3. 整體架構：可擴充的渲染引擎介面

這是整個專案的核心設計，**務必先實作這層再做其他功能**，否則後面會難以擴充。

### 3.1 共通介面定義

建立檔案 `src/renderers/types.ts`：

```typescript
// 渲染結果
export interface RenderResult {
  success: boolean;
  svg?: string;        // 渲染成功時回傳的 SVG 字串
  error?: string;      // 渲染失敗時的錯誤訊息（給使用者看，盡量是人話，不要丟原始 stack trace）
}

// 每一種 Diagram 引擎都要實作這個介面
export interface DiagramRenderer {
  id: string;                      // 唯一識別碼，例如 "mermaid", "plantuml"
  displayName: string;             // 顯示在 UI 上的名稱，例如 "Mermaid"
  supportedVersions: string[];     // 可選版本清單，例如 ["10.9.1", "11.4.0", "latest"]
  defaultVersion: string;          // 預設版本
  defaultSampleCode: string;       // 使用者選擇此引擎時，編輯器內預填的範例程式碼
  requiresExternalService: boolean; // 是否需要呼叫外部伺服器（PlantUML = true, Mermaid = false）
  render(code: string, version: string): Promise<RenderResult>;
}
```

### 3.2 註冊機制

建立檔案 `src/renderers/registry.ts`，維護一份所有可用渲染引擎的清單：

```typescript
import { mermaidRenderer } from "./mermaid/mermaidRenderer";
import { plantumlRenderer } from "./plantuml/plantumlRenderer";
import type { DiagramRenderer } from "./types";

export const RENDERER_REGISTRY: DiagramRenderer[] = [
  mermaidRenderer,
  plantumlRenderer,
];

export function getRendererById(id: string): DiagramRenderer | undefined {
  return RENDERER_REGISTRY.find((r) => r.id === id);
}
```

**未來要新增 Graphviz、D2 等引擎時，只需要：**
1. 在 `src/renderers/` 下新增一個資料夾（例如 `graphviz/`），實作 `DiagramRenderer` 介面
2. 在 `registry.ts` 加入這個新實作
3. UI 會自動列出新選項，不需要改動其他程式碼

請務必照這個模式實作，不要把 Mermaid 或 PlantUML 的邏輯寫死在 UI 元件裡。

---

## 4. 渲染引擎實作細節

### 4.1 Mermaid（純前端渲染）

**目標**：支援使用者選擇不同 Mermaid 版本，動態載入對應版本的函式庫渲染。

**做法**：透過 CDN（jsdelivr）以動態 `import()` 載入指定版本的 ESM 模組，**不要**把 Mermaid 寫死 import 在 package.json 裡當作固定依賴（這樣只能用一個版本）。

```typescript
// src/renderers/mermaid/mermaidRenderer.ts
import type { DiagramRenderer, RenderResult } from "../types";

const versionCache = new Map<string, any>(); // 快取已載入的版本，避免重複載入

async function loadMermaidVersion(version: string) {
  if (versionCache.has(version)) {
    return versionCache.get(version);
  }
  const moduleUrl = `https://cdn.jsdelivr.net/npm/mermaid@${version}/+esm`;
  const mermaidModule = await import(/* @vite-ignore */ moduleUrl);
  versionCache.set(version, mermaidModule);
  return mermaidModule;
}

export const mermaidRenderer: DiagramRenderer = {
  id: "mermaid",
  displayName: "Mermaid",
  supportedVersions: ["11.4.0", "10.9.1", "9.4.3"], // 待確認：實際版本號請查詢 npm 上 mermaid 套件目前有哪些穩定版本
  defaultVersion: "11.4.0",
  requiresExternalService: false,
  defaultSampleCode: `graph TD
    A[開始] --> B{是否下雨?}
    B -->|是| C[帶雨傘]
    B -->|否| D[不用帶雨傘]`,

  async render(code: string, version: string): Promise<RenderResult> {
    try {
      const mermaidModule = await loadMermaidVersion(version);
      const mermaid = mermaidModule.default;

      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict", // 重要：避免使用者輸入惡意內容造成 XSS，見第 8 節安全性說明
        fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif", // 重要：確保中文字型正確顯示，見 4.1.1
      });

      // 用一個隨機 id 避免多次渲染衝突
      const renderId = `mermaid-render-${Date.now()}`;
      const { svg } = await mermaid.render(renderId, code);

      return { success: true, svg };
    } catch (err: any) {
      return {
        success: false,
        error: `Mermaid 渲染失敗：${err?.message ?? "未知錯誤，請檢查語法"}`,
      };
    }
  },
};
```

#### 4.1.1 中文字型正確顯示（重要，使用者明確要求）

這裡有兩層風險，**都要處理**：

**風險一：瀏覽器內預覽時中文沒有正確顯示**
在呼叫 `mermaid.initialize()` 時，明確指定包含中文字型的 `fontFamily`（如上方範例），不要留空讓它用預設值。建議在 `index.html` 中用 Google Fonts 載入思源黑體（Noto Sans TC）作為保底字型：

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet">
```

**風險二：匯出成 PNG/JPG 時字型跑掉（這是使用者特別關切的點）**
這是 SVG → Canvas → PNG 流程中最容易出問題的地方。SVG 內部的文字渲染依賴瀏覽器當下載入的字型，如果匯出時字型還沒載入完成，或者目標裝置沒有對應字型，繪製到 canvas 上的文字可能會跑版、變成預設字型、甚至是方框（tofu）。

**處理方式**：
1. 在做 SVG → Canvas 轉換前，務必先呼叫 `document.fonts.ready` 確保字型載入完成：
   ```typescript
   await document.fonts.ready;
   ```
2. 在 SVG 字串內，將文字相關的 CSS 明確內嵌指定字型（不要依賴外部 CSS class），確保 SVG 本身是「自帶字型宣告」的：
   ```typescript
   // 在拿到 mermaid 回傳的 svg 字串後，注入明確的 font-family 樣式
   const svgWithFont = svg.replace(
     "<svg",
     `<svg style="font-family: 'Noto Sans TC', sans-serif;"`
   );
   ```
3. 匯出 PNG 時的轉換流程請見第 5.2 節，務必等待字型 ready 後才執行 `Image.onload` → `canvas.drawImage`。
4. 在測試階段，**務必拿純中文內容的 diagram 程式碼測試匯出結果**，肉眼確認字型沒有跑掉，不要只測試英文範例。

---

### 4.2 PlantUML（第一階段：外部 PlantUML Server）

**重要：這部分需要呼叫外部服務，不是純前端離線運作。請務必在 UI 上明確告知使用者。**

**做法**：使用 `plantuml-encoder` 這個 npm 套件，將使用者輸入的 PlantUML 程式碼編碼成 PlantUML server 認得的 URL 參數格式，組成圖片網址。

```bash
npm install plantuml-encoder
```

```typescript
// src/renderers/plantuml/plantumlRenderer.ts
import { encode } from "plantuml-encoder";
import type { DiagramRenderer, RenderResult } from "../types";

const PLANTUML_SERVER = "https://www.plantuml.com/plantuml";

export const plantumlRenderer: DiagramRenderer = {
  id: "plantuml",
  displayName: "PlantUML",
  supportedVersions: ["latest"], // PlantUML server 通常固定版本，第一階段不提供版本選擇
  defaultVersion: "latest",
  requiresExternalService: true, // 重要旗標，UI 要依此顯示警示文字
  defaultSampleCode: `@startuml
Alice -> Bob: 你好
Bob --> Alice: 嗨！
@enduml`,

  async render(code: string): Promise<RenderResult> {
    try {
      const encoded = encode(code);
      const svgUrl = `${PLANTUML_SERVER}/svg/${encoded}`;

      // 重要：要實際 fetch 一次確認有沒有錯誤（例如語法錯誤，PlantUML server 仍可能回傳 200 但內容是錯誤圖片）
      const response = await fetch(svgUrl);
      if (!response.ok) {
        throw new Error(`PlantUML server 回應錯誤（狀態碼 ${response.status}）`);
      }
      const svgText = await response.text();

      return { success: true, svg: svgText };
    } catch (err: any) {
      return {
        success: false,
        error: `PlantUML 渲染失敗：${err?.message ?? "請檢查語法或網路連線"}`,
      };
    }
  },
};
```

**UI 規範（重要，不可省略）**：
當使用者選擇 PlantUML 引擎時，編輯器上方或旁邊必須顯示一段提示文字，例如：

> ⚠️ PlantUML 渲染會將你輸入的程式碼傳送至外部伺服器（plantuml.com）進行處理，請勿輸入機密或敏感內容。

**未來擴充方向（不在本階段實作範圍，但架構要留空間）**：之後可能會把 PlantUML 換成 WASM 本地渲染方案，達到完全離線。由於已經抽象成 `DiagramRenderer` 介面，未來只需要新增一個 `plantumlWasmRenderer.ts` 並在 registry 中替換即可，不需要改動 UI 層程式碼。

---

## 5. 匯出功能實作細節

### 5.1 SVG 直接下載 / 複製

SVG 本身就是文字格式，最簡單：

```typescript
function downloadSvg(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

async function copySvgToClipboard(svgString: string) {
  await navigator.clipboard.writeText(svgString);
}
```

### 5.2 SVG → PNG / JPG 轉換（含解析度倍率）

這是整個專案中技術細節最多的部分，請照下方步驟完整實作，不要省略任何一步：

```typescript
interface ExportOptions {
  format: "png" | "jpg";
  scale: 1 | 2 | 3 | 4; // 解析度倍率
  backgroundColor?: string; // JPG 不支援透明背景，需要給預設底色，建議白色
}

async function exportSvgToRaster(
  svgString: string,
  options: ExportOptions
): Promise<Blob> {
  // 步驟 1：確保字型載入完成（見 4.1.1 中文字型說明，這一步不能省）
  await document.fonts.ready;

  // 步驟 2：從 SVG 字串取得原始尺寸
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
  const svgEl = svgDoc.documentElement;

  // 注意：SVG 可能用 viewBox 而沒有明確 width/height，要做 fallback 處理
  const viewBox = svgEl.getAttribute("viewBox");
  let width = parseFloat(svgEl.getAttribute("width") || "0");
  let height = parseFloat(svgEl.getAttribute("height") || "0");

  if ((!width || !height) && viewBox) {
    const [, , vbWidth, vbHeight] = viewBox.split(/\s+/).map(Number);
    width = width || vbWidth;
    height = height || vbHeight;
  }

  if (!width || !height) {
    throw new Error("無法判斷圖表尺寸，SVG 缺少 width/height 或 viewBox");
  }

  // 步驟 3：建立 Canvas，依倍率放大實際像素尺寸
  const canvas = document.createElement("canvas");
  canvas.width = width * options.scale;
  canvas.height = height * options.scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法取得 Canvas context");

  // JPG 不支援透明背景，需要先填底色；PNG 可選擇是否填底色
  if (options.format === "jpg" || options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.scale(options.scale, options.scale);

  // 步驟 4：把 SVG 轉成 Image 物件，畫到 Canvas 上
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG 轉換成 Image 失敗"));
    img.src = svgUrl;
  });

  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(svgUrl);

  // 步驟 5：輸出成指定格式的 Blob
  const mimeType = options.format === "png" ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas 轉換成圖片失敗"));
      },
      mimeType,
      options.format === "jpg" ? 0.95 : undefined // JPG 品質設定，PNG 不需要
    );
  });
}
```

**請注意以下幾個容易出錯的細節**：
- `canvas.width = width * scale` 是設定**實際像素尺寸**（解析度），不要跟 CSS 顯示尺寸搞混。
- 一定要先 `ctx.scale(scale, scale)` 再 `drawImage`，否則放大倍率不會生效。
- SVG 轉 Image 物件這一步是非同步的，一定要等 `onload` 觸發才能畫到 canvas 上，否則會畫出空白圖片（這是很常見的 bug）。
- JPG 沒有透明通道，沒填背景色的話預設會變黑色，務必照步驟 3 處理。

### 5.3 下載 PNG/JPG

```typescript
function downloadBlob(blob: Blob, filename: string, extension: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${extension}`;
  a.click();
  URL.revokeObjectURL(url);
}
```

### 5.4 複製圖片到剪貼簿

```typescript
async function copyImageToClipboard(blob: Blob) {
  // 注意：Clipboard API 寫入圖片目前主流瀏覽器只支援 image/png，不支援 image/jpeg
  // 如果使用者選擇複製 JPG，請先轉成 PNG blob 再複製，或在 UI 上限制「複製」只對 PNG 開放
  if (blob.type !== "image/png") {
    throw new Error("瀏覽器剪貼簿目前只支援複製 PNG 格式圖片");
  }
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}
```

**UI 規範**：複製按鈕在使用者選擇 JPG 格式時，建議直接disable並顯示提示文字「複製功能僅支援 PNG」，避免執行時噴錯誤訊息給使用者。

---

## 6. UI / Layout 規劃

### 6.1 整體 Layout

```
┌─────────────────────────────────────────────────────┐
│  Header：網站標題、引擎選擇 dropdown、版本選擇 dropdown │
├──────────────────────┬────────────────────────────────┤
│                      │                                │
│   左側：CodeMirror    │   右側：即時預覽區               │
│   程式碼編輯器         │   （顯示渲染後的 SVG）            │
│                      │                                │
│                      │   下方：匯出選項                  │
│                      │   - 格式選擇 (SVG/PNG/JPG)        │
│                      │   - 解析度倍率 (1x/2x/3x/4x)      │
│                      │   - [下載] [複製] 按鈕            │
│                      │                                │
└──────────────────────┴────────────────────────────────┘
```

左右各佔約 50% 寬度，建議用 CSS Grid 或 Flexbox 實作，並考慮響應式：螢幕寬度過窄時（例如手機）改成上下排列。

### 6.2 即時預覽與 Debounce

使用者打字時不要每個字元都觸發重新渲染，否則效能很差。請用 debounce（建議 300-500ms）：

```typescript
import { useEffect, useState } from "react";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// 使用方式
const debouncedCode = useDebounce(code, 400);
// 用 debouncedCode 去觸發 renderer.render()，不要用 code 本身
```

### 6.3 錯誤狀態顯示

當 `RenderResult.success === false` 時，右側預覽區要顯示清楚的錯誤訊息（用 `RenderResult.error` 的內容），不要讓畫面空白或卡死。建議用明顯的錯誤樣式（紅色邊框 + icon），並保留上一次成功渲染的圖（不要整個清空），這樣使用者修改程式碼時有個對照基準。

### 6.4 載入狀態

Mermaid 第一次切換版本時需要從 CDN 載入函式庫，PlantUML 需要等待外部 server 回應，這兩種情況都要顯示 loading 狀態（例如簡單的 spinner 或「渲染中...」文字），避免使用者以為網站卡住。

---

## 7. 額外功能（使用者已確認需要）

### 7.1 分享連結功能

**需求**：將程式碼壓縮編碼放入 URL，其他人點擊連結可以看到相同的圖表（包含引擎、版本、程式碼內容）。

**實作方式**：

```typescript
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
```

先安裝套件：
```bash
npm install lz-string
```

```typescript
interface ShareState {
  engine: string;       // 例如 "mermaid"
  version: string;      // 例如 "11.4.0"
  code: string;
}

function generateShareUrl(state: ShareState): string {
  const json = JSON.stringify(state);
  const compressed = compressToEncodedURIComponent(json);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?s=${compressed}`;
}

function parseShareUrl(): ShareState | null {
  const params = new URLSearchParams(window.location.search);
  const compressed = params.get("s");
  if (!compressed) return null;
  try {
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return JSON.parse(json) as ShareState;
  } catch {
    return null;
  }
}
```

**注意事項**：
- 網站載入時（在 `App.tsx` 的 `useEffect` 裡）要先檢查 URL 是否帶有 `?s=` 參數，如果有，優先用這個內容初始化編輯器狀態，**並跳過 LocalStorage 草稿讀取**（分享連結的優先權應該比本機草稿高，否則使用者點分享連結卻看到自己的舊草稿會很困惑）。
- URL 長度有上限（不同瀏覽器/伺服器限制不同，但保守建議整個 URL 不要超過 2000 字元），如果程式碼內容過長導致分享連結過長，建議在 UI 上提示「程式碼過長，分享連結可能無法在某些平台正常使用」，但不需要阻擋功能。
- 提供「複製分享連結」按鈕，按下後用 `navigator.clipboard.writeText()` 把網址複製到剪貼簿，並顯示「已複製」的提示（例如 toast 訊息）。

### 7.2 本機自動儲存草稿（LocalStorage）

**需求**：使用者關閉瀏覽器、重新打開網站，先前寫的程式碼不會丟失。

```typescript
import { useEffect, useState } from "react";

const STORAGE_KEY = "diagram-tool-draft";

interface DraftState {
  engine: string;
  version: string;
  code: string;
}

function useDraftPersistence(initialState: DraftState) {
  const [state, setState] = useState<DraftState>(() => {
    // 注意：如果 URL 帶有分享參數，App.tsx 應該已經處理過優先權，這裡只在沒有分享參數時才讀 LocalStorage
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : initialState;
    } catch {
      return initialState;
    }
  });

  useEffect(() => {
    // 用 debounce 寫入，避免每打一個字就寫一次 LocalStorage
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // LocalStorage 可能因為瀏覽器設定（例如私密模式）而寫入失敗，靜默忽略即可，不要讓使用者體驗中斷
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  return [state, setState] as const;
}
```

**狀態初始化優先順序（請務必按此順序處理，寫在 `App.tsx` 最上層的初始化邏輯）**：
1. 檢查 URL 是否有 `?s=` 分享參數 → 有的話用這個（見 7.1）
2. 沒有分享參數 → 讀取 LocalStorage 的草稿
3. LocalStorage 也沒有資料 → 使用預設引擎（Mermaid）的 `defaultSampleCode`

---

## 8. 安全性注意事項（請務必處理，不要省略）

### 8.1 Mermaid 的 XSS 風險

Mermaid 渲染時若設定不當，使用者輸入的程式碼有可能被用來執行任意 HTML/JS（例如某些舊版 Mermaid 的 `securityLevel` 設定為 `loose` 時允許 click handler 等）。

**處理方式**：在 `mermaid.initialize()` 呼叫時，明確設定：
```typescript
mermaid.initialize({
  securityLevel: "strict", // 不要設成 "loose" 或 "antiscript"
  // ...
});
```
這樣 Mermaid 會自動把渲染結果中的 script、不安全的連結等做消毒處理。**這是必須項目，不是可選項目**，因為這是一個公開工具，任何人都可以輸入任意內容。

### 8.2 PlantUML Server 呼叫的隱私風險

已在第 4.2 節提過，UI 上必須有明確警示文字告知使用者程式碼會送到外部伺服器。

### 8.3 CSP（Content Security Policy）考量

由於 Mermaid 是透過 CDN 動態載入 ESM 模組（`https://cdn.jsdelivr.net`），如果之後要加上嚴格的 CSP header，需要把這個網域加入白名單。GitHub Pages 預設不會加 CSP header，所以第一階段不會有問題，但**請在程式碼註解中標註這一點**，避免之後有人加 CSP 卻找不到為什�么 Mermaid 壞掉。

---

## 9. 專案目錄結構建議

```
diagram-tool/
├── public/
├── src/
│   ├── renderers/
│   │   ├── types.ts                    # DiagramRenderer 介面定義（第 3.1 節）
│   │   ├── registry.ts                 # 渲染引擎註冊清單（第 3.2 節）
│   │   ├── mermaid/
│   │   │   └── mermaidRenderer.ts      # 第 4.1 節
│   │   └── plantuml/
│   │       └── plantumlRenderer.ts     # 第 4.2 節
│   ├── export/
│   │   ├── svgExport.ts                # 第 5.1 節
│   │   └── rasterExport.ts             # 第 5.2-5.4 節
│   ├── hooks/
│   │   ├── useDebounce.ts              # 第 6.2 節
│   │   └── useDraftPersistence.ts      # 第 7.2 節
│   ├── share/
│   │   └── shareUrl.ts                 # 第 7.1 節
│   ├── components/
│   │   ├── Editor.tsx                  # CodeMirror 包裝元件
│   │   ├── PreviewPane.tsx             # 右側預覽區，含錯誤/載入狀態
│   │   ├── EngineSelector.tsx          # 引擎/版本選擇 dropdown
│   │   └── ExportControls.tsx          # 格式/解析度選擇 + 下載/複製按鈕
│   ├── App.tsx                         # 主要狀態管理 + 初始化優先順序邏輯（第 7.2 節）
│   └── main.tsx
├── .github/
│   └── workflows/
│       └── deploy.yml                  # GitHub Actions 自動部署
├── vite.config.ts
└── package.json
```

---

## 10. GitHub Pages 部署設定

### 10.1 `vite.config.ts` 設定 base path

GitHub Pages 如果是部署在 `https://<username>.github.io/<repo-name>/`（不是根網域），**務必**設定 `base`，否則資源路徑會壞掉：

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/<repo-name>/", // 待確認：請填入實際的 repo 名稱
});
```

### 10.2 GitHub Actions 自動部署

建立 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

部署前還需要到 GitHub repo 的 Settings → Pages，把 Source 設定為 "GitHub Actions"。

### 10.3 處理 SPA 路由問題（如果之後加路由）

本專案目前是單頁應用，不涉及多路由，**這節先跳過，不需要處理**。如果之後有人想加多頁面（例如獨立的「關於」頁面），才需要額外處理 GitHub Pages 對 SPA 路由 404 的問題（通常用 `404.html` redirect trick）。

---

## 11. 分階段實作順序（請按此順序進行，不要跳著做）

**Phase 1：骨架與 Mermaid 基本渲染**
1. Vite + React + TypeScript 專案初始化
2. 建立 `DiagramRenderer` 介面與 registry（第 3 節）
3. 實作 Mermaid renderer，先用單一固定版本跑通（不急著做多版本切換）
4. 建立基本左右 Layout（CodeMirror + 預覽區），先不管樣式美觀
5. 串起編輯器輸入 → debounce → 呼叫 renderer → 顯示 SVG 的完整流程

**Phase 2：Mermaid 多版本支援 + 中文字型處理**
1. 實作 CDN 動態載入指定版本（第 4.1 節）
2. 加上版本選擇 UI
3. 處理中文字型顯示問題（第 4.1.1 節），務必用中文範例測試

**Phase 3：匯出功能**
1. SVG 下載/複製（第 5.1 節）
2. SVG → PNG/JPG 轉換 + 解析度倍率（第 5.2 節）
3. PNG/JPG 下載（第 5.3 節）
4. 複製圖片到剪貼簿（第 5.4 節，注意 JPG 限制）
5. 用中文內容測試匯出後字型是否正確（這是使用者特別要求要驗證的項目）

**Phase 4：PlantUML 支援**
1. 實作 PlantUML renderer（第 4.2 節）
2. 加上外部服務警示文字
3. 確認 PlantUML 圖表也能正常走過 Phase 3 的匯出流程（即架構真的可重用，不是只為 Mermaid 寫死）

**Phase 5：分享連結 + 本機草稿**
1. 實作 LocalStorage 草稿儲存（第 7.2 節）
2. 實作分享連結功能（第 7.1 節）
3. 確認初始化優先順序邏輯正確（分享連結 > LocalStorage > 預設範例）

**Phase 6：安全性檢查 + 錯誤處理完善**
1. 確認 Mermaid `securityLevel: "strict"` 設定（第 8.1 節）
2. 確認所有 renderer 的錯誤都能被妥善捕捉並顯示人話錯誤訊息，不會讓畫面空白或整個崩潰
3. 測試邊界情況：空白輸入、語法錯誤、超長程式碼、特殊字元

**Phase 7：UI 細部優化 + 部署**
1. 響應式 Layout（手機版上下排列）
2. Loading 狀態樣式
3. 設定 `vite.config.ts` base path
4. 設定 GitHub Actions 部署流程
5. 實際部署測試，確認 GitHub Pages 上資源路徑、CDN 載入、外部 PlantUML 呼叫都正常運作

---

## 12. 尚待確認/討論的問題清單

以下是在規劃過程中發現、但目前尚未定案的項目，**請在動工前先跟使用者確認**，不要自行假設答案：

1. **Mermaid 支援的版本清單**：第 4.1 節範例程式碼中列的版本號（11.4.0 / 10.9.1 / 9.4.3）只是示意，請查詢 npm 上 mermaid 套件的實際版本歷史，列出真正有意義、有代表性的版本（例如最新版 + 幾個常見的舊版里程碑），不要憑空編造版本號。

2. **PlantUML server 的選擇**：目前方案用公開的 `plantuml.com` 官方 server，這個 server 有 rate limit、也可能不穩定。如果使用量大，之後可能需要考慮自架 PlantUML server（但這樣就不是純前端架構了）或尋找其他公開 server 作為備援。

3. **多圖表/分頁功能**：目前方案只支援單一程式碼編輯，沒有「多個分頁/歷史記錄」的概念（例如使用者想同時編輯比較兩個圖表）。如果有這個需求，需要額外設計資料結構（例如用陣列存多份草稿），目前範圍**不包含**這個功能。

4. **深色模式（Dark Mode）**：目前方案沒有特別規劃深色主題，如果需要，CodeMirror 6 本身有現成的 dark theme 套件可用，Mermaid 也有對應的 dark theme 設定，但需要額外規劃 UI 切換開關。

5. **瀏覽器相容性範圍**：方案中使用的 Clipboard API（特別是 `ClipboardItem` 寫入圖片）在 Safari 上支援度較晚，且部分舊版瀏覽器可能不支援。請確認目標使用者的瀏覽器範圍，若需要支援較舊瀏覽器，複製功能可能需要 fallback 方案（例如改成「請手動右鍵存檔」的提示）。

6. **PlantUML 編碼方式**：`plantuml-encoder` 套件預設使用 deflate 壓縮編碼，這是 PlantUML server 標準支援的格式，理論上不需要額外設定，但建議實作後實際測試幾個複雜的 PlantUML 範例（例如包含中文、包含複雜的 class diagram）確認編碼/解碼正確無誤。

---

## 13. 給 Gemini 的執行提醒

- 請嚴格按照第 11 節的階段順序進行，每完成一個 Phase 就先確認該階段功能可正常運作（手動測試），再進入下一個 Phase，不要一次性把所有功能都寫完才測試。
- 本文件第 3-8 節的程式碼範例都是可以直接參考使用的實作邏輯，並非僅供參考的概念展示，請優先採用文件中提供的程式碼結構，除非有明確技術原因需要調整。
- 凡是文件中標註「待確認」、「請先確認」字樣的項目，請在動工前停下來詢問使用者，不要自行假設或編造答案後繼續實作。
- 完成每個 Phase 後，建議做一次 git commit，方便回溯。
