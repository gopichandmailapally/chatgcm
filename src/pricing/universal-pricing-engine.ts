/**
 * Chat GCM — Universal Centralized Pricing & Estimation Engine
 * 
 * Single Source of Truth for:
 * 1. Installed Safety Nets (Boundary correction: <100 SFT min charge, exactly 100 SFT = 100 × 101-250 rate, >100 SFT slab)
 * 2. Cricket Nets Braided Bags (2mm & 2.5mm at 40mm & 45mm: Half bag, 1 bag, 2-3 bags, 4-5 bags, 5+ bags, explicit mixed bag policy)
 * 3. 1.5mm Twisted Cricket Nets (500-3300 @ ₹5.00, 3301-5000 @ ₹4.75, 5001-10000 @ ₹4.50, 10001+ @ ₹4.25, +₹0.50 customization, 5% GST)
 * 4. Turf Installation Accessories (Silica Sand ₹8/kg @ 5%, Rubber Granules ₹36/kg @ 5%, SPEB 7 Glue ₹370/L @ 18%, Seaming Tape ₹45/m @ 5%)
 * 5. Unified Turf Estimation (Independent line-item calculation with dedicated units, rates, GSTs & transport)
 * 6. Admin Matrix Management, Effective Dates, Tenant Overrides, Audit Logs & Calculation Previews.
 */

import { db } from '../db/database.js';

// ═════════════════════════════════════════════════════════════════════════════
// 1. INSTALLED SAFETY NETS (SECTION 1)
// ═════════════════════════════════════════════════════════════════════════════

export interface InstalledNetQuality {
  id: string;
  name: string;
  thicknessMm: number;
  meshMm: number;
  minCharge: number; // Applied strictly below 100 SFT
  slabs: {
    '101-250': { min: number; max: number; standard: number };
    '251-500': { min: number; max: number; standard: number };
    '501-1000': { min: number; max: number; standard: number };
    'above-1000': { min: number; max: number; standard: number };
  };
}

export const INSTALLED_SAFETY_NET_QUALITIES: Record<string, InstalledNetQuality> = {
  '1.5mm_30mm': {
    id: '1.5mm_30mm',
    name: '1.5mm Invisible / Monofilament Anti-Pigeon Net (30mm)',
    thicknessMm: 1.5,
    meshMm: 30,
    minCharge: 1500,
    slabs: {
      '101-250': { min: 16, max: 20, standard: 18 },
      '251-500': { min: 14, max: 18, standard: 16 },
      '501-1000': { min: 12, max: 16, standard: 14 },
      'above-1000': { min: 10, max: 14, standard: 12 }
    }
  },
  '2.0mm_40mm': {
    id: '2.0mm_40mm',
    name: '2.0mm High-Tenacity RUSSEA™ Balcony Net (40mm)',
    thicknessMm: 2.0,
    meshMm: 40,
    minCharge: 1650,
    slabs: {
      '101-250': { min: 24, max: 28, standard: 26 },
      '251-500': { min: 20, max: 24, standard: 22 },
      '501-1000': { min: 18, max: 22, standard: 20 },
      'above-1000': { min: 14, max: 18, standard: 16 }
    }
  },
  '2.0mm_45mm': {
    id: '2.0mm_45mm',
    name: '2.0mm High-Tenacity RUSSEA™ Balcony Net (45mm)',
    thicknessMm: 2.0,
    meshMm: 45,
    minCharge: 1650,
    slabs: {
      '101-250': { min: 22, max: 26, standard: 24 },
      '251-500': { min: 18, max: 22, standard: 20 },
      '501-1000': { min: 16, max: 20, standard: 18 },
      'above-1000': { min: 12, max: 16, standard: 14 }
    }
  },
  '2.0mm_50mm': {
    id: '2.0mm_50mm',
    name: '2.0mm High-Tenacity RUSSEA™ Balcony Net (50mm)',
    thicknessMm: 2.0,
    meshMm: 50,
    minCharge: 1650,
    slabs: {
      '101-250': { min: 20, max: 24, standard: 22 },
      '251-500': { min: 16, max: 20, standard: 18 },
      '501-1000': { min: 14, max: 18, standard: 16 },
      'above-1000': { min: 10, max: 14, standard: 12 }
    }
  },
  '2.5mm_40mm': {
    id: '2.5mm_40mm',
    name: '2.5mm Heavy-Duty RUSSEA™ Balcony & Monkey Net (40mm)',
    thicknessMm: 2.5,
    meshMm: 40,
    minCharge: 1800,
    slabs: {
      '101-250': { min: 26, max: 30, standard: 28 },
      '251-500': { min: 22, max: 26, standard: 24 },
      '501-1000': { min: 20, max: 24, standard: 22 },
      'above-1000': { min: 16, max: 20, standard: 18 }
    }
  }
};

