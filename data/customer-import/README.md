# Customer Import Source Files (Phase 1)

Place Tally export workbooks here before running Phase 1:

- `sale.xlsx`
- `party.xlsx`
- `outstanding.xlsx`
- `address.xls`

Run:

```bash
python3 scripts/customer_import_phase1_pipeline.py --emit-sql
```

Then apply generated SQL to staging (`customer_import_*` tables only). No promotion.
