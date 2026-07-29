import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "gestao",
  plugins: [react()],
  build: {
    outDir: "../dist-gestao",
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
});
