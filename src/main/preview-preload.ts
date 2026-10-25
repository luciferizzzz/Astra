import { ipcRenderer } from "electron";

/**
 * Minimal preload for the sandboxed preview renderer.
 *
 * The preview must report as little as possible. This only forwards
 * click coordinates from inside the project page back to the main process
 * so it can perform hit-testing (Option C from Phase 2 planning).
 */
function reportClick(event: MouseEvent): void {
  try {
    const target = event.target as Element | null;
    const data = {
      x: event.clientX,
      y: event.clientY,
      button: event.button,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      tagName: target?.tagName ?? null,
    };
    // Send to main via ipcRenderer; main listens on the webContents
    ipcRenderer.send("astra:preview:click", data);
  } catch {
    // Never throw from inside the untrusted page
  }
}

function install(): void {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      document.addEventListener("click", reportClick, { capture: true, passive: true });
    });
  } else {
    document.addEventListener("click", reportClick, { capture: true, passive: true });
  }
}

install();
