export function downloadSvg(svgString: string, filename: string) {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copySvgToClipboard(svgString: string) {
  await navigator.clipboard.writeText(svgString);
}
