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
    },
    build: { sourcemap: true },
  },
});
