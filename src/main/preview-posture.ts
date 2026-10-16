import type { WebPreferences } from "electron";

/**
 * The security posture of the preview surface, kept as a pure value so it can
 * be asserted without a live Electron process.
 *
 * The preview renders markup from projects the user did not write, so it gets
 * strictly less than the renderer: no preload, no Node.js, no `<webview>`, no
 * devtools, and its own in-memory session. See PRD §11.2 and §14.4 (SEC-016,
 * SEC-018).
 */

/** Preview documents live in a non-persistent (in-memory) session partition. */
export const PREVIEW_PARTITION = "astra-preview";

/** Web preferences a preview window must run with. */
export function previewWebPreferences(partition: string = PREVIEW_PARTITION): WebPreferences {
  return {
    partition,
    // No `preload`: the preview gets no bridge into the main process at all.
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
