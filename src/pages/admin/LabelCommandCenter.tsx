import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, ScanLine } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LabelKind } from "@/lib/barcode/barcodeTypes";
import {
  buildCartonLabelPayload,
  buildCustomerPickupLabelPayload,
  buildDispatchLabelPayload,
  buildFactoryFollowupLabelPayload,
  buildProductLabelPayload,
  buildReservationLabelPayload,
} from "@/lib/barcode/barcodePayloads";
import { LABEL_PRINT_PRESETS } from "@/lib/barcode/labelPrintPresets";
import { listTemplatesForKind } from "@/lib/barcode/labelTemplates";
import { OperationalStatusLabel } from "@/components/admin/OperationalStatusLabel";

const LS_KEY = "label-command-center-preferences-v1";

const OPTIONAL_SECTIONS = [
  { id: "showDisclaimer", label: "Include disclaimer block on preview JSON (recommended)" },
  { id: "showPhysical", label: "Include physical preset dimensions in preview" },
  { id: "compactJson", label: "Compact JSON (single line)" },
] as const;

type SectionId = (typeof OPTIONAL_SECTIONS)[number]["id"];

function loadSections(): Record<SectionId, boolean> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      return { showDisclaimer: true, showPhysical: true, compactJson: false };
    }
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return {
      showDisclaimer: parsed.showDisclaimer !== false,
      showPhysical: parsed.showPhysical !== false,
      compactJson: !!parsed.compactJson,
    };
  } catch {
    return { showDisclaimer: true, showPhysical: true, compactJson: false };
  }
}

function demoPayloadForKind(kind: LabelKind): Record<string, unknown> {
  switch (kind) {
    case "product":
      return buildProductLabelPayload({
        productId: "demo-product",
        productName: "Assorted premium tray",
        sku: "SKU-DEMO-01",
        barcodeText: "SKU-DEMO-01",
      }) as unknown as Record<string, unknown>;
    case "carton":
      return buildCartonLabelPayload({
        cartonId: "CTN-DEMO-1001",
        destinationLabel: "South Extension · cold chain",
        lineItemsSummary: "2 × tray · 1 × pouch",
      }) as unknown as Record<string, unknown>;
    case "dispatch":
      return buildDispatchLabelPayload({
        orderId: "ord-demo-9000",
        dispatchRef: "DSP-DEMO-22",
        destinationLabel: "Noida DC",
      }) as unknown as Record<string, unknown>;
    case "customer_pickup":
      return buildCustomerPickupLabelPayload({
        pickupRef: "PCK-DEMO-77",
        storeName: "Select City Walk",
        customerName: "Guest (demo)",
        pickupWindow: "Sat 11:00–13:00 (provisional)",
      }) as unknown as Record<string, unknown>;
    case "reservation":
      return buildReservationLabelPayload({
        reservationId: "res-demo-local",
        customerName: "Guest (demo)",
        storeName: "Kamla Nagar",
        productLabel: "Arabic sweets tray · 2 kg",
        qtyDisplay: "2",
        pickupDisplay: "2026-06-01 16:00 (operator entry)",
      }) as unknown as Record<string, unknown>;
    case "factory_followup_internal":
      return buildFactoryFollowupLabelPayload({
        followupId: "ff-demo-local",
        department: "Assembly",
        urgency: "normal",
        neededByDisplay: "2026-06-02",
        productLabel: "Wedding bulk mix",
        storeName: "Paschim Vihar",
      }) as unknown as Record<string, unknown>;
    default:
      return { error: "unknown kind" };
  }
}

/**
 * Operator shell — generates JSON payloads only. No print execution or device integration.
 */
export default function LabelCommandCenter() {
  const [kind, setKind] = useState<LabelKind>("product");
  const [sections, setSections] = useState<Record<SectionId, boolean>>(() => loadSections());

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(sections));
    } catch {
      /* ignore quota */
    }
  }, [sections]);

  const templates = useMemo(() => listTemplatesForKind(kind), [kind]);

  const payload = useMemo(() => demoPayloadForKind(kind), [kind]);

  const jsonPreview = useMemo(() => {
    let p: Record<string, unknown> = { ...payload };
    if (!sections.showPhysical) {
      const { physical: _x, ...rest } = p;
      p = rest;
    }
    if (!sections.showDisclaimer) {
      p = Object.fromEntries(Object.entries(p).filter(([k]) => k !== "disclaimer")) as Record<string, unknown>;
    }
    return sections.compactJson ? JSON.stringify(p) : JSON.stringify(p, null, 2);
  }, [payload, sections.compactJson, sections.showDisclaimer, sections.showPhysical]);

  const toggle = useCallback((id: SectionId, checked: boolean) => {
    setSections((s) => ({ ...s, [id]: checked }));
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 pb-24">
      <header className="space-y-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Label command center</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Payloads only
          </Badge>
          <OperationalStatusLabel kind="demo-data" />
          <OperationalStatusLabel kind="preview-only" />
          <OperationalStatusLabel kind="not-persisted" />
        </div>
        <p className="text-sm text-muted-foreground">
          TSC TE244 / compatible thermal layout assumptions. This page builds <span className="font-medium text-foreground">JSON payloads</span>{" "}
          for future print drivers — it does not send jobs to a printer.
        </p>
      </header>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-950 dark:text-amber-50">
        <strong className="font-semibold">Print integration pending.</strong> No USB / spooler / ZPL output is performed here.
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Label type</CardTitle>
          <CardDescription>Choose a logical label family. Templates describe expected fields.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label-kind">Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as LabelKind)}>
              <SelectTrigger id="label-kind" className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product label</SelectItem>
                <SelectItem value="carton">Carton label</SelectItem>
                <SelectItem value="dispatch">Dispatch label</SelectItem>
                <SelectItem value="customer_pickup">Customer pickup label</SelectItem>
                <SelectItem value="reservation">Reservation label</SelectItem>
                <SelectItem value="factory_followup_internal">Internal factory follow-up label</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registered templates</p>
            <ul className="list-inside list-disc space-y-1 text-xs text-muted-foreground">
              {templates.map((t) => (
                <li key={t.id}>
                  <span className="font-mono text-foreground/90">{t.id}</span> — {t.summary}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview options (local only)</p>
            <div className="grid gap-2 sm:grid-cols-1">
              {OPTIONAL_SECTIONS.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                  <Checkbox
                    checked={sections[s.id]}
                    onCheckedChange={(c) => toggle(s.id, c === true)}
                    id={`sec-${s.id}`}
                  />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="payload-preview">Payload preview</Label>
              <Badge variant="secondary" className="text-[10px]">
                {LABEL_PRINT_PRESETS.map((p) => p.id).join(", ")}
              </Badge>
            </div>
            <Textarea id="payload-preview" readOnly className="min-h-[220px] font-mono text-[11px]" value={jsonPreview} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled className="gap-2">
              <Printer className="h-4 w-4" aria-hidden />
              Send to printer (disabled)
            </Button>
            <Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(jsonPreview).catch(() => {})}>
              Copy JSON
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
