import { useState } from "react";
import { Download, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadSvg, copySvgToClipboard } from "../export/svgExport";
import { exportSvgToRaster, downloadBlob, copyImageToClipboard } from "../export/rasterExport";

interface ExportControlsProps {
  svg?: string;
  disabled: boolean;
}

export function ExportControls({ svg, disabled }: ExportControlsProps) {
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
      toast.success("下載成功！");
    } catch (err) {
      toast.error(`匯出失敗：${err instanceof Error ? err.message : String(err)}`);
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
        toast.success("SVG 原始碼已複製到剪貼簿！");
      } else {
        // Force PNG format for clipboard since JPG is not supported by standard Clipboard API
        const blob = await exportSvgToRaster(svg, { format: "png", scale });
        await copyImageToClipboard(blob);
        if (format === "jpg") {
          toast.success("圖片已使用 PNG 格式複製到剪貼簿！(剪貼簿不支援 JPG)");
        } else {
          toast.success("圖片已複製到剪貼簿！");
        }
      }
    } catch (err) {
      toast.error(`複製失敗：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-controls">
      <div className="export-options">
        <div className="control-group">
          <label htmlFor="format-select">格式：</label>
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
            <label htmlFor="scale-input">解析度倍率：</label>
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
                title="範圍：0.5 ~ 20"
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
        >
          {isExporting ? <Loader2 className="spinner" size={16} /> : <Download size={16} />}
          下載
        </button>
        <button 
          className="btn btn-secondary" 
          onClick={handleCopy}
          disabled={disabled || isExporting}
          title={format === "jpg" ? "剪貼簿複製將強制轉換為 PNG 格式" : ""}
        >
          {isExporting ? <Loader2 className="spinner" size={16} /> : <Copy size={16} />}
          複製
        </button>
      </div>
    </div>
  );
}
