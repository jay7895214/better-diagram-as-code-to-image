export interface ExportOptions {
  format: "png" | "jpg";
  scale: number;
  backgroundColor?: string;
}

export async function exportSvgToRaster(
  svgString: string,
  options: ExportOptions
): Promise<Blob> {
  await document.fonts.ready;

  // 1. 為了精準取得寬高，我們先建立一個隱藏的 div 塞入 svgString 讓瀏覽器運算（HTML parser 容錯率高）
  const div = document.createElement("div");
  div.innerHTML = svgString;
  const svgEl = div.querySelector("svg");
  if (!svgEl) throw new Error("無效的 SVG");

  // 短暫掛載到畫面以取得精準尺寸
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.pointerEvents = "none";
  document.body.appendChild(div);
  const bbox = svgEl.getBoundingClientRect();
  let width = bbox.width;
  let height = bbox.height;

  // Fallback: 如果隱藏 div 造成寬高為 0，嘗試從 viewBox 或原始屬性讀取
  if (width === 0 || height === 0) {
    const viewBox = svgEl.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/[\s,]+/).filter(Boolean);
      if (parts.length >= 4) {
        width = parseFloat(parts[2]);
        height = parseFloat(parts[3]);
      }
    }
  }
  
  if (width === 0 || height === 0) {
    const attrW = svgEl.getAttribute("width");
    const attrH = svgEl.getAttribute("height");
    if (attrW) width = parseFloat(attrW);
    if (attrH) height = parseFloat(attrH);
  }

  if (width === 0 || height === 0 || isNaN(width) || isNaN(height)) {
    // 若真的抓不到，給一個預設大小避免 canvas 報錯
    width = width || 800;
    height = height || 600;
  }

  document.body.removeChild(div);

  const clonedSvgEl = svgEl.cloneNode(true) as SVGSVGElement;
  clonedSvgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  if (!clonedSvgEl.hasAttribute("xmlns:xlink")) {
    clonedSvgEl.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  }
  clonedSvgEl.setAttribute("width", width.toString());
  clonedSvgEl.setAttribute("height", height.toString());
  if (!clonedSvgEl.hasAttribute("viewBox")) {
    clonedSvgEl.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  clonedSvgEl.style.fontFamily = "'Noto Sans TC', sans-serif";

  // 使用 XMLSerializer 可以修復 Mermaid 產生之不合法的 HTML 標籤（如未關閉的 <br>）
  const serializer = new XMLSerializer();
  const safeSvgString = serializer.serializeToString(clonedSvgEl);
  
  // 使用 Data URI 而非 Blob URL，因為 Blob URL 配合 XMLSerializer 產生的 foreignObject xmlns 容易在 Canvas 畫圖時被瀏覽器誤判為跨域污染 (Taint)
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(safeSvgString)}`;

  const canvas = document.createElement("canvas");
  canvas.width = width * options.scale;
  canvas.height = height * options.scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("無法取得 Canvas context");
  }

  if (options.format === "jpg" || options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.scale(options.scale, options.scale);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG 轉換成 Image 失敗 (SVG 可能不是有效 XML 或內含不允許的外部資源)"));
      img.src = svgUrl;
    });

    ctx.drawImage(img, 0, 0, width, height);
  } finally {
    // No need to revoke Data URI
  }

  const mimeType = options.format === "png" ? "image/png" : "image/jpeg";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas 轉換成圖片失敗"));
      },
      mimeType,
      options.format === "jpg" ? 0.95 : undefined
    );
  });
}

export function downloadBlob(blob: Blob, filename: string, extension: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.${extension}`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyImageToClipboard(blob: Blob) {
  if (blob.type !== "image/png") {
    throw new Error("瀏覽器剪貼簿目前只支援複製 PNG 格式圖片");
  }
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": blob }),
  ]);
}
