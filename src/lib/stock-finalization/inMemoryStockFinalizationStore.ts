import type {
  StockBalanceRecord,
  StockBalanceRepository,
  StockConsumptionLineageRecord,
  StockLineageRepository,
  StockMovementRepository,
} from "./stockFinalizationTypes";

export function createInMemoryStockBalanceRepository(
  initial: StockBalanceRecord[] = [],
): StockBalanceRepository {
  const balances = new Map<string, StockBalanceRecord>();
  for (const b of initial) {
    balances.set(`${b.productId}:${b.sku}:${b.locationCode}`, { ...b });
  }

  return {
    async getBalance(productId, sku, locationCode) {
      return balances.get(`${productId}:${sku}:${locationCode}`) ?? null;
    },
    async upsertBalanceInitial(row) {
      const key = `${row.productId}:${row.sku}:${row.locationCode}`;
      const existing = balances.get(key);
      if (existing) return existing;
      const record: StockBalanceRecord = {
        ...row,
        id: `mem-bal-${balances.size + 1}`,
        updatedAt: new Date().toISOString(),
      };
      balances.set(key, record);
      return record;
    },
    async applyConsumptionWithLock(params) {
      const key = `${params.productId}:${params.sku}:${params.locationCode}`;
      const row = balances.get(key);
      if (!row || row.version !== params.expectedVersion) {
        return { updated: false, balance: row ?? null };
      }
      const nextAvailable = row.availableQty - params.consumeQty;
      const nextReserved = row.reservedQty - params.releaseReservedQty;
      if (nextAvailable < 0 || nextReserved < 0) {
        return { updated: false, balance: row };
      }
      const updated: StockBalanceRecord = {
        ...row,
        availableQty: nextAvailable,
        reservedQty: nextReserved,
        version: row.version + 1,
        updatedAt: new Date().toISOString(),
      };
      balances.set(key, updated);
      return { updated: true, balance: updated };
    },
    async applyReversalWithLock(params) {
      const key = `${params.productId}:${params.sku}:${params.locationCode}`;
      const row = balances.get(key);
      if (!row || row.version !== params.expectedVersion) {
        return { updated: false, balance: row ?? null };
      }
      const restoreReserved = params.restoreReservedQty ?? params.restoreQty;
      const updated: StockBalanceRecord = {
        ...row,
        availableQty: row.availableQty + params.restoreQty,
        reservedQty: row.reservedQty + restoreReserved,
        version: row.version + 1,
        updatedAt: new Date().toISOString(),
      };
      balances.set(key, updated);
      return { updated: true, balance: updated };
    },
  };
}

export function createInMemoryStockMovementRepository(): StockMovementRepository {
  const movements: {
    id: string;
    movementType: string;
    reservationId: string | null;
    productId: string;
    sku: string;
    quantity: number;
    sourceLocation: string | null;
    destinationLocation: string | null;
    actorId: string | null;
    reasonCode: string | null;
    correlationId: string;
    metadata: Record<string, unknown>;
    orderId?: string;
    createdAt: string;
  }[] = [];

  return {
    async appendMovement(row) {
      const id = `mem-mov-${movements.length + 1}`;
      movements.push({
        id,
        ...row,
        orderId: (row.metadata.orderId as string) ?? undefined,
        createdAt: new Date().toISOString(),
      });
      return { id };
    },
    async listByOrder(orderId) {
      return movements
        .filter((m) => m.orderId === orderId || m.metadata?.orderId === orderId)
        .map((m) => ({
          id: m.id,
          movementType: m.movementType,
          quantity: m.quantity,
          sku: m.sku,
          correlationId: m.correlationId,
          createdAt: m.createdAt,
          metadata: m.metadata,
        }));
    },
  };
}

export function createInMemoryStockLineageRepository(): StockLineageRepository {
  const rows: StockConsumptionLineageRecord[] = [];
  return {
    async insertLineage(row) {
      const record: StockConsumptionLineageRecord = {
        ...row,
        id: `mem-scl-${rows.length + 1}`,
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

export function createInMemoryStockFinalizationEventSink() {
  const events: import("./stockFinalizationTypes").StockFinalizationOperationalEventRecord[] = [];
  return {
    async append(
      event: Omit<
        import("./stockFinalizationTypes").StockFinalizationOperationalEventRecord,
        "id" | "occurredAt"
      >,
    ) {
      const record = {
        ...event,
        id: `mem-sfe-${events.length + 1}`,
        occurredAt: new Date().toISOString(),
      };
      events.push(record);
      return record;
    },
    async listByOrder(orderId: string) {
      return events.filter((e) => e.orderId === orderId);
    },
  };
}
