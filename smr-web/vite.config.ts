import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  worker: {
    format: "es"
  },
  optimizeDeps: {
    // kokoro-js bundles its own worker/wasm loading; letting Vite pre-bundle it can break
    // dynamic asset resolution for the ONNX runtime's wasm files.
    exclude: ["kokoro-js"]
  }
});
