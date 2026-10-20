import { WebContentsView, protocol, session, type Session } from "electron";
import { promises as fs } from "node:fs";
import { realpath } from "node:fs/promises";
import { joinUnderRoot, isWithinRoot, isIgnoredPath } from "./project-paths";
import { PREVIEW_PARTITION, previewWebPreferences } from "./preview-posture";
import {
  PREVIEW_CSP,
  PREVIEW_SCHEME,
  contentTypeFor,
  isPreviewOriginUrl,
  previewUrlFor,
  relativePathFromPreviewUrl,
  toWholePixels,
} from "./preview-protocol";
import type { CanvasBounds } from "../shared/ipc";

/**
 * The canvas surface: the site itself, painted by its own Electron renderer.
 *
 * The canvas is *not* a region of the UI document. It is a `WebContentsView`
 * — a second, untrusted renderer laid over the rectangle the UI reserves for
 * it — so project JavaScript runs in a process that holds none of Astra's
 * privileges and shares no DOM with the editor (PRD §11.2, §11.7, SEC-001,
 * SEC-002).
 *
 * What this module owns:
 *
 *   - **One view, at most.** `attach` replaces whatever was there; a second
 *     project never gets a second renderer.
 *   - **Placement.** The UI renderer reports the rectangle (it is the only
 *     component that knows the layout), and this module moves the view to
 *     match. Electron wants whole pixels, so the rectangle is rounded here.
 *   - **Asset delivery.** The project is served over `astra-preview://`, a
 *     scheme with no meaning outside the open project's root. See
 *     `preview-protocol.ts` for the grammar and `handle` below for the read.
 *   - **Hardening.** The preview session denies every permission, navigation
 *     and popup, and the view gets the same no-Node posture the Phase 0 spike
 *     proved (`preview-posture.ts`).
 *
 * Registration is split: `registerPreviewScheme` must run *before* the app is
 * ready (Electron requires privileged schemes to be declared that early), while
 * the handler and the view are created later, when a project exists.
 */

/** A file the preview asked for, as bytes ready to be handed to the browser. */
interface PreviewResponse {
  readonly status: number;
  readonly body?: Buffer;
  readonly headers: Record<string, string>;
}

/**
 * Reads one project file for the preview.
 *
 * Containment is decided twice for the same reason the filesystem adapter does
 * it: the URL parser refuses `..` and absolute forms, and the resolved path is
 * checked against the canonical root so a symlink inside the project cannot
 * point out of it (SEC-013). Files under an ignored directory are refused too —
 * the explorer never lists them, and the canvas has no more business reading
 * `node_modules` than the tree does.
 */
async function readProjectFile(
  root: string,
  relativePath: string,
): Promise<PreviewResponse> {
  if (isIgnoredPath(relativePath)) {
    return { status: 404, headers: securityHeaders() };
  }

  const candidate = joinUnderRoot(root, relativePath);
  let canonical: string;
  try {
    canonical = await realpath(candidate);
  } catch {
    return { status: 404, headers: securityHeaders() };
  }
  if (!isWithinRoot(root, canonical)) {
    return { status: 404, headers: securityHeaders() };
  }

  let body: Buffer;
  try {
    const stats = await fs.stat(canonical);
    if (!stats.isFile()) {
      return { status: 404, headers: securityHeaders() };
    }
    body = await fs.readFile(canonical);
  } catch {
    return { status: 404, headers: securityHeaders() };
  }

  return {
    status: 200,
    body,
    headers: {
      ...securityHeaders(),
      "Content-Type": contentTypeFor(relativePath),
    },
  };
}

/**
 * Headers every preview response carries.
 *
 * `nosniff` matters more here than in an ordinary site: without it a browser
 * will happily treat an extension-less project file as HTML and run it.
 *
 * `Cache-Control: no-store` keeps a reload honest — an edit must be visible on
 * the next load, not served from Chromium's cache. The preview document also
 * gets `Content-Security-Policy` (see `PREVIEW_CSP`), which is what confines it
 * to the project's own files.
 */
function securityHeaders(): Record<string, string> {
  return {
    "Content-Security-Policy": PREVIEW_CSP,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  };
}

