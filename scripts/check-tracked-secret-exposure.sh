#!/usr/bin/env bash
# Point 3 / 3j — fail closed on high-confidence secret VALUES in tracked files.
# Secret names, placeholders, and Supabase publishable/anon keys are allowed.
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

mapfile -t FILES < <(git ls-files)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No tracked files to scan."
  exit 0
fi

python3 - "$ROOT" "${FILES[@]}" <<'PY'
import os
import re
import sys

root = sys.argv[1]
files = sys.argv[2:]

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
    ".woff", ".woff2", ".ttf", ".eot", ".pdf", ".zip", ".lock",
}

findings = []
for rel in files:
    ext = os.path.splitext(rel)[1].lower()
    if ext in skip_ext:
        continue
    path = os.path.join(root, rel)
    if not os.path.isfile(path):
        continue
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as handle:
            text = handle.read()
    except OSError:
        continue
    for label, pattern in patterns:
        if pattern.search(text):
            findings.append((label, rel))

if findings:
    print("TRACKED_SECRET_EXPOSURE_DETECTED", file=sys.stderr)
    for label, rel in findings:
        print(f"  {label}: {rel}", file=sys.stderr)
    sys.exit(1)

print(f"Tracked-secret exposure scan passed ({len(files)} files).")
PY
