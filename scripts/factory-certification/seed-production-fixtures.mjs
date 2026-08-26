#!/usr/bin/env node
/**
 * Deterministic Production-TV fixtures for the disposable local Factory
 * certification database. This script refuses every non-loopback Supabase host.
 * It uses service_role only during local bootstrap, never in browser tests.
 */

const baseUrl = process.env.FACTORY_CERT_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY?.trim();
if (!baseUrl || !serviceRoleKey) {
  throw new Error("FACTORY_CERT_SUPABASE_URL and FACTORY_CERT_LOCAL_SERVICE_ROLE_KEY are required");
}

const parsedBase = new URL(baseUrl);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(parsedBase.hostname)) {
  throw new Error(`Fixture seeding is local-only; refusing Supabase host ${parsedBase.hostname}`);
}

async function request(path, { method = "GET", body, prefer } = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} -> HTTP ${response.status}: ${text.slice(0, 800)}`);
  }
  return text ? JSON.parse(text) : null;
}

const products = [
  {
    id: "20000000-0000-4000-8000-000000000101",
    name: "Factory Cert Arabic Baklawa",
    category: "sweets",
    sku: "CERT-ARABIC-001",
    hsn_code: "1905",
    production_department: "arabic_sweets",
  },
  {
    id: "20000000-0000-4000-8000-000000000102",
    name: "Factory Cert Chocolate",
    category: "chocolates",
    sku: "CERT-CHOC-001",
    hsn_code: "1806",
    production_department: "chocolates_confectionery",
  },
  {
    id: "20000000-0000-4000-8000-000000000103",
    name: "Factory Cert Fusion Sweet",
    category: "sweets",
    sku: "CERT-FUSION-001",
    hsn_code: "1905",
    production_department: "fusion_sweets",
  },
  {
    id: "20000000-0000-4000-8000-000000000104",
    name: "Factory Cert Bakery",
    category: "bakery",
    sku: "CERT-BAKERY-001",
    hsn_code: "1905",
    production_department: "bakery",
  },
  {
    id: "20000000-0000-4000-8000-000000000105",
    name: "Factory Cert Nuts",
    category: "nuts",
    sku: "CERT-NUTS-001",
    hsn_code: "2008",
    production_department: "seasoned_nuts_mixes",
  },
];

await request("/rest/v1/products?on_conflict=id", {
  method: "POST",
  prefer: "resolution=merge-duplicates,return=minimal",
  body: products,
});

const jobs = [
  {
    id: "e3ed28b0-0000-4000-8000-000000000001",
    product_id: products[0].id,
    department: "ARABIC_SWEETS",
    assigned_qty: 6,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-arabic",
  },
  {
    id: "c0c0a7e1-0000-4000-8000-000000000002",
    product_id: products[1].id,
    department: "CHOCOLATES_CONFECTIONERY",
    assigned_qty: 7,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-chocolate",
  },
  {
    id: "f0510a01-0000-4000-8000-000000000003",
    product_id: products[2].id,
    department: "FUSION_SWEETS",
    assigned_qty: 8,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-fusion",
  },
  {
    id: "ba4e0001-0000-4000-8000-000000000004",
    product_id: products[3].id,
    department: "BAKERY",
    assigned_qty: 9,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-bakery",
  },
  {
    id: "a0750001-0000-4000-8000-000000000005",
    product_id: products[4].id,
    department: "SEASONED_NUTS_MIXES",
    assigned_qty: 10,
    produced_qty: 0,
    priority: "normal",
    status: "pending",
    stage: "prep",
    correlation_id: "factory-cert-production-nuts",
  },
];

await request("/rest/v1/production_jobs?on_conflict=id", {
  method: "POST",
  prefer: "resolution=merge-duplicates,return=representation",
  body: jobs,
});

const seeded = await request(
  "/rest/v1/production_jobs?correlation_id=like.factory-cert-production-*&select=id,canonical_department,status,assigned_qty,produced_qty,priority,correlation_id&order=correlation_id.asc",
);
if (!Array.isArray(seeded) || seeded.length !== jobs.length) {
  throw new Error(`Expected ${jobs.length} seeded Production jobs; got ${Array.isArray(seeded) ? seeded.length : "invalid response"}`);
}

const expectedDepartments = new Set([
  "ARABIC_SWEETS",
  "CHOCOLATES_CONFECTIONERY",
  "FUSION_SWEETS",
  "BAKERY",
  "SEASONED_NUTS_MIXES",
]);
for (const row of seeded) {
  if (!expectedDepartments.has(String(row.canonical_department))) {
    throw new Error(`Seeded job ${row.id} has unexpected canonical department ${row.canonical_department}`);
  }
  if (row.status !== "pending" || row.priority !== "normal") {
    throw new Error(`Seeded job ${row.id} did not retain pending/normal fixture state`);
  }
}

const golden = seeded.find((row) => String(row.id).slice(0, 8).toUpperCase() === "E3ED28B0");
if (!golden || Number(golden.assigned_qty) !== 6 || Number(golden.produced_qty ?? 0) !== 0) {
  throw new Error("Golden E3ED28B0 fixture was not seeded with assigned=6 / produced=0");
}

console.log(`Seeded ${seeded.length} deterministic Production-TV jobs; golden short id E3ED28B0 is present.`);
