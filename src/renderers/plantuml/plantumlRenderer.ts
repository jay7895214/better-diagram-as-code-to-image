import { encode } from "plantuml-encoder";
import type { DiagramRenderer, RenderResult } from "../types";

const PLANTUML_SERVER = "https://www.plantuml.com/plantuml";

export const plantumlRenderer: DiagramRenderer = {
  id: "plantuml",
  displayName: "PlantUML",
  supportedVersions: ["latest"], // PlantUML server 通常固定版本
  defaultVersion: "latest",
  requiresExternalService: true, // 重要旗標，UI 已經依此顯示警示文字
  defaultSampleCode: `@startuml
Alice -> Bob: 你好
Bob --> Alice: 嗨！
@enduml`,

  async render(code: string): Promise<RenderResult> {
    try {
      const encoded = encode(code);
      const svgUrl = `${PLANTUML_SERVER}/svg/${encoded}`;

      const response = await fetch(svgUrl);
      if (!response.ok) {
        throw new Error(`PlantUML server 回應錯誤（狀態碼 ${response.status}）`);
      }
      const svgText = await response.text();

      // PlantUML 如果遇到語法錯誤，仍然會回傳 200，但回傳的 SVG 內部會包含錯誤訊息。
      // 可以透過檢查 svg 是否包含特定的 error 特徵來進一步強化錯誤處理
      if (svgText.includes("<text") && svgText.includes("Syntax Error?")) {
        return {
          success: false,
          error: "PlantUML 語法錯誤，請檢查程式碼",
        };
      }

      return { success: true, svg: svgText };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
};
