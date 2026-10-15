/// <reference types="vite/client" />

import type { AstraApi } from "../../preload/api";

/*
 * Ambient types for the renderer.
 *
 * `window.astra` is published by the preload allowlist
 * (`src/preload/index.ts`) via `contextBridge`. The shape itself lives in
 * `src/preload/api.ts` — this file only teaches the renderer about it, so the
 * two cannot drift apart silently.
 *
 * NOTE: this declaration deliberately lives here rather than next to the
 * preload. A `.d.ts` sharing a basename with a sibling `.ts` file
 * (`src/preload/index.ts`) is silently dropped from the TypeScript program,
 * which compiles cleanly and then reports `window.astra` as unknown.
 */
declare global {
  interface Window {
    readonly astra: AstraApi;
  }
}

export {};
