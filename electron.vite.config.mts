import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { CSP_DEVELOPMENT, CSP_PRODUCTION } from "./src/shared/csp";

const rendererSrc = fileURLToPath(new URL("./src/renderer/src", import.meta.url));
const coreSrc = fileURLToPath(new URL("./src/core", import.meta.url));

export default defineConfig({
  main: {
    resolve: { alias: { "@core": coreSrc } },
    build: { sourcemap: true },
  },

  preload: {
    resolve: { alias: { "@core": coreSrc } },
    build: {
      sourcemap: true,
      // A sandboxed preload is loaded by Electron as CommonJS and cannot reach
      // into node_modules, so its bundle has to be self-contained. It currently
      // imports nothing from npm — only `electron` and the in-repo contract.
      // See PRD §14.4 (SEC-016).
      externalizeDeps: false,
      isolatedEntries: true,
    },
  },

  renderer: {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "astra:content-security-policy",
        transformIndexHtml: {
          order: "post",
          handler: (html, context) =>
            // `replaceAll`, not `replace`: a single-occurrence match silently
            // leaves the real policy untouched if the token ever appears twice.
            html.replaceAll("__CSP__", context.server ? CSP_DEVELOPMENT : CSP_PRODUCTION),
        },
      },
    ],
    resolve: {
      alias: {
        "@": rendererSrc,
        "@core": coreSrc,
      },
      // Belt and braces: if anything ever resolves `react` outside the dep
      // graph below (a nested package, a `?url` import), it still lands on the
      // same copy every other module uses.
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      // React and the store have to be in the optimizer's *initial* set.
      //
      // Vite discovers dependencies by scanning the entry graph, and anything it
      // finds later triggers a mid-session re-optimization: it rewrites the same
      // `node_modules/.vite/deps` files under a new hash and reloads the page.
      // Modules already transformed under the old hash keep pointing at the old
      // `?v=` query while the files underneath have been replaced, so `zustand`
      // and `react-dom` end up importing two different instances of the shared
      // React chunk — which surfaces as "Invalid hook call" (two copies of
      // React) only under `npm run dev`. Declaring the graph here means there is
      // nothing left to discover, so the optimizer never re-runs.
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "zustand",
      ],
    },
    build: { sourcemap: true },
  },
});
