import { validateLineageInsert } from "./dispatchLineage";
import type {
  DispatchLineageStore,
  DispatchReleaseLineageRecord,
  OrderDispatchStatusRepository,
  OrderDispatchStatusUpdateParams,
} from "./dispatchFinalizationTypes";

export function createInMemoryDispatchLineageStore(): DispatchLineageStore {
  const rows: DispatchReleaseLineageRecord[] = [];
  return {
    async insertLineage(row) {
      validateLineageInsert(row);
      const record: DispatchReleaseLineageRecord = {
        ...row,
        id: `mem-drl-${rows.length + 1}`,
        createdAt: new Date().toISOString(),
      };
      rows.push(record);
      return record;
    },
    async listByOrder(orderId) {
      return rows.filter((r) => r.orderId === orderId);
    },
  };
}

export function createInMemoryOrderDispatchStatusRepository(
  initial: Record<string, { status: string; tracking_number?: string | null; courier_name?: string | null }> = {},
): OrderDispatchStatusRepository {
  const orders = { ...initial };
  const history: { order_id: string; old_status: string; new_status: string; actor_id?: string | null }[] = [];

  return {
    async getOrderStatus(orderId) {
      const row = orders[orderId];
      return row ? { status: row.status } : null;
    },
    async updateOrderDispatchStatus(params: OrderDispatchStatusUpdateParams) {
      const row = orders[params.orderId];
      if (!row || row.status !== params.expectedPreviousStatus) {
        return {
          updated: false,
          previousStatus: row?.status ?? params.expectedPreviousStatus,
          nextStatus: row?.status ?? params.expectedPreviousStatus,
        };
      }
      row.status = params.nextStatus;
      if (params.trackingNumber !== undefined) row.tracking_number = params.trackingNumber;
      if (params.courierName !== undefined) row.courier_name = params.courierName;
      return {
        updated: true,
        previousStatus: params.expectedPreviousStatus,
        nextStatus: params.nextStatus,
      };
    },
    async insertStatusHistory(params) {
      history.push({
        order_id: params.orderId,
        old_status: params.oldStatus,
        new_status: params.newStatus,
        actor_id: params.actorId ?? null,
      });
    },
  };
}
