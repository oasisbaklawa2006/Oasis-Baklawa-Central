# Barcode / label foundation — status

Last updated: 2026-05-24

## Scope

Foundation for **thermal label payloads** (TSC TE244–class assumptions) used by retail, dispatch, and factory coordination surfaces. **No print execution**, no device drivers, no stock writes.

## Delivered

| Path | Purpose |
|------|---------|
| `src/lib/barcode/barcodeTypes.ts` | `LabelKind`, `LabelPhysicalPreset`, schema version |
| `src/lib/barcode/labelPrintPresets.ts` | Static TE244-compatible dimensions (informational dots) |
| `src/lib/barcode/labelTemplates.ts` | Template descriptors per label kind |
| `src/lib/barcode/barcodePayloads.ts` | Pure JSON-serializable payload builders |
| `src/pages/admin/LabelCommandCenter.tsx` | Operator UI shell — preview, local checkbox prefs, copy JSON |
| `/admin/label-command-center` | Route (admin staff) |

## Label kinds

1. Product  
2. Carton  
3. Dispatch  
4. Customer pickup  
5. Reservation (includes “not guaranteed until manually verified” disclaimer)  
6. Internal factory follow-up  

## Explicit non-goals

- ZPL / TSPL / driver output  
- USB / Bluetooth pairing  
- GS1 assignment authority  
- Automatic printing on order state changes  

## Next steps

- Choose canonical **barcode symbology** per label (Code128 vs QR) and field lengths.  
- Add **print adapter** interface (still behind feature flag) with queue + audit.  
- Wire **reservation id** from backend when persistence exists.
