import { supabase } from "@/integrations/supabase/client";
import { assertPauseReasonProvided, evaluateCompletionGate } from "./completionGating";
import { assertLifecycleTransition } from "./lifecycleMatrix";
import { assertPoint88LifecycleRpc, type Point88LifecycleRpc } from "./point88Scope";
import type { ProductionJobSnapshot, ProductionLifecycleRpcResult } from "./types";

type RpcClient = {
  rpc: (
    name: string,
    params?: Record<string, unknown>,
  ) => PromiseLike<ProductionLifecycleRpcResult>;
};

const rpcClient = supabase as unknown as RpcClient;

export function createProductionCorrelationId(prefix = "point88"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function invokeLifecycleRpc<T = Record<string, unknown>>(
  rpcName: Point88LifecycleRpc,
  args: Record<string, unknown>,
): Promise<ProductionLifecycleRpcResult<T>> {
  assertPoint88LifecycleRpc(rpcName);
  return (await rpcClient.rpc(rpcName, args)) as ProductionLifecycleRpcResult<T>;
}

export const productionGovernedRpc = {
  createProductionCorrelationId,

  async createShortageDemand(args: {
    p_reservation_id: string;
    p_department: string;
    p_priority?: string;
    p_correlation_id?: string;
  }): Promise<ProductionLifecycleRpcResult> {
    return invokeLifecycleRpc("create_production_shortage_demand", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("allocate"),
    });
  },

  async acceptJob(args: {
    p_job_id: string;
    p_batch_number: string;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    if (job) assertLifecycleTransition("accept", job);
    return invokeLifecycleRpc("accept_production_job", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("accept"),
    });
  },

  async rejectJob(args: {
    p_job_id: string;
    p_rejection_reason: string;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    if (job) assertLifecycleTransition("reject", job);
    return invokeLifecycleRpc("reject_production_job", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("reject"),
    });
  },

  async startJob(args: {
    p_job_id: string;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    if (job) assertLifecycleTransition("start", job);
    return invokeLifecycleRpc("start_production_job", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("start"),
    });
  },

  async pauseJob(args: {
    p_job_id: string;
    p_reason: string;
    p_comment?: string | null;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    assertPauseReasonProvided(args.p_reason);
    if (job) assertLifecycleTransition("pause", job);
    return invokeLifecycleRpc("pause_production_job", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("pause"),
    });
  },

  async resumeJob(args: {
    p_job_id: string;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    if (job) assertLifecycleTransition("resume", job);
    return invokeLifecycleRpc("resume_production_job", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("resume"),
    });
  },

  async advanceStage(args: {
    p_job_id: string;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    if (job) assertLifecycleTransition("advance_stage", job);
    return invokeLifecycleRpc("advance_production_job_stage", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("advance"),
    });
  },

  async recordOutput(args: {
    p_job_id: string;
    p_produced_qty: number;
    p_wasted_qty: number;
    p_batch_number?: string | null;
    p_notes?: string | null;
    p_execution_metadata?: Record<string, string | number>;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    if (job) {
      assertLifecycleTransition("record_output", job);
      const gate = evaluateCompletionGate({
        producedQty: args.p_produced_qty,
        wastedQty: args.p_wasted_qty,
        assignedQty: job.assigned_qty,
      });
      if (!gate.allowed) {
        return { data: null, error: { message: gate.allowed === false ? gate.reason : "Completion gate rejected." } };
      }
    }
    return invokeLifecycleRpc("record_production_output", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("output"),
    });
  },

  async declareReady(args: {
    p_job_id: string;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    if (job) assertLifecycleTransition("declare_ready", job);
    return invokeLifecycleRpc("declare_production_ready", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("ready"),
    });
  },

  async dispatchToRgs(args: {
    p_job_id: string;
    p_dispatched_qty: number;
    p_correlation_id?: string;
  }, job?: ProductionJobSnapshot): Promise<ProductionLifecycleRpcResult> {
    if (job) assertLifecycleTransition("dispatch_to_rgs", job);
    return invokeLifecycleRpc("dispatch_production_to_rgs", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("dispatch"),
    });
  },

  async quickLogToRgs(args: {
    p_product_id: string;
    p_department: string;
    p_produced_qty: number;
    p_wasted_qty: number;
    p_batch_number: string;
    p_correlation_id?: string;
  }): Promise<ProductionLifecycleRpcResult> {
    const gate = evaluateCompletionGate({
      producedQty: args.p_produced_qty,
      wastedQty: args.p_wasted_qty,
      assignedQty: args.p_produced_qty,
    });
    if (!gate.allowed) {
      return { data: null, error: { message: gate.allowed === false ? gate.reason : "Completion gate rejected." } };
    }
    return invokeLifecycleRpc("quick_log_production_to_rgs", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("quick"),
    });
  },

  async submitDayEnd(args: {
    p_department: string;
    p_business_date: string;
    p_exception_notes?: string | null;
    p_corrects_signoff_id?: string | null;
    p_correlation_id?: string;
  }): Promise<ProductionLifecycleRpcResult> {
    return invokeLifecycleRpc("submit_production_day_end", {
      ...args,
      p_correlation_id: args.p_correlation_id ?? createProductionCorrelationId("dayend"),
    });
  },
};
