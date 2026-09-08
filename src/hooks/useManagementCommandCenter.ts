import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  buildManagementCommandCenterProjection,
  fetchCoreFinance255CollectionsSnapshot,
  type ManagementCommandCenterProjection,
} from "@/lib/management-reporting";
import type { UserFactRow } from "@/lib/management-reporting/operationalMetricsProjection";
import type { ProductComplianceRow } from "@/lib/management-reporting/eanComplianceRegistry";
import { hasModuleAccess, getAllowedModulesForRole } from "@/lib/appverse/roleAccess";
import { useAuth } from "@/hooks/useAuth";

export interface ManagementCommandCenterFilters {
  periodStart: string;
  periodEnd: string;
  eanSearch: string;
  eanPage: number;
  eanPageSize: number;
  tallyCompanyId: string | null;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_ORDERS = 5000;
const MAX_ORDER_ITEMS = 10000;
const MAX_COMPANIES = 2000;
const MAX_USERS = 500;
const MAX_PRODUCTS = 2000;
const MAX_LEDGER_DISPUTES = 500;

function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  return {
    start: startOfMonth(now).toISOString(),
    end: endOfMonth(now).toISOString(),
  };
}

export function useManagementCommandCenter() {
  const { role } = useAuth();
  const allowedModules = getAllowedModulesForRole(role);
  const canViewFinance =
    hasModuleAccess(allowedModules, "finance") ||
    hasModuleAccess(allowedModules, "finance_audit") ||
    hasModuleAccess(allowedModules, "management_reporting");

  const period = defaultPeriod();
  const [filters, setFilters] = useState<ManagementCommandCenterFilters>({
    periodStart: period.start,
    periodEnd: period.end,
    eanSearch: "",
    eanPage: 0,
    eanPageSize: DEFAULT_PAGE_SIZE,
    tallyCompanyId: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState<ManagementCommandCenterProjection | null>(null);
  const [eanTotal, setEanTotal] = useState(0);
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: string; label: string }>>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        ordersRes,
        orderItemsRes,
        companiesRes,
        usersRes,
        productsRes,
        slaRes,
        disputesRes,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, status, payment_status, sales_order_value, advance_paid, advance_required, company_id, created_at",
            { count: "exact" },
          )
          .limit(MAX_ORDERS),
        supabase
          .from("order_items")
          .select("order_id, product_id, quantity, products(name)", { count: "exact" })
          .limit(MAX_ORDER_ITEMS),
        supabase
          .from("companies")
          .select(
            "id, business_name, wallet_balance, credit_limit, allow_credit, is_frozen, fssai_number, gst_number, account_manager_id",
            { count: "exact" },
          )
          .limit(MAX_COMPANIES),
        supabase
          .from("users")
          .select("id, full_name, name", { count: "exact" })
          .limit(MAX_USERS),
        supabase
          .from("products")
          .select(
            "id, name, sku, barcode_sku, hsn_code, gst_percentage, allergen_warnings, ingredients, nutrition_facts, is_active",
            { count: "exact" },
          )
          .limit(MAX_PRODUCTS),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved")
          .lt("sla_resolution_due", new Date().toISOString()),
        supabase
          .from("ledger_disputes")
          .select("id, status, ledger:bi_monthly_ledgers(total_amount)", { count: "exact" })
          .limit(MAX_LEDGER_DISPUTES),
      ]);

      if (ordersRes.error) throw new Error(ordersRes.error.message);
      if (companiesRes.error) throw new Error(companiesRes.error.message);

      const sourceReadWarnings: string[] = [];
      for (const [label, res] of [
        ["order_items", orderItemsRes],
        ["users", usersRes],
        ["products", productsRes],
        ["support_tickets", slaRes],
        ["ledger_disputes", disputesRes],
      ] as const) {
        if (res.error) {
          sourceReadWarnings.push(`${label} read failed: ${res.error.message}`);
        }
      }
      if (ordersRes.count != null && ordersRes.count > MAX_ORDERS) {
        sourceReadWarnings.push(
          `orders read truncated at ${MAX_ORDERS} of ${ordersRes.count} rows — totals may understate`,
        );
      }
      if (orderItemsRes.count != null && orderItemsRes.count > MAX_ORDER_ITEMS) {
        sourceReadWarnings.push(
          `order_items read truncated at ${MAX_ORDER_ITEMS} of ${orderItemsRes.count} rows — rankings may understate`,
        );
      }
      if (companiesRes.count != null && companiesRes.count > MAX_COMPANIES) {
        sourceReadWarnings.push(
          `companies read truncated at ${MAX_COMPANIES} of ${companiesRes.count} rows — credit metrics may understate`,
        );
      }
      if (usersRes.count != null && usersRes.count > MAX_USERS) {
        sourceReadWarnings.push(
          `users read truncated at ${MAX_USERS} of ${usersRes.count} rows — salesperson names may be incomplete`,
        );
      }
      if (productsRes.count != null && productsRes.count > MAX_PRODUCTS) {
        sourceReadWarnings.push(
          `products read truncated at ${MAX_PRODUCTS} of ${productsRes.count} rows — EAN/compliance may understate`,
        );
      }
      if (disputesRes.count != null && disputesRes.count > MAX_LEDGER_DISPUTES) {
        sourceReadWarnings.push(
          `ledger_disputes read truncated at ${MAX_LEDGER_DISPUTES} of ${disputesRes.count} rows — disputed totals may understate`,
        );
      }

      const ordersTruncated = ordersRes.count != null && ordersRes.count > MAX_ORDERS;
      const orderItemsTruncated =
        orderItemsRes.count != null && orderItemsRes.count > MAX_ORDER_ITEMS;
      const companiesTruncated =
        companiesRes.count != null && companiesRes.count > MAX_COMPANIES;
      const usersTruncated = usersRes.count != null && usersRes.count > MAX_USERS;
      const productsTruncated = productsRes.count != null && productsRes.count > MAX_PRODUCTS;
      const disputesTruncated =
        disputesRes.count != null && disputesRes.count > MAX_LEDGER_DISPUTES;

      const orderItemsFailed = Boolean(orderItemsRes.error);
      const usersFailed = Boolean(usersRes.error);
      const productsFailed = Boolean(productsRes.error);
      const slaFailed = Boolean(slaRes.error);
      const disputesFailed = Boolean(disputesRes.error);

      const orders = (ordersRes.data ?? []) as Array<{
        id: string;
        status: string;
        payment_status: string | null;
        sales_order_value: number | null;
        advance_paid: number | null;
        advance_required: number | null;
        company_id: string | null;
        created_at: string | null;
      }>;

      const orderItems = orderItemsFailed
        ? []
        : (orderItemsRes.data ?? []).map((row) => {
            const products = row.products as { name?: string | null } | null;
            return {
              order_id: row.order_id as string,
              product_id: row.product_id as string | null,
              quantity: row.quantity as number | null,
              product_name: products?.name ?? null,
            };
          });

      const companies = (companiesRes.data ?? []) as Array<{
        id: string;
        business_name: string | null;
        wallet_balance: number | null;
        credit_limit: number | null;
        allow_credit: boolean | null;
        is_frozen: boolean | null;
        fssai_number: string | null;
        gst_number: string | null;
        account_manager_id: string | null;
      }>;

      const disputes = disputesFailed
        ? []
        : ((disputesRes.data ?? []) as Array<{
            id: string;
            status: string | null;
            ledger: { total_amount: number | null } | null;
          }>);
      const openDisputes = disputes.filter((d) => d.status !== "resolved");
      const disputedOrHeldAmount = disputesFailed
        ? 0
        : openDisputes.reduce((s, d) => s + (d.ledger?.total_amount ?? 0), 0);

      let coreFinance255 = null;
      let coreFinanceWarnings: string[] = [];
      if (canViewFinance) {
        const unpaidOrderIds = orders
          .filter(
            (o) =>
              o.payment_status !== "paid" &&
              !["draft", "cart", "cancelled"].includes(o.status),
          )
          .map((o) => o.id);
        coreFinance255 = await fetchCoreFinance255CollectionsSnapshot({
          unpaidOrderIds,
          recoveryOrderIds: orders.map((o) => o.id),
          periodStartIso: filters.periodStart,
          periodEndIso: filters.periodEnd,
        });
        coreFinanceWarnings = [...coreFinance255.warnings, ...sourceReadWarnings];
      } else {
        coreFinanceWarnings = sourceReadWarnings;
      }

      const built = buildManagementCommandCenterProjection({
        orders,
        orderItems,
        companies: companies.map((c) => ({
          id: c.id,
          business_name: c.business_name,
          account_manager_id: c.account_manager_id,
        })),
        companyCredit: companies,
        users: usersFailed
          ? []
          : (usersRes.data ?? []).map(
              (user): UserFactRow => ({
                id: user.id,
                full_name: user.full_name,
                name: user.name,
              }),
            ),
        products: productsFailed
          ? []
          : ((productsRes.data ?? []) as ProductComplianceRow[]),
        companyCompliance: companies.map((c) => ({
          id: c.id,
          business_name: c.business_name,
          fssai_number: c.fssai_number,
          gst_number: c.gst_number,
        })),
        slaBreachedSupportCount: slaFailed ? null : (slaRes.count ?? 0),
        disputedLedgerCount: disputesFailed ? null : openDisputes.length,
        disputedOrHeldAmount,
        disputedOrHeldUnavailable: disputesFailed || disputesTruncated,
        disputedOrHeldBlocker: disputesFailed
          ? (disputesRes.error?.message ?? "ledger_disputes read failed")
          : disputesTruncated
            ? "ledger_disputes read truncated — partial dataset"
            : undefined,
        periodStartIso: filters.periodStart,
        periodEndIso: filters.periodEnd,
        eanSearchQuery: filters.eanSearch,
        eanOffset: filters.eanPage * filters.eanPageSize,
        eanLimit: filters.eanPageSize,
        includeFinance: canViewFinance,
        coreFinance255,
        coreFinanceWarnings,
        sourceReadWarnings,
        rankingsUnavailable: orderItemsFailed,
        bestSellersUnavailable: orderItemsFailed || orderItemsTruncated || ordersTruncated,
        bestClientsUnavailable: ordersTruncated,
        salespeopleRankingsUnavailable:
          usersFailed || usersTruncated || ordersTruncated,
        operationalDataUnavailable: ordersTruncated,
        complianceDataUnavailable: productsFailed,
        ordersTruncated,
        companiesTruncated,
        productsTruncated,
        disputesTruncated,
      });

      setProjection(built);
      setEanTotal(built.eanRegistryTotal);
      setCompanyOptions(
        companies
          .map((c) => ({ id: c.id, label: c.business_name ?? c.id.slice(0, 8) }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load management reporting");
      setProjection(null);
    } finally {
      setLoading(false);
    }
  }, [canViewFinance, filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const periodLabel = useMemo(() => {
    try {
      return `${format(new Date(filters.periodStart), "dd MMM yyyy")} – ${format(
        new Date(filters.periodEnd),
        "dd MMM yyyy",
      )}`;
    } catch {
      return "Selected period";
    }
  }, [filters.periodStart, filters.periodEnd]);

  const setPeriodPreset = useCallback((preset: "this_month" | "last_month" | "last_3_months") => {
    const now = new Date();
    if (preset === "this_month") {
      setFilters((f) => ({
        ...f,
        periodStart: startOfMonth(now).toISOString(),
        periodEnd: endOfMonth(now).toISOString(),
      }));
      return;
    }
    if (preset === "last_month") {
      const last = subMonths(now, 1);
      setFilters((f) => ({
        ...f,
        periodStart: startOfMonth(last).toISOString(),
        periodEnd: endOfMonth(last).toISOString(),
      }));
      return;
    }
    setFilters((f) => ({
      ...f,
      periodStart: startOfMonth(subMonths(now, 2)).toISOString(),
      periodEnd: endOfMonth(now).toISOString(),
    }));
  }, []);

  return {
    loading,
    error,
    projection,
    refresh,
    filters,
    setFilters,
    periodLabel,
    setPeriodPreset,
    canViewFinance,
    eanTotal,
    companyOptions,
  };
}
