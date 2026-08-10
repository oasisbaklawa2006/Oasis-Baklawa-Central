import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Inbox, Loader2, Tag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createCatalogueApprovalService,
  type CatalogueApprovalOutcome,
  type CatalogueDraftKind,
  type CatalogueDraftView,
} from "@/lib/catalogue-approval";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

function outcomeToast(outcome: CatalogueApprovalOutcome) {
  if (outcome.success) {
    toast.success(outcome.message);
  } else if (outcome.kind === "mapping_not_finalized") {
    toast.warning(outcome.message);
  } else if (outcome.kind === "not_authorized") {
    toast.error(outcome.message);
  } else {
    toast.error(outcome.message);
  }
}

function DraftTagCells({ draft }: { draft: Extract<CatalogueDraftView, { kind: "tag" }> }) {
  return (
    <>
      <TableCell className="font-mono text-xs">{draft.tag_key ?? "—"}</TableCell>
      <TableCell>{draft.tag_label ?? "—"}</TableCell>
      <TableCell>{draft.is_active === null ? "—" : draft.is_active ? "Yes" : "No"}</TableCell>
    </>
  );
}

function DraftAliasCells({ draft }: { draft: Extract<CatalogueDraftView, { kind: "alias" }> }) {
  return (
    <>
      <TableCell>{draft.alias_text ?? "—"}</TableCell>
      <TableCell>{draft.canonical_name ?? "—"}</TableCell>
      <TableCell className="font-mono text-xs">{draft.product_id ?? "—"}</TableCell>
    </>
  );
}

function DraftPricingCells({ draft }: { draft: Extract<CatalogueDraftView, { kind: "pricing" }> }) {
  return (
    <>
      <TableCell className="font-mono text-xs">{draft.product_id ?? "—"}</TableCell>
      <TableCell>{draft.price_channel ?? "—"}</TableCell>
      <TableCell>{draft.price_type ?? "—"}</TableCell>
      <TableCell>
        {draft.calculated_price != null ? `${draft.calculated_price} ${draft.currency ?? "INR"}` : "—"}
      </TableCell>
    </>
  );
}

function DraftMoqCells({ draft }: { draft: Extract<CatalogueDraftView, { kind: "moq" }> }) {
  return (
    <>
      <TableCell className="font-mono text-xs">{draft.product_id ?? "—"}</TableCell>
      <TableCell>{draft.channel ?? "—"}</TableCell>
      <TableCell>
        {draft.moq_applicable === false
          ? "Disabled"
          : draft.moq_value != null
            ? `${draft.moq_value} ${draft.moq_uom ?? ""}`
            : "—"}
      </TableCell>
    </>
  );
}