/**
 * Declares the preview scheme as privileged.
 *
 * Must be called before `app.whenReady()`. `standard` makes the scheme behave
 * like `http:` — relative URLs resolve against it and it gets a real origin —
 * which is what lets a site's own `./styles.css` and `../assets/logo.png`
 * references work at all. `secure` keeps the document out of mixed-content
 * trouble, `supportFetchAPI` lets project JavaScript fetch its own files, and
 * `corsEnabled` is what allows those cross-origin reads from an opaque origin.
 */
export function registerPreviewScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PREVIEW_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

/** The live canvas surface, or `null` when no project is open. */
export interface CanvasView {
  /**
   * Shows `relativePath` of `root` at `bounds`, reloading only when the file or
   * the revision changed. Passing `null` bounds hides the surface.
   */
  show(root: string, relativePath: string, bounds: CanvasBounds | null, revision: number): void;
  /** Hides the surface without destroying it. */
  hide(): void;
  /** Destroys the underlying renderer. */
  destroy(): void;
  /** Places the surface as a child of `parent`, on top of its document. */
  attachTo(parent: BaseWindowContentView): void;
  /** Whether the surface is currently shown. */
  isVisible(): boolean;
  /** The rectangle the surface occupies, or `null` before it is shown. */
  currentBounds(): CanvasBounds | null;
  /** The renderer itself, for the main process and tests. `null` before `show`. */
  readonly contents: WebContentsView["webContents"] | null;
}

/**
 * The slice of `BrowserWindow.contentView` this module needs.
 *
 * Narrowed to a structural type so `canvas-view.ts` never has to name a window
 * it does not own — the entry point passes its own `contentView` in.
 */
export interface BaseWindowContentView {
  addChildView(view: WebContentsView): void;
  removeChildView(view: WebContentsView): void;
}

/**
 * Creates the canvas host.
 *
 * The view is created lazily — a user who never opens a project never pays for
 * a second renderer — and reused for the life of the window, because creating
 * one per file change would thrash the process model for no gain.
 */
export function createCanvasView(): CanvasView {
  let view: WebContentsView | null = null;
  let host: BaseWindowContentView | null = null;
  let loadedRoot: string | null = null;
  let loadedPath: string | null = null;
  let loadedRevision = -1;
  let visible = false;

  /** Builds the view and its hardened session on first use. */
  function ensureView(): WebContentsView {
    if (view !== null && !view.webContents.isDestroyed()) return view;

    // Hardens the partition *and* installs the `astra-preview://` handler on
    // it. Called for its effect: the session is resolved by name from the
    // view's `webPreferences`, which is what makes the two the same session.
    hardenCanvasSession();
    const created = new WebContentsView({
      webPreferences: previewWebPreferences(PREVIEW_PARTITION),
    });

    const contents = created.webContents;
    // The session carries the permission denials; these three cover the routes
    // a session cannot: navigation away from the served document, redirects to
    // somewhere else, and a popup.
    //
    // In-page navigation *within* the project is allowed — clicking a link to
    // another page of the same site is browsing, not an escape, and the host
    // component tells the protocol handler which project is open. Anything that
    // does not address the preview origin is cancelled here; the handler would
    // answer it 404 anyway, but refusing before the request is made is the
    // clearer posture (PRD §11.7).
    contents.on("will-navigate", (event, url) => {
      if (!isPreviewOriginUrl(url)) event.preventDefault();
    });
    contents.on("will-redirect", (event, url) => {
      if (!isPreviewOriginUrl(url)) event.preventDefault();
    });
    contents.on("will-attach-webview", (event) => {
      event.preventDefault();
    });
    contents.setWindowOpenHandler(() => ({ action: "deny" }));

    // A preview renderer that dies takes the canvas with it: the dead view is
    // detached from the host before being forgotten (a destroyed webContents
    // left in the tree would keep a hole in the window), and the next `show`
    // rebuilds it rather than leaving a blank rectangle over the UI.
    contents.on("render-process-gone", () => {
      if (view !== null && !view.webContents.isDestroyed() && host !== null) {
        host.removeChildView(view);
      }
      view = null;
      loadedRoot = null;
      loadedPath = null;
      loadedRevision = -1;
      visible = false;
    });

    if (host !== null) host.addChildView(created);
    view = created;
    return created;
  }

  return {
    get contents() {
      return view?.webContents ?? null;
    },

    attachTo(parent) {
      host = parent;
      // A view already built (a window reopened) is re-parented rather than
      // rebuilt, so the renderer survives a window replacement.
      if (view !== null && !view.webContents.isDestroyed()) {
        parent.addChildView(view);
      }
    },

    isVisible() {
      return visible;
    },

    currentBounds() {
      if (view === null || view.webContents.isDestroyed()) return null;
      const bounds = view.getBounds();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    },

    show(root, relativePath, bounds, revision) {
      // A hidden request must not build a renderer: the view is created lazily
      // on first display, so "hide the canvas" is never a reason to spend a
      // process.
      if (bounds === null) {
        this.hide();
        return;
      }

      const target = ensureView();
      const contents = target.webContents;

      // Visibility and geometry are cheap; they run on every layout change.
      target.setBounds(toWholePixels(bounds));
      target.setVisible(true);
      visible = true;

      const needsLoad =
        loadedRoot !== root || loadedPath !== relativePath || loadedRevision !== revision;
      if (!needsLoad) return;

      loadedRoot = root;
      loadedPath = relativePath;
      loadedRevision = revision;
      // The path is encoded segment by segment, so a file whose *name* contains
      // a slash-like character cannot smuggle a path separator through.
      void contents.loadURL(previewUrlFor(relativePath));
    },

    hide() {
      if (view === null || view.webContents.isDestroyed()) return;
      if (!visible) return;
      view.setVisible(false);
      visible = false;
    },

    destroy() {
      if (view === null) return;
      if (host !== null && !view.webContents.isDestroyed()) {
        host.removeChildView(view);
      }
      if (!view.webContents.isDestroyed()) {
        // Closing the webContents releases its renderer. `WebContentsView` has
        // no `destroy` of its own: dropping the last reference and closing the
        // contents is what frees the process.
        view.webContents.close();
      }
      view = null;
      loadedRoot = null;
      loadedPath = null;
      loadedRevision = -1;
      visible = false;
    },
  };
}

