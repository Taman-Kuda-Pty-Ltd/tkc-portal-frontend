import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Test runner config, kept separate from vite.config.ts (the app build). Runs
// component tests in jsdom so we can assert the AddressAutocomplete fallback.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
