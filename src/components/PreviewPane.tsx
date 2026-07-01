import React, { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2 } from "lucide-react";
import { ZoomControls } from "./ZoomControls";

interface PreviewPaneProps {
  svg?: string;
  error?: string;
  isLoading: boolean;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4.0;
const FIT_PADDING = 40;

export function PreviewPane({ svg, error, isLoading }: PreviewPaneProps) {
  const { t } = useTranslation();
  
  // Zoom & Pan state
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 當 svg 更新時，將其插入 DOM
  useEffect(() => {
    if (svg && contentRef.current) {
      contentRef.current.innerHTML = svg;
    }
  }, [svg]);

  // Fit to View
  const handleFitToView = useCallback(() => {
    if (!outerContainerRef.current || !contentRef.current) return;
    const container = outerContainerRef.current.getBoundingClientRect();
    const svgEl = contentRef.current.querySelector('svg');
    
    let contentW = 0, contentH = 0;
    if (svgEl) {
      const vb = svgEl.viewBox?.baseVal;
      if (vb && vb.width > 0 && vb.height > 0) {
        contentW = vb.width;
        contentH = vb.height;
      } else {
        const w = parseFloat(svgEl.getAttribute('width') || '0');
        const h = parseFloat(svgEl.getAttribute('height') || '0');
        if (w > 0 && h > 0) {
          contentW = w;
          contentH = h;
        } else {
          // If no explicitly set width/height or viewBox, measure visually
          const rect = svgEl.getBoundingClientRect();
          // Adjust for current scale if already scaled
          contentW = rect.width / scale; 
          contentH = rect.height / scale;
        }
      }
    }

    if (contentW <= 0 || contentH <= 0) return;
    
    const scaleX = Math.max(0.01, (container.width - FIT_PADDING * 2)) / contentW;
    const scaleY = Math.max(0.01, (container.height - FIT_PADDING * 2)) / contentH;
    const fitScale = Math.min(scaleX, scaleY, MAX_SCALE);
    
    setScale(Math.max(MIN_SCALE, fitScale));
    setPosition({ x: 0, y: 0 });
  }, [scale]);

  // 自動 Fit (延遲 150ms 確保 DOM 渲染完畢)
  const fitToViewRef = useRef(handleFitToView);
  useEffect(() => {
    fitToViewRef.current = handleFitToView;
  }, [handleFitToView]);

  useEffect(() => {
    if (!svg) return;
    const timer = setTimeout(() => {
      fitToViewRef.current();
    }, 150);
    return () => clearTimeout(timer);
  }, [svg]);

  // Native wheel listener to prevent passive event warning in React 17+
  useEffect(() => {
    const el = outerContainerRef.current;
    if (!el) return;
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor)));
    };
    
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...position };
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: positionStartRef.current.x + dx,
      y: positionStartRef.current.y + dy,
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const zoomIn = () => setScale(s => Math.min(MAX_SCALE, s * 1.25));
  const zoomOut = () => setScale(s => Math.max(MIN_SCALE, s / 1.25));
  const resetZoom = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

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
          <Loader2 className="spinner" size={24} />
          <span>{t("editor.loading")}</span>
        </div>
      )}

      {/* 控制器 */}
      {svg && !error && !isLoading && (
        <ZoomControls 
          scale={scale} 
          onZoomIn={zoomIn} 
          onZoomOut={zoomOut} 
          onFit={handleFitToView} 
          onReset={resetZoom} 
        />
      )}

      {/* SVG 容器 (監聽事件的外層) */}
      <div 
        ref={outerContainerRef}
        className={`svg-container ${isLoading ? 'loading' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        {/* Transform 內層：緊湊包覆 SVG */}
        <div
          ref={contentRef}
          className="zoom-content-wrapper"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        />
      </div>
    </div>
  );
}
