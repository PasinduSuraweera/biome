import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The new design, built next to the classic app for comparison. It reuses the
// classic app's data, report logic and translations (../web/src), so both
// always show the same numbers.
//   GitHub Pages: published under /biome/v2/, reading data from the classic site at /biome/.
//   Vercel (BIOME_TARGET=vercel): published at the root with its own copy of the data.
const vercel = process.env.BIOME_TARGET === "vercel";
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode !== "production" || vercel ? "/" : "/biome/v2/",
  publicDir: mode !== "production" || vercel ? "../web/public" : false,
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@classic": path.resolve(__dirname, "../web/src") } },
  server: { fs: { allow: [".."] } },
  build: { outDir: "dist", emptyOutDir: true },
}));
