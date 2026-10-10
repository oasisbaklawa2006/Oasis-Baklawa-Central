import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChangeEvent } from "react";

type TraceItem = {
  id: string;
  quantity: number;
  product: { name: string } | null;
};

export type OrderAmendmentFormFieldsProps = {
  reason: string;
  onReasonChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  amendEligible: boolean;
  cancelEligible: boolean;
  substituteEligible: boolean;
  submitting: "amend" | "cancel" | "substitute" | null;
  disabledHints: { amend: string | null; cancel: string | null; substitute: string | null };
  onAmendClick: () => void;
  onCancelClick: () => void;
  onSubstituteClick: () => void;
  items: TraceItem[];
  loadingItems: boolean;
  onRefreshLinesClick: () => void;
  selectedItemId: string | null;
  onSelectedItemChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  substituteProductId: string;
  onSubstituteProductChange: (event: ChangeEvent<HTMLInputElement>) => void;
  substituteQty: string;
  onSubstituteQtyChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function OrderAmendmentFormFields({
  reason,
  onReasonChange,
  amendEligible,
  cancelEligible,
  substituteEligible,
  submitting,
  disabledHints,
  onAmendClick,
  onCancelClick,
  onSubstituteClick,
  items,
  loadingItems,
  onRefreshLinesClick,
  selectedItemId,
  onSelectedItemChange,
  substituteProductId,
  onSubstituteProductChange,
  substituteQty,
  onSubstituteQtyChange,
}: OrderAmendmentFormFieldsProps) {
  return (
    <>
      <Textarea
        value={reason}
        onChange={onReasonChange}
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
          onClick={onAmendClick}
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
          onClick={onCancelClick}
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
          onClick={onSubstituteClick}
        >
          {submitting === "substitute" ? <Loader2 size={14} className="animate-spin" /> : null}
          Substitute line
        </Button>
      </div>

      {(amendEligible || substituteEligible) && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Line identity (read-only load; mutation via Core only)</p>
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onRefreshLinesClick}>
              {loadingItems ? <Loader2 size={12} className="animate-spin" /> : "Refresh lines"}
            </Button>
          </div>
          {items.length > 0 && (
            <select
              className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs"
              value={selectedItemId ?? ""}
              onChange={onSelectedItemChange}
            >
              {items.map(function renderLineOption(item) {
                return (
                  <option key={item.id} value={item.id}>
                    {item.product?.name ?? item.id.slice(0, 8)} · qty {item.quantity}
                  </option>
                );
              })}
            </select>
          )}
          {substituteEligible && (
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={substituteProductId}
                onChange={onSubstituteProductChange}
                placeholder="Replacement product id"
                className="h-8 text-xs"
              />
              <Input
                value={substituteQty}
                onChange={onSubstituteQtyChange}
                placeholder="Qty"
                className="h-8 text-xs"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
