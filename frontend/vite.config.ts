import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
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
});
