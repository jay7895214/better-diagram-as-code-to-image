import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadSvg, copySvgToClipboard } from "../export/svgExport";
import { exportSvgToRaster, downloadBlob, copyImageToClipboard } from "../export/rasterExport";

interface ExportControlsProps {
  svg?: string;
  disabled: boolean;
}

export function ExportControls({ svg, disabled }: ExportControlsProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<"svg" | "png" | "jpg">("png");
  const [scale, setScale] = useState<number>(4);
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (!svg) return;
    setIsExporting(true);
    try {
      if (format === "svg") {
        downloadSvg(svg, "diagram");
      } else {
        const blob = await exportSvgToRaster(svg, { format, scale });
        downloadBlob(blob, "diagram", format);
      }
      toast.success(t("export.downloadSuccess"));
    } catch (err) {
      toast.error(`${t("export.exportFail")}${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopy = async () => {
    if (!svg) return;
    setIsExporting(true);
    try {
      if (format === "svg") {
        await copySvgToClipboard(svg);
        toast.success(t("export.copySvgSuccess"));
      } else {
        // Force PNG format for clipboard since JPG is not supported by standard Clipboard API
        const blob = await exportSvgToRaster(svg, { format: "png", scale });
        await copyImageToClipboard(blob);
        if (format === "jpg") {
          toast.success(t("export.copyJpgAsPng"));
        } else {
          toast.success(t("export.copySuccess"));
        }
      }
    } catch (err) {
      toast.error(`${t("export.copyFail")}${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-controls">
      <div className="export-options">
        <div className="control-group">
          <label htmlFor="format-select">{t("export.format")}</label>
          <select
            id="format-select"
            value={format}
            onChange={(e) => setFormat(e.target.value as "svg" | "png" | "jpg")}
            disabled={disabled || isExporting}
          >
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="svg">SVG</option>
          </select>
        </div>

        {format !== "svg" && (
          <div className="control-group" style={{ position: "relative" }}>
            <label htmlFor="scale-input">{t("export.scale")}</label>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <input
                id="scale-input"
                type="number"
                min="0.5"
                max="20"
                step="0.5"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                disabled={disabled || isExporting}
                style={{ width: '80px' }}
                title={t("export.scaleHint")}
              />
            </div>
          </div>
        )}
      </div>

      <div className="export-actions">
        <button 
          className="btn btn-primary" 
          onClick={handleDownload}
          disabled={disabled || isExporting}
          title={t("export.download")}
        >
          {isExporting ? <Loader2 className="spinner" size={16} /> : <Download size={16} />}
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={handleCopy}
          disabled={disabled || isExporting}
          title={format === "jpg" ? t("export.copyWarning") : t("export.copy")}
        >
          {isExporting ? <Loader2 className="spinner" size={16} /> : <Copy size={16} />}
        </button>
      </div>
    </div>
  );
}
