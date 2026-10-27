/**
 * Deterministic Invisible Grill Pricing & Estimation Engine (2026)
 * Strictly adheres to Chat GCM Invisible Grills Pricing Rules:
 *
 * 1. Hyderabad City Pricing:
 *    Total Installation Area | Hyderabad Price
 *    Below 60 SFT            | ₹10,000 fixed
 *    60–100 SFT              | ₹160/SFT
 *    101–200 SFT             | ₹140/SFT
 *    201–300 SFT             | ₹130/SFT
 *    301–500 SFT             | ₹120/SFT
 *    501–1,000 SFT           | ₹110/SFT
 *    Above 1,000 SFT         | ₹100/SFT
 *
 * 2. Outside Hyderabad Pricing (Add ₹30/SFT to every category):
 *    Total Installation Area | Outside Hyderabad Price
 *    Below 60 SFT            | ₹10,000 + ₹30 × Actual SFT
 *    60–100 SFT              | ₹190/SFT
 *    101–200 SFT             | ₹170/SFT
 *    201–300 SFT             | ₹160/SFT
 *    301–500 SFT             | ₹150/SFT
 *    501–1,000 SFT           | ₹140/SFT
 *    Above 1,000 SFT         | ₹130/SFT
 *
 * 3. Calculation Rules:
 *    - Below 60 SFT: Apply the fixed ₹10,000 base price.
 *    - For outside Hyderabad, add ₹30 multiplied by actual SFT, including below 60 SFT.
 *    - From 60 SFT onward, multiply the entire installation area by applicable slab rate.
 *    - Do not use progressive slab calculations.
 *    - Do not add the ₹30/SFT surcharge twice.
 *    - Calculate total area across all requested openings before selecting the applicable slab.
 *    - Do not invent discounts or extra charges.
 */

export interface GrillOpening {
  widthFt: number;
  heightFt: number;
  count?: number;
  name?: string;
}

export interface InvisibleGrillInput {
  totalAreaSft?: number;
  openings?: GrillOpening[];
  isOutsideHyderabad?: boolean;
  locationCity?: string;
  wireDiameter?: '2.5mm' | '2.0mm' | '3.0mm'; // Default 2.5mm
  spacing?: '2-inch' | '3-inch'; // Default 2-inch
}

export interface InvisibleGrillResult {
  productName: string;
  totalAreaSft: number;
  isMinimumBillingApplied: boolean;
  slabName: string;
  baseRatePerSft: number; // 0 if below 60 SFT (fixed ₹10,000)
  locationSurchargePerSft: number; // ₹30 if outside Hyderabad, 0 if within
  effectiveRatePerSft: number; // Total per SFT rate applied (e.g. ₹160 or ₹190)
  fixedBaseAmount: number; // ₹10,000 if < 60 SFT, 0 otherwise
  locationChargeAmount: number; // ₹30 × SFT if outside Hyderabad & < 60 SFT; incorporated in rate if >= 60 SFT
  totalAmount: number;
  isOutsideHyderabad: boolean;
  locationLabel: string;
  openingsBreakdown: Array<{
    name: string;
    dimensions: string;
    count: number;
    areaSft: number;
  }>;
  specifications: {
    wireGrade: string;
    wireDiameter: string;
    coating: string;
    gapSpacing: string;
    trackMaterial: string;
    warrantyYears: number;
    installationIncluded: boolean;
  };
  summaryText: string;
}

export const HYD_FIXED_BELOW_60 = 10000;
export const OUTSIDE_HYD_RATE_SURCHARGE = 30; // ₹30 per SFT

interface SlabRateDefinition {
  name: string;
  minSft: number;
  maxSft: number;
  hydRate: number;
}

const SLAB_RATES: SlabRateDefinition[] = [
  { name: '60–100 SFT', minSft: 60, maxSft: 100, hydRate: 160 },
  { name: '101–200 SFT', minSft: 101, maxSft: 200, hydRate: 140 },
  { name: '201–300 SFT', minSft: 201, maxSft: 300, hydRate: 130 },
  { name: '301–500 SFT', minSft: 301, maxSft: 500, hydRate: 120 },
  { name: '501–1,000 SFT', minSft: 501, maxSft: 1000, hydRate: 110 },
  { name: 'Above 1,000 SFT', minSft: 1001, maxSft: Infinity, hydRate: 100 }
];

/**
 * Calculates deterministic pricing for Invisible Grills
 */
