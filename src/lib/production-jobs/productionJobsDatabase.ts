import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

/**
 * Central's generated Supabase snapshot predates Core migration
 * 20260817090000_rgs_department_taxonomy.sql, which adds the governed,
 * trigger-maintained `production_jobs.canonical_department` column.
 *
 * Keep this narrowly-scoped type overlay until the generated snapshot is
 * refreshed from the canonical Core schema. This is a type-only bridge: it
 * does not alter runtime schema, migrations, RLS, or write authority.
 */
type ProductionJobsTable = Database["public"]["Tables"]["production_jobs"];

type ProductionJobsTableWithCanonicalDepartment = Omit<
  ProductionJobsTable,
  "Row" | "Insert" | "Update"
> & {
  Row: ProductionJobsTable["Row"] & { canonical_department: string | null };
  Insert: ProductionJobsTable["Insert"] & { canonical_department?: string | null };
  Update: ProductionJobsTable["Update"] & { canonical_department?: string | null };
};

export type DatabaseWithCanonicalProductionDepartment = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Database["public"]["Tables"], "production_jobs"> & {
      production_jobs: ProductionJobsTableWithCanonicalDepartment;
    };
  };
};

export const productionJobsDb = supabase as unknown as SupabaseClient<DatabaseWithCanonicalProductionDepartment>;
