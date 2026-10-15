/**
 * Content-Security-Policy for the Astra renderer.
 *
 * In a packaged build the renderer is loaded from `file://`, where there are no
 * HTTP headers to attach a policy to — so the policy is injected as a
 * `<meta http-equiv>` tag by `electron.vite.config.ts`.
 *
 * The production policy is deliberately strict: no remote origins at all, no
 * inline or `eval` scripts, no framing, no plugins. See PRD §14.4 (SEC-015).
 *
 * The development policy relaxes exactly the things Vite needs in order to serve
 * the app: the inline React Fast Refresh preamble, the HMR websocket, and the
 * dev server origin. None of those relaxations reach a production bundle — the
 * two strings are selected by build mode, never by a runtime flag.
 */

/**
 * NOTE on `frame-src 'none'`: the design canvas renders markup authored by the
 * user, but it does so inside the renderer document, not in a frame. When the
 * sandboxed preview lands (PRD §11.2) it gets its own, separately-scoped
 * policy — this one must not be loosened to accommodate it.
 */
const DIRECTIVES_DEVELOPMENT = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // Vite's HMR websocket, plus the dev server origin itself.
  "connect-src 'self' ws://localhost:* http://localhost:*",
  // Monaco hands its language workers to the browser as blob:/data: URLs.
  "worker-src 'self' blob: data:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

const DIRECTIVES_PRODUCTION = [
  "default-src 'self'",
  "script-src 'self'",
  // Tailwind and Monaco both inject <style> elements at runtime.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // Local-first: a packaged Astra talks to nothing over the network.
  "connect-src 'self'",
  "worker-src 'self' blob: data:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
];

export const CSP_DEVELOPMENT = DIRECTIVES_DEVELOPMENT.join("; ");
export const CSP_PRODUCTION = DIRECTIVES_PRODUCTION.join("; ");
