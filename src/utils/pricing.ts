/**
 * Global pricing utility for weight-based product pricing.
 *
 * Formulas:
 *   Weight (kg) = product.avg_weight_per_pack (grams conceptually, but stored as kg in DB)
 *                 OR product.net_weight_grams / 1000
 *   Pack Price  = base_price_per_kg * weight_kg
 *   Carton Price = Pack Price * packs_per_master_carton
 */

export function getWeightKg(product: any): number {
  if (product?.avg_weight_per_pack && product.avg_weight_per_pack > 0) {
    return product.avg_weight_per_pack;
  }
  if (product?.net_weight_grams && product.net_weight_grams > 0) {
    return product.net_weight_grams / 1000;
  }
  return 0;
}

export function getBasePerKg(product: any): number {
  return product?.price_per_kg || product?.wholesale_price || product?.base_price || 0;
}

/**
 * Returns the price for a single pack/box.
 * Formula: base_per_kg * weight_kg
 * Falls back to mrp or base_per_kg if weight is unavailable.
 */
export function calculatePackPrice(product: any): number {
  const perKg = getBasePerKg(product);
  const weightKg = getWeightKg(product);

  if (perKg > 0 && weightKg > 0) {
    return perKg * weightKg;
  }
  // Fallback: treat wholesale_price/mrp as flat pack price
  return product?.mrp || perKg || 0;
}

/**
 * Returns the price for a full master carton.
 * Formula: packPrice * packs_per_master_carton
 */
export function calculateCartonPrice(product: any): number {
  const packPrice = calculatePackPrice(product);
  const packsPerCarton = product?.packs_per_master_carton || product?.packs_per_carton || 1;
  return packPrice * packsPerCarton;
}

/**
 * Returns the line-item total for a given quantity of packs.
 */
export function calculateLineTotal(product: any, quantity: number): number {
  return calculatePackPrice(product) * quantity;
}
