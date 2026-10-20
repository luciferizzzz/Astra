/*
 * The parity fixture's script — proof that linked JavaScript runs inside the
 * sandboxed canvas, not just markup and CSS.
 *
 * The observable effect is deliberately tiny and deterministic: it records that
 * it ran and copies a stylesheet-provided value into the DOM. Any side effect
 * that needed the network would be blocked by the preview CSP, which is the
 * point — a real site's *own* scripts must run, and nothing else may.
 */

(function () {
  "use strict";

  var status = document.getElementById("status");
  if (status) {
    status.textContent = "script ran";
    // Read back through `getComputedStyle` so the test can assert the cascade
    // resolved our custom property, not merely that a string was written.
    var accent = getComputedStyle(document.documentElement)
      .getPropertyValue("--fixture-accent")
      .trim();
    status.dataset["accent"] = accent;
  }

  // A marker the test reads to distinguish "the script executed" from "the DOM
  // happened to contain this text".
  window.__parityFixture = { ran: true, href: window.location.href };
})();
