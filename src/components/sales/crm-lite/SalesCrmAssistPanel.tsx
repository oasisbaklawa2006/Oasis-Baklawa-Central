import { Link } from "react-router-dom";
import ClientInteractionsTab from "@/components/sales/ClientInteractionsTab";
import { Button } from "@/components/ui/button";
import { salesCustomer360RouteForCompany } from "@/lib/customer-360/customer360Identity";
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
          Log calls, WhatsApp, visits, notes and promises against your assigned roster. Interactions write to the governed
          <code className="mx-1 rounded bg-muted px-1">client_interactions</code> timeline scoped to your executive identity.
        </p>
        {focusCompany && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-primary">
              Assisting: {focusCompany.business_name}
            </p>
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link to={salesCustomer360RouteForCompany(focusCompany.id)} data-testid="sales-customer360-link">
                Open Customer 360
              </Link>
            </Button>
          </div>
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
