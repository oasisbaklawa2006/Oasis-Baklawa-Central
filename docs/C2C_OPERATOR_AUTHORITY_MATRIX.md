# C2C — Operator authority matrix

**Legend:** **Y** = allowed today in UI sense / safe path · **N** = not allowed or not implemented · **F** = **frozen** — must not ship without gates · **—** = not applicable  

Column shorthand: **RO** Read-only · **Sug** Suggest · **Que** Queue · **Exe** Execute · **Ovr** Override · **Aud** Requires audit · **Fin** Requires finance · **Lck** Requires lock · **JWT** Requires JWT hardening · **RP** Replay / idempotency protection · **Stg** Staging validation  

> “Requires JWT” here means **per C2C target posture** (verified user identity at Edge), not current `verify_jwt=false` state.

## CURRENTLY FROZEN (no implementation PR approved)

- Packet reassignment, close/reopen packet, automation queue, bulk mutations, finance-triggered messaging from this matrix row set — **all F** for production expansion until authority + staging gates pass.

## READ-ONLY SAFE TODAY (client / analytics)

- Saved views, local notes, CSV export, analytics strip (non-mutating), classify **suggestion**, route **suggestion** (no server persistence in those two Edge handlers).

## FUTURE-ONLY (TOOL 5 + governed writes)

- Execute/Ovr columns for reassignment, automation, bulk actions, finance coupling — **future** only.

---

## Matrix

| Action | RO | Sug | Que | Exe | Ovr | Aud | Fin | Lck | JWT | RP | Stg |
|--------|:--:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:--:|:---:|
| **classify** | Y | Y | N | N | N | Y* | N | N | Y | Y | Y |
| **route** | Y | Y | N | N | N | Y* | N | N | Y | Y | Y |
| **reply** | N | N | N | Y | N | Y | N | Y | Y | Y | Y |
| **resend** | N | N | Y | Y | N | Y | N | Y | Y | Y | Y |
| **reassign** | N | N | N | F | F | Y | N | Y | Y | Y | Y |
| **close packet** | N | N | N | F | F | Y | N | Y | Y | Y | Y |
| **reopen packet** | N | N | N | F | F | Y | N | Y | Y | Y | Y |
| **escalate** | N | N | N | F | F | Y | N | N | Y | Y | Y |
| **mark resolved** | N | N | N | F | F | Y | N | Y | Y | Y | Y |
| **queue automation** | N | N | F | F | F | Y | N | Y | Y | Y | Y |
| **bulk actions** | N | N | N | F | F | Y | N | Y | Y | Y | Y |
| **retry failed send** | N | N | Y | F | N | Y | N | Y | Y | Y | Y |
| **export** | Y | N | N | N | N | N | N | N | N | N | N |
| **notes** | Y | N | N | N | N | N | N | N | N | N | N |
| **saved views** | Y | N | N | N | N | N | N | N | N | N | N |
| **analytics** | Y | N | N | N | N | N | N | N | N | N | N |
| **future TOOL 5** | N | N | N | F | F | Y | Y* | Y | Y | Y | Y |

\* **Aud Y*** for classify/route = “attempt should be auditable” under future policy even if read-only today — staging decision.

---

## Notes on columns

- **Sug:** Classify/route are **suggestions** only (no DB writes in current Edge code).  
- **Exe for reply:** Sends customer-visible message — highest sensitivity.  
- **Fin column:** Finance-related routing **suggestion** may surface in route metadata; **no** finance ledger write from these handlers.  
- **JWT / RP / Stg:** Marked **Y** for every execute/frozen row as **target** gates before production expansion.

---

## Cross-references

- Live findings: `docs/C2C_LIVE_AUTHORITY_SURFACE_AUDIT.md`  
- Contract gaps: `docs/C2C_EDGE_CONTRACT_RECONCILIATION.md`  
- Gating table: `docs/C2C_IMPLEMENTATION_GATING_MATRIX.md`  
- Sequence: `docs/C2C_SAFE_SEQUENCE_ROADMAP.md`
