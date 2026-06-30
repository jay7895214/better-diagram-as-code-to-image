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
  document.body.appendChild(div);
  const bbox = svgEl.getBoundingClientRect();
  const width = bbox.width;
  const height = bbox.height;
  document.body.removeChild(div);

  if (!width || !height || width === 0 || height === 0) {
    throw new Error("無法判斷圖表尺寸");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width * options.scale;
  canvas.height = height * options.scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("無法取得 Canvas context");

  if (options.format === "jpg" || options.backgroundColor) {
    ctx.fillStyle = options.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.scale(options.scale, options.scale);

  // 2. 對原始字串進行 Regex 替換，注入精確的寬高與字體
  // (避免使用 XMLSerializer 破壞 Mermaid 內部不標準的 HTML / foreignObject)
  const cleanSvgString = svgString
    .replace(/(<svg[^>]*?)\s+width="[^"]*"/g, "$1")
    .replace(/(<svg[^>]*?)\s+height="[^"]*"/g, "$1");

  const svgWithFont = cleanSvgString.replace(
    "<svg",
    `<svg width="${width}" height="${height}" style="font-family: 'Noto Sans TC', sans-serif;" xmlns="http://www.w3.org/2000/svg"`
  );

  const svgBlob = new Blob([svgWithFont], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("SVG 轉換成 Image 失敗"));
    img.src = svgUrl;
  });

  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(svgUrl);

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
