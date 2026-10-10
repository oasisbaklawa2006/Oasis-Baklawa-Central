#!/usr/bin/env bash
# Point 3 / 3j — fail closed on high-confidence secret VALUES in tracked files.
# Secret names, placeholders, and Supabase publishable/anon keys are allowed.
#
# Modes:
#   check-tracked-secret-exposure.sh [ROOT]
#     Scan tracked files in a checked-out working tree.
#   check-tracked-secret-exposure.sh --git-ref COMMIT
#     Scan blobs directly from an already-fetched Git commit without checking
#     out or executing candidate code. This is the authoritative mode for the
#     privileged pull_request_target job.
set -euo pipefail

fail() {
  echo "TRACKED_SECRET_EXPOSURE_SCAN_FAILED: $*" >&2
  exit 1
}

MODE="worktree"
ROOT="."
GIT_REF=""
if [[ "${1:-}" == "--git-ref" ]]; then
  MODE="git-ref"
  GIT_REF="${2:-}"
  [[ -n "$GIT_REF" ]] || fail 'git ref is required after --git-ref'
  [[ $# -eq 2 ]] || fail 'unexpected arguments after --git-ref COMMIT'
else
  ROOT="${1:-.}"
  [[ $# -le 1 ]] || fail 'unexpected arguments'
fi

tracked_list="$(mktemp)"
trap 'rm -f "$tracked_list"' EXIT

if [[ "$MODE" == "git-ref" ]]; then
  git rev-parse --verify "${GIT_REF}^{commit}" >/dev/null 2>&1 \
    || fail "candidate commit does not resolve: $GIT_REF"
  if ! git ls-tree -r -z "$GIT_REF" \
    | sed -z -n 's/^[0-7]\\{6\\} blob [0-9a-f]*\\t//p' > "$tracked_list"; then
    fail 'git ls-tree failed while enumerating candidate tracked files'
  fi
else
  cd "$ROOT"
  if ! git ls-files -z > "$tracked_list"; then
    fail 'git ls-files failed while enumerating tracked files'
  fi
fi

if [[ ! -s "$tracked_list" ]]; then
  echo "No tracked files to scan."
  exit 0
fi

python3 - "$tracked_list" "$MODE" "$GIT_REF" <<'PY'
import os
import re
import subprocess
import sys

tracked_list, mode, git_ref = sys.argv[1:4]
root = os.getcwd()
with open(tracked_list, "rb") as handle:
    files = [os.fsdecode(raw) for raw in handle.read().split(b"\0") if raw]

patterns = [
    ("resend_api_key", re.compile(r"\bre_[A-Za-z0-9]{20,}\b")),
    ("github_pat", re.compile(r"\bghp_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b")),
    ("openai_sk", re.compile(r"\bsk-[A-Za-z0-9]{20,}\b")),
    ("aws_access_key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("private_key_block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("supabase_service_role_jwt", re.compile(
        r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"
    )),
    ("supabase_secret_key", re.compile(r"\bsb_secret_[A-Za-z0-9_-]{10,}\b")),
]

skip_ext = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip",
}


def read_candidate_blob(rel: str) -> str:
    # Candidate data is read through Git object plumbing only. No candidate
    # checkout, PATH mutation, sourcing, shell evaluation, hooks, or scripts.
    proc = subprocess.run(
        ["git", "show", f"{git_ref}:{rel}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode != 0:
        print(
            f"TRACKED_SECRET_EXPOSURE_SCAN_FAILED: cannot read candidate blob {rel}",
            file=sys.stderr,
        )
        sys.exit(1)
    return proc.stdout.decode("utf-8", errors="ignore")


findings = []
scanned = 0
for rel in files:
    ext = os.path.splitext(rel)[1].lower()
    if ext in skip_ext:
        continue

    if mode == "git-ref":
        text = read_candidate_blob(rel)
    else:
        path = os.path.join(root, rel)
        if not os.path.isfile(path):
            continue
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as handle:
                text = handle.read()
        except OSError as exc:
            print(
                f"TRACKED_SECRET_EXPOSURE_SCAN_FAILED: cannot read {rel}: {exc}",
                file=sys.stderr,
            )
            sys.exit(1)

    scanned += 1
    for label, pattern in patterns:
        if pattern.search(text):
            findings.append((label, rel))

if findings:
    print("TRACKED_SECRET_EXPOSURE_DETECTED", file=sys.stderr)
    for label, rel in findings:
        # Never echo the matched value itself.
        print(f"  {label}: {rel}", file=sys.stderr)
    sys.exit(1)

print(f"Tracked-secret exposure scan passed ({scanned} text candidates; {len(files)} tracked files enumerated).")
PY
