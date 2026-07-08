/**
 * Shared types for Catalogue Builder AI-Studio draft persistence (PR #225).
 * Mirrors the `catalogue_ai_studio_drafts` / `catalogue_ai_studio_draft_audit_log` tables.
 */
import type { Database } from "@/integrations/supabase/types";

export type CatalogueDraftRow = Database["public"]["Tables"]["catalogue_ai_studio_drafts"]["Row"];
export type CatalogueDraftInsert = Database["public"]["Tables"]["catalogue_ai_studio_drafts"]["Insert"];
export type CatalogueDraftAuditRow =
  Database["public"]["Tables"]["catalogue_ai_studio_draft_audit_log"]["Row"];

export const CATALOGUE_DRAFT_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;
export type CatalogueDraftStatus = (typeof CATALOGUE_DRAFT_STATUSES)[number];

/** The content fields an operator edits in the draft studio — a subset of CatalogueDraftRow. */
export const CATALOGUE_DRAFT_CONTENT_KEYS = [
  "catalogue_title",
  "short_description",
  "long_description",
  "b2b_sales_copy",
  "export_catalogue_copy",
  "whatsapp_product_message",
  "hindi_description",
  "storage_shelf_life_copy",
] as const;

export type CatalogueDraftContentKey = (typeof CATALOGUE_DRAFT_CONTENT_KEYS)[number];

export type CatalogueDraftContent = Record<CatalogueDraftContentKey, string>;
