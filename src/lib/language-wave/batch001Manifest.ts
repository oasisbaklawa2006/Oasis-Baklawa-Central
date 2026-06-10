import type { Batch001Product } from "./types";

/** Batch 001 authority set — OAS-AS-BKL-0001 … OAS-AS-BKL-0025 (live Central, 2026-06-09). */
export const BATCH001_PRODUCTS: Batch001Product[] = [
  { sku: "OAS-AS-BKL-0001", productId: "c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0", name: "Cashew Kitta", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0002", productId: "89de33c7-e4c1-475e-b711-18258683fdec", name: "Square Baklawa", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0003", productId: "90e0f9df-d4dc-4ec5-8238-d7a2624e759a", name: "Cashew Ring", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0004", productId: "eb9c7a73-d1df-4bea-bdf1-209a5b386262", name: "Cashew Rosebud", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0005", productId: "691f2fe6-2d25-4ce2-a9fd-d4b81ecb694b", name: "Almond Crosole", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0006", productId: "da4372b9-e1b3-4b17-bdd0-278bd636ab9a", name: "Cashew Pyramid", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0007", productId: "2390ea3d-19ba-43bb-8624-d6b033153c2f", name: "Cashew Finger", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0008", productId: "a6013e20-0fc7-4fe6-b2ab-f7f82d336b0c", name: "Date Baklawa", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0009", productId: "c522fa96-9247-4cf5-9699-a20bc316dc55", name: "Special Square Baklawa", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0010", productId: "7d66f253-a179-4a33-b8ba-7b94ec783a3e", name: "Pistachio Ring", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0011", productId: "2178c1c7-80c2-4ba3-a211-8643dcf57777", name: "Pistachio Pyramid(Topping)", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0012", productId: "4baff7d1-bf58-4d0f-b842-c53f99caac61", name: "Chocolate Pistachio Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0013", productId: "c5e84d04-0d8b-4466-8690-a7e6267b44a8", name: "Chocolate Cashew Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0014", productId: "4af95ba1-ff0f-4740-8869-6a19a41e8c83", name: "Mor Cashew Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0015", productId: "73f91572-8844-4fa6-b267-56210d180468", name: "Mor Pistachio Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0016", productId: "f3f7a8fd-cea8-4ecb-a258-ef1ea86940b7", name: "Pistachio Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0017", productId: "0cb6c64c-0529-4dfc-83cd-9b45ab7f9de6", name: "Cashew Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0018", productId: "2cab3d7f-7593-441e-a030-6ac6ad3ed9bc", name: "Diamond Pistachio", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0019", productId: "636b47cb-ea6f-4711-ae29-d6153e565ae3", name: "Pistachio Pyramid", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0020", productId: "b0aee1c4-4502-4a15-9880-e2c01378c0b5", name: "Tart Cashew", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0021", productId: "6b258e44-69dc-465a-b82a-cbb72f68d723", name: "Mix Nut Tart", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0022", productId: "8554f5d5-5e46-4ffe-b98a-0ed10ec522ae", name: "Almond Tart", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0023", productId: "43a25d30-f7d9-426b-b5af-cae7d477468e", name: "Pistachio Tart", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0024", productId: "cea65af8-129c-4838-988f-30955fa5bc22", name: "Mor Pistachio Durum", category: "Turkish Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0025", productId: "f58e0a78-53a9-400b-8768-7af09b68ba38", name: "Coconut Durum", category: "Turkish Baklawa", packSize: "1kg" },
];

export const BATCH001_SKUS = BATCH001_PRODUCTS.map((p) => p.sku);

export function batch001ProductBySku(sku: string): Batch001Product | undefined {
  return BATCH001_PRODUCTS.find((p) => p.sku === sku);
}

/** SKUs with zero approved `product_aliases` rows before Wave 2C (live audit 2026-06-09). */
export const BATCH001_WAVE2C_SKUS = [
  "OAS-AS-BKL-0002",
  "OAS-AS-BKL-0004",
  "OAS-AS-BKL-0005",
  "OAS-AS-BKL-0006",
  "OAS-AS-BKL-0008",
  "OAS-AS-BKL-0009",
  "OAS-AS-BKL-0011",
  "OAS-AS-BKL-0018",
] as const;

/** Known live cross-SKU alias collisions (same normalized alias → multiple product_id). */
export const BATCH001_LIVE_COLLISIONS: Array<{ term: string; skus: string[] }> = [
  { term: "cashew assiyah", skus: ["OAS-AS-BKL-0013", "OAS-AS-BKL-0014"] },
  { term: "cashew high gap baklawa", skus: ["OAS-AS-BKL-0013", "OAS-AS-BKL-0014"] },
  { term: "cashew high jump baklawa", skus: ["OAS-AS-BKL-0013", "OAS-AS-BKL-0014"] },
];
