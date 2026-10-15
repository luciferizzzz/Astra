import { shell, type Session, type WebContents } from "electron";
import { isTrustedRendererUrl, type TrustedRendererTarget } from "./trusted-url";

/**
 * BrowserWindow and webContents hardening.
 *
 * The renderer is treated as a potentially compromised surface: it renders
 * markup from projects the user did not write. These guards exist so that even
 * a fully-controlled renderer cannot navigate the app, spawn windows, attach a
 * `<webview>`, or reach an arbitrary OS surface.
 *
 * See PRD §11.2 and §14.4 (SEC-018, SEC-020, SEC-021).
 */

export function hardenWebContents(contents: WebContents, target: TrustedRendererTarget): void {
  // No window.open, ever. A link that leaves the app leaves through the OS
  // browser — which is outside every privilege this process holds.
  contents.setWindowOpenHandler(({ url }) => {
    if (isExternalBrowserUrl(url)) {
      void shell.openExternal(url).catch(() => {
        // A refused external open is not worth interrupting the user over.
      });
    }
    return { action: "deny" };
  });

  // In-page navigation may only stay on the renderer document.
  contents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(url, target)) {
      event.preventDefault();
    }
  });

  // `<webview>` is a privileged escape hatch that Astra never uses.
  contents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

/**
 * Denies every runtime permission request.
 *
 * Astra asks for none of them — no camera, microphone, geolocation,
 * notifications or media. Denying wholesale keeps the surface closed instead of
 * relying on a default that could quietly widen in a future Electron release.
 */
export function hardenSession(ses: Session): void {
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
}

function isExternalBrowserUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}
