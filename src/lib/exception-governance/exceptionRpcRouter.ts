import type {
  ExceptionDeclarationInput,
  ExceptionGovernanceWriteContext,
  ExceptionReleaseInput,
  GovernedExceptionRpcCall,
} from "./exceptionGovernanceTypes";
import { ExceptionGovernanceError } from "./exceptionGovernanceTypes";

export function buildDeclarationRpc(
  input: ExceptionDeclarationInput,
  ctx: ExceptionGovernanceWriteContext,
): GovernedExceptionRpcCall {
  const { category, binding, quantities, notes, issueType } = input;

  switch (category) {
    case "wastage":
      if (binding.subsystem === "PRODUCTION") {
        return {
          rpcName: "record_production_output",
          args: {
            p_job_id: binding.jobId,
            p_produced_qty: quantities?.actualQty ?? 0,
            p_wasted_qty: quantities?.wastedQty ?? 0,
            p_batch_number: binding.batchNumber ?? null,
            p_correlation_id: ctx.correlationId,
            p_notes: notes ?? ctx.reason,
            p_execution_metadata: {},
          },
        };
      }
      if (binding.subsystem === "ASSEMBLY") {
        return {
          rpcName: "record_assembly_consumption",
          args: {
            p_component_id: binding.componentId,
            p_consumed_qty: quantities?.actualQty ?? 0,
            p_wasted_qty: quantities?.wastedQty ?? 0,
            p_returned_qty: 0,
            p_correlation_id: ctx.correlationId,
          },
        };
      }
      break;

    case "rejection":
      if (binding.subsystem === "PRODUCTION") {
        return {
          rpcName: "reject_production_job",
          args: {
            p_job_id: binding.jobId,
            p_rejection_reason: ctx.reason,
            p_correlation_id: ctx.correlationId,
          },
        };
      }
      if (binding.subsystem === "RGS") {
        return {
          rpcName: "accept_rgs_production_receipt",
          args: {
            p_transfer_id: binding.transferId,
            p_accepted_qty: quantities?.actualQty ?? 0,
            p_rejected_qty: quantities?.rejectedQty ?? 0,
            p_hold_qty: 0,
            p_correlation_id: ctx.correlationId,
          },
        };
      }
      if (binding.subsystem === "ASSEMBLY") {
        return {
          rpcName: "accept_assembly_output",
          args: {
            p_assembly_job_id: binding.assemblyJobId,
            p_accepted_qty: quantities?.actualQty ?? 0,
            p_rejected_qty: quantities?.rejectedQty ?? 0,
            p_correlation_id: ctx.correlationId,
          },
        };
      }
      break;

    case "shortage":
      return {
        rpcName: "create_production_shortage_demand",
        args: {
          p_reservation_id: binding.reservationId,
          p_department: binding.department,
          p_priority: "normal",
          p_correlation_id: ctx.correlationId,
        },
      };

    case "blocker":
      return {
        rpcName: "report_production_issue",
        args: {
          p_job_id: binding.jobId,
          p_department: binding.department,
          p_issue_type: issueType ?? "blocker",
          p_comment: notes ?? ctx.reason,
          p_correlation_id: ctx.correlationId,
        },
      };

    case "quality_hold":
      if (binding.subsystem === "RGS") {
        return {
          rpcName: "accept_rgs_production_receipt",
          args: {
            p_transfer_id: binding.transferId,
            p_accepted_qty: quantities?.actualQty ?? 0,
            p_rejected_qty: 0,
            p_hold_qty: quantities?.holdQty ?? 0,
            p_correlation_id: ctx.correlationId,
          },
        };
      }
      if (binding.subsystem === "3PGS") {
        return {
          rpcName: "record_b2b_3pgs_inventory_exception",
          args: {
            p_product_id: binding.productId,
            p_sku: binding.sku,
            p_action: "quarantine",
            p_source_bucket: "available",
            p_quantity: quantities?.holdQty ?? 0,
            p_reason: ctx.reason,
            p_correlation_id: ctx.correlationId,
            p_evidence: ctx.evidenceRef ? [{ ref: ctx.evidenceRef }] : [],
          },
        };
      }
      break;
    default:
      break;
  }

  throw new ExceptionGovernanceError(
    "rpc_unavailable",
    `No governed Core RPC for ${category} in subsystem ${binding.subsystem}`,
  );
}

export function buildReleaseRpc(
  input: ExceptionReleaseInput,
  ctx: ExceptionGovernanceWriteContext,
): GovernedExceptionRpcCall {
  const { category, binding, targetId, resolutionNotes, quantities } = input;

  if (category === "blocker") {
    return {
      rpcName: "resolve_production_issue",
      args: {
        p_issue_id: targetId,
        p_resolution_notes: resolutionNotes,
        p_correlation_id: ctx.correlationId,
      },
    };
  }

  if (category === "quality_hold") {
    if (binding.subsystem === "3PGS") {
      return {
        rpcName: "record_b2b_3pgs_inventory_exception",
        args: {
          p_product_id: binding.productId,
          p_sku: binding.sku,
          p_action: "release_quarantine",
          p_source_bucket: "quarantine",
          p_quantity: quantities?.holdQty ?? 0,
          p_reason: ctx.reason,
          p_correlation_id: ctx.correlationId,
          p_evidence: ctx.evidenceRef ? [{ ref: ctx.evidenceRef }] : [],
        },
      };
    }
    throw new ExceptionGovernanceError(
      "rpc_unavailable",
      `Quality-hold release for subsystem ${binding.subsystem} requires Core prerequisite`,
    );
  }

  throw new ExceptionGovernanceError("rpc_unavailable", `Release not supported for ${category}`);
}

export function idempotencyKeyFor(
  category: string,
  correlationId: string,
  bindingKey: string,
): string {
  return `point89:${category}:${bindingKey}:${correlationId}`;
}
