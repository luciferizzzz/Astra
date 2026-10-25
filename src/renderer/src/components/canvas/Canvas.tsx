import { useCallback, useEffect, useRef, useState } from "react";
import { VIEWPORT_WIDTHS, useAppStore } from "@/store/app-store";
import { bridge } from "@/store/bridge";
import { useProjectStore } from "@/store/project-store";
import { useCanvasStore } from "@/store/canvas-store";

/**
 * The design surface.
 *
 * The site itself is not rendered here. Project markup is untrusted, so it runs
 * in its own Electron renderer laid *over* this region by the main process
 * (PRD §11.2, §11.7) — this component's whole job is to reserve the rectangle.
 *
 * Two things follow from that:
 *
 *   - The region must be measured, not styled into place. Only the renderer
 *     knows the layout after panels toggle and the window resizes, so a
 *     `ResizeObserver` reports the rectangle to the main process, which moves
 *     the view to match.
 *   - The region must not be filled with anything. Whatever is painted here
 *     would be covered by the view anyway, so it stays a frame that says what
 *     would appear and what is stopping it.
 *
 * The frame is not inert: the active viewport preset sizes it — Tablet and
 * Mobile render as a fixed-width column, Desktop stays fluid (FR-H01) — and the
 * strip above names both the preset and whether the surface is in edit or
 * preview mode.
 */

const VIEWPORT_LABELS = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" } as const;

export default function Canvas() {
  const viewport = useAppStore((state) => state.viewport);
  const mode = useAppStore((state) => state.mode);
  const width = VIEWPORT_WIDTHS[viewport];

  const entryPoint = useProjectStore((state) => state.entryPoint);
  const root = useProjectStore((state) => state.root);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const selection = useCanvasStore((state) => state.selection);
  const subscribeCanvas = useCanvasStore((state) => state.subscribe);

  useEffect(() => {
    return subscribeCanvas();
  }, [subscribeCanvas]);

  /**
   * Bumped whenever the entry page must be re-rendered even though its path did
   * not change: an external edit, or a project reopened at the same name. The
   * main process reloads on a different value.
   */
  const [revision] = useState(0);

  /**
   * Reports the surface's rectangle to the main process.
   *
   * `getBoundingClientRect` returns viewport coordinates, which is exactly the
   * space a child view is placed in — the UI document fills the window's client
   * area and does not scroll as a whole, so no offset correction is needed.
   */
  const report = useCallback(() => {
    const api = bridge();
    if (!api?.setCanvasSurface) return;

    const element = surfaceRef.current;
    const visible = root !== null && entryPoint !== null && element !== null;
    if (!visible) {
      void api.setCanvasSurface({ bounds: null, entryPath: null, revision }).catch(() => undefined);
      return;
    }

    const rect = element.getBoundingClientRect();
    void api
      .setCanvasSurface({
        bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
        entryPath: entryPoint,
        revision,
      })
      .catch(() => undefined);
  }, [entryPoint, revision, root]);

  // Placement follows the element, not a render: a panel toggle or a window
  // resize changes the rectangle without changing anything React subscribes to.
  useEffect(() => {
    const element = surfaceRef.current;
    report();
    if (element === null) return;

    // `ResizeObserver` is absent under jsdom, where there is no layout to
    // observe and therefore nothing to report. The window listener is kept in
    // both environments so the effect still has a lifetime to clean up.
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => report());
    observer?.observe(element);
    window.addEventListener("resize", report);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", report);
    };
  }, [report]);

  // Hiding is a promise, not an unmount: the surface must be told to disappear
  // before the window it lives over goes away.
  useEffect(() => () => {
    const api = bridge();
    void api?.setCanvasSurface?.({ bounds: null, entryPath: null, revision: 0 })?.catch?.(
      () => undefined,
    );
  }, []);

  return (
    <main
      aria-label="Canvas"
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-3 overflow-hidden bg-surface-0 p-6"
    >
      <div className="flex shrink-0 items-center gap-2 text-[11px] text-fg-subtle">
        <span data-testid="canvas-viewport">{VIEWPORT_LABELS[viewport]}</span>
        <span aria-hidden="true">·</span>
        <span data-testid="canvas-mode">{mode}</span>
      </div>

      {/*
        The measured region is the device viewport itself: the preview renderer
        is placed edge-to-edge over this box, so the box must be exactly the
        width a browser would be handed — padding or a border *inside* it would
        shrink every project by that much and make the presets lie (FR-H01).

        Desktop is fluid, so the box fills the column; Tablet and Mobile are
        fixed widths, capped by the column when the window is too narrow to hold
        them. The dashed outline marks where the site will paint, and is drawn
        on the box rather than around it so no pixels of the box are reserved
        for chrome.
      */}
      <div
        ref={surfaceRef}
        data-testid="canvas-surface"
        className="relative min-h-0 flex-1 rounded border border-dashed border-border-subtle"
        style={width === null ? { width: "100%" } : { width, maxWidth: "100%" }}
      >
        {selection?.found && selection.rect ? (
          <div
            data-testid="canvas-selection-outline"
            style={{
              position: "absolute",
              left: selection.rect.x,
              top: selection.rect.y,
              width: selection.rect.width,
              height: selection.rect.height,
              border: "1px solid #4f9bff",
              pointerEvents: "none",
              boxSizing: "border-box",
            }}
          >
            {selection.tagName ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: -18,
                  background: "#4f9bff",
                  color: "#fff",
                  fontSize: "10px",
                  padding: "0 4px",
                  lineHeight: "16px",
                  borderRadius: "2px",
                }}
              >
                {selection.tagName.toLowerCase()}
                {selection.id ? `#${selection.id}` : ""}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center p-6">
          {root !== null && entryPoint !== null ? (
            // The site is painted over this box by the main process; the text is
            // only ever seen for the moment before the view arrives.
            <p className="text-xs text-fg-faint" data-testid="canvas-pending">
              Rendering {entryPoint}…
            </p>
          ) : (
            <div className="max-w-xs text-center">
              <p className="text-sm text-fg-muted">Open a project folder to begin</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-faint">
                Your site will render here, isolated from the editor and from your machine.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
