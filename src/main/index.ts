import { BrowserWindow, Menu, app, dialog, nativeTheme, session } from "electron";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { IPC_CHANNELS, MENU_COMMANDS, type MenuCommand, type ProjectFsEvent } from "../shared/ipc";
import type { SettingsTheme } from "../shared/settings";
import { registerIpcHandlers } from "./ipc";
import { buildMenuTemplate } from "./menu";
import { openPreview } from "./preview";
import { createProjectSession } from "./project-session";
import { hardenSession, hardenWebContents } from "./security";
import { createSettingsStore } from "./settings-store";
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
 * The open project, if any. Created at module scope so the quit path can stop
 * its watcher even if the window never opened.
 */
const project = createProjectSession({
  // Verified external changes are forwarded to the renderer as data; deciding
  // what they mean (quiet reload vs. conflict prompt) is the sync layer's job.
  onChanges: (changes) => {
    sendToRenderer(IPC_CHANNELS.projectFsEvent, { changes } satisfies ProjectFsEvent);
  },
  onWatcherFallback: (reason) => {
    console.warn(`[astra] filesystem watcher fell back to polling: ${reason}`);
  },
});

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

/**
 * The surface colour for a theme, in the same values the renderer's tokens use.
 *
 * Painted before the renderer has loaded, so the window matches the interface
 * the moment it appears instead of flashing the wrong background.
 */
function surfaceColorFor(theme: SettingsTheme): string {
  const dark = theme === "dark" || (theme === "system" && nativeTheme.shouldUseDarkColors);
  return dark ? "#0a0a0b" : "#f4f4f5";
}

function createMainWindow(target: TrustedRendererTarget, backgroundColor: string): BrowserWindow {
  const window = new BrowserWindow({
    title: "Astra",
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    center: true,
    // Revealed on `ready-to-show`, so the user never sees a blank frame.
    show: false,
    // Matches --color-surface-0 for the stored theme, so the first painted frame
    // is never the wrong colour.
    backgroundColor,
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

/**
 * Forwards a message to the renderer, if it is still there.
 *
 * The menu and the filesystem watcher both live in the main process, but what
 * they report — a click, a changed file — is renderer business. Guarded on
 * `isDestroyed` because both can outlive the window for a moment.
 */
function sendToRenderer(channel: string, payload: unknown): void {
  const contents = mainWindow?.webContents;
  if (contents && !contents.isDestroyed()) {
    contents.send(channel, payload);
  }
}

/** Forwards a menu command to the renderer. */
function sendMenuCommand(command: MenuCommand): void {
  sendToRenderer(IPC_CHANNELS.menuCommand, command);
}

/** The About dialog — deliberately plain, and always offline. */
async function showAboutDialog(): Promise<void> {
  const options = {
    type: "info" as const,
    title: "About Astra",
    message: `Astra ${app.getVersion()}`,
    detail:
      "Local-first desktop visual web designer.\n" +
      "Design visually — and own your code.\n\n" +
      "No account. No telemetry. Nothing leaves your machine.",
    buttons: ["Close"],
    noLink: true,
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    await dialog.showMessageBox(mainWindow, options);
  } else {
    await dialog.showMessageBox(options);
  }
}

/** Installs the native application menu (FR-A02). */
function installApplicationMenu(): void {
  const template = buildMenuTemplate({
    // Reload and DevTools only make sense against the dev server.
    isDevelopment: !app.isPackaged,
    handlers: {
      onOpenSettings: () => sendMenuCommand(MENU_COMMANDS.openSettings),
      onAbout: () => void showAboutDialog(),
      onCommand: (command) => sendMenuCommand(command),
    },
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  const target = resolveRendererTarget();
  const settings = createSettingsStore(app.getPath("userData"));

  hardenSession(session.defaultSession);
  registerIpcHandlers(target, settings, project);

  // Installed before anything is awaited, not after. The menu needs neither the
  // stored settings nor the window — a click resolves `mainWindow` at the moment
  // it is pressed — so queuing it behind `settings.read()` would leave a window
  // at the ready in which the application has no menu at all.
  installApplicationMenu();

  // Read the stored theme once so the window's first frame already matches it.
  const stored = await settings.read();
  const backgroundColor = surfaceColorFor(stored.theme);
  mainWindow = createMainWindow(target, backgroundColor);

  // macOS convention: reopen the window when the dock icon is clicked.
  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createMainWindow(target, backgroundColor);
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

// Best effort: the process is on its way out, so the watcher's handles would
// be released by the OS anyway. Closing here keeps a dev relaunch from racing
// a stale watcher against the same project files.
app.on("will-quit", () => {
  void project.close();
});

// Belt and braces. This fires while `new BrowserWindow()` is still constructing,
// so it applies to every window — including any added later — before that window
// is ever shown. `createMainWindow` then installs the refined policy on top.
app.on("web-contents-created", (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-attach-webview", (event) => event.preventDefault());
});
