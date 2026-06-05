#!/usr/bin/env python3
"""Inspect customer master Excel workbooks at fixed /mnt/data paths only.

Usage (where /mnt/data is mounted):
  python3 scripts/inspect_customer_master_workbook.py

Outputs JSON with sheet names, header rows, row counts, and sample rows.
Does NOT import into database.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Install openpyxl: pip install openpyxl", file=sys.stderr)
    sys.exit(1)

AUDIT_PATH = Path("/mnt/data/oasis_customer_master_audit_import_plan.xlsx")
ORIGINAL_PATH = Path("/mnt/data/Copy of Party (1).xlsx")

SAMPLE_ROWS = 3


def inspect_workbook(path: Path) -> dict:
    if not path.is_file():
        return {"path": str(path), "error": "file_not_found"}

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheets: dict[str, dict] = {}

    for name in wb.sheetnames:
        ws = wb[name]
        rows_iter = ws.iter_rows(values_only=True)
        header = next(rows_iter, None)
        data_count = 0
        samples: list[list] = []
        for row in rows_iter:
            if not any(c is not None and str(c).strip() for c in row):
                continue
            data_count += 1
            if len(samples) < SAMPLE_ROWS:
                samples.append([None if c is None else str(c) for c in row])
        sheets[name] = {
            "header": [None if c is None else str(c) for c in header] if header else [],
            "data_row_count": data_count,
            "sample_rows": samples,
        }

    wb.close()
    return {"path": str(path), "sheet_names": wb.sheetnames if False else list(sheets.keys()), "sheets": sheets}


def main() -> int:
    report = {
        "audit_workbook": inspect_workbook(AUDIT_PATH),
        "original_workbook": inspect_workbook(ORIGINAL_PATH),
    }
    print(json.dumps(report, indent=2))
    missing = [
        k
        for k, v in report.items()
        if isinstance(v, dict) and v.get("error") == "file_not_found"
    ]
    if missing:
        print(f"\nMissing files: {missing}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
