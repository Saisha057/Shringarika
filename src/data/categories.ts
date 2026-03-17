/**
 * SHARED CATEGORY DEFINITIONS
 * Single source of truth for all product categories
 * Used by:
 * - AdminProductForm dropdown
 * - Product page filtering
 * - Ensures perfect category matching
 */

export const CATEGORIES = [
  "SAREES",
  "UNSTITCHED SUIT",
  "PURE GEORGETTE KURTI",
  "CHANDERI SILK",
  "MUSLIN CLOTH",
  "MUL COTTON",
  "BOTTOM WEARS",
] as const

export type Category = (typeof CATEGORIES)[number]

// Sub-types for additional product classification
export const SUB_TYPES = [
  "SILK",
  "CHIFFON",
  "SHORT KURTI",
  "LONG KURTI",
  "PLAZO SET",
  "CORD SET",
  "NAYRA CUT",
  "STITCHED DHOTI",
  "PLAZO",
  "PANTS",
] as const

export type SubType = (typeof SUB_TYPES)[number]
