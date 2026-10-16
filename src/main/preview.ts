import { BrowserWindow, session, type Session } from "electron";
import { PREVIEW_PARTITION, previewWebPreferences } from "./preview-posture";
import { hardenSession } from "./security";

/**
 * The preview surface.
 *
 * Preview documents are untrusted: they come from a project the user may have
 * cloned from anywhere. This module builds the window they are allowed to run
 * in, and closes every route out of it:
 *
 *   - a dedicated in-memory session with all permissions denied,
 *   - no preload bridge, no Node.js, no `<webview>`, no devtools,
 *   - no navigation (`will-navigate`, `will-redirect` are cancelled),
 *   - no popups (`setWindowOpenHandler` denies).
 *
 * The window is deliberately separate from the app window. See PRD §11.2.
 */

let previewWindows: BrowserWindow[] = [];

/** Applies every runtime restriction the preview session must carry. */
export function hardenPreviewSession(ses: Session): void {
  hardenSession(ses);
  // Deny the *check* as well as the request: features that ask before prompting
  // (clipboard read, media devices) must be refused silently.
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);
}

/** Creates the hardened window a preview document runs inside. */
export function createPreviewWindow(partition: string = PREVIEW_PARTITION): BrowserWindow {
  const ses = session.fromPartition(partition, { cache: false });
  hardenPreviewSession(ses);

  const window = new BrowserWindow({
    title: "Astra Preview",
    width: 1024,
    height: 720,
    show: false,
    backgroundColor: "#ffffff",
    webPreferences: previewWebPreferences(partition),
  });

  const contents = window.webContents;
  // A preview renders one document. It never navigates and never opens another
  // window, so a hostile document cannot steer the user elsewhere.
  contents.on("will-navigate", (event) => {
    event.preventDefault();
  });
  contents.on("will-redirect", (event) => {
    event.preventDefault();
  });
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
  contents.setWindowOpenHandler(() => ({ action: "deny" }));

  return window;
}

/**
 * Creates a preview window and loads `url` into it.
 *
 * The window is kept in a module-level list so Electron does not collect it
 * while the preview is open.
 */
export function openPreview(url: string, partition: string = PREVIEW_PARTITION): BrowserWindow {
  const window = createPreviewWindow(partition);
  previewWindows.push(window);
  window.on("closed", () => {
    previewWindows = previewWindows.filter((candidate) => candidate !== window);
  });
  void window.loadURL(url);
  return window;
}
