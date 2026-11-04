import { renderDocumentMarkdown } from "./render.ts";

export function renderSafeMarkdown(source: string): string {
  return renderDocumentMarkdown(source);
}
