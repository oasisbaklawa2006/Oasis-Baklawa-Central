import type { LabelPhysicalPreset } from "./barcodeTypes";

/**
 * Static presets for TSC TE244 / similar 4" thermal printers.
 * Values are design-time assumptions only — no calibration or device I/O.
 */

export const TSC_TE244_99x38_PRESET: LabelPhysicalPreset = {
  id: "tsc-te244-99x38",
  printerFamily: "tsc_te244_compatible",
  widthMm: 99,
  heightMm: 38,
  dpi: 203,
  /** ~99mm at 203 dpi */
  printableWidthDots: 792,
  /** ~38mm at 203 dpi */
  printableHeightDots: 304,
};

export const LABEL_PRINT_PRESETS: readonly LabelPhysicalPreset[] = [TSC_TE244_99x38_PRESET];
