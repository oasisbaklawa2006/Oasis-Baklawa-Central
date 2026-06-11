#!/usr/bin/env node
/**
 * Read-only usability wave audit — routes, Batch 001 catalogue, images.
 * No writes. Uses anon Supabase key from .env.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const envText = readFileSync(join(ROOT, ".env"), "utf8");
const env = Object.fromEntries(
  envText
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      const k = l.slice(0, i);
      const v = l.slice(i + 1).replace(/^"|"$/g, "");
      return [k, v];
    }),
);

const SUPABASE_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
const APP_URL = process.env.APP_URL || "http://127.0.0.1:5173";
const LIVE_URL = process.env.LIVE_APP_URL || "https://b2b.oasisbaklawa.com";

const BATCH001_SKUS = [
  "OAS-AS-BKL-0001", "OAS-AS-BKL-0002", "OAS-AS-BKL-0003", "OAS-AS-BKL-0004", "OAS-AS-BKL-0005",
  "OAS-AS-BKL-0006", "OAS-AS-BKL-0007", "OAS-AS-BKL-0008", "OAS-AS-BKL-0009", "OAS-AS-BKL-0010",
  "OAS-AS-BKL-0011", "OAS-AS-BKL-0012", "OAS-AS-BKL-0013", "OAS-AS-BKL-0014", "OAS-AS-BKL-0015",
  "OAS-AS-BKL-0016", "OAS-AS-BKL-0017", "OAS-AS-BKL-0018", "OAS-AS-BKL-0019", "OAS-AS-BKL-0020",
  "OAS-AS-BKL-0021", "OAS-AS-BKL-0022", "OAS-AS-BKL-0023", "OAS-AS-BKL-0024", "OAS-AS-BKL-0025",
];

/** Routes declared in src/App.tsx (static paths only). */
const APP_ROUTES = [
  "/splash", "/intro", "/track", "/operations-controller", "/security-gate", "/",
  "/home", "/welcome", "/catalogue", "/quick-order", "/product/1", "/login", "/register",
  "/onboarding", "/reset-password", "/buyer-portal", "/cart", "/orders", "/orders/1",
  "/dashboard", "/account", "/favorites", "/account/users", "/account/addresses",
  "/account/logistics", "/documents", "/faq", "/terms", "/privacy", "/shipping",
  "/approval-pending", "/admin", "/admin/clients", "/admin/approvals", "/admin/products",
  "/admin/pricing", "/admin/orders", "/admin/production", "/admin/operations",
  "/admin/packing-dispatch", "/admin/accounts-release", "/admin/exceptions", "/admin/dispatch",
  "/admin/finance", "/admin/finance-board", "/admin/finance-governance", "/admin/users",
  "/admin/moq", "/admin/currency", "/admin/support", "/admin/operator-inbox", "/admin/whatsapp",
  "/admin/settings", "/admin/audit", "/admin/department", "/admin/inventory", "/admin/logistics",
  "/admin/sales-hub", "/admin/notifications", "/admin/heartbeat", "/admin/display-management",
  "/admin/merchandising", "/admin/catalogue-sync", "/admin/catalogue-approvals",
  "/admin/order-management", "/admin/central-pool", "/admin/cmd-war-room",
  "/admin/inventory-command-center", "/admin/carton-explorer", "/admin/reservation-board",
  "/admin/inventory-risk-board", "/admin/scan-timeline", "/admin/assembly-tasks",
  "/admin/assembly-tv", "/admin/ready-goods", "/admin/store-coordination",
  "/admin/label-command-center", "/admin/customer-timeline-preview", "/admin/operational-search",
  "/admin/live-work-queues", "/admin/entity-graph-explorer", "/admin/queue-execution-preview",
  "/admin/barcode-execution-preview", "/admin/product-intelligence-prototype",
  "/admin/execution-command-center", "/admin/execution-risk", "/admin/execution-bottlenecks",
  "/admin/execution/production", "/admin/execution/assembly", "/admin/execution/ready-goods",
  "/admin/execution/dispatch", "/admin/execution/third-party", "/admin/execution/retail",
  "/admin/execution/complaints", "/admin/rgs-tv", "/admin/golden-chain-operator",
  "/admin/dispatch-readiness", "/admin/dispatch-completion", "/admin/dispatch-finalization",
  "/admin/stock-finalization", "/admin/dispatch-mgmt", "/admin/dispatch-tv",
  "/admin/target-vs-actual", "/admin/3pcs-store", "/admin/verification", "/admin/announcements",
  "/sales/dashboard",
];

/** Ghost routes referenced in old audits but NOT in App.tsx */
const GHOST_ROUTES = [
  "/admin/customers", "/admin/assembly", "/admin/finance/payments", "/admin/finance/invoices",
  "/admin/crm", "/admin/roles",
];