/**
 * Applies the preview session's hardening and installs the file handler.
 *
 * The handler is registered on *this session's* protocol, not the default
 * module: the preview view runs in its own partition
 * (`PREVIEW_PARTITION`), and the default session's handlers do not apply to
 * it. Registering on the right session is what makes the scheme resolvable
 * inside the sandboxed document at all.
 *
 * Idempotent by asking the session, not by keeping a flag: `fromPartition`
 * hands back the same session every time, and `protocol.handle` throws if a
 * scheme is already registered on it. Rebuilding the view after a renderer
 * crash therefore re-hardens the session without re-registering.
 */
function hardenCanvasSession(): Session {
  const ses = session.fromPartition(PREVIEW_PARTITION, { cache: false });
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);

  if (!ses.protocol.isProtocolHandled(PREVIEW_SCHEME)) {
    ses.protocol.handle(PREVIEW_SCHEME, (request) => answerPreviewRequest(request.url));
  }
  return ses;
}

/** Answers one `astra-preview://` request from the open project, or 404. */
async function answerPreviewRequest(rawUrl: string): Promise<Response> {
  let relativePath: string;
  try {
    relativePath = relativePathFromPreviewUrl(rawUrl);
  } catch {
    return new Response("Not found", { status: 404, headers: securityHeaders() });
  }

  const root = currentRoot();
  if (root === null) {
    return new Response("No project is open", { status: 404, headers: securityHeaders() });
  }

  const answer = await readProjectFile(root, relativePath);
  if (answer.body === undefined) {
    return new Response("Not found", { status: answer.status, headers: answer.headers });
  }
  // `BodyInit` in this lib set does not accept a Node `Buffer` directly; a
  // Blob built from the same bytes is the portable form.
  const blob = new Blob([new Uint8Array(answer.body)], { type: answer.headers["Content-Type"] });
  return new Response(blob, { status: answer.status, headers: answer.headers });
}

/**
 * How the handler learns which project is open.
 *
 * Injected rather than imported so this module keeps no dependency on the
 * session's shape and a test can drive the handler without a live project.
 * The entry point sets it once, to a function that reads the live session.
 */
let rootReader: () => string | null = () => null;

/** Points the preview handler at the project whose files it may serve. */
export function setPreviewRootReader(reader: () => string | null): void {
  rootReader = reader;
}

function currentRoot(): string | null {
  return rootReader();
}