export interface InstalledSafetyNetResult {
  qualityId: string;
  qualityName: string;
  actualAreaSft: number;
  billedAreaSft: number;
  isMinimumChargeApplied: boolean;
  applicableSlab: string;
  ratePerSft: number;
  totalAmount: number;
  explanation: string;
}

/**
 * Calculates Installed Safety Net pricing enforcing strict boundary rules:
 * - Below 100 SFT: Apply previously configured fixed minimum charge.
 * - Exactly 100 SFT: Calculate 100 × applicable 101–250 SFT rate.
 * - Above 100 SFT: Apply appropriate existing quantity slab.
 * Do not apply the fixed minimum charge to exactly 100 SFT.
 */
export function calculateInstalledSafetyNet(
  qualityKey: string,
  actualAreaSft: number,
  rateMode: 'min' | 'max' | 'standard' = 'standard'
): InstalledSafetyNetResult {
  const quality = INSTALLED_SAFETY_NET_QUALITIES[qualityKey] || INSTALLED_SAFETY_NET_QUALITIES['2.0mm_45mm'];
  const sft = Math.round(actualAreaSft);

  if (sft <= 0) {
    throw new Error('Installation area must be greater than 0 SFT.');
  }

  // 1. Below 100 SFT: Fixed Minimum Charge
  if (sft < 100) {
    return {
      qualityId: quality.id,
      qualityName: quality.name,
      actualAreaSft: sft,
      billedAreaSft: 100,
      isMinimumChargeApplied: true,
      applicableSlab: 'below-100-min-charge',
      ratePerSft: Math.round((quality.minCharge / sft) * 100) / 100,
      totalAmount: quality.minCharge,
      explanation: `Below 100 SFT (${sft} SFT): Fixed minimum doorstep visit charge of ₹${quality.minCharge.toLocaleString('en-IN')} applies.`
    };
  }

  // 2. Exactly 100 SFT or between 100 and 250 SFT: 101–250 SFT Slab Rate
  let slabKey: '101-250' | '251-500' | '501-1000' | 'above-1000';
  let slabLabel = '';

  if (sft <= 250) {
    slabKey = '101-250';
    slabLabel = sft === 100 ? 'Exactly 100 SFT (billed at 101–250 SFT rate)' : '101–250 SFT';
  } else if (sft <= 500) {
    slabKey = '251-500';
    slabLabel = '251–500 SFT';
  } else if (sft <= 1000) {
    slabKey = '501-1000';
    slabLabel = '501–1,000 SFT';
  } else {
    slabKey = 'above-1000';
    slabLabel = 'Above 1,000 SFT';
  }

  const rate = quality.slabs[slabKey][rateMode];
  const totalAmount = Math.round(sft * rate);

  return {
    qualityId: quality.id,
    qualityName: quality.name,
    actualAreaSft: sft,
    billedAreaSft: sft,
    isMinimumChargeApplied: false,
    applicableSlab: slabKey,
    ratePerSft: rate,
    totalAmount,
    explanation: sft === 100
      ? `Exactly 100 SFT: Calculated at 100 × ₹${rate}/SFT (${slabLabel}) = ₹${totalAmount.toLocaleString('en-IN')}. Minimum charge NOT applied.`
      : `${sft} SFT: Calculated at ₹${rate}/SFT (${slabLabel}) = ₹${totalAmount.toLocaleString('en-IN')}.`
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. CRICKET NETS — BAG PRICING CORRECTION (SECTION 2)
// ═════════════════════════════════════════════════════════════════════════════

export const SFT_PER_FULL_BAG = 3300; // 100ft x 33ft
export const SFT_PER_HALF_BAG = 1650; // 50ft x 33ft

export type BraidedVariant = '2mm_45mm' | '2mm_40mm' | '2.5mm_45mm' | '2.5mm_40mm';

export interface BraidedBagTierRates {
  halfBag: number;        // Half bag (1,650 SFT)
  oneFullBag: number;     // 1 full bag (3,300 SFT)
  twoToThreeBags: number; // 2–3 full bags (6,600 – 9,900 SFT)
  fourToFiveBags: number; // 4–5 full bags (13,200 – 16,500 SFT)
  aboveFiveBags: number;  // Above 5 full bags (>16,500 SFT)
}

export const BRAIDED_BAG_RATES: Record<BraidedVariant, BraidedBagTierRates> = {
  '2mm_45mm': {
    halfBag: 7.50,
    oneFullBag: 7.00,
    twoToThreeBags: 6.50,
    fourToFiveBags: 6.00,
    aboveFiveBags: 5.50
  },
  '2mm_40mm': {
    halfBag: 8.00,
    oneFullBag: 7.50,
    twoToThreeBags: 7.00,
    fourToFiveBags: 6.50,
    aboveFiveBags: 6.00
  },
  '2.5mm_45mm': {
    halfBag: 8.00,
    oneFullBag: 7.50,
    twoToThreeBags: 7.00,
    fourToFiveBags: 6.50,
    aboveFiveBags: 6.00
  },
  '2.5mm_40mm': {
    halfBag: 9.00,
    oneFullBag: 8.50,
    twoToThreeBags: 8.00,
    fourToFiveBags: 7.50,
    aboveFiveBags: 7.00
  }
};

export type MixedBagPricingPolicy = 'SEPARATE_TIERS' | 'TOTAL_VOLUME_TIER' | 'REQUIRE_OWNER_CONFIRMATION';

export interface CricketBraidedOrderInput {
  variant: BraidedVariant;
  fullBags: number;
  halfBags: number;
  mixedBagPolicy?: MixedBagPricingPolicy;
  gstRate?: number; // Default 5% for net supply
}

export interface CricketBraidedOrderResult {
  variant: BraidedVariant;
  fullBags: number;
  halfBags: number;
  totalSft: number;
  fullBagsSft: number;
  halfBagsSft: number;
  applicablePolicy: MixedBagPricingPolicy;
  fullBagRatePerSft: number;
  halfBagRatePerSft: number;
  fullBagsAmount: number;
  halfBagsAmount: number;
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  totalWithGst: number;
  tierSummary: string;
  requiresOwnerApproval: boolean;
  approvalNote?: string;
}

/**
 * Calculates cricket braided bag pricing according to the exact master prompt table.
 * Strictly uses configured policy for mixed full/half bag orders. Never assumes rates automatically.
 */
export function calculateCricketBraidedBags(input: CricketBraidedOrderInput): CricketBraidedOrderResult {
  const { variant, fullBags = 0, halfBags = 0 } = input;
  const policy: MixedBagPricingPolicy = input.mixedBagPolicy || 'SEPARATE_TIERS';
  const gstRate = input.gstRate !== undefined ? input.gstRate : 5.0;

  if (fullBags < 0 || halfBags < 0 || (fullBags === 0 && halfBags === 0)) {
    throw new Error('Order must contain at least one full bag or half bag.');
  }

  const rates = BRAIDED_BAG_RATES[variant];
  if (!rates) {
    throw new Error(`Unknown braided net variant: ${variant}`);
  }

  const fullBagsSft = fullBags * SFT_PER_FULL_BAG;
  const halfBagsSft = halfBags * SFT_PER_HALF_BAG;
  const totalSft = fullBagsSft + halfBagsSft;

  let fullBagRate = 0;
  let halfBagRate = rates.halfBag;
  let tierSummary = '';
  let requiresOwnerApproval = false;
  let approvalNote: string | undefined;

  // Resolve Full Bag Tier Rate
  if (fullBags === 0) {
    fullBagRate = 0;
  } else if (fullBags === 1) {
    fullBagRate = rates.oneFullBag;
    tierSummary = '1 Full Bag Tier';
  } else if (fullBags >= 2 && fullBags <= 3) {
    fullBagRate = rates.twoToThreeBags;
    tierSummary = '2–3 Full Bags Tier';
  } else if (fullBags >= 4 && fullBags <= 5) {
    fullBagRate = rates.fourToFiveBags;
    tierSummary = '4–5 Full Bags Tier';
  } else {
    fullBagRate = rates.aboveFiveBags;
    tierSummary = 'Above 5 Full Bags Tier';
  }

  // Handle Mixed Orders (Both full and half bags present)
  let fullBagsAmount = 0;
  let halfBagsAmount = 0;

  if (fullBags > 0 && halfBags > 0) {
    if (policy === 'REQUIRE_OWNER_CONFIRMATION') {
      requiresOwnerApproval = true;
      approvalNote = `Mixed order of ${fullBags} Full Bag(s) + ${halfBags} Half Bag(s) requires explicit owner rate authorization.`;
      fullBagsAmount = Math.round(fullBagsSft * fullBagRate * 100) / 100;
      halfBagsAmount = Math.round(halfBagsSft * rates.halfBag * 100) / 100;
    } else if (policy === 'TOTAL_VOLUME_TIER') {
      // Treat total bags as fractional to determine volume tier
      const totalEquivalentBags = fullBags + (halfBags * 0.5);
      let blendedRate = rates.aboveFiveBags;
      if (totalEquivalentBags <= 1) blendedRate = rates.oneFullBag;
      else if (totalEquivalentBags <= 3) blendedRate = rates.twoToThreeBags;
      else if (totalEquivalentBags <= 5) blendedRate = rates.fourToFiveBags;

      fullBagRate = blendedRate;
      halfBagRate = blendedRate;
      tierSummary = `Blended Volume Tier (${totalEquivalentBags.toFixed(1)} Bags Equivalent)`;
      fullBagsAmount = Math.round(fullBagsSft * blendedRate * 100) / 100;
      halfBagsAmount = Math.round(halfBagsSft * blendedRate * 100) / 100;
    } else {
      // 'SEPARATE_TIERS' (Default Approved Policy):
      // Full bags receive their volume tier rate; half bags receive the half-bag rate.
      fullBagsAmount = Math.round(fullBagsSft * fullBagRate * 100) / 100;
      halfBagsAmount = Math.round(halfBagsSft * rates.halfBag * 100) / 100;
      tierSummary = `${tierSummary} + Half Bag Tier`;
    }
  } else if (fullBags > 0) {
    fullBagsAmount = Math.round(fullBagsSft * fullBagRate * 100) / 100;
    halfBagsAmount = 0;
  } else {
    // Only half bags
    fullBagsAmount = 0;
    halfBagRate = rates.halfBag;
    halfBagsAmount = Math.round(halfBagsSft * halfBagRate * 100) / 100;
    tierSummary = `${halfBags} Half Bag(s) Tier`;
  }

  const subtotal = Math.round((fullBagsAmount + halfBagsAmount) * 100) / 100;
  const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
  const totalWithGst = Math.round((subtotal + gstAmount) * 100) / 100;

  return {
    variant,
    fullBags,
    halfBags,
    totalSft,
    fullBagsSft,
    halfBagsSft,
    applicablePolicy: policy,
    fullBagRatePerSft: fullBagRate,
    halfBagRatePerSft: halfBagRate,
    fullBagsAmount,
    halfBagsAmount,
    subtotal,
    gstPct: gstRate,
    gstAmount,
    totalWithGst,
    tierSummary,
    requiresOwnerApproval,
    approvalNote
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. 1.5mm TWISTED CRICKET NETS — BOUNDARY CORRECTION (SECTION 3)
// ═════════════════════════════════════════════════════════════════════════════

export interface Twisted15CalculationResult {
  totalSft: number;
  applicableSlab: string;
  baseMaterialRatePerSft: number;
  materialAmount: number;
  customizationRatePerSft: number; // Always ₹0.50 / SFT
  customizationAmount: number;
  totalRatePerSft: number; // Base + ₹0.50
  subtotal: number; // Taxable Supply Value
  gstPct: number; // 5%
  gstAmount: number;
  grandTotal: number;
}

/**
 * 1.5mm Twisted Cricket Nets Boundary Calculation:
 * - 500–3,300 SFT: ₹5.00
 * - 3,301–5,000 SFT: ₹4.75
 * - 5,001–10,000 SFT: ₹4.50
 * - 10,001 SFT and above: ₹4.25
 * Customization charge: ₹0.50/SFT additional.
 * GST: 5% on total taxable supply value (material + customization).
 */
export function calculateTwisted15Netting(sft: number, includeCustomization: boolean = true): Twisted15CalculationResult {
  if (sft < 500) {
    throw new Error('Minimum order quantity for 1.5mm twisted net is 500 SFT.');
  }

  let baseRate = 0;
  let slab = '';

  if (sft <= 3300) {
    baseRate = 5.00;
    slab = '500–3,300 SFT (₹5.00/SFT)';
  } else if (sft <= 5000) {
    baseRate = 4.75;
    slab = '3,301–5,000 SFT (₹4.75/SFT)';
  } else if (sft <= 10000) {
    baseRate = 4.50;
    slab = '5,001–10,000 SFT (₹4.50/SFT)';
  } else {
    baseRate = 4.25;
    slab = '10,001 SFT and above (₹4.25/SFT)';
  }

  const customizationRate = includeCustomization ? 0.50 : 0.00;
  const materialAmount = Math.round(sft * baseRate * 100) / 100;
  const customizationAmount = Math.round(sft * customizationRate * 100) / 100;
  const subtotal = Math.round((materialAmount + customizationAmount) * 100) / 100;

  const gstPct = 5.0;
  const gstAmount = Math.round(subtotal * (gstPct / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;

  return {
    totalSft: sft,
    applicableSlab: slab,
    baseMaterialRatePerSft: baseRate,
    materialAmount,
    customizationRatePerSft: customizationRate,
    customizationAmount,
    totalRatePerSft: baseRate + customizationRate,
    subtotal,
    gstPct,
    gstAmount,
    grandTotal
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. NEW TURF INSTALLATION ACCESSORIES — SUPPLY ONLY (SECTION 4)
// ═════════════════════════════════════════════════════════════════════════════

export interface TurfAccessoryProduct {
  id: string;
  name: string;
  unit: string;
  basePrice: number;
  gstPct: number;
  description: string;
}

export const TURF_ACCESSORIES_CATALOG: Record<string, TurfAccessoryProduct> = {
  silica_sand: {
    id: 'PROD-TURF-ACC-SAND',
    name: 'Washed & Graded Silica Sand (0.5mm–1.0mm)',
    unit: 'kg',
    basePrice: 8.0,
    gstPct: 5.0,
    description: 'Dry, rounded silica sand infill for artificial turf ballast and pile stability. 5% GST.'
  },
  rubber_granules: {
    id: 'PROD-TURF-ACC-RUBBER',
    name: 'Resilient SBR Rubber Granules (1mm–3mm)',
    unit: 'kg',
    basePrice: 36.0,
    gstPct: 5.0,
    description: 'Cushioning infill granules for professional shock absorption and true ball bounce. 5% GST.'
  },
  speb7_glue: {
    id: 'PROD-TURF-ACC-GLUE',
    name: 'SPEB 7 Polyurethane Adhesive Glue',
    unit: 'liter',
    basePrice: 370.0,
    gstPct: 18.0, // CRITICAL: 18% GST (Never apply 5% to glue)
    description: 'High-tensile weatherproof polyurethane adhesive for artificial grass seaming. 18% GST.'
  },
  seaming_tape: {
    id: 'PROD-TURF-ACC-TAPE',
    name: 'Heavy-Duty Geotextile Seaming Tape',
    unit: 'meter',
    basePrice: 45.0,
    gstPct: 5.0,
    description: 'Reinforced non-woven jointing tape for bonding turf roll seams with SPEB 7 glue. 5% GST.'
  }
};

export interface TurfAccessoryLineItem {
  accessoryKey: 'silica_sand' | 'rubber_granules' | 'speb7_glue' | 'seaming_tape';
  quantity: number;
}

export interface TurfAccessoryCalculation {
  product: TurfAccessoryProduct;
  quantity: number;
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  totalWithGst: number;
}

export function calculateTurfAccessory(key: string, quantity: number): TurfAccessoryCalculation {
  const product = TURF_ACCESSORIES_CATALOG[key];
  if (!product) {
    throw new Error(`Unknown turf accessory product: ${key}`);
  }
  if (quantity < 0) {
    throw new Error('Accessory quantity cannot be negative.');
  }

  const subtotal = Math.round(quantity * product.basePrice * 100) / 100;
  const gstAmount = Math.round(subtotal * (product.gstPct / 100) * 100) / 100;
  const totalWithGst = Math.round((subtotal + gstAmount) * 100) / 100;

  return {
    product,
    quantity,
    subtotal,
    gstPct: product.gstPct,
    gstAmount,
    totalWithGst
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. UNIFIED TURF ESTIMATION (SECTION 5)
// ═════════════════════════════════════════════════════════════════════════════

export interface UnifiedTurfEstimateInput {
  turfSft?: number;
  turfRatePerSft?: number; // Base rate before GST (default ₹85/sft for non-infill or ₹75 for infill)
  turfGstPct?: number;     // 18% for artificial grass
  silicaSandKg?: number;
  rubberGranulesKg?: number;
  glueLiters?: number;
  seamingTapeMeters?: number;
  transportCharges?: number;
  transportGstPct?: number; // 5% for transport/goods transport agency or 0 if flat reimbursement
}

export interface UnifiedTurfLineItem {
  itemCode: string;
  name: string;
  unit: string;
  quantity: number;
  rate: number;
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  totalWithGst: number;
}

export interface UnifiedTurfEstimateResult {
  lineItems: UnifiedTurfLineItem[];
  subtotal: number;
  totalGst: number;
  grandTotal: number;
  breakdownSummary: string;
}

/**
 * Unified Turf Estimation:
 * Calculates turf, accessories, and transportation independently with their own units, rates, and GSTs.
 * Does not automatically add accessories unless requested or approved.
 */
export function calculateUnifiedTurfEstimate(input: UnifiedTurfEstimateInput): UnifiedTurfEstimateResult {
  const lineItems: UnifiedTurfLineItem[] = [];

  // 1. Artificial Grass / Turf
  if (input.turfSft && input.turfSft > 0) {
    const rate = input.turfRatePerSft !== undefined ? input.turfRatePerSft : 85.0;
    const gstPct = input.turfGstPct !== undefined ? input.turfGstPct : 18.0;
    const subtotal = Math.round(input.turfSft * rate * 100) / 100;
    const gstAmount = Math.round(subtotal * (gstPct / 100) * 100) / 100;
    lineItems.push({
      itemCode: 'TURF-MAIN',
      name: 'Artificial Grass / Sports Turf',
      unit: 'SFT',
      quantity: input.turfSft,
      rate,
      subtotal,
      gstPct,
      gstAmount,
      totalWithGst: Math.round((subtotal + gstAmount) * 100) / 100
    });
  }

  // 2. Silica Sand (₹8/kg, 5% GST)
  if (input.silicaSandKg && input.silicaSandKg > 0) {
    const calc = calculateTurfAccessory('silica_sand', input.silicaSandKg);
    lineItems.push({
      itemCode: calc.product.id,
      name: calc.product.name,
      unit: calc.product.unit,
      quantity: calc.quantity,
      rate: calc.product.basePrice,
      subtotal: calc.subtotal,
      gstPct: calc.gstPct,
      gstAmount: calc.gstAmount,
      totalWithGst: calc.totalWithGst
    });
  }

  // 3. Rubber Granules (₹36/kg, 5% GST)
  if (input.rubberGranulesKg && input.rubberGranulesKg > 0) {
    const calc = calculateTurfAccessory('rubber_granules', input.rubberGranulesKg);
    lineItems.push({
      itemCode: calc.product.id,
      name: calc.product.name,
      unit: calc.product.unit,
      quantity: calc.quantity,
      rate: calc.product.basePrice,
      subtotal: calc.subtotal,
      gstPct: calc.gstPct,
      gstAmount: calc.gstAmount,
      totalWithGst: calc.totalWithGst
    });
  }

  // 4. SPEB 7 Adhesive Glue (₹370/liter, 18% GST)
  if (input.glueLiters && input.glueLiters > 0) {
    const calc = calculateTurfAccessory('speb7_glue', input.glueLiters);
    lineItems.push({
      itemCode: calc.product.id,
      name: calc.product.name,
      unit: calc.product.unit,
      quantity: calc.quantity,
      rate: calc.product.basePrice,
      subtotal: calc.subtotal,
      gstPct: calc.gstPct,
      gstAmount: calc.gstAmount,
      totalWithGst: calc.totalWithGst
    });
  }

  // 5. Seaming Tape (₹45/meter, 5% GST)
  if (input.seamingTapeMeters && input.seamingTapeMeters > 0) {
    const calc = calculateTurfAccessory('seaming_tape', input.seamingTapeMeters);
    lineItems.push({
      itemCode: calc.product.id,
      name: calc.product.name,
      unit: calc.product.unit,
      quantity: calc.quantity,
      rate: calc.product.basePrice,
      subtotal: calc.subtotal,
      gstPct: calc.gstPct,
      gstAmount: calc.gstAmount,
      totalWithGst: calc.totalWithGst
    });
  }

  // 6. Transportation Charges
  if (input.transportCharges && input.transportCharges > 0) {
    const rate = input.transportCharges;
    const gstPct = input.transportGstPct !== undefined ? input.transportGstPct : 0.0;
    const subtotal = Math.round(rate * 100) / 100;
    const gstAmount = Math.round(subtotal * (gstPct / 100) * 100) / 100;
    lineItems.push({
      itemCode: 'TRANSPORT',
      name: 'Dedicated Freight & Transport Logistics',
      unit: 'Trip',
      quantity: 1,
      rate,
      subtotal,
      gstPct,
      gstAmount,
      totalWithGst: Math.round((subtotal + gstAmount) * 100) / 100
    });
  }

  const subtotal = Math.round(lineItems.reduce((acc, it) => acc + it.subtotal, 0) * 100) / 100;
  const totalGst = Math.round(lineItems.reduce((acc, it) => acc + it.gstAmount, 0) * 100) / 100;
  const grandTotal = Math.round((subtotal + totalGst) * 100) / 100;

  const breakdownSummary = lineItems.map(it => 
    `• ${it.name}: ${it.quantity} ${it.unit} @ ₹${it.rate}/${it.unit} = ₹${it.subtotal.toLocaleString('en-IN')} (+${it.gstPct}% GST ₹${it.gstAmount.toLocaleString('en-IN')} = ₹${it.totalWithGst.toLocaleString('en-IN')})`
  ).join('\n');

  return {
    lineItems,
    subtotal,
    totalGst,
    grandTotal,
    breakdownSummary
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 6. ADMIN MANAGEMENT & AUDIT LOGGING (SECTION 6)
// ═════════════════════════════════════════════════════════════════════════════

export interface PriceAuditEntry {
  productId: string;
  productName: string;
  fieldChanged: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  tenantId?: string;
  effectiveFrom: string;
  timestamp: string;
}

export function logPriceChange(entry: Omit<PriceAuditEntry, 'timestamp'>): void {
  try {
    db.prepare(`
      INSERT INTO lead_activities (id, lead_id, activity_type, description, performed_by)
      VALUES (?, 'SYSTEM-PRICING', 'PRICE_CHANGE_AUDIT', ?, ?)
    `).run(
      'AUDIT-' + Date.now().toString(36).toUpperCase(),
      JSON.stringify({ ...entry, timestamp: new Date().toISOString() }),
      entry.changedBy || 'ADMIN_USER'
    );
  } catch (err) {
    console.warn('[Pricing Engine] Could not persist audit entry:', err);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. LANDSCAPE ARTIFICIAL GRASS ROLL PRICING (SECTION 7 & 8)
// ═════════════════════════════════════════════════════════════════════════════

export const ROLL_SFT_STANDARD = 540; // 1 full roll = 540 SFT

export const LANDSCAPE_GRASS_CATALOG: Record<string, { thickness: string; basePrice: number }> = {
  '25mm': { thickness: '25mm', basePrice: 24 },
  '35mm': { thickness: '35mm', basePrice: 28 },
  '40mm': { thickness: '40mm', basePrice: 32 },
  '50mm': { thickness: '50mm', basePrice: 36 }
};

export function getLandscapeRollDiscount(rolls: number): number {
  if (rolls >= 11) return 4;
  if (rolls >= 7) return 3;
  if (rolls >= 4) return 2;
  if (rolls >= 2) return 1;
  return 0;
}

export interface LandscapeGrassCalculationResult {
  variant: string;
  basePricePerSft: number;
  requiredSft: number;
  requiredRolls: number;
  suppliedSft: number;
  extraSft: number;
  discountPerSft: number;
  finalRatePerSft: number;
  materialSubtotal: number;
  gstPct: number;
  gstAmount: number;
  totalWithGst: number;
  policyNote: string;
}

export function calculateLandscapeGrassRolls(
  variant: '25mm' | '35mm' | '40mm' | '50mm',
  requiredSft?: number,
  explicitRolls?: number
): LandscapeGrassCalculationResult {
  const item = LANDSCAPE_GRASS_CATALOG[variant];
  if (!item) {
    throw new Error(`Unknown landscape grass variant: ${variant}. Valid: 25mm, 35mm, 40mm, 50mm`);
  }

  const sft = requiredSft && requiredSft > 0 ? requiredSft : (explicitRolls ? explicitRolls * ROLL_SFT_STANDARD : ROLL_SFT_STANDARD);
  const rolls = explicitRolls && explicitRolls > 0 ? explicitRolls : Math.ceil(sft / ROLL_SFT_STANDARD);
  const suppliedSft = rolls * ROLL_SFT_STANDARD;
  const extraSft = suppliedSft - sft;

  const discount = getLandscapeRollDiscount(rolls);
  const finalRate = item.basePrice - discount;
  const materialSubtotal = Math.round(suppliedSft * finalRate * 100) / 100;
  const gstPct = 5.0;
  const gstAmount = Math.round(materialSubtotal * (gstPct / 100) * 100) / 100;
  const totalWithGst = Math.round((materialSubtotal + gstAmount) * 100) / 100;

  return {
    variant,
    basePricePerSft: item.basePrice,
    requiredSft: sft,
    requiredRolls: rolls,
    suppliedSft,
    extraSft,
    discountPerSft: discount,
    finalRatePerSft: finalRate,
    materialSubtotal,
    gstPct,
    gstAmount,
    totalWithGst,
    policyNote: 'We supply full rolls only, sir. Each roll contains 540 SFT. Installation and transportation not included.'
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 8. PREMIUM SPORTS TURF ROLL PRICING (SECTION 9)
// ═════════════════════════════════════════════════════════════════════════════

export const SPORTS_TURF_CATALOG: Record<string, { key: string; name: string; basePrice: number }> = {
  '15mm_multisports': { key: '15mm_multisports', name: '15mm Multisports, 5500 DTEX', basePrice: 85 },
  '30mm_non_infill': { key: '30mm_non_infill', name: '30mm Non-Infill, 13500 DTEX', basePrice: 85 },
  '50mm_infill_12000': { key: '50mm_infill_12000', name: '50mm Infill, 12000 DTEX', basePrice: 80 },
  '50mm_infill_14000': { key: '50mm_infill_14000', name: '50mm Infill, 14000 DTEX', basePrice: 85 },
  '50mm_infill_16000': { key: '50mm_infill_16000', name: '50mm Infill, 16000 DTEX', basePrice: 92 },
  '50mm_infill_18000': { key: '50mm_infill_18000', name: '50mm Infill, 18000 DTEX', basePrice: 100 }
};

export function getSportsTurfRollDiscount(rolls: number): number {
  if (rolls >= 11) return 8;
  if (rolls >= 7) return 6;
  if (rolls >= 4) return 4;
  if (rolls >= 2) return 2;
  return 0;
}

export interface SportsTurfCalculationResult {
  variantKey: string;
  name: string;
  basePricePerSft: number;
  requiredSft: number;
  requiredRolls: number;
  suppliedSft: number;
  extraSft: number;
  discountPerSft: number;
  finalRatePerSft: number;
  materialSubtotal: number;
  gstPct: number;
  gstAmount: number;
  totalWithGst: number;
  policyNote: string;
}

export function calculateSportsTurfRolls(
  variantKey: string,
  requiredSft?: number,
  explicitRolls?: number
): SportsTurfCalculationResult {
  const item = SPORTS_TURF_CATALOG[variantKey];
  if (!item) {
    throw new Error(`Unknown sports turf variant: ${variantKey}.`);
  }

  const sft = requiredSft && requiredSft > 0 ? requiredSft : (explicitRolls ? explicitRolls * ROLL_SFT_STANDARD : ROLL_SFT_STANDARD);
  const rolls = explicitRolls && explicitRolls > 0 ? explicitRolls : Math.ceil(sft / ROLL_SFT_STANDARD);
  const suppliedSft = rolls * ROLL_SFT_STANDARD;
  const extraSft = suppliedSft - sft;

  const discount = getSportsTurfRollDiscount(rolls);
  const finalRate = item.basePrice - discount;
  const materialSubtotal = Math.round(suppliedSft * finalRate * 100) / 100;
  const gstPct = 5.0;
  const gstAmount = Math.round(materialSubtotal * (gstPct / 100) * 100) / 100;
  const totalWithGst = Math.round((materialSubtotal + gstAmount) * 100) / 100;

  return {
    variantKey,
    name: item.name,
    basePricePerSft: item.basePrice,
    requiredSft: sft,
    requiredRolls: rolls,
    suppliedSft,
    extraSft,
    discountPerSft: discount,
    finalRatePerSft: finalRate,
    materialSubtotal,
    gstPct,
    gstAmount,
    totalWithGst,
    policyNote: 'Supply only. Infill, adhesive, tape, installation and transport not included unless specified.'
  };
}
