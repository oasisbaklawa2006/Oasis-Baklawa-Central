import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Playwright specs (e.g. visual-audit) use @playwright/test, not Vitest.
    exclude: ["src/test/tests/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  ssr: {
    noExternal: ["typescript"],
  },
});
