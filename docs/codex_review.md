結論
這份 implementation plan 的方向大致正確：用既有 DiagramRenderer 抽象新增一個 D2 renderer、註冊到 registry、加 i18n 範例，再用 npm run lint / npm run build 驗證，確實符合目前專案架構。專案目前已經用 DiagramRenderer 統一描述 renderer 必備欄位與 render(code, version) 介面。
而 UI 的引擎下拉選單也確實是從 RENDERER_REGISTRY 自動長出選項。

不過，我會建議在真正實作前修正幾個重點，尤其是 D2 套件 API 確認、WASM/Worker bundling、renderer instance 快取、分享連結與舊草稿相容性、匯出 SVG/PNG 的可靠性。

我認為計畫中正確的地方
1. 用 DiagramRenderer 新增 D2 renderer 是合理的
目前 DiagramRenderer 已經包含：

id

displayName

supportedVersions

defaultVersion

defaultSampleCode

requiresExternalService

render(code, version)。

Mermaid 與 PlantUML 都是以獨立 renderer 物件實作這個介面。
因此新增 src/renderers/d2/d2Renderer.ts 或類似路徑是自然的擴充方式。

2. 註冊到 RENDERER_REGISTRY 後 UI 會自動出現 D2
目前 registry 只包含 Mermaid 與 PlantUML。
EngineSelector 會直接 map registry 產生 <option>。
所以計畫中說「加入 registry 後下拉選單自動出現」是對的。

3. D2 應標示為不需要外部服務
PlantUML 現在設為 requiresExternalService: true，App 會因此跳出外部服務警告。
D2 若用 @terrastruct/d2 在瀏覽器本地 WASM 渲染，應該設為 false，避免誤導使用者。

4. 動態載入方向正確
@terrastruct/d2 是 WASM wrapper，npm 頁面描述它是用 WebAssembly 在 browser / Node 環境執行 D2。來源：@terrastruct/d2 - npm。
D2 官方 GitHub README 也說 D2 支援不同 layout engines，預設包含 dagre，ELK 也 bundled。來源：terrastruct/d2 GitHub。
因此它的 payload 與初始化成本確實比一般純 JS renderer 更值得 lazy-load。

主要問題與建議修正
1. 「new D2() → .compile() → .render()」這段要先用實際套件 API 驗證
這是整份計畫最大的不確定點。計畫中寫：

初始化 new D2()，並執行 .compile(code) 與 .render() 產生 SVG。

這個描述可能是對的，但我不建議直接依賴文字計畫實作。原因：

@terrastruct/d2 API 近期有變動風險。

它同時支援 browser 與 Node，可能有不同 entry / worker 行為。

compile() / render() 的回傳型別、參數格式、是否要傳 layout/theme/options，都要看實際 type definitions。

我嘗試用 npm view @terrastruct/d2 ... 查目前 registry metadata，但此環境回 403，代表 local npm registry policy 可能擋了這個套件；這也意味著實作時 npm install @terrastruct/d2 可能不是百分之百穩。

建議把 implementation plan 的第 1 步改成：

先建立 spike branch / local spike：
1. npm install @terrastruct/d2
2. 檢查 node_modules/@terrastruct/d2 的 package.json、exports、types
3. 寫最小 browser/Vite proof-of-concept：
   import('@terrastruct/d2') → render "x -> y" → console.log SVG
4. 確認 API、WASM/worker asset 路徑與 build output 後，再接入正式 renderer
這樣可以避免照錯 API 寫出來後才在 build 或 runtime 爆掉。

2. 不應每次 render 都 new D2()；建議快取 module / instance / initialization promise
目前 App 會在使用者輸入後 debounce 400ms 重新 render。
如果 D2 renderer 每次 render 都：

const { D2 } = await import("@terrastruct/d2");
const d2 = new D2();
可能會造成：

重複初始化 WASM。

重複建立或喚醒 Worker。

首次 render 後仍然每次都有額外 overhead。

