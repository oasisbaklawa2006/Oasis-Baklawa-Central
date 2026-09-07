import { useCallback, useEffect, useRef, useState } from "react";
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

export function useCustomer360(companyId: string | undefined, options?: { salesExecutiveViewer?: boolean }) {
  const { companyId: viewerCompanyId, role, user } = useAuth();
  const [state, setState] = useState<Customer360LoadState>({ status: "idle" });
  const [refreshToken, setRefreshToken] = useState(0);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const requestSeq = ++requestSeqRef.current;

    async function load() {
      if (!companyId) {
        if (!cancelled && requestSeq === requestSeqRef.current) {
          setState({
            status: "identity_error",
            failure: "invalid_company_id",
            message: "Customer identity is required.",
          });
        }
        return;
      }

      if (!cancelled && requestSeq === requestSeqRef.current) {
        setState({ status: "loading" });
      }

      try {
        const model = await fetchCustomer360ReadModel(companyId, {
          viewerCompanyId,
          isStorefrontViewer: isStorefrontRole(role),
          viewerUserId: user?.id ?? null,
          isSalesExecutiveViewer: options?.salesExecutiveViewer ?? false,
        });
        if (cancelled || requestSeq !== requestSeqRef.current) return;
        setState({ status: "ready", model });
      } catch (error) {
        if (cancelled || requestSeq !== requestSeqRef.current) return;
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
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [companyId, role, viewerCompanyId, refreshToken, options?.salesExecutiveViewer, user?.id]);

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  return { state, refresh };
}
