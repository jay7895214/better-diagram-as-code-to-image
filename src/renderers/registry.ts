import { mermaidRenderer } from "./mermaid/mermaidRenderer";
import { plantumlRenderer } from "./plantuml/plantumlRenderer";
import type { DiagramRenderer } from "./types";

export const RENDERER_REGISTRY: DiagramRenderer[] = [
  mermaidRenderer,
  plantumlRenderer,
];

export function getRendererById(id: string): DiagramRenderer | undefined {
  return RENDERER_REGISTRY.find((r) => r.id === id);
}
