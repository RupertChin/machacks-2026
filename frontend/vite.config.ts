/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mediapipe/tasks-vision": path.resolve(
        __dirname,
        "node_modules/@mediapipe/tasks-vision/vision_bundle.mjs"
      ),
    },
  },
  optimizeDeps: {
    include: ["@jscad/modeling", "@jscad/stl-serializer"],
  },
  worker: {
    rollupOptions: {
      plugins: [],
    },
  },
  test: {
    globals: false,
    environment: "node",
  },
});
