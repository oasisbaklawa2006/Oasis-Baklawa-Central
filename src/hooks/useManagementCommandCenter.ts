import { useCallback, useEffect, useMemo, useState } from "react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import {
  buildManagementCommandCenterProjection,
  type ManagementCommandCenterProjection,
} from "@/lib/management-reporting";
import { hasModuleAccess, getAllowedModulesForRole } from "@/lib/appverse/roleAccess";
import { useAuth } from "@/hooks/useAuth";

export interface ManagementCommandCenterFilters {
  periodStart: string;
  periodEnd: string;
  eanSearch: string;
  eanPage: number;
  eanPageSize: number;
}

const DEFAULT_PAGE_SIZE = 50;

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
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projection, setProjection] = useState<ManagementCommandCenterProjection | null>(null);
  const [eanTotal, setEanTotal] = useState(0);

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
          )
          .limit(5000),
        supabase
          .from("order_items")
          .select("order_id, product_id, quantity, products(name)")
          .limit(10000),
        supabase
          .from("companies")
          .select(
            "id, business_name, wallet_balance, credit_limit, allow_credit, is_frozen, fssai_number, gst_number, account_manager_id",
          )
          .limit(2000),
        supabase
          .from("users")
          .select("id, full_name, name")
          .limit(500),
        supabase
          .from("products")
          .select(
            "id, name, sku, barcode_sku, hsn_code, gst_percentage, allergen_warnings, ingredients, nutrition_facts, is_active",
          )
          .limit(2000),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved")
          .lt("sla_resolution_due", new Date().toISOString()),
        supabase
          .from("ledger_disputes")
          .select("id, status, ledger:bi_monthly_ledgers(total_amount)")
          .limit(500),
      ]);

      if (ordersRes.error) throw new Error(ordersRes.error.message);
      if (companiesRes.error) throw new Error(companiesRes.error.message);

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

      const orderItems = (orderItemsRes.data ?? []).map((row) => {
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

      const disputes = (disputesRes.data ?? []) as Array<{
        id: string;
        status: string | null;
        ledger: { total_amount: number | null } | null;
      }>;
      const openDisputes = disputes.filter((d) => d.status !== "resolved");
      const disputedOrHeldAmount = openDisputes.reduce(
        (s, d) => s + (d.ledger?.total_amount ?? 0),
        0,
      );

      const built = buildManagementCommandCenterProjection({
        orders,
        orderItems,
        companies: companies.map((c) => ({
          id: c.id,
          business_name: c.business_name,
          account_manager_id: c.account_manager_id,
        })),
        companyCredit: companies,
        users: (usersRes.data ?? []) as Array<{
          id: string;
          full_name: string | null;
          name: string | null;
        }>,
        products: (productsRes.data ?? []) as Parameters<
          typeof buildManagementCommandCenterProjection
        >[0]["products"],
        companyCompliance: companies.map((c) => ({
          id: c.id,
          business_name: c.business_name,
          fssai_number: c.fssai_number,
          gst_number: c.gst_number,
        })),
        slaBreachedSupportCount: slaRes.count ?? 0,
        disputedLedgerCount: openDisputes.length,
        disputedOrHeldAmount,
        periodStartIso: filters.periodStart,
        periodEndIso: filters.periodEnd,
        eanSearchQuery: filters.eanSearch,
        eanOffset: filters.eanPage * filters.eanPageSize,
        eanLimit: filters.eanPageSize,
        includeFinance: canViewFinance,
      });

      setProjection(built);
      setEanTotal(
        built.complianceExceptions.filter((e) => e.category === "ean").length +
          built.eanRegistry.length,
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
  };
}
