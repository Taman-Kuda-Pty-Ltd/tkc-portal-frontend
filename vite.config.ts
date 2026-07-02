import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In dev, proxy /api to the local FastAPI server so the frontend uses the same
// relative "/api" base it uses in production (where Caddy serves both).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
