/**
 * The design surface.
 *
 * Phase 1 ships the frame, not the renderer: the real site will be painted
 * inside a sandboxed preview process (PRD §11.2), so what is here is the
 * correctly-sized, correctly-named region that preview will fill.
 */
export default function Canvas() {
  return (
    <main aria-label="Canvas" className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-surface-0 p-6">
      <div className="max-w-xs text-center">
        <p className="text-sm text-neutral-300">Open a project folder to begin</p>
        <p className="mt-1 text-xs leading-relaxed text-neutral-600">
          Your site will render here, isolated from the editor and from your machine.
        </p>
      </div>
    </main>
  );
}
