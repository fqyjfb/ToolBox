// Re-export everything so consumers do `import { mountIcon, BY_NAME, ... } from '.../kubai-icons'`
export * from './engine.js';
export { ICONS, BY_NAME } from './icons.js';

// Default palette so runtime.palette is always present even when every icon overrides its colour
import { flatTone, runtime } from './engine.js';
const N = 1;
runtime.palette = flatTone('default', '#5393FF', N);
