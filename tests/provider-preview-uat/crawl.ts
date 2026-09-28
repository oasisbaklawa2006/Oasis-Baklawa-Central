import path from "node:path";
import type { Page } from "@playwright/test";
import { classifyAccessWallFromSignals } from "../../src/lib/provider-preview-uat/access-wall";
import type { ProviderPreviewTarget } from "../../src/lib/provider-preview-uat/catalogue";
import { PROVIDER_PREVIEW_TRANCHE } from "../../src/lib/provider-preview-uat/catalogue";
import {
  assertChromiumNeverCertifiesScannerPass,
  deriveFunctionStatus,
  physicalGateNote,
  scannerAcceptanceStatus,
} from "../../src/lib/provider-preview-uat/gates";
import {
  appendManifestRow,
  emptyUxEvidence,
  screenshotRelPath,
  sha256Bytes,
  type ProviderPreviewManifestRow,
  type UxEvidenceSlot,
} from "../../src/lib/provider-preview-uat/manifest";
import {
  normalizeProviderPreviewUrl,
  redactUrlForEvidence,
  resolveProviderPreviewBaseUrl,
  secretNameForApp,
} from "../../src/lib/provider-preview-uat/url";

import {
  ensureProviderPreviewOutputDir,
  resolveProviderPreviewOutputRoot,
  writeSecretPresenceAudit,
} from "../../scripts/lib/provider-preview-report-lib.mjs";

const OUTPUT_ROOT = resolveProviderPreviewOutputRoot();

export type ViewportPreset = { width: number; height: number; label: string };

export function viewportForDevice(device: ProviderPreviewTarget["device"]): ViewportPreset {
  if (device === "phone") return { width: 390, height: 844, label: "390x844" };
  if (device === "scanner") return { width: 480, height: 800, label: "480x800-software-preview" };
  return { width: 1440, height: 900, label: "1440x900" };
}

async function captureSlot(
  page: Page,
  absPath: string,
): Promise<Buffer> {
  return page.screenshot({ path: absPath, fullPage: true });
}

async function pageHasMeaningfulSurface(page: Page): Promise<boolean> {
  const textLen = await page.evaluate(() => document.body?.innerText?.trim().length ?? 0);
  const hasMain = await page.locator("main, [role='main'], #root, [data-testid]").first().count();
  return textLen > 40 || hasMain > 0;
}

function blockedRow(
  target: ProviderPreviewTarget,
  opts: {
    viewport: ViewportPreset;
    crawlBaseUrl: string;
    blockClassification: string;
    notes: string;
    missingSecretNames?: string[];
  },
): ProviderPreviewManifestRow {
  return {
    uatId: target.uatId,
    tranche: PROVIDER_PREVIEW_TRANCHE,
    harness: "provider-preview",
    app: target.app,
    route: target.route,
    state: target.state,
    role: target.persona,
    viewport: opts.viewport.label,
    device: target.device,
    baselineSha: target.baselineSha,
    crawlBaseUrl: redactUrlForEvidence(opts.crawlBaseUrl),
    timestamp: new Date().toISOString(),
    blockClassification: opts.blockClassification,
    visualStatus: "BLOCKED",
    functionStatus: "BLOCKED",
    scannerAcceptanceStatus: scannerAcceptanceStatus(target),
    uxEvidence: emptyUxEvidence(),
    uxEvidenceSha256: {},
    consoleErrors: [],
    networkErrors: [],
    notes: opts.notes,
    screenshotPrimary: "",
    screenshotSha256: "",
  };
}

