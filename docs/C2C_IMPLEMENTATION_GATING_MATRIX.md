# C2C — Implementation gating matrix

**Legend:** **Y** = allowed / satisfied · **N** = not allowed or not satisfied · **—** = not applicable · **TBD** = requires explicit review

This matrix gates **implementation** work. Documentation-only work (e.g. this repo’s planning PRs) may proceed under org doc review rules.

| Capability | Allowed now? | Requires migrations? | Requires Edge? | Requires JWT review? | Requires staging pilot? | Requires immutable audit? | Requires rollback plan? | Production-ready? | Blocked reason (if not ready) |
|------------|--------------|----------------------|----------------|------------------------|-------------------------|----------------------------|------------------------|-------------------|-------------------------------|
| Read-only analytics | Y | N | N (client read) | Y (for any privileged select) | N | N | N | TBD | RLS + field exposure must be reviewed. |
| Saved views | Y | N | N | N | N | N | N | Y (client-only) | Trust boundary: never server-authoritative. |
| Local notes | Y | N | N | N | N | N | N | Y (client-only) | Same as saved views. |
| CSV export | Y | N | N | N | N | N | N | Y (client-only) | Exports only visible rows; educate on PII handling. |
| Operator reply | TBD | TBD | Y | Y | Y | Y | Y | N | Existing prod path — re-validate under C2C; audit + idempotency. |
| Classify | TBD | TBD | Y | Y | Y | TBD | Y | N | Cost/abuse + persistence review. |
| Route | TBD | TBD | Y | Y | Y | TBD | Y | N | Client-supplied intent trust review. |
| TOOL 5 override | N | Y | Y | Y | Y | Y | Y | N | Not approved; needs full authority stack. |
| Packet reassignment | N | Y | Y | Y | Y | Y | Y | N | No governed reassignment API in read-only track. |
| Auto-routing | N | Y | Y | Y | Y | Y | Y | N | Automation frozen; queue model required. |
| Auto-send queue | N | Y | Y | Y | Y | Y | Y | N | Queue + dedupe + replay plan required. |
| Retry automation | N | Y | Y | Y | Y | Y | Y | N | Same as queue. |
| Escalation engine | N | Y | Y | Y | Y | Y | Y | N | Policy + notification scope undefined. |
| Production order extraction | N | TBD | TBD | Y | Y | Y | Y | N | Cross-domain PII and finance coupling. |
| Finance-triggered dispatch messaging | N | TBD | TBD | Y | Y | Y | Y | N | High abuse impact; dual control likely required. |

### How to use this matrix

1. **Pick a row** before opening an implementation PR.
2. If any **Requires** column is **Y** and not satisfied, set **Production-ready** to **N**.
3. **Staging pilot** is mandatory before flipping **Production-ready** to **Y** for any new write or automation row.
4. **Immutable audit** is mandatory for any row that mutates customer-affecting state or operator accountability boundaries.
