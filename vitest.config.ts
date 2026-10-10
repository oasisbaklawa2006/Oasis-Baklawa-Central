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
    // Dummy values so modules that construct the Supabase client at import
    // time (e.g. src/integrations/supabase/client.ts) don't throw during
    // test collection. Not a real project - never used to reach a live backend.
    env: {
      VITE_SUPABASE_URL: "https://test-project.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
      VITE_STOCK_FINALIZATION_DEMO: "false",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  ssr: {
    noExternal: ["typescript"],
  },
});