export async function crawlProviderPreviewTarget(
  page: Page,
  target: ProviderPreviewTarget,
): Promise<ProviderPreviewManifestRow> {
  const viewport = viewportForDevice(target.device);
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  const secretName = secretNameForApp(target.app);
  const baseUrl = resolveProviderPreviewBaseUrl(target.app);
  if (!baseUrl) {
    const row = blockedRow(target, {
      viewport,
      crawlBaseUrl: "",
      blockClassification: "DEPLOY_BLOCKED",
      notes: `DEPLOY BLOCKED — missing ${secretName}. Central TEST_PREVIEW_URL is not valid for ${target.app}.`,
    });
    appendManifestRow(row);
    return row;
  }

  let normalizedBase: string;
  try {
    normalizedBase = normalizeProviderPreviewUrl(baseUrl);
  } catch (error) {
    const row = blockedRow(target, {
      viewport,
      crawlBaseUrl: "",
      blockClassification: "DEPLOY_BLOCKED",
      notes: `DEPLOY BLOCKED — ${secretName} failed validation: ${error instanceof Error ? error.message : String(error)}`,
    });
    appendManifestRow(row);
    return row;
  }

  const consoleErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 500));
  });
  page.on("response", (resp) => {
    if (resp.status() >= 400 && !resp.url().includes("favicon")) {
      networkErrors.push(`${resp.status()} ${resp.url().slice(0, 200)}`);
    }
  });

  const routePath = target.route.startsWith("/") ? target.route : `/${target.route}`;
  const destination = `${normalizedBase}${routePath === "/" ? "" : routePath}`;

  let blockedNavigation = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (!request.isNavigationRequest()) {
      await route.continue();
      return;
    }

    try {
      normalizeProviderPreviewUrl(request.url());
      await route.continue();
    } catch {
      blockedNavigation = true;
      await route.abort("blockedbyclient");
    }
  });

  try {
    await page.goto(destination, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (error) {
    const row = blockedRow(target, {
      viewport,
      crawlBaseUrl: normalizedBase,
      blockClassification: blockedNavigation ? "NAVIGATION_REDIRECT_BLOCKED" : "NAVIGATION_FAILED",
      notes: blockedNavigation
        ? "Navigation redirect was blocked because it targeted a host outside the governed preview allowlist."
        : "Navigation failed before the provider-preview surface loaded. Raw browser error text is omitted to avoid leaking the governed preview URL.",
    });
    appendManifestRow(row);
    return row;
  } finally {
    await page.unroute("**/*");
  }

  if (blockedNavigation) {
    const row = blockedRow(target, {
      viewport,
      crawlBaseUrl: normalizedBase,
      blockClassification: "NAVIGATION_REDIRECT_BLOCKED",
      notes: "Navigation redirect was blocked because it targeted a host outside the governed preview allowlist.",
    });
    appendManifestRow(row);
    return row;
  }

  await page.waitForTimeout(800);

  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
  const wall = classifyAccessWallFromSignals(title, page.url(), bodyText);
  if (wall.blocked) {
    const row = blockedRow(target, {
      viewport,
      crawlBaseUrl: normalizedBase,
      blockClassification: wall.classification ?? "DEPLOYMENT_PROTECTION",
      notes: wall.reason,
    });
    appendManifestRow(row);
    return row;
  }

  const uxEvidence = emptyUxEvidence();
  const uxEvidenceSha256: Partial<Record<UxEvidenceSlot, string>> = {};
  const slots: UxEvidenceSlot[] = ["s0", "s1", "s2", "s3"];

  for (const slot of slots) {
    if (slot === "s1") await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    if (slot === "s2") await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    if (slot === "s3" && target.state !== "default") {
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    const rel = screenshotRelPath(target, slot);
    const abs = path.join(OUTPUT_ROOT, rel);
    const screenshotBytes = await captureSlot(page, abs);
    uxEvidence[slot] = rel;
    uxEvidenceSha256[slot] = sha256Bytes(screenshotBytes);
  }

  const meaningfulSurface = await pageHasMeaningfulSurface(page);
  let functionStatus = deriveFunctionStatus({
    target,
    deployBlocked: false,
    deploymentWall: false,
    meaningfulSurface,
  });
  functionStatus = assertChromiumNeverCertifiesScannerPass(target, functionStatus);

  const gateNote = physicalGateNote(target.physicalGate);
  const notes = [gateNote, target.notes].filter(Boolean).join(" ");

  const row: ProviderPreviewManifestRow = {
    uatId: target.uatId,
    tranche: PROVIDER_PREVIEW_TRANCHE,
    harness: "provider-preview",
    app: target.app,
    route: target.route,
    state: target.state,
    role: target.persona,
    viewport: viewport.label,
    device: target.device,
    baselineSha: target.baselineSha,
    crawlBaseUrl: redactUrlForEvidence(normalizedBase),
    timestamp: new Date().toISOString(),
    blockClassification: null,
    visualStatus: uxEvidence.s0 ? "OBSERVED" : "NOT-TESTED",
    functionStatus,
    scannerAcceptanceStatus: scannerAcceptanceStatus(target),
    uxEvidence,
    uxEvidenceSha256,
    consoleErrors: consoleErrors.slice(0, 20),
    networkErrors: networkErrors.slice(0, 20),
    notes: notes || "Provider-preview software crawl complete.",
    screenshotPrimary: uxEvidence.s0 ?? "",
    screenshotSha256: uxEvidence.s0 ? uxEvidenceSha256.s0 ?? "" : "",
  };

  appendManifestRow(row);
  return row;
}

export function recordSecretPresenceAudit(): void {
  const names = ["TEST_AI_STUDIO_PREVIEW_URL", "TEST_TRACE_PREVIEW_URL"] as const;
  const payload = {
    generatedAt: new Date().toISOString(),
    harness: "provider-preview",
    policy: "Secret names only — values never logged.",
    secrets: names.map((name) => ({ name, present: Boolean(process.env[name]?.trim()) })),
  };
  ensureProviderPreviewOutputDir();
  writeSecretPresenceAudit(`${JSON.stringify(payload, null, 2)}\n`);
}