export default function ApprovalInbox() {
  const approval = useMemo(() => createCatalogueApprovalService(supabase), []);
  const [tagDrafts, setTagDrafts] = useState<CatalogueDraftView[]>([]);
  const [aliasDrafts, setAliasDrafts] = useState<CatalogueDraftView[]>([]);
  const [pricingDrafts, setPricingDrafts] = useState<CatalogueDraftView[]>([]);
  const [moqDrafts, setMoqDrafts] = useState<CatalogueDraftView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("Does not meet catalogue standards");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tags, aliases, pricing, moq] = await Promise.all([
        approval.listPendingTagDrafts(),
        approval.listPendingAliasDrafts(),
        approval.listPendingPricingDrafts(),
        approval.listPendingMoqDrafts(),
      ]);
      setTagDrafts(tags);
      setAliasDrafts(aliases);
      setPricingDrafts(pricing);
      setMoqDrafts(moq);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load approval inbox";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [approval]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    draftId: string,
    action: () => Promise<CatalogueApprovalOutcome>,
  ) {
    setBusyId(draftId);
    try {
      const outcome = await action();
      outcomeToast(outcome);
      if (outcome.success || outcome.kind === "mapping_not_finalized") {
        await load();
      }
    } finally {
      setBusyId(null);
    }
  }

  const APPROVE_BY_KIND: Record<CatalogueDraftKind, (draftId: string) => Promise<CatalogueApprovalOutcome>> = {
    tag: (draftId) => approval.approveTagDraft(draftId),
    alias: (draftId) => approval.approveAliasDraft(draftId),
    pricing: (draftId) => approval.approvePricingDraft(draftId),
    moq: (draftId) => approval.approveMoqDraft(draftId),
  };
  const REJECT_BY_KIND: Record<
    CatalogueDraftKind,
    (draftId: string, reason: string) => Promise<CatalogueApprovalOutcome>
  > = {
    tag: (draftId, reason) => approval.rejectTagDraft(draftId, reason),
    alias: (draftId, reason) => approval.rejectAliasDraft(draftId, reason),
    pricing: (draftId, reason) => approval.rejectPricingDraft(draftId, reason),
    moq: (draftId, reason) => approval.rejectMoqDraft(draftId, reason),
  };
  const TARGET_TABLE_LABEL: Record<CatalogueDraftKind, string> = {
    tag: "public.product_tags",
    alias: "public.product_aliases",
    pricing: "public.product_pricing_rules",
    moq: "public.product_moq_rules",
  };

  function renderDraftTable(
    kind: CatalogueDraftKind,
    drafts: CatalogueDraftView[],
  ) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pending drafts…
        </div>
      );
    }

    if (drafts.length === 0) {
      return (
        <p className="py-8 text-sm text-muted-foreground">
          No pending {kind} drafts. Approvals write to{" "}
          <span className="font-mono">{TARGET_TABLE_LABEL[kind]}</span> via Central RPC.
        </p>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Operation</TableHead>
            {kind === "tag" && (
              <>
                <TableHead>tag_key</TableHead>
                <TableHead>tag_label</TableHead>
                <TableHead>is_active</TableHead>
              </>
            )}
            {kind === "alias" && (
              <>
                <TableHead>alias_text</TableHead>
                <TableHead>canonical_name</TableHead>
                <TableHead>product_id</TableHead>
              </>
            )}
            {kind === "pricing" && (
              <>
                <TableHead>product_id</TableHead>
                <TableHead>channel</TableHead>
                <TableHead>price_type</TableHead>
                <TableHead>price</TableHead>
              </>
            )}
            {kind === "moq" && (
              <>
                <TableHead>product_id</TableHead>
                <TableHead>channel</TableHead>
                <TableHead>moq</TableHead>
              </>
            )}
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {drafts.map((draft) => (
            <TableRow key={draft.draftId}>
              <TableCell>
                <Badge variant="outline">{draft.operation}</Badge>
              </TableCell>
              {draft.kind === "tag" && <DraftTagCells draft={draft} />}
              {draft.kind === "alias" && <DraftAliasCells draft={draft} />}
              {draft.kind === "pricing" && <DraftPricingCells draft={draft} />}
              {draft.kind === "moq" && <DraftMoqCells draft={draft} />}
              <TableCell className="text-xs text-muted-foreground">
                {draft.submitted_at
                  ? new Date(draft.submitted_at).toLocaleString()
                  : "—"}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button
                  size="sm"
                  disabled={busyId === draft.draftId}
                  onClick={() =>
                    void runAction(draft.draftId, () => APPROVE_BY_KIND[kind](draft.draftId))
                  }
                >
                  {busyId === draft.draftId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  <span className="sr-only">Approve</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busyId === draft.draftId}
                  onClick={() =>
                    void runAction(draft.draftId, () =>
                      REJECT_BY_KIND[kind](draft.draftId, rejectReason),
                    )
                  }
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Reject</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Inbox className="h-6 w-6" />
            Catalogue Approval Inbox
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Review tag, alias, pricing, and MOQ drafts submitted from AI Studio. Pricing and MOQ
            are Central/Core-governed commercial authority — AI Studio can only propose changes
            here; approval or rejection in Central is the only way they take effect.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reject reason</CardTitle>
          <CardDescription>Applied when rejecting a draft (RPC requires a reason).</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="reject-reason" className="sr-only">
            Reject reason
          </Label>
          <Input
            id="reject-reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="tags">
        <TabsList>
          <TabsTrigger value="tags" className="gap-2">
            <Tag className="h-4 w-4" />
            Tag drafts
            <Badge variant="secondary">{tagDrafts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="aliases">
            Alias drafts
            <Badge variant="secondary">{aliasDrafts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pricing">
            Pricing drafts
            <Badge variant="secondary">{pricingDrafts.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="moq">
            MOQ drafts
            <Badge variant="secondary">{moqDrafts.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="tags" className="mt-4">
          <Card>
            <CardContent className="pt-6">{renderDraftTable("tag", tagDrafts)}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="aliases" className="mt-4">
          <Card>
            <CardContent className="pt-6">{renderDraftTable("alias", aliasDrafts)}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardContent className="pt-6">{renderDraftTable("pricing", pricingDrafts)}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="moq" className="mt-4">
          <Card>
            <CardContent className="pt-6">{renderDraftTable("moq", moqDrafts)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
