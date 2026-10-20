import { useEffect, useState } from "react";
import { VIEWPORT_WIDTHS, useAppStore } from "@/store/app-store";

type BridgeStatus = "probing" | "connected" | "unavailable";

const VIEWPORT_LABELS = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" } as const;

/**
 * The status bar: liveness and posture.
 *
 * This is where the renderer proves the path that matters most — a sandboxed,
 * context-isolated renderer reaching a validated IPC handler in the main process
 * through the preload allowlist — and where it states the security posture out
 * loud rather than leaving it implicit. A shell that looks connected when the
 * bridge is absent is worse than one that says nothing.
 *
 * It also reports the two pieces of shell state a designer looks down to confirm
 * without moving the pointer: the active viewport and whether the canvas is in
 * edit or preview mode.
 */
export default function StatusBar() {
  // The bridge is either present (probed below) or this page was opened from a
  // plain browser, where there is no preload behind it. Deciding the absent case
  // at initialization keeps it out of the effect body entirely — a synchronous
  // setState inside an effect is a cascading render for a constant (NFR-010).
  const [status, setStatus] = useState<BridgeStatus>(() => (window.astra ? "probing" : "unavailable"));
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const viewport = useAppStore((state) => state.viewport);
  const mode = useAppStore((state) => state.mode);

  useEffect(() => {
    let cancelled = false;
    const bridge = window.astra;
    if (!bridge) return; // already "unavailable" from the initializer above

    void bridge
      .ping("renderer-ready")
      .then((reply) => {
        if (!cancelled && reply.pong) setStatus("connected");
      })
      .catch(() => {
        if (!cancelled) setStatus("unavailable");
      });

    void bridge
      .getAppVersion()
      .then((version) => {
        if (!cancelled) setAppVersion(version);
      })
      .catch(() => {
        if (!cancelled) setAppVersion(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const width = VIEWPORT_WIDTHS[viewport];

  return (
    <footer
      aria-label="Status bar"
      className="flex shrink-0 items-center gap-3 border-t border-border-subtle bg-surface-1 px-3 py-1 text-[11px] text-fg-subtle"
    >
      <span>Electron foundation</span>

      <span aria-hidden="true" className="h-3 w-px bg-border-subtle" />

      <span>context isolation on · sandbox on</span>

      <dl className="ml-auto flex items-center gap-4">
        <div className="flex items-baseline gap-1.5">
          <dt className="text-fg-faint">Viewport</dt>
          <dd className="text-fg-muted" data-testid="status-viewport">
            {VIEWPORT_LABELS[viewport]}
            {width === null ? "" : ` · ${width}px`}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-fg-faint">Mode</dt>
          <dd className="text-fg-muted" data-testid="status-mode">
            {mode}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-fg-faint">Bridge</dt>
          <dd className="text-fg-muted" data-testid="bridge-status">
            {status}
          </dd>
        </div>
        <div className="flex items-baseline gap-1.5">
          <dt className="text-fg-faint">Version</dt>
          <dd className="text-fg-muted" data-testid="app-version">
            {appVersion ?? "—"}
          </dd>
        </div>
      </dl>
    </footer>
  );
}
