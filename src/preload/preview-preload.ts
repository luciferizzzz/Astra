import { ipcRenderer } from "electron";
import { IPC_CHANNELS, type CanvasClickPayload } from "../shared/ipc";

/**
 * Minimal preload for the sandboxed canvas renderer.
 *
 * The preview must report as little as possible, so this file does exactly one
 * thing: forward click coordinates from inside the project page to the main
 * process, which performs the hit-test (Option C from the Phase 2 planning).
 * The page itself never learns a selector, never receives a reply, and has no
 * bridge back into Astra — if this preload were removed the canvas would still
 * render, it just could not be clicked.
 *
 * Emitted as its own bundle (`out/preload/preview-preload.js`) because
 * `preview-posture.ts` points the view's `preload` at that path. The channel
 * name comes from the shared contract on purpose: a hardcoded string here is
 * exactly how this wiring silently broke once (it sent
 * `astra:preview:click` while the main process listened on
 * `astra:canvas:click`).
 */
function reportClick(event: MouseEvent): void {
  try {
    const target = event.target as Element | null;
    const payload: CanvasClickPayload = {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      tagName: target?.tagName ?? null,
    };
    ipcRenderer.send(IPC_CHANNELS.canvasClick, payload);
  } catch {
    // Never throw from inside the untrusted page
  }
}

function install(): void {
  const capture = { capture: true, passive: true } as const;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      document.addEventListener("click", reportClick, capture);
    });
  } else {
    document.addEventListener("click", reportClick, capture);
  }
}

install();
