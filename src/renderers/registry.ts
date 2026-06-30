import { mermaidRenderer } from "./mermaid/mermaidRenderer";
import { plantumlRenderer } from "./plantuml/plantumlRenderer";
import { d2Renderer } from "./d2/d2Renderer";
import type { DiagramRenderer } from "./types";

export const RENDERER_REGISTRY: DiagramRenderer[] = [
  mermaidRenderer,
  plantumlRenderer,
  d2Renderer,
];

export function getRendererById(id: string): DiagramRenderer | undefined {
  return RENDERER_REGISTRY.find((r) => r.id === id);
}
