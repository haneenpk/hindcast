import { defineConfig } from "tsup";

export default defineConfig([
  // The npm package: rrweb stays external so consumers dedupe it.
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
  },
  // The embeddable r.js: one self-contained, minified IIFE with rrweb
  // bundled in, loaded from a plain async <script> tag.
  {
    entry: { r: "src/embed.ts" },
    format: ["iife"],
    platform: "browser",
    target: "es2018",
    minify: true,
    sourcemap: false,
    noExternal: [/.*/],
    outExtension() {
      return { js: ".js" };
    },
  },
]);
