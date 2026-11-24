import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { torchAttestationPlugin } from "./scripts/torch-attestation-manifest";

// Real process env overrides .env files, matching what vite bakes into import.meta.env.
const pickViteEnv = (env: NodeJS.ProcessEnv) =>
  Object.fromEntries(Object.entries(env).filter(([k, v]) => k.startsWith("VITE_") && v !== undefined)) as Record<string, string>;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // WO-TB-02: server-only runtime attestation manifest (build only; never emitted into dist/).
    torchAttestationPlugin((m) => ({ ...loadEnv(m, process.cwd(), "VITE_"), ...pickViteEnv(process.env) })),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