async function supabaseSelect(table, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${query}`;
  const res = await fetch(url, {
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function checkRoute(base, route) {
  const url = `${base}${route}`;
  try {
    const res = await fetch(url, { redirect: "manual" });
    const status = res.status;
    const loc = res.headers.get("location") || null;
    const body = status === 200 ? await res.text() : "";
    const hasRoot = body.includes('id="root"') || body.includes('id="root"');
    const isSpaShell = status === 200 && hasRoot;
    const isRedirect = status >= 300 && status < 400;
    return { route, status, location: loc, ok: isSpaShell || isRedirect || status === 200, isSpaShell, isRedirect };
  } catch (e) {
    return { route, status: 0, error: String(e), ok: false };
  }
}

async function headImage(url) {
  if (!url) return { ok: false, reason: "no_url" };
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}

async function main() {
  const outDir = join(ROOT, "audit-notes");
  mkdirSync(outDir, { recursive: true });

  console.log("=== Route smoke (local SPA shell) ===");
  const localRoutes = [];
  for (const route of APP_ROUTES) {
    const r = await checkRoute(APP_URL, route);
    localRoutes.push(r);
    if (!r.ok) console.log("FAIL local", route, r.status, r.error || r.location || "");
  }
  const localBroken = localRoutes.filter((r) => !r.ok);

  console.log("\n=== Ghost route check (should 200 SPA or redirect, not 404 from host) ===");
  const ghostResults = [];
  for (const route of GHOST_ROUTES) {
    const r = await checkRoute(LIVE_URL, route);
    ghostResults.push(r);
    console.log(route, r.status, r.isSpaShell ? "SPA" : r.location || "");
  }

  console.log("\n=== Batch 001 catalogue (read-only Supabase) ===");
  const skuFilter = BATCH001_SKUS.map((s) => `sku.eq.${s}`).join(",");
  const products = await supabaseSelect(
    "products",
    `select=id,sku,name,image_url,visible_in_catalog,is_active,category,sub_category&or=(${skuFilter})`,
  );

  const aliasRows = await supabaseSelect(
    "product_aliases",
    `select=product_id,alias_text&limit=5000`,
  );

  const aliasByProduct = new Map();
  for (const row of aliasRows) {
    const n = aliasByProduct.get(row.product_id) || 0;
    aliasByProduct.set(row.product_id, n + 1);
  }

  const batchAudit = [];
  for (const sku of BATCH001_SKUS) {
    const p = products.find((x) => x.sku === sku);
    if (!p) {
      batchAudit.push({ sku, found: false });
      continue;
    }
    const imgCheck = await headImage(p.image_url);
    batchAudit.push({
      sku,
      name: p.name,
      found: true,
      visible_in_catalog: p.visible_in_catalog,
      is_active: p.is_active,
      has_image_url: Boolean(p.image_url),
      image_reachable: imgCheck.ok,
      image_status: imgCheck.status ?? imgCheck.reason,
      alias_count: aliasByProduct.get(p.id) || 0,
      product_id: p.id,
      public_link: `${LIVE_URL}/product/${p.id}`,
    });
  }

  const missingImages = batchAudit.filter((r) => r.found && !r.has_image_url);
  const brokenImages = batchAudit.filter((r) => r.found && r.has_image_url && !r.image_reachable);
  const hiddenFromCatalog = batchAudit.filter((r) => r.found && !r.visible_in_catalog);
  const notFound = batchAudit.filter((r) => !r.found);

  console.log(`Batch001: ${products.length}/25 found, ${missingImages.length} missing images, ${hiddenFromCatalog.length} hidden`);

  console.log("\n=== Product aliases count ===");
  let aliasCountRes;
  try {
    const rows = await supabaseSelect("product_aliases", "select=id&status=eq.approved&limit=1");
    const countHdr = await fetch(`${SUPABASE_URL}/rest/v1/product_aliases?select=id`, {
      method: "HEAD",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, Prefer: "count=exact" },
    });
    aliasCountRes = countHdr.headers.get("content-range");
  } catch (e) {
    aliasCountRes = String(e);
  }

  console.log("\n=== WhatsApp packets (read-only sample) ===");
  let waPackets = [];
  try {
    waPackets = await supabaseSelect(
      "whatsapp_packets",
      "select=id,phone_number,customer_name,status,last_message_at&order=last_message_at.desc&limit=3",
    );
  } catch (e) {
    console.log("whatsapp_packets:", e.message);
  }

  const report = {
    generated_at: new Date().toISOString(),
    app_url_local: APP_URL,
    app_url_live: LIVE_URL,
    routes: {
      tested: APP_ROUTES.length,
      local_broken: localBroken,
      ghost_routes: ghostResults,
    },
    batch001: {
      products_found: products.length,
      not_found_skus: notFound.map((r) => r.sku),
      missing_images: missingImages.map((r) => r.sku),
      broken_image_urls: brokenImages,
      hidden_from_catalog: hiddenFromCatalog.map((r) => ({ sku: r.sku, name: r.name })),
      rows: batchAudit,
    },
    product_aliases_content_range: aliasCountRes,
    whatsapp_packets_sample_count: waPackets.length,
  };

  const outPath = join(outDir, "usability-wave-audit.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\nWrote", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
