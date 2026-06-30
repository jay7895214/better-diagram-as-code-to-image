import type { DiagramRenderer, RenderResult } from "../types";

// 快取已載入的版本，避免重複載入
const versionCache = new Map<string, unknown>();

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
  supportedVersions: ["11.4.1", "10.9.3", "9.4.3"],
  defaultVersion: "11.4.1",
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
        securityLevel: "strict",
        fontFamily: "'Noto Sans TC', 'Microsoft JhengHei', sans-serif",
      });

      // 在 render 之前先 parse，避免 Mermaid 渲染失敗時將錯誤區塊強行注入 DOM
      try {
        await mermaid.parse(code);
      } catch (parseErr) {
        throw new Error(parseErr instanceof Error ? parseErr.message : "語法錯誤");
      }

      // 用一個隨機 id 避免多次渲染衝突
      const renderId = `mermaid-render-${Date.now()}`;
      const { svg } = await mermaid.render(renderId, code);

      return { success: true, svg };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
