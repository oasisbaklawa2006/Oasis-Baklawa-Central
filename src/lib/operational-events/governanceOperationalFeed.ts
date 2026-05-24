import { dedupeOperationalEventsById } from "./normalize";
import type { OperationalEventRecord } from "./types";
import { GovernanceOperationalEventKind } from "./types";
import { APPROVAL_REQUIREMENTS } from "@/lib/governance/approvalMatrix";
import { OVERRIDE_RULES } from "@/lib/governance/overrideRules";
import { defaultEscalationMessage } from "@/lib/governance/escalationRules";

const SOURCE = "derived_governance" as const;

export interface GovernanceOperationalFeedInput {
  /** Topics requiring human escalation attention (caller-supplied, bounded). */
  escalationTopics: string[];
}

export function buildGovernanceOperationalFeed(input: GovernanceOperationalFeedInput): OperationalEventRecord[] {
  let sortKey = 9500;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "cmd", displayLabel: "Governance projection" };
  const out: OperationalEventRecord[] = [];

  out.push({
    id: "gov:shell:matrix",
    kind: GovernanceOperationalEventKind.PROTECTED_TRANSITION,
    category: "audit",
    severity: "info",
    title: "Approval matrix (design)",
    detail: APPROVAL_REQUIREMENTS.map((r) => `${r.kind} · min ${r.minApprovers} approvers · CMD=${r.requiresCmd}`).join("\n"),
    occurredAt: null,
    sortKey: next(),
    actor,
    entities: [{ entityType: "approval", id: "matrix" }],
    source: SOURCE,
  });

  for (const r of OVERRIDE_RULES) {
    out.push({
      id: `gov:override:${r.kind}`,
      kind: GovernanceOperationalEventKind.OVERRIDE_REQUIRED,
      category: "financial",
      severity: r.reversible ? "warning" : "urgent",
      title: `Override policy · ${r.kind}`,
      detail: r.rule,
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [{ entityType: "approval", id: r.kind }],
      source: SOURCE,
    });
  }

  for (const topic of input.escalationTopics) {
    out.push({
      id: `gov:escalation:${topic.replace(/\s+/g, "-").slice(0, 48)}`,
      kind: GovernanceOperationalEventKind.ESCALATION_PENDING,
      category: "escalation",
      severity: "warning",
      title: `Escalation pending · ${topic}`,
      detail: defaultEscalationMessage(topic),
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [{ entityType: "ticket", id: topic }],
      source: SOURCE,
    });
  }

  return dedupeOperationalEventsById(out);
}
