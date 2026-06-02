import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientResolutionInput,
  ClientResolutionResult,
  ClientResolutionScoreReason,
  CompanyResolutionRow,
  OwnerProfileRow,
} from "./clientResolutionTypes";
import { extractClientResolutionTextSignals } from "./clientResolutionSignals";
import {
  CLIENT_RESOLUTION_SIGNAL_WEIGHTS,
  scoreClientResolutionCandidates,
} from "./clientResolutionScoring";

const COMPANY_SELECT =
  "id, business_name, account_manager_id, phone, gst_number, status, registered_address";

function phoneLast10(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function dedupeCompanies(rows: CompanyResolutionRow[]): CompanyResolutionRow[] {
  const map = new Map<string, CompanyResolutionRow>();
  for (const row of rows) {
    if (!map.has(row.id)) map.set(row.id, row);
  }
  return [...map.values()];
}

async function loadOwnerProfiles(
  supabase: SupabaseClient,
  ownerIds: string[],
): Promise<Map<string, OwnerProfileRow>> {
  const uniqueIds = [...new Set(ownerIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, name")
    .in("id", uniqueIds);

  if (error || !data) return new Map();
  return new Map((data as OwnerProfileRow[]).map((row) => [row.id, row]));
}

async function queryCompaniesByName(
  supabase: SupabaseClient,
  term: string,
): Promise<CompanyResolutionRow[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .ilike("business_name", `%${term}%`)
    .limit(5);
  if (error || !data) return [];
  return data as CompanyResolutionRow[];
}

async function queryCompaniesByPhone(
  supabase: SupabaseClient,
  last10: string,
): Promise<CompanyResolutionRow[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .or(`phone.ilike.%${last10},gst_number.ilike.%${last10}%`)
    .limit(5);
  if (error || !data) return [];
  return data as CompanyResolutionRow[];
}

async function queryCompaniesByGst(
  supabase: SupabaseClient,
  gst: string,
): Promise<CompanyResolutionRow[]> {
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .eq("gst_number", gst)
    .limit(3);
  if (error || !data) return [];
  return data as CompanyResolutionRow[];
}

async function queryCompaniesByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<CompanyResolutionRow[]> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) return [];
  const { data, error } = await supabase
    .from("companies")
    .select(COMPANY_SELECT)
    .in("id", uniqueIds)
    .limit(10);
  if (error || !data) return [];
  return data as CompanyResolutionRow[];
}

async function queryCompaniesViaOrders(
  supabase: SupabaseClient,
  orderReference: string,
): Promise<CompanyResolutionRow[]> {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("company_id, order_number")
    .ilike("order_number", `%${orderReference}%`)
    .limit(3);
  if (error || !orders?.length) return [];
  const companyIds = orders
    .map((row) => row.company_id)
    .filter((id): id is string => Boolean(id));
  return queryCompaniesByIds(supabase, companyIds);
}

async function queryCompaniesViaB2bPhone(
  supabase: SupabaseClient,
  last10: string,
): Promise<CompanyResolutionRow[]> {
  const { data: apps, error } = await supabase
    .from("b2b_applications")
    .select("business_name")
    .or(`contact_phone.ilike.%${last10},mobile_number.ilike.%${last10}%`)
    .eq("status", "approved")
    .limit(3);
  if (error || !apps?.length) return [];

  const companies: CompanyResolutionRow[] = [];
  for (const app of apps) {
    const rows = await queryCompaniesByName(supabase, app.business_name);
    companies.push(...rows);
  }
  return companies;
}

async function queryCompaniesViaPortalUserPhone(
  supabase: SupabaseClient,
  last10: string,
): Promise<CompanyResolutionRow[]> {
  const { data: users, error } = await supabase
    .from("users")
    .select("company_id")
    .or(`phone.ilike.%${last10},mobile_number.ilike.%${last10}%`)
    .not("company_id", "is", null)
    .limit(3);
  if (error || !users?.length) return [];
  const companyIds = users
    .map((row) => row.company_id)
    .filter((id): id is string => Boolean(id));
  return queryCompaniesByIds(supabase, companyIds);
}

async function queryCompaniesViaDeliveryLocation(
  supabase: SupabaseClient,
  locationToken: string,
): Promise<CompanyResolutionRow[]> {
  const { data, error } = await supabase
    .from("delivery_addresses")
    .select("company_id, city, street_address")
    .or(`city.ilike.%${locationToken}%,street_address.ilike.%${locationToken}%`)
    .limit(5);
  if (error || !data?.length) return [];
  const companyIds = data
    .map((row) => row.company_id)
    .filter((id): id is string => Boolean(id));
  return queryCompaniesByIds(supabase, companyIds);
}

async function queryCompaniesViaShadowClients(
  supabase: SupabaseClient,
  term: string,
): Promise<CompanyResolutionRow[]> {
  const { data, error } = await supabase
    .from("shadow_clients")
    .select("extracted_business_name, promoted_to_company_id")
    .ilike("extracted_business_name", `%${term}%`)
    .limit(5);
  if (error || !data?.length) return [];

  const promotedIds = data
    .map((row) => row.promoted_to_company_id)
    .filter((id): id is string => Boolean(id));
  const promoted = await queryCompaniesByIds(supabase, promotedIds);

  const names = data
    .map((row) => row.extracted_business_name)
    .filter((name): name is string => Boolean(name));
  const byName: CompanyResolutionRow[] = [];
  for (const name of names.slice(0, 3)) {
    byName.push(...(await queryCompaniesByName(supabase, name)));
  }
  return dedupeCompanies([...promoted, ...byName]);
}

/**
 * Read-only client resolution for operator inbox (WA-04A).
 * SELECT-only queries; no ownership, order, or customer mutations.
 */
export async function resolveClientCandidates(
  supabase: SupabaseClient,
  input: ClientResolutionInput,
): Promise<ClientResolutionResult> {
  const signals = extractClientResolutionTextSignals(
    input.messageText,
    input.stitchedPlainText,
  );

  const senderIsEmployee = input.senderIdentity?.kind === "employee";
  const collected: CompanyResolutionRow[] = [];
  const additionalReasons = new Map<string, ClientResolutionScoreReason[]>();

  function noteReason(companyId: string, weight: number, reason: string): void {
    const list = additionalReasons.get(companyId) ?? [];
    list.push({ companyId, weight, reason });
    additionalReasons.set(companyId, list);
  }

  function absorb(rows: CompanyResolutionRow[]): void {
    collected.push(...rows);
  }

  for (const term of signals.nameCandidates.slice(0, 6)) {
    absorb(await queryCompaniesByName(supabase, term));
    absorb(await queryCompaniesViaShadowClients(supabase, term));
  }

  for (const gst of signals.gstNumbers) {
    absorb(await queryCompaniesByGst(supabase, gst));
  }

  for (const last10 of signals.phoneLast10) {
    absorb(await queryCompaniesByPhone(supabase, last10));
    absorb(await queryCompaniesViaB2bPhone(supabase, last10));
    absorb(await queryCompaniesViaPortalUserPhone(supabase, last10));
  }

  const senderLast10 = phoneLast10(input.senderPhone);
  if (senderLast10 && input.senderIdentity?.kind === "customer") {
    absorb(await queryCompaniesByPhone(supabase, senderLast10));
    absorb(await queryCompaniesViaPortalUserPhone(supabase, senderLast10));
  }

  for (const orderRef of signals.orderReferences.slice(0, 3)) {
    const orderCompanies = await queryCompaniesViaOrders(supabase, orderRef);
    absorb(orderCompanies);
    for (const company of orderCompanies) {
      noteReason(
        company.id,
        CLIENT_RESOLUTION_SIGNAL_WEIGHTS.orderReference,
        `Previous order reference "${orderRef}" linked to company`,
      );
    }
  }

  for (const location of signals.locationTokens.slice(0, 3)) {
    absorb(await queryCompaniesViaDeliveryLocation(supabase, location));
  }

  const companies = dedupeCompanies(collected);
  const ownerProfiles = await loadOwnerProfiles(
    supabase,
    companies.map((company) => company.account_manager_id).filter((id): id is string => Boolean(id)),
  );

  let result = scoreClientResolutionCandidates({
    signals,
    companies,
    ownerProfiles,
    waCustomerName: input.waCustomerName,
    waCompanyName: input.waCompanyName,
    senderIsEmployee,
    additionalReasons,
  });

  return result;
}

export async function fetchClientResolution(
  supabase: SupabaseClient,
  input: ClientResolutionInput,
): Promise<ClientResolutionResult> {
  return resolveClientCandidates(supabase, input);
}
