import { VIEWPORT_WIDTHS, useAppStore } from "@/store/app-store";

/**
 * The design surface.
 *
 * Phase 1 ships the frame, not the renderer: the real site will be painted
 * inside a sandboxed preview process (PRD §11.2), so what is here is the
 * correctly-sized, correctly-named region that preview will fill.
 *
 * The frame is not inert, though. The active viewport preset sizes it — Tablet
 * and Mobile render as a fixed-width column, Desktop stays fluid (FR-H01) — and
 * the strip above names both the preset and whether the surface is in edit or
 * preview mode, so the state the menu and toolbar set is visible where it
 * applies.
 */

const VIEWPORT_LABELS = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" } as const;

export default function Canvas() {
  const viewport = useAppStore((state) => state.viewport);
  const mode = useAppStore((state) => state.mode);
  const width = VIEWPORT_WIDTHS[viewport];

  return (
    <main
      aria-label="Canvas"
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-surface-0 p-6"
    >
      <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
        <span data-testid="canvas-viewport">{VIEWPORT_LABELS[viewport]}</span>
        <span aria-hidden="true">·</span>
        <span data-testid="canvas-mode">{mode}</span>
      </div>

      <div
        className="flex min-h-[8rem] w-full max-w-xl items-center justify-center rounded border border-dashed border-border-subtle p-6"
        style={width === null ? undefined : { width, maxWidth: "100%" }}
      >
        <div className="max-w-xs text-center">
          <p className="text-sm text-fg-muted">Open a project folder to begin</p>
          <p className="mt-1 text-xs leading-relaxed text-fg-faint">
            Your site will render here, isolated from the editor and from your machine.
          </p>
        </div>
      </div>
    </main>
  );
}
