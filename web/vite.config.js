import { defineConfig } from "vite";
// relative base so the built site works on GitHub Pages under any repo name
export default defineConfig({ base: "./", build: { outDir: "dist", assetsDir: "assets" } });