快速打字時產生多個 render promise race。

Mermaid renderer 已經有「版本載入快取」的概念，避免重複載入同一版本。
D2 也應該採用類似方式，例如：

let d2InstancePromise: Promise<D2Like> | undefined;

async function getD2() {
  if (!d2InstancePromise) {
    d2InstancePromise = import("@terrastruct/d2").then(({ D2 }) => new D2());
  }
  return d2InstancePromise;
}
如果官方 API 建議 reuse instance，也要遵守。搜尋結果中也有一個 2026 年 issue 提到 @terrastruct/d2 在 Node 的 worker lifecycle 沒有 public terminate API；雖然這個專案是 CSR browser，不是 Node build-time rendering，但這仍提醒我們應該避免每次 render 任意建立新 instance。來源：d2js WASM worker issue。

3. Vite / WASM / Worker 不是「可能」而是應列為核心風險驗證項
計畫目前寫：

若 Vite 編譯期針對 Web Worker 或 WASM 發生路徑解析問題，可能需要微調 vite.config.ts。

我建議把這項從「可能」提升為「必驗證」。目前專案使用 Vite 5。
@terrastruct/d2 包含 WASM 與 Worker，可能遇到：

dev server 可跑，但 production build 不能跑。

production build 可過，但部署到 GitHub Pages / subpath 後 WASM URL 錯。

Worker URL 被 Vite 打包成不正確路徑。

CSP 或 cross-origin isolation 相關限制。

dynamic import code splitting 後 chunk 與 WASM asset base path 不一致。

建議驗證計畫新增：

- npm run build
- npm run preview
- 在 preview build 中實際切換 D2 並渲染
- 檢查 Network panel：
  - D2 JS chunk 是否 lazy-loaded
  - WASM 是否 lazy-loaded
  - Worker 是否 200
  - 部署 base path 下 URL 是否正確
只跑 npm run build 不夠，因為 Vite build 成功不代表 runtime asset URL 正確。

4. supportedVersions: ["latest"] 不是很有意義，建議重新思考版本策略
目前 DiagramRenderer 強制要有 supportedVersions 與 defaultVersion。
PlantUML 用 latest 是合理的，因為它實際上是 server 端版本。

但 D2 是 npm dependency，本質上版本已經被 package-lock.json 鎖住。若 UI 顯示 latest，容易讓使用者誤以為可以選 D2 版本。比較好的做法有幾種：

沿用現有介面，先用 ["bundled"] 或 ["package"]

優點：不大改架構。

缺點：UI 仍會顯示一個不是很有用的版本 dropdown。

把 supportedVersions 改成 optional，只有 Mermaid 顯示版本選單

優點：語意更正確。

缺點：要調整 DiagramRenderer 與 EngineSelector。

D2 renderer 的 supportedVersions 從 package version 注入

例如 build-time 讀 package version 或手動同步。

優點：UI 顯示真實版本。

缺點：維護成本略高。

如果只是第一版，我建議先用最小改動，但不要叫 latest；可以用 ["bundled"] 或 ["npm"]，避免誤導。

5. i18n sample 計畫是對的，但還要注意 fallback 行為
目前 App 初始化與切換引擎時使用 t("samples.${engineId}") || defaultSampleCode。
因此新增 samples.d2 到 en.json、zh-CN.json、zh-TW.json 是必要的。現有 zh-TW 只有 mermaid 與 plantuml sample。

不過這裡有一個 subtle issue：i18next 在 key 不存在時，常見行為是回傳 key 字串本身，例如 "samples.d2"，它是 truthy，所以 || newRenderer.defaultSampleCode 未必會 fallback。
所以如果漏了一個 locale，使用者切到 D2 時可能看到 samples.d2 文字，而不是 D2 範例。

建議：

實作時一定三個 locale 都加。

或把 fallback 寫得更安全，例如用 i18n.exists()。

語言切換邏輯也會比對多語系 sample 來判斷是否要替換目前 code。
所以 samples.d2 要在所有支援語言中保持同步存在。