export function calculateInvisibleGrills(input: InvisibleGrillInput): InvisibleGrillResult {
  let totalArea = 0;
  const openingsBreakdown: Array<{
    name: string;
    dimensions: string;
    count: number;
    areaSft: number;
  }> = [];

  if (input.openings && input.openings.length > 0) {
    for (let i = 0; i < input.openings.length; i++) {
      const op = input.openings[i];
      const count = op.count && op.count > 0 ? Math.floor(op.count) : 1;
      const sft = Math.round(op.widthFt * op.heightFt * count * 100) / 100;
      totalArea += sft;
      openingsBreakdown.push({
        name: op.name || `Opening ${i + 1}`,
        dimensions: `${op.widthFt} × ${op.heightFt} ft`,
        count,
        areaSft: sft
      });
    }
  } else if (input.totalAreaSft && input.totalAreaSft > 0) {
    totalArea = Math.round(input.totalAreaSft * 100) / 100;
    openingsBreakdown.push({
      name: 'Total Balcony / Window Opening',
      dimensions: `${totalArea} SFT`,
      count: 1,
      areaSft: totalArea
    });
  } else {
    throw new Error('Total area or openings with dimensions must be provided.');
  }

  const isOutside = input.isOutsideHyderabad === true;
  const locationLabel = isOutside
    ? (input.locationCity ? `${input.locationCity} (Outside Hyderabad)` : 'Outside Hyderabad (+₹30/SFT)')
    : 'Hyderabad City';

  const wireDiameter = input.wireDiameter || '2.5mm';
  const spacing = input.spacing || '2-inch';

  let slabName = '';
  let baseRatePerSft = 0;
  let effectiveRatePerSft = 0;
  let fixedBaseAmount = 0;
  let locationChargeAmount = 0;
  let totalAmount = 0;
  let isMinimumBillingApplied = false;

  // Below 60 SFT rule
  if (totalArea < 60) {
    isMinimumBillingApplied = true;
    slabName = 'Below 60 SFT';
    fixedBaseAmount = HYD_FIXED_BELOW_60;

    if (isOutside) {
      locationChargeAmount = Math.round(OUTSIDE_HYD_RATE_SURCHARGE * totalArea);
      totalAmount = fixedBaseAmount + locationChargeAmount;
      effectiveRatePerSft = Math.round((totalAmount / totalArea) * 100) / 100;
    } else {
      locationChargeAmount = 0;
      totalAmount = fixedBaseAmount;
      effectiveRatePerSft = Math.round((totalAmount / totalArea) * 100) / 100;
    }
  } else {
    // 60 SFT and above: Match applicable slab
    const slab = SLAB_RATES.find(s => totalArea >= s.minSft && totalArea <= s.maxSft) || SLAB_RATES[SLAB_RATES.length - 1];
    slabName = slab.name;
    baseRatePerSft = slab.hydRate;
    effectiveRatePerSft = isOutside ? baseRatePerSft + OUTSIDE_HYD_RATE_SURCHARGE : baseRatePerSft;
    totalAmount = Math.round(totalArea * effectiveRatePerSft);
    locationChargeAmount = isOutside ? Math.round(totalArea * OUTSIDE_HYD_RATE_SURCHARGE) : 0;
  }

  const summaryText = isMinimumBillingApplied
    ? (isOutside
        ? `For ${totalArea} SFT in ${locationLabel}: Fixed Base ₹${fixedBaseAmount.toLocaleString('en-IN')} + Location Charge ₹${locationChargeAmount.toLocaleString('en-IN')} (₹30 × ${totalArea} SFT) = Total ₹${totalAmount.toLocaleString('en-IN')} (includes installation & 10-year warranty)`
        : `For ${totalArea} SFT in ${locationLabel}: Fixed Minimum Billing = ₹${totalAmount.toLocaleString('en-IN')} (includes installation & 10-year warranty)`)
    : `For ${totalArea} SFT in ${locationLabel}: Slab ${slabName} at ₹${effectiveRatePerSft}/SFT = Total ₹${totalAmount.toLocaleString('en-IN')} (includes installation & 10-year warranty)`;

  return {
    productName: 'AISI 316 Marine Grade Balcony & Window Invisible Grills',
    totalAreaSft: totalArea,
    isMinimumBillingApplied,
    slabName,
    baseRatePerSft,
    locationSurchargePerSft: isOutside ? OUTSIDE_HYD_RATE_SURCHARGE : 0,
    effectiveRatePerSft,
    fixedBaseAmount,
    locationChargeAmount,
    totalAmount,
    isOutsideHyderabad: isOutside,
    locationLabel,
    openingsBreakdown,
    specifications: {
      wireGrade: 'AISI 316 Marine Grade Stainless Steel (High-Tensile 450+ kg Breaking Load)',
      wireDiameter,
      coating: 'DuPont Transparent Anti-Scratch Nylon Casing',
      gapSpacing: `${spacing} Gap Spacing`,
      trackMaterial: 'Heavy-Duty Aluminum H-Track with SS Stiffeners',
      warrantyYears: 10,
      installationIncluded: true
    },
    summaryText
  };
}
