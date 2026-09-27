import { useCallback, type ChangeEvent } from "react";

type OrderAmendmentFormControls = {
  setReason: (value: string) => void;
  setSelectedItemId: (value: string) => void;
  setSubstituteProductId: (value: string) => void;
  setSubstituteQty: (value: string) => void;
  loadItems: () => Promise<void>;
  submitGovernedChange: (action: "amend" | "cancel" | "substitute") => Promise<void>;
};

export function useOrderAmendmentFormControls({
  setReason,
  setSelectedItemId,
  setSubstituteProductId,
  setSubstituteQty,
  loadItems,
  submitGovernedChange,
}: OrderAmendmentFormControls) {
  const handleReasonChange = useCallback(function onReasonChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setReason(event.target.value);
  }, [setReason]);

  const handleSelectedItemChange = useCallback(function onSelectedItemChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedItemId(event.target.value);
  }, [setSelectedItemId]);

  const handleSubstituteProductChange = useCallback(function onSubstituteProductChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setSubstituteProductId(event.target.value);
  }, [setSubstituteProductId]);

  const handleSubstituteQtyChange = useCallback(function onSubstituteQtyChange(event: ChangeEvent<HTMLInputElement>) {
    setSubstituteQty(event.target.value);
  }, [setSubstituteQty]);

  const handleRefreshLinesClick = useCallback(function onRefreshLinesClick() {
    void loadItems();
  }, [loadItems]);

  const handleAmendClick = useCallback(function onAmendClick() {
    void (async function submitAmendAfterLines() {
      await loadItems();
      await submitGovernedChange("amend");
    })();
  }, [loadItems, submitGovernedChange]);

  const handleCancelClick = useCallback(function onCancelClick() {
    void submitGovernedChange("cancel");
  }, [submitGovernedChange]);

  const handleSubstituteClick = useCallback(function onSubstituteClick() {
    void (async function submitSubstituteAfterLines() {
      await loadItems();
      await submitGovernedChange("substitute");
    })();
  }, [loadItems, submitGovernedChange]);

  return {
    handleReasonChange,
    handleSelectedItemChange,
    handleSubstituteProductChange,
    handleSubstituteQtyChange,
    handleRefreshLinesClick,
    handleAmendClick,
    handleCancelClick,
    handleSubstituteClick,
  };
}
