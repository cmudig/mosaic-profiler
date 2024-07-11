import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import anywidget from "@anywidget/vite";

export default defineConfig({
  build: {
    outDir: "mosaic_widget/static",
    lib: {
      entry: ["src/index.js"],
      formats: ["es"],
    },
  },
  plugins: [anywidget(), svelte()]
});
