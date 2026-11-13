// Type declarations for the kubai-icons JS engine.
// Kept alongside the JS sources so `import ... from '../../assets/kubai-icons'`
// resolves under tsc strict mode without sprinkling ambient `declare module`
// entries across the app.

export const SVG_NS: string;
export const ICON_VIEWBOX: string;
export const KR: number;
export const CR: number;
export const CLOCK_MINUTES: number;
export const REF: [number, number, number];

export type RGB = [number, number, number];

export function tint(src: string, sel: RGB | string): string;
export function hex(c: RGB): string;
export function rgb(h: string): RGB;
export function parseColorMatrix(hex: string): string;

// Shape helpers
export function rp(points: number[][], radii: number[], closed?: boolean): string;
export function rr(x: number, y: number, w: number, h: number, r: number): string;
export function circ(cx: number, cy: number, r: number): string;
export function lines(x: number, y: number, hs?: number[], vs?: number[], cap?: string): string;
export function star(cx: number, cy: number, points: number, rOuter: number, rInner: number, rot?: number): string;
export function gear(teeth: number, rOuter: number, rInner: number): string;
export function cloud(r: number, bumps: number, h: number): string;
export function frontPiece(pts: number[][], radii: number[]): string;
export function sector(cx: number, cy: number, r: number, a0: number, a1: number): string;
export function R(x: number, y: number, w: number, h: number): number[][];
export function f(v: number | number[] | string): string;
export function at(el: Element, attrs: Record<string, unknown>): void;

export function flatTone(name: string, base: string, n: number): { name: string; colors: string[] };
export function clearTone(name: string, base: string, n: number): {
  name: string;
  colors: string[];
  edges: string[];
  deepMarks?: boolean;
};

export interface Palette {
  name: string;
  colors: string[];
  edges?: string[];
  deepMarks?: boolean;
}

export interface Runtime {
  palette: Palette | null;
}

export const runtime: Runtime;

// The dynamic SVG builder passed to each icon's `svg(u)` callback.
export interface U {
  id(tag: string): string;
  lo(height: number): string;
  loS(): string;
  up(height: number): string;
  upS(): string;
  sh: string;   // shadow filter URL
  hi: string;   // highlight filter URL
  grads: string;
}

export interface IconInstance {
  icon: IconDef;
  i: number;
  E: Record<string, Element>;
  s: Record<string, number | number[]>;
  raf: number;
  painted: string;
  hover: number;
  color?: string;
  edge?: string;
}

export interface IconDef {
  name: string;
  by?: string;
  svg: (u: U) => string;
  target: (hover: boolean, s: Record<string, number | number[]>) => Record<string, unknown>;
  draw: (p: Record<string, unknown>, E: Record<string, Element>, inst: IconInstance) => void;
}

export function mountIcon(icon: IconDef, i: number, host: HTMLElement, color?: string): IconInstance;
export function go(inst: IconInstance): void;

// --- icons.js re-exports ---

export const ICONS: IconDef[];
export const BY_NAME: Record<string, IconDef>;
