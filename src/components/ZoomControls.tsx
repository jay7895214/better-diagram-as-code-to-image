import { ZoomIn, ZoomOut, Expand, Maximize2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onReset: () => void;
}

export function ZoomControls({ scale, onZoomIn, onZoomOut, onFit, onReset }: ZoomControlsProps) {
  const { t } = useTranslation();
  const percentage = Math.round(scale * 100);

  return (
    <div className="zoom-controls">
      <button onClick={onZoomIn} className="zoom-btn" title={t("zoom.in", "Zoom In")}>
        <ZoomIn size={16} />
      </button>
      
      <div className="zoom-label">
        <span>{percentage}%</span>
      </div>
      
      <button onClick={onZoomOut} className="zoom-btn" title={t("zoom.out", "Zoom Out")}>
        <ZoomOut size={16} />
      </button>
      
      <div className="zoom-divider" />
      
      <button onClick={onFit} className="zoom-btn" title={t("zoom.fit", "Fit to View")}>
        <Expand size={16} />
      </button>
      
      <button onClick={onReset} className="zoom-btn" title={t("zoom.reset", "Reset Zoom (Double click)")}>
        <Maximize2 size={16} />
      </button>
    </div>
  );
}
