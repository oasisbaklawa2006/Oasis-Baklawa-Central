import ClientInteractionsTab from "@/components/sales/ClientInteractionsTab";
import type { CrmLiteCompany } from "@/lib/crm-lite/salesCrmLiteTypes";

interface Props {
  companies: CrmLiteCompany[];
  userId: string;
  focusCompanyId?: string | null;
}

/** Point 74 — CRM-lite sales assistance surface on the sales executive console. */
export default function SalesCrmAssistPanel({ companies, userId, focusCompanyId }: Props) {
  const focusCompany = focusCompanyId ? companies.find((c) => c.id === focusCompanyId) : null;

  return (
    <div className="space-y-4" data-point="74" data-testid="sales-crm-assist-panel">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground">CRM-lite sales assistance</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Log calls, WhatsApp, visits and notes against your assigned roster. Interactions write to the governed
          <code className="mx-1 rounded bg-muted px-1">client_interactions</code> timeline scoped by
          <code className="mx-1 rounded bg-muted px-1">companies.account_manager_id</code>.
        </p>
        {focusCompany && (
          <p className="mt-2 text-xs font-medium text-primary">
            Assisting: {focusCompany.business_name}
          </p>
        )}
      </div>

      <ClientInteractionsTab
        companies={companies}
        userId={userId}
        initialFilterCompanyId={focusCompanyId ?? undefined}
        scopeExecutiveId={userId}
      />
    </div>
  );
}
