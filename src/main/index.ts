import { BrowserWindow, app, session } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { registerIpcHandlers } from "./ipc";
import { openPreview } from "./preview";
import { hardenSession, hardenWebContents } from "./security";
import type { TrustedRendererTarget } from "./trusted-url";

/**
 * Astra's Electron entry point.
 *
 * The process model is deliberately narrow: one main process that owns the
 * filesystem, one sandboxed renderer that owns nothing. The preview surface
 * becomes its own process later (PRD §11.2) and must never share this window.
 */

// Electron keeps a window alive only while a JavaScript reference to it exists.
let mainWindow: BrowserWindow | null = null;

/**
 * Where the renderer lives.
 *
 * `electron-vite` points `ELECTRON_RENDERER_URL` at the Vite dev server when
 * running `npm run dev`. In a packaged build there is no server, and the
 * renderer is read from `file://` inside `out/renderer`.
 */
function resolveRendererTarget(): TrustedRendererTarget {
  const devServerUrl = process.env["ELECTRON_RENDERER_URL"];
  const fileUrl = pathToFileURL(join(__dirname, "../renderer/index.html")).toString();

  return devServerUrl ? { devServerUrl, fileUrl } : { fileUrl };
}

function createMainWindow(target: TrustedRendererTarget): BrowserWindow {
  const window = new BrowserWindow({
    title: "Astra",
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    center: true,
    // Revealed on `ready-to-show`, so the user never sees a blank frame.
    show: false,
    // Matches --color-surface-0, so the window background is never white.
    backgroundColor: "#0a0a0b",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // `sandbox` is what makes the preload meaningful: with it on, the
      // renderer has no Node.js at all and the preload can only require a
      // fixed set of builtins. See PRD §14.4 (SEC-016, SEC-017).
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      spellcheck: false,
    },
  });

  window.once("ready-to-show", () => window.show());
  hardenWebContents(window.webContents, target);

  if (target.devServerUrl) {
    void window.loadURL(`${target.devServerUrl}/`);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  return window;
}

app.whenReady().then(() => {
  const target = resolveRendererTarget();

  hardenSession(session.defaultSession);
  registerIpcHandlers(target);
  mainWindow = createMainWindow(target);

  // macOS convention: reopen the window when the dock icon is clicked.
  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createMainWindow(target);
    }
  });
});

/**
 * Test-only hook for the Phase 0 sandbox spike.
 *
 * Playwright drives the main process through `app.evaluate`, which cannot reach
 * into this module's scope. When `ASTRA_E2E=1` the entry point publishes a
 * single function on `globalThis` so `e2e/sandbox.spec.ts` can open a preview of
 * a hostile fixture and probe it. The hook is inert in every normal run.
 */
function installPreviewTestSeam(): void {
  if (process.env["ASTRA_E2E"] !== "1") {
    return;
  }
  const scope = globalThis as { __astraOpenPreview?: (url: string) => number };
  scope.__astraOpenPreview = (url) => openPreview(url).id;
}

// Installed at module load rather than inside `whenReady`, so a test that
// evaluates the main process as soon as it launches cannot miss it.
installPreviewTestSeam();

app.on("window-all-closed", () => {
  mainWindow = null;
  if (process.platform !== "darwin") app.quit();
});

// Belt and braces. This fires while `new BrowserWindow()` is still constructing,
// so it applies to every window — including any added later — before that window
// is ever shown. `createMainWindow` then installs the refined policy on top.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-attach-webview", (event) => event.preventDefault());
});
