/**
 * The preload bridge, or `undefined` when the renderer is running without one.
 *
 * A plain browser pointed at the Vite dev server has no `window.astra`; every
 * store treats that as "the shell is not connected" rather than throwing.
 */
export function bridge(): typeof window.astra | undefined {
  return typeof window === "undefined" ? undefined : window.astra;
}