6. 分享 URL / LocalStorage 中未知 engine 的處理需要補強
目前初始化邏輯：

const initialEngineId = initialShareState?.engine || initialDraftState?.engine || "mermaid";
const initialVersion = initialShareState?.version || initialDraftState?.version || fallbackRenderer.defaultVersion;
const initialCode = initialShareState?.code || initialDraftState?.code || t(`samples.${initialEngineId}`) || fallbackRenderer.defaultSampleCode;
如果使用者開到舊分享連結、手動改 URL、localStorage 有未來或不存在的 engine，getRendererById(engineId) 會是 undefined。目前 render effect 會直接 return，但 EngineSelector 的 <select value={engineId}> 可能沒有匹配 option。

整合 D2 不一定會造成這個問題，但新增 engine 是個好時機補強：

- initialEngineId 若找不到 renderer，fallback 到 mermaid。
- initialVersion 若不在 renderer.supportedVersions，fallback 到 renderer.defaultVersion。
這能提升分享連結與草稿相容性。

7. 錯誤狀態下應清掉舊 SVG，否則匯出按鈕可能仍能匯出上一張圖
目前 render effect 成功時會 setSvg(result.svg)，失敗時只 setError(result.error)，沒有清掉舊的 svg。
ExportControls disabled 條件是 isLoading || !!error || !svg。
因為有 !!error，按鈕通常會 disabled，但 preview pane 或狀態切換時仍可能保留舊 SVG state。

建議趁整合 D2 時調整成：

if (result.success) {
  setSvg(result.svg);
  setError(undefined);
} else {
  setSvg(undefined);
  setError(result.error);
}
這不是 D2 專屬，但 D2 syntax error 測試會更乾淨。

8. D2 SVG 匯出 PNG/JPG 要特別驗證尺寸與外部資源
目前 raster export 的尺寸來源是把 SVG 掛到 hidden div，取 getBoundingClientRect()。
接著 clone SVG、補 width、height、viewBox，再用 Data URI 載入 Image 畫到 Canvas。

D2 產出的 SVG 可能會有幾個風險：

SVG 根節點只有 viewBox，沒有明確 width/height。

字型或 style 的處理與 Mermaid 不同。

內嵌 CSS / marker / defs / foreignObject 可能影響 Canvas 轉圖。

如果 SVG 中引用外部資源，Canvas 可能 taint 或載入失敗。

所以驗證計畫裡的「匯出 SVG 與 PNG」非常重要，但我會補充：

- 測試不同 D2 輸出尺寸：
  - 小圖
  - 長圖
  - 含 label / markdown / code block 的圖
- 測試 dark mode / light mode 下匯出是否可讀
- 測試 PNG/JPG 背景是否符合預期
9. 語法高亮先不做可以，但可以至少標註 D2 mode 的未來方向
計畫說先不加專屬 D2 syntax highlighting，我同意。
目前 editor 似乎主要是 CodeMirror + color picker plugin，沒有 per-engine language mode。專案已經有 colorPickerPlugin。
若第一階段目標是 renderer 整合，不做高亮是合理取捨。

但可以在 plan 補一個 future task：

Future:
- 依 engineId 切換 CodeMirror extension
- D2 可先用 StreamLanguage / simple regex tokenizer
- 或等待官方 D2 language tooling / grammar 可直接整合
D2 官方 README 也提到 D2 有 parser、autoformatter、syntax highlighting 等 language tooling 方向。來源：terrastruct/d2 GitHub。

我建議修改後的 implementation plan
Phase 0：Spike / 風險驗證
安裝 @terrastruct/d2。

檢查套件 exports / types / browser entry。

建立最小 Vite browser 測試：

dynamic import package。

render "x -> y: Hello D2"。

確認產生 SVG string。

跑：

npm run build

npm run preview

在 preview build 中確認 WASM / Worker / chunk URL 都正確。

