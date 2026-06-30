import { useEffect, useRef } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

interface PreviewPaneProps {
  svg?: string;
  error?: string;
  isLoading: boolean;
}

export function PreviewPane({ svg, error, isLoading }: PreviewPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 當 svg 更新時，將其插入 DOM
  useEffect(() => {
    if (svg && containerRef.current) {
      containerRef.current.innerHTML = svg;
    }
  }, [svg]);

  return (
    <div className="preview-pane">
      {/* 錯誤提示 */}
      {error && (
        <div className="error-banner">
          <AlertCircle className="icon" />
          <span>{error}</span>
        </div>
      )}

      {/* 載入中遮罩 */}
      {isLoading && (
        <div className="loading-overlay">
          <Loader2 className="spinner" />
          <span>渲染中...</span>
        </div>
      )}

      {/* SVG 容器，保留上一次成功的圖表 */}
      <div 
        ref={containerRef} 
        className={`svg-container ${isLoading ? 'loading' : ''}`} 
      />
    </div>
  );
}
