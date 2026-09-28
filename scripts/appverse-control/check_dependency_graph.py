#!/usr/bin/env python3
"""Fail-closed validator for the Appverse Mission Control dependency graph."""

from __future__ import annotations

import json
import sys
from pathlib import Path

GRAPH = Path("appverse-control/dependency-graph.json")

MANDATORY_POINT100_UPSTREAMS = {
    "CORE-AUTH-01",
    "CENTRAL-AUTH-01",
    "CENTRAL-GOVERNANCE",
    "CENTRAL-POINT55-PUBLISHED-PRODUCTS",
    "CORE-FINANCE-LEDGER",
    "TRACE-POINT95-99",
    "CORE-WA-CONSUMER",
    "CORE-WA-IDENTITY",
    "AI-POINT49",
    "AI-POINT50",
    "AI-POINT51",
    "CORE-AI-CHAT-CAPTURE",
    "CENTRAL-AI-CHAT-CONSUMER",
    "AI-ALIAS-SESSION",
    "BUYER-APP-RECERT",
}

MANDATORY_PRODUCTION_READINESS_UPSTREAMS = {
    "POINT100",
    "CORE-SECURITY-HARDENING",
    "WHATSAPP-LIVE-CERT",
    "PHYSICAL-UAT",
}


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    data = json.loads(GRAPH.read_text(encoding="utf-8"))

    if data.get("authority") != "APPVERSE_MISSION_CONTROL":
        fail("dependency graph authority must be APPVERSE_MISSION_CONTROL")

    mission = data.get("mission", {})
    if mission.get("asm_id") != "APPVERSE-LINK-01":
        fail("final linking graph must be assigned to APPVERSE-LINK-01")
    if mission.get("repository") != "oasisbaklawa2006/Oasis-Baklawa-Central":
        fail("programme-level linking must remain owned by Central Mission Control")

    safety = data.get("production_safety_gate", {})
    if safety.get("enabled") is not True:
        fail("production safety gate must remain enabled")
    if safety.get("cross_repo_code_mutation_allowed") is not False:
        fail("Mission Control must not authorize cross-repo code mutation")

    repositories = data.get("repositories", {})
    required_repos = {"central", "core", "buyer", "ai_studio", "trace"}
    if set(repositories) != required_repos:
        fail(f"repository registry must be exactly {sorted(required_repos)}")

    nodes = data.get("nodes", [])
    by_id = {}
    for node in nodes:
        node_id = node.get("id")
        if not node_id or node_id in by_id:
            fail(f"node ids must be unique and non-empty: {node_id!r}")
        if node.get("repository") not in repositories:
            fail(f"{node_id}: unknown repository key {node.get('repository')!r}")
        by_id[node_id] = node

    required_nodes = {
        "CORE-AUTH-01",
        "CENTRAL-AUTH-01",
        "CENTRAL-GOVERNANCE",
        "CENTRAL-POINT55-PUBLISHED-PRODUCTS",
        "CORE-FINANCE-LEDGER",
        "CORE-TRACE-AUTHORITY",
        "CORE-SECURITY-HARDENING",
        "CORE-WA-CONSUMER",
        "CORE-WA-IDENTITY",
        "AI-POINT49",
        "AI-POINT50",
        "AI-POINT51",
        "CORE-AI-CHAT-CAPTURE",
        "CENTRAL-AI-CHAT-CONSUMER",
        "AI-ALIAS-SESSION",
        "TRACE-POINT95-99",
        "BUYER-APP-RECERT",
        "WHATSAPP-LIVE-CERT",
        "PHYSICAL-UAT",
        "POINT100",
        "PRODUCTION-READINESS",
        "APPVERSE-COMPLETE",
    }
    missing = required_nodes - set(by_id)
    if missing:
        fail(f"required final-completion nodes missing: {sorted(missing)}")

    # Every declared edge must exist in both directions.
    for node_id, node in by_id.items():
        for upstream in node.get("upstream", []):
            if upstream not in by_id:
                fail(f"{node_id}: missing upstream node {upstream}")
            if node_id not in by_id[upstream].get("downstream", []):
                fail(f"edge {upstream} -> {node_id} is not mirrored downstream")
        for downstream in node.get("downstream", []):
            if downstream not in by_id:
                fail(f"{node_id}: missing downstream node {downstream}")
            if node_id not in by_id[downstream].get("upstream", []):
                fail(f"edge {node_id} -> {downstream} is not mirrored upstream")

    # Git branch stacking is exceptional. Every PR targets main unless explicitly allowed.
    allowed_stacks = {
        (edge["downstream"], edge["upstream"])
        for edge in data.get("invariants", {}).get("allowed_stacked_edges", [])
    }
    non_main_prs = []
    for node_id, node in by_id.items():
        if node.get("pr") is None:
            continue
        branch = node.get("branch")
        base = node.get("base")
        if not branch or not base:
            fail(f"{node_id}: PR nodes require branch and base")
        if base == "main":
            continue
        matching_upstreams = [
            upstream
            for upstream in node.get("upstream", [])
            if by_id[upstream].get("repository") == node.get("repository")
            and by_id[upstream].get("branch") == base
        ]
        if len(matching_upstreams) != 1:
            fail(f"{node_id}: non-main base {base!r} does not resolve to exactly one same-repo upstream")
        edge = (node_id, matching_upstreams[0])
        if edge not in allowed_stacks:
            fail(f"{node_id}: unapproved stacked branch edge {edge}")
        non_main_prs.append(edge)

    if set(non_main_prs) != allowed_stacks:
        fail(f"declared stacked edges and actual stacked PR bases differ: declared={sorted(allowed_stacks)} actual={sorted(non_main_prs)}")

    # Final completion graph must be acyclic.
    visiting: set[str] = set()
    visited: set[str] = set()

    def visit(node_id: str) -> None:
        if node_id in visiting:
            fail(f"dependency cycle detected at {node_id}")
        if node_id in visited:
            return
        visiting.add(node_id)
        for child in by_id[node_id].get("downstream", []):
            visit(child)
        visiting.remove(node_id)
        visited.add(node_id)

    for node_id in by_id:
        visit(node_id)

    # Core mutation authority must release before Trace consumer merge.
    required_release_edges = {
        (edge["producer"], edge["consumer"])
        for edge in data.get("invariants", {}).get("required_release_before_consumer_merge", [])
    }
    if ("CORE-TRACE-AUTHORITY", "TRACE-POINT95-99") not in required_release_edges:
        fail("Core Trace authority -> Trace consumer release edge is mandatory")
    trace_gate = " ".join(by_id["TRACE-POINT95-99"].get("merge_gate", [])).lower()
    if "production" not in trace_gate or "core" not in trace_gate:
        fail("Trace merge gate must explicitly require Core production release/verification")

    # Point100 and production readiness must fail closed on immutable mission floors.
    point100_required = set(data["invariants"]["point100_must_not_be_finally_certified_before"])
    if not MANDATORY_POINT100_UPSTREAMS.issubset(point100_required):
        fail(
            "Point100 invariant list has dropped mandatory entries: "
            f"{sorted(MANDATORY_POINT100_UPSTREAMS - point100_required)}"
        )
    point100_upstream = set(by_id["POINT100"].get("upstream", []))
    if not point100_required.issubset(point100_upstream):
        fail(f"Point100 is missing mandatory upstreams: {sorted(point100_required - point100_upstream)}")
    if not MANDATORY_POINT100_UPSTREAMS.issubset(point100_upstream):
        fail(
            "Point100 node is missing immutable mandatory upstreams: "
            f"{sorted(MANDATORY_POINT100_UPSTREAMS - point100_upstream)}"
        )

    readiness_required = set(data["invariants"]["production_readiness_must_not_clear_before"])
    if not MANDATORY_PRODUCTION_READINESS_UPSTREAMS.issubset(readiness_required):
        fail(
            "Production Readiness invariant list has dropped mandatory entries: "
            f"{sorted(MANDATORY_PRODUCTION_READINESS_UPSTREAMS - readiness_required)}"
        )
    readiness_upstream = set(by_id["PRODUCTION-READINESS"].get("upstream", []))
    if not readiness_required.issubset(readiness_upstream):
        fail(f"Production Readiness is missing mandatory upstreams: {sorted(readiness_required - readiness_upstream)}")
    if not MANDATORY_PRODUCTION_READINESS_UPSTREAMS.issubset(readiness_upstream):
        fail(
            "Production Readiness node is missing immutable mandatory upstreams: "
            f"{sorted(MANDATORY_PRODUCTION_READINESS_UPSTREAMS - readiness_upstream)}"
        )

    if by_id["APPVERSE-COMPLETE"].get("upstream") != ["PRODUCTION-READINESS"]:
        fail("APPVERSE-COMPLETE must have exactly one direct upstream: PRODUCTION-READINESS")

    print(f"Appverse dependency graph OK: {len(by_id)} nodes, {sum(len(n.get('downstream', [])) for n in nodes)} directed edges")


if __name__ == "__main__":
    main()
