import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    // Inline every photo and font as a data URL. Replays store the DOM, not
    // network traffic — an image referenced by URL comes back broken once
    // the shop isn't running, so the assets have to travel inside the page.
    // The largest asset is ~80 KB; this ceiling leaves room without being
    // unbounded.
    assetsInlineLimit: 150 * 1024,
    // Inlined photos make the one bundle ~0.9 MB by design; don't warn.
    chunkSizeWarningLimit: 1200,
  },
});
