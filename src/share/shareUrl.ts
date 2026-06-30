import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export interface ShareState {
  engine: string;
  version: string;
  code: string;
}

export function generateShareUrl(state: ShareState): string {
  const json = JSON.stringify(state);
  const compressed = compressToEncodedURIComponent(json);
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}?s=${compressed}`;
}

export function parseShareUrl(): ShareState | null {
  const params = new URLSearchParams(window.location.search);
  const compressed = params.get("s");
  if (!compressed) return null;
  try {
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return JSON.parse(json) as ShareState;
  } catch {
    return null;
  }
}
