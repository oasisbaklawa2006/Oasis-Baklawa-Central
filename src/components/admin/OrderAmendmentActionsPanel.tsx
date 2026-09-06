import { useCallback, useMemo, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  buildOrderChangeCorrelationId,
  buildOrderChangeDecisionIdentity,
  buildOrderChangeIdempotencyKey,
  getOrderAmendmentFacts,
  POINT75_CORE_PREREQUISITE,
  requestOrderAmendment,
  requestOrderCancellation,
  requestOrderSubstitution,
} from "@/lib/order-authority/orderAmendmentAuthorityClient";
import {
  isOrderChangeActionEligible,
  orderChangeActionDisabledReason,
} from "@/lib/order-authority/orderAmendmentEligibility";

type OrderAmendmentActionsPanelProps = {
  orderId: string;
  orderStatus: string;
  orderNumber?: string | null;
};

type TraceItem = {
  id: string;
  quantity: number;
  product: { name: string } | null;
};

/** Point 75 — governed amendment / cancellation / substitution boundary (Core RPC only). */
export function OrderAmendmentActionsPanel({
  orderId,
  orderStatus,
  orderNumber,
}: OrderAmendmentActionsPanelProps) {
  const [reason, setReason] = useState("");
  const [substituteProductId, setSubstituteProductId] = useState("");
  const [substituteQty, setSubstituteQty] = useState("1");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [items, setItems] = useState<TraceItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [submitting, setSubmitting] = useState<"amend" | "cancel" | "substitute" | null>(null);
  const [factsError, setFactsError] = useState<string | null>(null);

  const amendEligible = isOrderChangeActionEligible("amend", orderStatus);
  const cancelEligible = isOrderChangeActionEligible("cancel", orderStatus);
  const substituteEligible = isOrderChangeActionEligible("substitute", orderStatus);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    const { data, error } = await supabase
      .from("order_items")
      .select("id, quantity, product:products(name)")
      .eq("order_id", orderId);
    if (error) {
      toast.error("Failed to load order lines for governed change");
      setItems([]);
    } else {
      setItems((data ?? []) as TraceItem[]);
      if (!selectedItemId && data?.[0]?.id) setSelectedItemId(data[0].id);
    }
    setLoadingItems(false);
  }, [orderId, selectedItemId]);

  const submitGovernedChange = useCallback(
    async (action: "amend" | "cancel" | "substitute") => {
      const trimmedReason = reason.trim();
      if (trimmedReason.length < 3) {
        toast.error("A governed reason is required (minimum 3 characters).");
        return;
      }

      setSubmitting(action);
      setFactsError(null);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const actorId = authData.user?.id;
        if (!actorId) throw new Error("Authenticated operator is required for governed order change");

        const facts = await getOrderAmendmentFacts(orderId);
        const evidenceReference = `central-order-trace:${orderId}:${facts.commercialVersionId}`;
        const identity = buildOrderChangeDecisionIdentity({
          orderId,
          action,
          commercialVersionId: facts.commercialVersionId,
          expectedStatus: facts.orderStatus,
          reason: trimmedReason,
        });
        const correlationId = await buildOrderChangeCorrelationId(action, identity);
        const idempotencyKey = await buildOrderChangeIdempotencyKey(action, identity);
        const sourceReference = `order-trace:${orderNumber ?? orderId}`;

        if (action === "cancel") {
          await requestOrderCancellation({
            orderId,
            commercialVersionId: facts.commercialVersionId,
            expectedOrderStatus: facts.orderStatus,
            reason: trimmedReason,
            evidenceReference,
            sourceChannel: "CENTRAL",
            sourceReference,
            correlationId,
            idempotencyKey,
            actorId,
          });
          toast.success("Governed cancellation recorded via Core authority");
        } else if (action === "substitute") {
          if (!selectedItemId) throw new Error("Select an order line to substitute");
          if (!substituteProductId.trim()) throw new Error("Replacement product id is required");
          const qty = Number(substituteQty);
          if (!Number.isFinite(qty) || qty <= 0) throw new Error("Substitution quantity must be positive");

          await requestOrderSubstitution({
            orderId,
            commercialVersionId: facts.commercialVersionId,
            expectedOrderStatus: facts.orderStatus,
            orderItemId: selectedItemId,
            replacementProductId: substituteProductId.trim(),
            newQuantity: qty,
            reason: trimmedReason,
            evidenceReference,
            customerApprovalReference: null,
            sourceChannel: "CENTRAL",
            sourceReference,
            correlationId,
            idempotencyKey,
            actorId,
          });
          toast.success("Governed substitution recorded via Core authority");
        } else {
          if (!selectedItemId) throw new Error("Select an order line to amend");
          const line = items.find((item) => item.id === selectedItemId);
          if (!line) throw new Error("Selected line not found");

          await requestOrderAmendment({
            orderId,
            commercialVersionId: facts.commercialVersionId,
            expectedOrderStatus: facts.orderStatus,
            reason: trimmedReason,
            evidenceReference,
            lineChanges: [{ orderItemId: selectedItemId, newQuantity: line.quantity }],
            sourceChannel: "CENTRAL",
            sourceReference,
            correlationId,
            idempotencyKey,
            actorId,
          });
          toast.success("Governed amendment recorded via Core authority");
        }

        setReason("");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Governed order change failed";
        if (message.includes("Core prerequisite")) {
          setFactsError(POINT75_CORE_PREREQUISITE);
        }
        toast.error(message);
      } finally {
        setSubmitting(null);
      }
    },
    [items, orderId, orderNumber, reason, selectedItemId, substituteProductId, substituteQty],
  );

  const disabledHints = useMemo(
    () => ({
      amend: orderChangeActionDisabledReason("amend", orderStatus),
      cancel: orderChangeActionDisabledReason("cancel", orderStatus),
      substitute: orderChangeActionDisabledReason("substitute", orderStatus),
    }),
    [orderStatus],
  );

  return (
    <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-3" data-point="75">
      <div className="flex items-start gap-2">
        <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" aria-hidden />
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Governed order change (Point 75)
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Amendment, cancellation and substitution route only through Core RPC authority. No direct order or line
            mutation from Central.
          </p>
        </div>
      </div>

      {factsError && (
        <p className="rounded border border-amber-300/60 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          {factsError}
        </p>
      )}

      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Governed reason (required)"
        className="min-h-[72px] text-xs"
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!amendEligible || submitting !== null}
          title={disabledHints.amend || "Request governed amendment via Core"}
          onClick={() => {
            void loadItems().then(() => submitGovernedChange("amend"));
          }}
        >
          {submitting === "amend" ? <Loader2 size={14} className="animate-spin" /> : null}
          Amend line
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!cancelEligible || submitting !== null}
          title={disabledHints.cancel || "Request governed cancellation via Core"}
          onClick={() => {
            void submitGovernedChange("cancel");
          }}
        >
          {submitting === "cancel" ? <Loader2 size={14} className="animate-spin" /> : null}
          Cancel order
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!substituteEligible || submitting !== null}
          title={disabledHints.substitute || "Request governed substitution via Core"}
          onClick={() => {
            void loadItems().then(() => submitGovernedChange("substitute"));
          }}
        >
          {submitting === "substitute" ? <Loader2 size={14} className="animate-spin" /> : null}
          Substitute line
        </Button>
      </div>

      {(amendEligible || substituteEligible) && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Line identity (read-only load; mutation via Core only)</p>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void loadItems()}>
              {loadingItems ? <Loader2 size={12} className="animate-spin" /> : "Refresh lines"}
            </Button>
          </div>
          {items.length > 0 && (
            <select
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"
              value={selectedItemId ?? ""}
              onChange={(event) => setSelectedItemId(event.target.value)}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.product?.name ?? item.id.slice(0, 8)} · qty {item.quantity}
                </option>
              ))}
            </select>
          )}
          {substituteEligible && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={substituteProductId}
                onChange={(event) => setSubstituteProductId(event.target.value)}
                placeholder="Replacement product id"
                className="h-8 text-xs"
              />
              <Input
                value={substituteQty}
                onChange={(event) => setSubstituteQty(event.target.value)}
                placeholder="Qty"
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
