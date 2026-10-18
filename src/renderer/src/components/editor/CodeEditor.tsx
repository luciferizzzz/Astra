/**
 * The bottom panel: direct source editing.
 *
 * Phase 1 does not wire Monaco up: this is the reserved, resizable region. When
 * a file is selected in the explorer, its text is displayed read-only so the
 * behaviour is demonstrable (FR-B04). Editing and the Monaco mount arrive with
 * later deliverables.
 */
import { useProjectStore } from "@/store/project-store";

export default function CodeEditor() {
  const openFile = useProjectStore((state) => state.openFile);
  const fileIssue = useProjectStore((state) => state.fileIssue);
  const notice = useProjectStore((state) => state.notice);
  const clearNotice = useProjectStore((state) => state.clearNotice);
  const selectedPath = useProjectStore((state) => state.selectedPath);
  const selectFile = useProjectStore((state) => state.selectFile);
  const dismissFileIssue = useProjectStore((state) => state.dismissFileIssue);

  return (
    <section
      aria-label="Code editor"
      className="flex h-40 shrink-0 flex-col border-t border-border-subtle bg-surface-1"
    >
      <nav
        aria-label="Open files"
        className="flex items-center gap-1 border-b border-border-subtle px-2 py-1"
      >
        {openFile ? (
          <span className="rounded bg-surface-2 px-2 py-1 font-mono text-[length:var(--astra-font-mono-size)] text-fg">
            {openFile.relativePath}
          </span>
        ) : (
          <>
            <span className="px-2 py-1 font-mono text-[length:var(--astra-font-mono-size)] text-fg-muted">HTML</span>
            <span className="px-2 py-1 font-mono text-[length:var(--astra-font-mono-size)] text-fg-faint">CSS</span>
            <span className="px-2 py-1 font-mono text-[length:var(--astra-font-mono-size)] text-fg-faint">JS</span>
          </>
        )}
      </nav>
      <div className="flex min-h-0 flex-1 flex-col">
        {notice ? (
          <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-surface-2 px-2 py-1 text-[10px] text-fg-muted">
            <span>{notice}</span>
            <button type="button" onClick={clearNotice} className="text-fg-subtle hover:text-fg">
              Dismiss
            </button>
          </div>
        ) : null}
        {fileIssue && openFile === null ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-xs text-fg-muted">
            <p>This file is missing or unreadable.</p>
            {selectedPath ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void selectFile(selectedPath)}
                  className="rounded border border-border-subtle px-2 py-0.5 text-xs hover:bg-surface-2"
                >
                  Retry
                </button>
                <button
                  type="button"
                  onClick={dismissFileIssue}
                  className="rounded border border-border-subtle px-2 py-0.5 text-xs hover:bg-surface-2"
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </div>
        ) : openFile ? (
          <pre className="min-h-0 flex-1 overflow-auto px-2 py-1 font-mono text-[length:var(--astra-font-mono-size)] text-fg whitespace-pre-wrap">
            {openFile.text}
          </pre>
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p className="text-xs text-fg-faint">Open a file to edit its source.</p>
          </div>
        )}
      </div>
    </section>
  );
}
