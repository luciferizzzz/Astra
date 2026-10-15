import { useEffect, useState } from "react";

type BridgeStatus = "probing" | "connected" | "unavailable";

/**
 * Foundation shell.
 *
 * The real editor — canvas, inspector, code editor, sync engine — is built in
 * Phase 0+. What this component does prove is the path that matters most: a
 * sandboxed, context-isolated renderer reaching a validated IPC handler in the
 * main process through the preload allowlist.
 */
export default function App() {
  const [status, setStatus] = useState<BridgeStatus>("probing");
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const bridge = window.astra;

    if (!bridge) {
      // Rendered from a plain browser against the Vite dev server, where there
      // is no preload behind the page. Say so rather than look connected.
      setStatus("unavailable");
    } else {
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
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex h-full w-full flex-col items-center justify-center bg-surface-0 text-neutral-100">
      <h1 className="text-3xl font-semibold tracking-tight">Astra</h1>
      <p className="mt-2 text-sm text-neutral-400">Design visually. Own your code.</p>

      <p className="mt-6 rounded-md border border-border-subtle px-3 py-1 text-xs text-neutral-500">
        Electron foundation · context isolation on · sandbox on
      </p>

      <dl className="mt-8 flex gap-8 text-xs">
        <div className="flex items-baseline gap-2">
          <dt className="text-neutral-600">Bridge</dt>
          <dd className="text-neutral-400" data-testid="bridge-status">
            {status}
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-neutral-600">Version</dt>
          <dd className="text-neutral-400" data-testid="app-version">
            {appVersion ?? "—"}
          </dd>
        </div>
      </dl>
    </main>
  );
}
