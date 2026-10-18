import type { CSSProperties } from "react";
import type { ProjectListEntry } from "../../../../shared/ipc";
import { classifyFile } from "@/lib/file-kind";
import { useProjectStore } from "@/store/project-store";

interface FileTreeProps {
  /** Relative path to the directory being rendered (empty string = the root). */
  directoryPath?: string;
  /** Nesting depth; drives the indent and the ARIA level. */
  depth?: number;
}

/** Rows nest with a fixed indent, so depth is a style, not a class per level. */
function indent(depth: number): CSSProperties {
  return { paddingLeft: `${Math.max(0, depth) * 1.25}rem` };
}

const ROW = "flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface-2";

/**
 * The explorer's file tree (FR-B02, FR-B03).
 *
 * One `<li role="treeitem">` per entry, with the nested group of a directory's
 * children living *inside* that item — the structure assistive tech expects of
 * a tree. Directories expand lazily: the first open fetches that directory's
 * listing, and later toggles reuse the cached one until the watcher says it
 * changed.
 *
 * Each file carries a badge naming its type rather than an icon font, which the
 * narrow sidebar can afford and a screen reader can read (the badge's type
 * label is its `title`).
 */
export default function FileTree({ directoryPath = "", depth = 0 }: FileTreeProps) {
  const entriesByDirectory = useProjectStore((state) => state.entriesByDirectory);
  const expanded = useProjectStore((state) => state.expanded);
  const selectedPath = useProjectStore((state) => state.selectedPath);
  const openFile = useProjectStore((state) => state.openFile);
  const toggleDirectory = useProjectStore((state) => state.toggleDirectory);
  const selectFile = useProjectStore((state) => state.selectFile);

  const entries: readonly ProjectListEntry[] | undefined = entriesByDirectory[directoryPath];

  if (!entries) return null;

  return (
    <ul
      role={depth === 0 ? "tree" : "group"}
      aria-label={depth === 0 ? "Project files" : undefined}
      className="flex flex-col gap-0.5 text-xs"
    >
      {entries.map((entry) => {
        if (entry.kind === "directory") {
          const isExpanded = expanded[entry.relativePath] === true;
          return (
            <li
              key={entry.relativePath}
              role="treeitem"
              aria-expanded={isExpanded}
              aria-level={depth + 1}
              data-testid={`tree-dir-${entry.relativePath}`}
              className="flex flex-col"
            >
              <button
                type="button"
                onClick={() => void toggleDirectory(entry.relativePath)}
                style={indent(depth)}
                className={`${ROW} text-fg-muted hover:text-fg`}
              >
                <span className="w-3 shrink-0 text-center text-[10px] text-fg-subtle" aria-hidden="true">
                  {isExpanded ? "▾" : "▸"}
                </span>
                <span className="truncate" title={entry.name}>
                  {entry.name}
                </span>
              </button>
              {isExpanded ? <FileTree directoryPath={entry.relativePath} depth={depth + 1} /> : null}
            </li>
          );
        }

        const file = classifyFile(entry.name);
        const isSelected =
          selectedPath === entry.relativePath || openFile?.relativePath === entry.relativePath;
        return (
          <li
            key={entry.relativePath}
            role="treeitem"
            aria-selected={isSelected}
            aria-level={depth + 1}
            data-testid={`tree-file-${entry.relativePath}`}
          >
            <button
              type="button"
              onClick={() => void selectFile(entry.relativePath)}
              style={indent(depth)}
              className={`${ROW} ${isSelected ? "bg-surface-2 text-fg" : "text-fg-muted"}`}
            >
              <span className="w-8 shrink-0 truncate text-left font-mono text-[10px] text-fg-subtle" title={file.label}>
                {file.badge}
              </span>
              <span className="truncate" title={entry.name}>
                {entry.name}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
