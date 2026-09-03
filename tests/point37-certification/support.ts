import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";
import {
  createAuthenticatedCertificationClient,
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
  loginToFactoryCertificationTarget,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationTarget,
} from "../factory-certification/support";

export type Point37CertStage = {
  stage: string;
  status: "PASS" | "FAIL" | "SKIP";
  detail: string;
};

export type Point37CertEvidence = {
  schema_version: 1;
  point: 37;
  scope: "governed_production_release";
  status: "PASS" | "FAIL";
  commit_sha: string;
  target_url: string;
  order_id: string | null;
  order_status_before: string | null;
  order_status_after: string | null;
  stages: Point37CertStage[];
};

export function hasPoint37CertificationEnv(): boolean {
  return hasFactoryCertificationTarget() && hasFactoryCertificationBackend();
}

export function requirePoint37CertificationEnv(): void {
  if (!hasPoint37CertificationEnv()) {
    throw new Error(
      "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL and FACTORY_CERT_SUPABASE_URL / FACTORY_CERT_SUPABASE_ANON_KEY",
    );
  }
}

export function resolvePoint37CertOrderId(): string | null {
  return process.env.POINT37_CERT_ORDER_ID?.trim() || null;
}

export async function loginPoint37FinanceActor(page: Page) {
  const credentials = readFactoryCertificationCredentials("FINANCE");
  if (!credentials) {
    throw new Error("CREDENTIAL_REQUIRED: FACTORY_CERT_FINANCE_EMAIL + FACTORY_CERT_FINANCE_PASSWORD");
  }
  await loginToFactoryCertificationTarget(page, credentials);
  return credentials;
}

export async function readOrderStatus(page: Page, orderId: string): Promise<string | null> {
  const { client } = await createAuthenticatedCertificationClient(page);
  const { data, error } = await client.from("orders").select("status").eq("id", orderId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.status ?? null;
}

export async function invokeGovernedProductionRelease(page: Page, orderId: string) {
  const { client } = await createAuthenticatedCertificationClient(page);
  const { data, error } = await client.rpc("release_order_to_in_production_v1", { p_order_id: orderId });
  if (error) throw new Error(error.message);
  return data;
}

export function writePoint37Evidence(
  evidence: Point37CertEvidence,
  filename = "point37-governed-production-release.json",
) {
  const dir = resolve(process.cwd(), "docs/evidence/point37");
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, filename), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export { resolveFactoryCertificationTarget };
