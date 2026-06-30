import type { DiagramRenderer, RenderResult } from "../types";

interface D2Instance {
  compile(code: string): Promise<{ diagram: unknown; renderOptions: unknown }>;
  render(diagram: unknown, renderOptions: unknown): Promise<string>;
}

interface D2ErrorEntry {
  errmsg?: string;
}

let d2InstancePromise: Promise<D2Instance> | undefined;

async function getD2Instance() {
  if (!d2InstancePromise) {
    d2InstancePromise = (async () => {
      const { D2 } = await import("@terrastruct/d2");
      return new D2();
    })();
  }
  return d2InstancePromise;
}

// 實作一個簡單的 Async Mutex，防止多個渲染請求同時存取非線程安全的 D2 Worker
let d2Mutex = Promise.resolve();

export const d2Renderer: DiagramRenderer = {
  id: "d2",
  displayName: "D2",
  supportedVersions: ["bundled"],
  defaultVersion: "bundled",
  requiresExternalService: false,
  defaultSampleCode: "direction: right\n\nx -> y: Hello D2",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async render(code: string, _version: string): Promise<RenderResult> {
    let release!: () => void;
    const nextLock = new Promise<void>((resolve) => { release = resolve; });
    const waitPromise = d2Mutex;
    // 確保 queue 不會因為 error 斷裂
    d2Mutex = d2Mutex.then(() => nextLock).catch(() => nextLock);

    await waitPromise;

    try {
      const d2 = await getD2Instance();
      const compiled = await d2.compile(code);
      const svg = await d2.render(compiled.diagram, compiled.renderOptions);

      // 防禦性檢查：若發生非預期錯誤導致回傳非字串，直接拋錯
      if (typeof svg !== "string") {
        throw new Error("D2 發生並行渲染衝突，請重試");
      }

      return { success: true, svg };
    } catch (err: unknown) {
      console.error("D2 Render Error:", err);
      let errMsg = err instanceof Error ? err.message : String(err);

      // 嘗試解析 D2 拋出的 raw JSON 錯誤格式，轉為人類可讀的字串
      try {
        const parsed = JSON.parse(errMsg);
        if (Array.isArray(parsed) && parsed[0]?.errmsg) {
          errMsg = (parsed as D2ErrorEntry[]).map((e) => e.errmsg).join('\n');
        }
      } catch {
        // 若不是 JSON，則維持原本的錯誤訊息
      }

      return { success: false, error: errMsg };
    } finally {
      release(); // 釋放鎖，讓下一個排隊的渲染請求執行
    }
  },
};
