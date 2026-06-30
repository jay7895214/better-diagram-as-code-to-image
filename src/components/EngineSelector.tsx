import { useTranslation } from "react-i18next";
import { getRendererById, RENDERER_REGISTRY } from "../renderers/registry";

interface EngineSelectorProps {
  engineId: string;
  version: string;
  onEngineChange: (engineId: string) => void;
  onVersionChange: (version: string) => void;
}

export function EngineSelector({ engineId, version, onEngineChange, onVersionChange }: EngineSelectorProps) {
  const { t } = useTranslation();
  const currentRenderer = getRendererById(engineId);

  return (
    <div className="engine-selector">      <div className="selector-group">
        <label htmlFor="engine-select">{t("engine.label")}</label>
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
        <label htmlFor="version-select">{t("engine.version")}</label>
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
