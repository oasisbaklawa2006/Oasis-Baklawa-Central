/**
 * Deterministic, frontend-only catalogue readiness scoring for Catalogue Builder.
 * Reads only existing product fields already returned by the products table — no new
 * backend status column is invented and no field is mutated here.
 */

export type ReadinessState = "pass" | "warn" | "missing";

export interface ReadinessCategory {
  key: string;
  label: string;
  state: ReadinessState;
  detail: string;
  nextAction: string | null;
}

export interface ReadinessResult {
  score: number;
  overallLabel: "Catalogue-ready" | "Needs attention" | "Not ready";
  categories: ReadinessCategory[];
}

export interface ReadinessProductInput {
  name?: string | null;
  description?: string | null;
  sku?: string | null;
  category?: string | null;
  production_department?: string | null;
  uom?: string | null;
  settlement_unit?: string | null;
  carton_type?: string | null;
  packs_per_master_carton?: number | null;
  image_url?: string | null;
  is_active?: boolean | null;
  visible_in_catalog?: boolean | null;
  shelf_life?: string | null;
  storage_type?: string | null;
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

const STATE_POINTS: Record<ReadinessState, number> = { pass: 2, warn: 1, missing: 0 };

function buildIdentity(p: ReadinessProductInput): ReadinessCategory {
  if (!hasText(p.name)) {
    return {
      key: "identity",
      label: "Identity",
      state: "missing",
      detail: "Product name is blank.",
      nextAction: "Add a clear, buyer-recognizable product name.",
    };
  }
  if (!hasText(p.description)) {
    return {
      key: "identity",
      label: "Identity",
      state: "warn",
      detail: "Name is set, but the description is blank.",
      nextAction: "Add a short description so buyers understand what this product is.",
    };
  }
  return { key: "identity", label: "Identity", state: "pass", detail: "Name and description are set.", nextAction: null };
}

function buildSku(p: ReadinessProductInput): ReadinessCategory {
  if (!hasText(p.sku)) {
    return {
      key: "sku",
      label: "SKU",
      state: "missing",
      detail: "No SKU code on this product.",
      nextAction: "Open in Product Catalogue and let the SKU auto-generate, or set one manually.",
    };
  }
  return { key: "sku", label: "SKU", state: "pass", detail: `SKU: ${p.sku}`, nextAction: null };
}

function buildCategoryType(p: ReadinessProductInput): ReadinessCategory {
  if (!hasText(p.category)) {
    return {
      key: "category_type",
      label: "Category / Type",
      state: "missing",
      detail: "No catalogue category set.",
      nextAction: "Set a Category so buyers can browse to this product.",
    };
  }
  if (!hasText(p.production_department)) {
    return {
      key: "category_type",
      label: "Category / Type",
      state: "warn",
      detail: `Category is "${p.category}", but Target Department is not set.`,
      nextAction: "Set Target Department so orders route to the correct factory queue.",
    };
  }
  return {
    key: "category_type",
    label: "Category / Type",
    state: "pass",
    detail: `Category: ${p.category} · Department: ${p.production_department}`,
    nextAction: null,
  };
}

function buildUnitSettlement(p: ReadinessProductInput): ReadinessCategory {
  const hasUom = hasText(p.uom);
  const hasSettlement = hasText(p.settlement_unit);
  if (!hasUom && !hasSettlement) {
    return {
      key: "unit_settlement",
      label: "Unit / Settlement",
      state: "missing",
      detail: "Unit of Measure and Settlement Unit are both blank.",
      nextAction: "Set Unit of Measure and Settlement Unit so pricing and downstream unit math work.",
    };
  }
  if (!hasUom || !hasSettlement) {
    return {
      key: "unit_settlement",
      label: "Unit / Settlement",
      state: "warn",
      detail: !hasUom ? "Settlement Unit is set, but Unit of Measure is blank." : "Unit of Measure is set, but Settlement Unit is blank.",
      nextAction: !hasUom ? "Set Unit of Measure (buyer-facing price label)." : "Set Settlement Unit (how downstream operations settle this line).",
    };
  }
  return {
    key: "unit_settlement",
    label: "Unit / Settlement",
    state: "pass",
    detail: `UOM: ${p.uom} · Settlement: ${p.settlement_unit}`,
    nextAction: null,
  };
}

function buildPackaging(p: ReadinessProductInput): ReadinessCategory {
  const hasCarton = hasText(p.carton_type);
  const hasPacks = Boolean(p.packs_per_master_carton && p.packs_per_master_carton > 0);
  if (!hasCarton && !hasPacks) {
    return {
      key: "packaging",
      label: "Packaging / Carton",
      state: "missing",
      detail: "No carton type or packs-per-carton set.",
      nextAction: "Fill in both Carton Type and Packs / Carton.",
    };
  }
  if (!hasCarton) {
    return {
      key: "packaging",
      label: "Packaging / Carton",
      state: "warn",
      detail: "Packs / Carton is set, but Carton Type has not been calculated yet.",
      nextAction: "Fill in Carton Type.",
    };
  }
  if (!hasPacks) {
    return {
      key: "packaging",
      label: "Packaging / Carton",
      state: "warn",
      detail: "Carton type is set, but Packs / Carton is blank.",
      nextAction: "Fill in Packs / Carton.",
    };
  }
  return {
    key: "packaging",
    label: "Packaging / Carton",
    state: "pass",
    detail: `Carton: ${p.carton_type} · ${p.packs_per_master_carton} packs/carton`,
    nextAction: null,
  };
}

function buildHeroImage(p: ReadinessProductInput): ReadinessCategory {
  if (!hasText(p.image_url)) {
    return {
      key: "hero_image",
      label: "Hero Image",
      state: "missing",
      detail: "No hero image set — a placeholder icon is shown in the catalogue.",
      nextAction: "Add a hero image URL or upload one in Product Catalogue.",
    };
  }
  return { key: "hero_image", label: "Hero Image", state: "pass", detail: "Hero image is set.", nextAction: null };
}

function buildCatalogueVisibility(p: ReadinessProductInput): ReadinessCategory {
  const isActive = p.is_active ?? true;
  const isVisible = p.visible_in_catalog ?? true;
  if (!isActive) {
    return {
      key: "catalogue_visibility",
      label: "Catalogue Visibility",
      state: "missing",
      detail: "Product is inactive — not usable anywhere.",
      nextAction: "Turn on \"Product is Active\" if this SKU should be usable again.",
    };
  }
  if (!isVisible) {
    return {
      key: "catalogue_visibility",
      label: "Catalogue Visibility",
      state: "warn",
      detail: "Active but hidden from the storefront (internal / BOM-only).",
      nextAction: "Confirm this is intentional, or turn off \"Internal BOM Use Only\" to show it to buyers.",
    };
  }
  return {
    key: "catalogue_visibility",
    label: "Catalogue Visibility",
    state: "pass",
    detail: "Active and visible to buyers.",
    nextAction: null,
  };
}

function buildShelfStorage(p: ReadinessProductInput): ReadinessCategory | null {
  const hasShelfLife = hasText(p.shelf_life);
  const hasStorage = hasText(p.storage_type);
  if (!hasShelfLife && !hasStorage) return null; // fields not in use for this product — omit rather than guess
  if (!hasShelfLife || !hasStorage) {
    return {
      key: "shelf_storage",
      label: "Shelf Life / Storage",
      state: "warn",
      detail: !hasShelfLife ? "Storage type is set, but Shelf Life (days) is blank." : "Shelf life is set, but Storage Type is blank.",
      nextAction: !hasShelfLife ? "Set Shelf Life (days)." : "Set Storage Type.",
    };
  }
  return {
    key: "shelf_storage",
    label: "Shelf Life / Storage",
    state: "pass",
    detail: `${p.shelf_life} days · ${p.storage_type}`,
    nextAction: null,
  };
}

export function computeCatalogueReadiness(product: ReadinessProductInput): ReadinessResult {
  const categories = [
    buildIdentity(product),
    buildSku(product),
    buildCategoryType(product),
    buildUnitSettlement(product),
    buildPackaging(product),
    buildHeroImage(product),
    buildCatalogueVisibility(product),
    buildShelfStorage(product),
  ].filter((c): c is ReadinessCategory => c !== null);

  const earned = categories.reduce((sum, c) => sum + STATE_POINTS[c.state], 0);
  const possible = categories.length * STATE_POINTS.pass;
  const score = possible > 0 ? Math.round((earned / possible) * 100) : 0;

  const hasMissing = categories.some((c) => c.state === "missing");
  const allPass = categories.every((c) => c.state === "pass");
  // "Catalogue-ready" requires both the score threshold AND every category passing —
  // a single warn category (e.g. hidden-from-storefront visibility) must never be labelled ready.
  const overallLabel: ReadinessResult["overallLabel"] =
    allPass && score >= 90 ? "Catalogue-ready" : hasMissing ? "Not ready" : "Needs attention";

  return { score, overallLabel, categories };
}
