import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// The new design, built next to the classic app for comparison. It reuses the
// classic app's data, report logic and translations (../web/src), so both
// always show the same numbers. Published under /biome/v2/.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "production" ? "/biome/v2/" : "/",
  publicDir: mode === "production" ? false : "../web/public",
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@classic": path.resolve(__dirname, "../web/src") } },
  server: { fs: { allow: [".."] } },
  build: { outDir: "dist", emptyOutDir: true },
}));
