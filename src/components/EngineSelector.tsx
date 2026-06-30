import { getRendererById, RENDERER_REGISTRY } from "../renderers/registry";
import { AlertTriangle } from "lucide-react";

interface EngineSelectorProps {
  engineId: string;
  version: string;
  onEngineChange: (engineId: string) => void;
  onVersionChange: (version: string) => void;
}

export function EngineSelector({ engineId, version, onEngineChange, onVersionChange }: EngineSelectorProps) {
  const currentRenderer = getRendererById(engineId);

  return (
    <div className="engine-selector">
      {currentRenderer?.requiresExternalService && (
        <span className="external-service-warning">
          <AlertTriangle size={14} />
          此引擎會將程式碼傳送至外部伺服器進行處理，請勿輸入機密內容。
        </span>
      )}

      <div className="selector-group">
        <label htmlFor="engine-select">渲染引擎：</label>
        <select
          id="engine-select"
          value={engineId}
          onChange={(e) => onEngineChange(e.target.value)}
        >
          {RENDERER_REGISTRY.map((renderer) => (
            <option key={renderer.id} value={renderer.id}>
              {renderer.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="selector-group">
        <label htmlFor="version-select">版本：</label>
        <select
          id="version-select"
          value={version}
          onChange={(e) => onVersionChange(e.target.value)}
        >
          {currentRenderer?.supportedVersions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
