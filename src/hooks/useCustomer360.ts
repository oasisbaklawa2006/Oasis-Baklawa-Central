import { useCallback, useEffect, useState } from "react";
import { isStorefrontRole } from "@/lib/auth-routing";
import { useAuth } from "@/hooks/useAuth";
import { Customer360IdentityError } from "@/lib/customer-360/customer360Identity";
import { fetchCustomer360ReadModel } from "@/lib/customer-360/customer360ReadModel";
import type { Customer360IdentityFailure, Customer360ReadModel } from "@/lib/customer-360/customer360Types";

export type Customer360LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; model: Customer360ReadModel }
  | { status: "identity_error"; failure: Customer360IdentityFailure; message: string }
  | { status: "error"; message: string };

export function useCustomer360(companyId: string | undefined) {
  const { companyId: viewerCompanyId, role } = useAuth();
  const [state, setState] = useState<Customer360LoadState>({ status: "idle" });

  const refresh = useCallback(async () => {
    if (!companyId) {
      setState({
        status: "identity_error",
        failure: "invalid_company_id",
        message: "Customer identity is required.",
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const model = await fetchCustomer360ReadModel(companyId, {
        viewerCompanyId,
        isStorefrontViewer: isStorefrontRole(role),
      });
      setState({ status: "ready", model });
    } catch (error) {
      if (error instanceof Customer360IdentityError) {
        setState({
          status: "identity_error",
          failure: error.failure,
          message: error.message,
        });
        return;
      }
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Customer 360 read failed.",
      });
    }
  }, [companyId, role, viewerCompanyId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { state, refresh };
}
