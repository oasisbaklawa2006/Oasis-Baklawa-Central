/** Governed order change actions — Core is transactional authority; Central never shadow-mutates. */
export type OrderChangeAction = "amend" | "cancel" | "substitute";

export type OrderAmendmentBlocker = {
  code?: string;
  message?: string;
  scope?: string;
};

export type OrderAmendmentFacts = {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  commercialVersionId: string;
  commercialVersionNumber: number;
  frozenSalesOrderValue: number;
  financeStatus: string | null;
  productionCutoffReached: boolean;
  packingCutoffReached: boolean;
  dispatchCutoffReached: boolean;
  amendmentAllowed: boolean;
  cancellationAllowed: boolean;
  substitutionAllowed: boolean;
  blockers: OrderAmendmentBlocker[];
};

export type OrderAmendmentLineChange = {
  orderItemId: string;
  newQuantity?: number | null;
  remove?: boolean;
};

export type RequestOrderAmendmentInput = {
  orderId: string;
  commercialVersionId: string;
  expectedOrderStatus: string;
  reason: string;
  evidenceReference: string;
  lineChanges: OrderAmendmentLineChange[];
  sourceChannel: string;
  sourceReference: string;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type RequestOrderCancellationInput = {
  orderId: string;
  commercialVersionId: string;
  expectedOrderStatus: string;
  reason: string;
  evidenceReference: string;
  sourceChannel: string;
  sourceReference: string;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type RequestOrderSubstitutionInput = {
  orderId: string;
  commercialVersionId: string;
  expectedOrderStatus: string;
  orderItemId: string;
  replacementProductId: string;
  newQuantity: number;
  reason: string;
  evidenceReference: string;
  customerApprovalReference?: string | null;
  sourceChannel: string;
  sourceReference: string;
  correlationId: string;
  idempotencyKey: string;
  actorId: string;
};

export type OrderChangeAuthorityResult = {
  ok: boolean;
  orderId?: string;
  changeId?: string;
  previousStatus?: string;
  newStatus?: string;
  previousCommercialVersionId?: string;
  newCommercialVersionId?: string;
  alreadyApplied?: boolean;
  blockers?: OrderAmendmentBlocker[];
};
