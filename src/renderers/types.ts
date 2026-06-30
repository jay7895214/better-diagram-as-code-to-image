// 渲染結果
export interface RenderResult {
  success: boolean;
  svg?: string;        // 渲染成功時回傳的 SVG 字串
  error?: string;      // 渲染失敗時的錯誤訊息
}

// 每一種 Diagram 引擎都要實作這個介面
export interface DiagramRenderer {
  id: string;                      // 唯一識別碼，例如 "mermaid", "plantuml"
  displayName: string;             // 顯示在 UI 上的名稱，例如 "Mermaid"
  supportedVersions: string[];     // 可選版本清單
  defaultVersion: string;          // 預設版本
  defaultSampleCode: string;       // 使用者選擇此引擎時，編輯器內預填的範例程式碼
  requiresExternalService: boolean; // 是否需要呼叫外部伺服器
  render(code: string, version: string): Promise<RenderResult>;
}
