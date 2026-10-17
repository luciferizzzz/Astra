/**
 * The bottom panel: direct source editing.
 *
 * Monaco is already a dependency, but Phase 1 does not wire it up: this is the
 * reserved, resizable region and its file tabs. Showing the empty state keeps
 * the promise that the code is always reachable without pretending an editor is
 * mounted.
 */
export default function CodeEditor() {
  return (
    <section
      aria-label="Code editor"
      className="flex h-40 shrink-0 flex-col border-t border-border-subtle bg-surface-1"
    >
      <nav
        aria-label="Open files"
        className="flex items-center gap-1 border-b border-border-subtle px-2 py-1"
      >
        <span className="px-2 py-1 font-mono text-[length:var(--astra-font-mono-size)] text-fg-muted">HTML</span>
        <span className="px-2 py-1 font-mono text-[length:var(--astra-font-mono-size)] text-fg-faint">CSS</span>
        <span className="px-2 py-1 font-mono text-[length:var(--astra-font-mono-size)] text-fg-faint">JS</span>
      </nav>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-xs text-fg-faint">Open a file to edit its source.</p>
      </div>
    </section>
  );
}
