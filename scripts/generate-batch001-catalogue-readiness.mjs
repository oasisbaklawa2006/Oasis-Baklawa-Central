#!/usr/bin/env node
/**
 * Launcher for the TypeScript report generator (imports canonical language-wave constants).
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = join(scriptDir, "..");
const tsEntry = join(scriptDir, "generate-batch001-catalogue-readiness.ts");

const result = spawnSync("npx", ["vite-node", tsEntry], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});

process.exit(result.status ?? 1);