Phase 1：Renderer
新增 src/renderers/d2/d2Renderer.ts：

id: "d2"

displayName: "D2"

requiresExternalService: false

defaultSampleCode

module / D2 instance promise 快取

清楚處理錯誤訊息

若 D2 API 支援 theme / layout，可先用預設值，但保留 options 位置

Phase 2：Registry + i18n
在 registry import 並加入 d2Renderer。

三個 locale 都加 samples.d2。

檢查 i18n.exists() 或至少避免缺 key 時顯示 samples.d2。

Phase 3：App robustness
建議一併修：

unknown engine fallback。

invalid version fallback。

render error 時清掉舊 SVG。

如果 D2 首次載入較慢，可考慮顯示更明確 loading message。

Phase 4：驗證
自動化：

npm run lint

npm run build

手動：

dev mode 測 D2。

production preview 測 D2。

D2 syntax error。

SVG download。

PNG/JPG export。

share URL。

localStorage draft。

language switch 時 D2 sample 更新。

mobile layout 下切換 D2。

對原計畫逐點評語
原計畫項目	評估	建議
npm install @terrastruct/d2	正確，但有 registry/install 風險	先 spike；本環境 npm view 回 403，實作前要確認 install 可行
dynamic import	正確	加上 module/instance promise 快取
new D2().compile().render()	需確認	必須用實際 type/API 驗證，不要只照計畫文字
supportedVersions: ["latest"]	可跑但語意不佳	改 bundled / package version，或隱藏不適用的版本選單
加 registry	正確	UI 會自動出現 D2
加 samples.d2	正確	三個 locale 都要加，避免 i18next fallback key 問題
先不做 syntax highlighting	合理	記為 future enhancement
只跑 lint/build	不足	還要跑 production preview 實測 WASM/Worker URL
手動匯出測試	正確	特別測尺寸、字型、Data URI canvas 轉圖
我會特別提醒 Gemini plan 補上的一句話
如果要把風險寫成最短版本，我會加這段：

D2 整合的主要風險不是 renderer registry，而是 @terrastruct/d2 的 browser bundling 行為與 WASM/Worker runtime asset path。實作前應先用 Vite production build + preview 驗證 dynamic import、WASM、Worker 是否能在部署 base path 下正確載入，並快取 D2 instance，避免每次 render 重複初始化 WASM/Worker。

本次檢查使用的檔案與指令
Testing / Checks

✅ pwd && rg --files -g 'AGENTS.md' -g 'package.json' -g 'vite.config.*' -g 'src/**' | head -200

✅ find .. -name AGENTS.md -print && sed -n '1,220p' package.json && sed -n '1,220p' src/renderers/types.ts && sed -n '1,220p' src/renderers/registry.ts && sed -n '1,220p' src/renderers/mermaid/mermaidRenderer.ts && sed -n '1,200p' src/renderers/plantuml/plantumlRenderer.ts

✅ sed -n '1,260p' src/App.tsx && sed -n '1,220p' src/components/EngineSelector.tsx && sed -n '1,220p' src/components/ExportControls.tsx && sed -n '1,220p' src/export/svgExport.ts && sed -n '1,220p' src/export/rasterExport.ts && sed -n '1,160p' src/i18n/locales/zh-TW.json

✅ git status --short && nl -ba src/renderers/types.ts | sed -n '1,80p' && nl -ba src/renderers/registry.ts | sed -n '1,80p' && nl -ba src/App.tsx | sed -n '1,160p' && nl -ba src/i18n/locales/zh-TW.json | sed -n '1,100p'

✅ nl -ba package.json | sed -n '1,80p' && nl -ba src/components/EngineSelector.tsx | sed -n '1,90p' && nl -ba src/export/rasterExport.ts | sed -n '1,130p'

⚠️ npm view @terrastruct/d2 version description dist.unpackedSize dependencies exports types --json — npm registry 回 403 Forbidden，疑似環境 registry policy 限制，無法用本機 npm 直接確認套件 metadata。