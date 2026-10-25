import type { WebPreferences } from "electron";
import { join } from "node:path";

/**
 * The security posture of the preview surface, kept as a pure value so it can
 * be asserted without a live Electron process.
 *
 * The preview renders markup from projects the user did not write, so it gets
 * strictly less than the renderer. See PRD §11.2 and §14.4 (SEC-016,
 * SEC-018). Phase 2 uses a minimal preload solely to report click coordinates
 * for hit-testing (Option C).
 */

/** Preview documents live in a non-persistent (in-memory) session partition. */
export const PREVIEW_PARTITION = "astra-preview";

/** Web preferences a preview window must run with. */
export function previewWebPreferences(partition: string = PREVIEW_PARTITION): WebPreferences {
  // Resolve preload for preview (works in dev and build)
  let previewPreload: string | undefined;
  try {
    // In built output, preload goes to ../preload/preview-preload.js relative to main
    previewPreload = join(__dirname, "../preload/preview-preload.js");
  } catch {
    previewPreload = undefined;
  }

  return {
    partition,
    preload: previewPreload,
    contextIsolation: true,
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    webviewTag: false,
    spellcheck: false,
    devTools: false,
    navigateOnDragDrop: false,
  };
}
