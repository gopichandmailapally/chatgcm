/**
 * Deterministic Cloth Hanger Pricing & Estimation Engine (2026)
 * Strictly adheres to Chat GCM Cloth Hangers Pricing Rules:
 *
 * 1. Base Pricing (Installation Included):
 *    Size | Ceiling Mounted (6 Rods) | Wall Mounted (6 Rods)
 *    4 ft | ₹2,500                   | ₹3,000
 *    5 ft | ₹2,750                   | ₹3,250
 *    6 ft | ₹3,000                   | ₹3,500
 *    7 ft | ₹3,250                   | ₹3,750
 *    8 ft | ₹3,500                   | ₹4,000
 *
 * 2. Specifications:
 *    - SS304 stainless steel
 *    - 16mm diameter pipes
 *    - Metal brackets, not plastic
 *    - 4mm ropes
 *    - 6 rods per unit
 *
 * 3. Location Charges:
 *    - Within Hyderabad city: Base price (no extra charge)
 *    - Outside Hyderabad city: Add ₹500 per unit for both categories
 *
 * 4. Formula:
 *    Total = (Base Price + Outside Hyderabad Charge) × Quantity
 *    (Wall-mounted surcharge of ₹500 is already included in the wall-mounted table prices.
 *     Do not add installation charges again).
 */

export type ClothHangerMounting = 'ceiling' | 'wall';
export type ClothHangerSize = 4 | 5 | 6 | 7 | 8;

export interface ClothHangerInput {
  sizeFt: ClothHangerSize;
  mountingType: ClothHangerMounting;
  quantity?: number; // default 1
  isOutsideHyderabad?: boolean;
  locationCity?: string;
}

export interface ClothHangerResult {
  productName: string;
  sizeFt: ClothHangerSize;
  mountingType: ClothHangerMounting;
  mountingLabel: string;
  quantity: number;
  baseUnitPrice: number;
  locationChargePerUnit: number;
  finalUnitPrice: number;
  grossAmount: number;
  totalAmount: number;
  isOutsideHyderabad: boolean;
  locationLabel: string;
  specifications: {
    material: string;
    pipeDiameter: string;
    bracketType: string;
    ropeThickness: string;
    rodsCount: number;
    installationIncluded: boolean;
  };
  summaryText: string;
}

// Master Pricing Matrix (Base price includes installation & wall-mounted surcharge where applicable)
export const CLOTH_HANGER_BASE_PRICES: Record<ClothHangerMounting, Record<ClothHangerSize, number>> = {
  ceiling: {
    4: 2500,
    5: 2750,
    6: 3000,
    7: 3250,
    8: 3500
  },
  wall: {
    4: 3000,
    5: 3250,
    6: 3500,
    7: 3750,
    8: 4000
  }
};

export const OUTSIDE_HYDERABAD_HANGER_SURCHARGE = 500; // Per unit

/**
 * Calculates deterministic pricing for cloth drying hangers
 */
export function calculateClothHanger(input: ClothHangerInput): ClothHangerResult {
  const size = input.sizeFt;
  if (![4, 5, 6, 7, 8].includes(size)) {
    throw new Error(`Invalid cloth hanger size: ${size} ft. Available sizes are 4, 5, 6, 7, and 8 ft.`);
  }

  const mounting: ClothHangerMounting = input.mountingType === 'wall' ? 'wall' : 'ceiling';
  const qty = Math.max(1, Math.floor(input.quantity || 1));
  const isOutside = input.isOutsideHyderabad === true;

  const baseUnitPrice = CLOTH_HANGER_BASE_PRICES[mounting][size];
  const locationChargePerUnit = isOutside ? OUTSIDE_HYDERABAD_HANGER_SURCHARGE : 0;
  const finalUnitPrice = baseUnitPrice + locationChargePerUnit;
  const totalAmount = finalUnitPrice * qty;

  const mountingLabel = mounting === 'ceiling' ? 'Ceiling Mounted (6 Rods)' : 'Wall Mounted (6 Rods)';
  const locationLabel = isOutside
    ? (input.locationCity ? `${input.locationCity} (Outside Hyderabad)` : 'Outside Hyderabad (+₹500/unit)')
    : 'Hyderabad City';

  return {
    productName: `SS304 6-Rod Cloth Drying Hanger (${mountingLabel}, ${size} ft)`,
    sizeFt: size,
    mountingType: mounting,
    mountingLabel,
    quantity: qty,
    baseUnitPrice,
    locationChargePerUnit,
    finalUnitPrice,
    grossAmount: baseUnitPrice * qty,
    totalAmount,
    isOutsideHyderabad: isOutside,
    locationLabel,
    specifications: {
      material: 'SS304 Stainless Steel',
      pipeDiameter: '16mm Heavy-Duty Pipes',
      bracketType: 'High-Strength Metal Brackets (No Plastic)',
      ropeThickness: '4mm High-Tensile Nylon Cord',
      rodsCount: 6,
      installationIncluded: true
    },
    summaryText: `${qty} unit${qty > 1 ? 's' : ''} of ${size} ft ${mounting === 'ceiling' ? 'Ceiling' : 'Wall'} Cloth Hanger in ${locationLabel} = ₹${totalAmount.toLocaleString('en-IN')} (includes complete installation)`
  };
}
