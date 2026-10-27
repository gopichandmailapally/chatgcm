/**
 * Chat GCM — Universal Centralized Pricing & Estimation Engine (2026 Enterprise Edition)
 * Single Source of Truth across all GCM Websites & Channels.
 * 
 * 1. Installed Safety Nets:
 *    - 5 Approved Qualities: 1.5mm Twisted 30mm, 2mm Braided 45mm, 2mm Braided 40mm, 2.5mm Braided 45mm, 2.5mm Braided 40mm
 *    - 7 Approved Slabs: Below 100 (fixed min), 100–250, 251–500, 501–2000, 2001–5000, 5001–10000, Above 10000
 *    - Boundary Rule: Exactly 100 SFT billed at 100–250 SFT rate, NEVER fixed minimum.
 *    - No unapproved 50mm mesh variants. 1.5mm 30mm is strictly twisted.
 * 
 * 2. Invisible Grills:
 *    - Approved schedule: <60 SFT = ₹10,000 fixed; 60–100 = ₹160; 101–200 = ₹140; 201–300 = ₹130; 301–500 = ₹120; 501–1000 = ₹110; >1000 = ₹100
 *    - Outside Hyderabad: +₹30/SFT applied to both fixed and slab tiers based on actual SFT.
 * 
 * 3. Cricket Braided Bags:
 *    - Full Bag = 3,300 SFT (100x33ft); Half Bag = 1,650 SFT (50x33ft)
 *    - Exact Tiers: Half bag, 1 full bag, 2–3 bags, 4–5 bags, Above 5 bags for all 4 variants
 *    - 5% Supply-only GST.
 * 
 * 4. 1.5mm Twisted Cricket Nets:
 *    - 500–3,300: ₹5.00; 3,301–5,000: ₹4.75; 5,001–10,000: ₹4.50; 10,001+: ₹4.25
 *    - Customization: ₹0.50/SFT; 5% GST.
 * 
 * 5. Artificial Grass & Sports Turf (540 SFT Roll Rule):
 *    - 1 roll = 540 SFT. Roll quantity = CEILING(Required SFT / 540).
 *    - Landscape: 25mm ₹24, 35mm ₹28, 40mm ₹32, 50mm ₹36. Discounts: 1 roll ₹0, 2-3 rolls ₹1, 4-6 rolls ₹2, 7-10 rolls ₹3, 11+ rolls ₹4.
 *    - Sports: 15mm 5500 ₹85, 30mm 13500 ₹85, 50mm 12000 ₹80, 50mm 14000 ₹85, 50mm 16000 ₹92, 50mm 18000 ₹100. Discounts: 1 roll ₹0, 2-3 rolls ₹2, 4-6 rolls ₹4, 7-10 rolls ₹6, 11+ rolls ₹8.
 *    - Material Supply GST: 5%.
 * 
 * 6. Turf Accessories:
 *    - Silica Sand ₹8/kg (5% GST), Rubber Granules ₹36/kg (5% GST), SPEB 7 Glue ₹370/L (18% GST), Seaming Tape ₹45/m (5% GST).
 */

import { db } from '../db/database.js';
import { calculateInvisibleGrills, type InvisibleGrillInput, type InvisibleGrillResult } from '../calculators/invisible-grill-calculator.js';
import { calculateClothHanger, type ClothHangerInput, type ClothHangerResult } from '../calculators/cloth-hanger-calculator.js';

export { calculateInvisibleGrills, calculateClothHanger };
export type { InvisibleGrillInput, InvisibleGrillResult, ClothHangerInput, ClothHangerResult };


// ═════════════════════════════════════════════════════════════════════════════
// 1. INSTALLED SAFETY NETS (SECTION 1)
// ═════════════════════════════════════════════════════════════════════════════

export type InstalledNetQualityId =
  | '1.5mm_30mm'
  | '2.0mm_45mm'
  | '2.0mm_40mm'
  | '2.5mm_45mm'
  | '2.5mm_40mm';

export interface InstalledNetQuality {
  id: InstalledNetQualityId;
  name: string;
  materialType: 'twisted' | 'braided';
  thicknessMm: number;
  meshMm: number;
  minCharge: number; // Below 100 SFT fixed charge
  slabs: {
    '100-250': number;
    '251-500': number;
    '501-2000': number;
    '2001-5000': number;
    '5001-10000': number;
    'above-10000': number;
  };
}

export const INSTALLED_SAFETY_NET_QUALITIES: Record<InstalledNetQualityId, InstalledNetQuality> = {
  '1.5mm_30mm': {
    id: '1.5mm_30mm',
    name: '1.5mm Twisted HDPE Anti-Pigeon Net (30mm Mesh)',
    materialType: 'twisted',
    thicknessMm: 1.5,
    meshMm: 30,
    minCharge: 1500,
    slabs: {
      '100-250': 18,
      '251-500': 15,
      '501-2000': 12,
      '2001-5000': 10,
      '5001-10000': 8,
      'above-10000': 7
    }
  },
  '2.0mm_45mm': {
    id: '2.0mm_45mm',
    name: '2.0mm High-Tenacity Braided RUSSEA™ Balcony Net (45mm Mesh)',
    materialType: 'braided',
    thicknessMm: 2.0,
    meshMm: 45,
    minCharge: 1750,
    slabs: {
      '100-250': 20,
      '251-500': 17,
      '501-2000': 14,
      '2001-5000': 12,
      '5001-10000': 10,
      'above-10000': 9
    }
  },
  '2.0mm_40mm': {
    id: '2.0mm_40mm',
    name: '2.0mm High-Tenacity Braided RUSSEA™ Balcony Net (40mm Mesh)',
    materialType: 'braided',
    thicknessMm: 2.0,
    meshMm: 40,
    minCharge: 1900,
    slabs: {
      '100-250': 21,
      '251-500': 18,
      '501-2000': 15,
      '2001-5000': 13,
      '5001-10000': 11,
      'above-10000': 10
    }
  },
  '2.5mm_45mm': {
    id: '2.5mm_45mm',
    name: '2.5mm Heavy-Duty Braided RUSSEA™ Balcony & Child Safety Net (45mm Mesh)',
    materialType: 'braided',
    thicknessMm: 2.5,
    meshMm: 45,
    minCharge: 1900,
    slabs: {
      '100-250': 21,
      '251-500': 18,
      '501-2000': 15,
      '2001-5000': 13,
      '5001-10000': 11,
      'above-10000': 10
    }
  },
  '2.5mm_40mm': {
    id: '2.5mm_40mm',
    name: '2.5mm Heavy-Duty Braided RUSSEA™ Balcony & Monkey Net (40mm Mesh)',
    materialType: 'braided',
    thicknessMm: 2.5,
    meshMm: 40,
    minCharge: 2000,
    slabs: {
      '100-250': 23,
      '251-500': 20,
      '501-2000': 17,
      '2001-5000': 15,
      '5001-10000': 13,
      'above-10000': 12
    }
  }
};

export interface InstalledSafetyNetResult {
  qualityId: string;
  qualityName: string;
  actualAreaSft: number;
  billedAreaSft: number;
  isMinimumChargeApplied: boolean;
  isFixedMinimumApplied?: boolean;
  applicableSlab: string;
  ratePerSft: number;
  appliedRatePerSft?: number;
  totalAmount: number;
  explanation: string;
}

/**
 * Calculates Installed Safety Net pricing strictly enforcing boundary rules:
 * - Below 100 SFT: Apply fixed minimum charge.
 * - Exactly 100 SFT: Calculate 100 × applicable 100–250 SFT rate. (NEVER minimum charge).
 * - Above 100 SFT: Apply appropriate quantity slab.
 * Installed net prices include complete installation.
 */
export function calculateInstalledSafetyNet(
  qualityKey: string,
  actualAreaSft: number,
  _rateModeOrScope?: any
): InstalledSafetyNetResult {
  let key = qualityKey as InstalledNetQualityId;
  // Fallbacks & aliases (reject unknown 50mm, map standard pigeon to 2mm 45mm or 1.5mm 30mm)
  if (key === ('2.0mm_50mm' as any)) key = '2.0mm_45mm';
  const quality = INSTALLED_SAFETY_NET_QUALITIES[key] || INSTALLED_SAFETY_NET_QUALITIES['2.0mm_45mm'];
  const sft = Math.round(actualAreaSft * 100) / 100;

  if (sft <= 0) {
    throw new Error('Installation area must be greater than 0 SFT.');
  }

  // 1. Below 100 SFT: Fixed Minimum Charge
  if (sft < 100) {
    const unitRate = Math.round((quality.minCharge / sft) * 100) / 100;
    return {
      qualityId: quality.id,
      qualityName: quality.name,
      actualAreaSft: sft,
      billedAreaSft: sft,
      isMinimumChargeApplied: true,
      isFixedMinimumApplied: true,
      applicableSlab: 'Below 100 SFT (Fixed Minimum)',
      ratePerSft: unitRate,
      appliedRatePerSft: unitRate,
      totalAmount: quality.minCharge,
      explanation: `Below 100 SFT (${sft} SFT): Fixed minimum doorstep visit and installation charge of ₹${quality.minCharge.toLocaleString('en-IN')} applies.`
    };
  }

  // 2. Slabs
  let slabKey: keyof InstalledNetQuality['slabs'];
  let slabLabel = '';

  if (sft <= 250) {
    slabKey = '100-250';
    slabLabel = sft === 100 ? 'Exactly 100 SFT (billed at 100–250 SFT slab rate)' : '100–250 SFT';
  } else if (sft <= 500) {
    slabKey = '251-500';
    slabLabel = '251–500 SFT';
  } else if (sft <= 2000) {
    slabKey = '501-2000';
    slabLabel = '501–2,000 SFT';
  } else if (sft <= 5000) {
    slabKey = '2001-5000';
    slabLabel = '2,001–5,000 SFT';
  } else if (sft <= 10000) {
    slabKey = '5001-10000';
    slabLabel = '5,001–10,000 SFT';
  } else {
    slabKey = 'above-10000';
    slabLabel = 'Above 10,000 SFT';
  }

  const rate = quality.slabs[slabKey];
  const totalAmount = Math.round(sft * rate);

  return {
    qualityId: quality.id,
    qualityName: quality.name,
    actualAreaSft: sft,
    billedAreaSft: sft,
    isMinimumChargeApplied: false,
    isFixedMinimumApplied: false,
    applicableSlab: slabLabel,
    ratePerSft: rate,
    appliedRatePerSft: rate,
    totalAmount,
    explanation: sft === 100
      ? `Exactly 100 SFT: Calculated at 100 × ₹${rate}/SFT (${slabLabel}) = ₹${totalAmount.toLocaleString('en-IN')} with installation included. Fixed minimum charge NOT applied.`
      : `${sft} SFT: Calculated at ₹${rate}/SFT (${slabLabel}) = ₹${totalAmount.toLocaleString('en-IN')} with installation included.`
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. CRICKET NETS — BRAIDED BAG PRICING (SECTION 2)
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

  let fullBagsAmount = 0;
  let halfBagsAmount = 0;

  if (fullBags > 0 && halfBags > 0) {
    if (policy === 'REQUIRE_OWNER_CONFIRMATION') {
      requiresOwnerApproval = true;
      approvalNote = `Mixed order of ${fullBags} Full Bag(s) + ${halfBags} Half Bag(s) requires explicit owner rate authorization.`;
      fullBagsAmount = Math.round(fullBagsSft * fullBagRate * 100) / 100;
      halfBagsAmount = Math.round(halfBagsSft * rates.halfBag * 100) / 100;
    } else if (policy === 'TOTAL_VOLUME_TIER') {
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
      fullBagsAmount = Math.round(fullBagsSft * fullBagRate * 100) / 100;
      halfBagsAmount = Math.round(halfBagsSft * rates.halfBag * 100) / 100;
      tierSummary = `${tierSummary} + Half Bag Tier`;
    }
  } else if (fullBags > 0) {
    fullBagsAmount = Math.round(fullBagsSft * fullBagRate * 100) / 100;
    halfBagsAmount = 0;
  } else {
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
// 3. 1.5mm TWISTED CRICKET NETS (SECTION 3)
// ═════════════════════════════════════════════════════════════════════════════

export interface Twisted15CalculationResult {
  totalSft: number;
  applicableSlab: string;
  baseMaterialRatePerSft: number;
  materialAmount: number;
  customizationRatePerSft: number; // Always ₹0.50 / SFT
  customizationAmount: number;
  totalRatePerSft: number; // Base + ₹0.50
  subtotal: number;
  gstPct: number; // 5%
  gstAmount: number;
  grandTotal: number;
}

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
// 4. ARTIFICIAL GRASS & SPORTS TURF (540 SFT ROLL RULE) (SECTION 4)
// ═════════════════════════════════════════════════════════════════════════════

export const SFT_PER_TURF_ROLL = 540; // 2m x 25m = 50 sqm ≈ 538.2 to 540 SFT standard roll

export const LANDSCAPE_GRASS_RATES: Record<number, number> = {
  25: 24.0,
  35: 28.0,
  40: 32.0,
  50: 36.0
};

export const SPORTS_TURF_RATES: Record<string, number> = {
  '15mm_5500': 85.0,
  '30mm_13500': 85.0,
  '50mm_12000': 80.0,
  '50mm_14000': 85.0,
  '50mm_16000': 92.0,
  '50mm_18000': 100.0
};

export function getLandscapeDiscountPerSft(rolls: number): number {
  if (rolls <= 1) return 0;
  if (rolls <= 3) return 1;
  if (rolls <= 6) return 2;
  if (rolls <= 10) return 3;
  return 4;
}

export function getSportsTurfDiscountPerSft(rolls: number): number {
  if (rolls <= 1) return 0;
  if (rolls <= 3) return 2;
  if (rolls <= 6) return 4;
  if (rolls <= 10) return 6;
  return 8;
}

export interface TurfRollOrderInput {
  category: 'landscape' | 'sports';
  variantKey: string; // e.g. "25mm" or "50mm_14000"
  requiredAreaSft: number;
  gstRate?: number; // Default 5% for material supply
}

export interface TurfRollOrderResult {
  category: 'landscape' | 'sports';
  variantKey: string;
  requiredAreaSft: number;
  rollsQuantity: number;
  suppliedAreaSft: number;
  extraMaterialSft: number;
  baseRatePerSft: number;
  discountPerSft: number;
  effectiveRatePerSft: number;
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  totalWithGst: number;
  summaryText: string;
}

export function calculateTurfRollOrder(input: TurfRollOrderInput): TurfRollOrderResult {
  const { category, variantKey, requiredAreaSft } = input;
  const gstRate = input.gstRate !== undefined ? input.gstRate : 5.0;

  if (requiredAreaSft <= 0) {
    throw new Error('Required area must be greater than 0 SFT.');
  }

  // 1. Roll count using strict ceiling
  const rollsQuantity = Math.ceil(requiredAreaSft / SFT_PER_TURF_ROLL);
  const suppliedAreaSft = rollsQuantity * SFT_PER_TURF_ROLL;
  const extraMaterialSft = suppliedAreaSft - requiredAreaSft;

  // 2. Base rate & discounts
  let baseRate = 0;
  let discount = 0;

  if (category === 'landscape') {
    const mm = parseInt(variantKey.replace('mm', ''), 10);
    baseRate = LANDSCAPE_GRASS_RATES[mm] || 28.0;
    discount = getLandscapeDiscountPerSft(rollsQuantity);
  } else {
    baseRate = SPORTS_TURF_RATES[variantKey] || 85.0;
    discount = getSportsTurfDiscountPerSft(rollsQuantity);
  }

  const effectiveRate = Math.max(1, baseRate - discount);
  const subtotal = Math.round(suppliedAreaSft * effectiveRate * 100) / 100;
  const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
  const totalWithGst = Math.round((subtotal + gstAmount) * 100) / 100;

  const summaryText = `Material: ${variantKey} ${category === 'landscape' ? 'Landscape Grass' : 'Sports Turf'}
Required Area: ${requiredAreaSft} SFT
Supply Quantity: ${rollsQuantity} Full Roll${rollsQuantity > 1 ? 's' : ''} (540 SFT/roll)
Supplied Area: ${suppliedAreaSft} SFT (Extra: ${extraMaterialSft} SFT)
Rate: ₹${effectiveRate}/SFT (Base ₹${baseRate}${discount > 0 ? ` - ₹${discount} volume discount` : ''})
Material Subtotal: ₹${subtotal.toLocaleString('en-IN')}
GST (5%): ₹${gstAmount.toLocaleString('en-IN')}
Total: ₹${totalWithGst.toLocaleString('en-IN')}
Supply only. Installation/accessories to be confirmed separately.`;

  return {
    category,
    variantKey,
    requiredAreaSft,
    rollsQuantity,
    suppliedAreaSft,
    extraMaterialSft,
    baseRatePerSft: baseRate,
    discountPerSft: discount,
    effectiveRatePerSft: effectiveRate,
    subtotal,
    gstPct: gstRate,
    gstAmount,
    totalWithGst,
    summaryText
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 5. TURF INSTALLATION ACCESSORIES (SECTION 5)
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
    gstPct: 18.0, // Strictly 18% GST for adhesive
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

export function calculateTurfAccessory(key: string, quantity: number) {
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
// 6. UNIFIED TURF ESTIMATION (SECTION 6)
// ═════════════════════════════════════════════════════════════════════════════

export interface UnifiedTurfEstimateInput {
  turfSft?: number;
  turfRatePerSft?: number; // Base rate before GST (default ₹85/sft)
  turfGstPct?: number;     // 5% for artificial grass material supply
  silicaSandKg?: number;
  rubberGranulesKg?: number;
  glueLiters?: number;
  seamingTapeMeters?: number;
  transportCharges?: number;
  transportGstPct?: number;
}

export function calculateUnifiedTurfEstimate(input: UnifiedTurfEstimateInput) {
  const lineItems: any[] = [];
  let grandTotal = 0;
  let totalTaxable = 0;
  let totalGst = 0;

  const turfGst = input.turfGstPct !== undefined ? input.turfGstPct : 5.0; // Approved 5% supply GST

  if (input.turfSft && input.turfSft > 0) {
    const rate = input.turfRatePerSft || 85.0;
    const sub = Math.round(input.turfSft * rate * 100) / 100;
    const tax = Math.round(sub * (turfGst / 100) * 100) / 100;
    const tot = Math.round((sub + tax) * 100) / 100;
    lineItems.push({
      itemCode: 'TURF-MAIN',
      name: 'Professional Sports Turf / Artificial Grass Material',
      unit: 'SFT',
      quantity: input.turfSft,
      rate,
      subtotal: sub,
      gstPct: turfGst,
      gstAmount: tax,
      totalWithGst: tot
    });
    totalTaxable += sub;
    totalGst += tax;
    grandTotal += tot;
  }

  // Accessories
  if (input.silicaSandKg && input.silicaSandKg > 0) {
    const calc = calculateTurfAccessory('silica_sand', input.silicaSandKg);
    lineItems.push({
      itemCode: 'ACC-SAND',
      name: calc.product.name,
      unit: calc.product.unit,
      quantity: calc.quantity,
      rate: calc.product.basePrice,
      subtotal: calc.subtotal,
      gstPct: calc.gstPct,
      gstAmount: calc.gstAmount,
      totalWithGst: calc.totalWithGst
    });
    totalTaxable += calc.subtotal;
    totalGst += calc.gstAmount;
    grandTotal += calc.totalWithGst;
  }

  if (input.rubberGranulesKg && input.rubberGranulesKg > 0) {
    const calc = calculateTurfAccessory('rubber_granules', input.rubberGranulesKg);
    lineItems.push({
      itemCode: 'ACC-RUBBER',
      name: calc.product.name,
      unit: calc.product.unit,
      quantity: calc.quantity,
      rate: calc.product.basePrice,
      subtotal: calc.subtotal,
      gstPct: calc.gstPct,
      gstAmount: calc.gstAmount,
      totalWithGst: calc.totalWithGst
    });
    totalTaxable += calc.subtotal;
    totalGst += calc.gstAmount;
    grandTotal += calc.totalWithGst;
  }

  if (input.glueLiters && input.glueLiters > 0) {
    const calc = calculateTurfAccessory('speb7_glue', input.glueLiters);
    lineItems.push({
      itemCode: 'ACC-GLUE',
      name: calc.product.name,
      unit: calc.product.unit,
      quantity: calc.quantity,
      rate: calc.product.basePrice,
      subtotal: calc.subtotal,
      gstPct: calc.gstPct,
      gstAmount: calc.gstAmount,
      totalWithGst: calc.totalWithGst
    });
    totalTaxable += calc.subtotal;
    totalGst += calc.gstAmount;
    grandTotal += calc.totalWithGst;
  }

  if (input.seamingTapeMeters && input.seamingTapeMeters > 0) {
    const calc = calculateTurfAccessory('seaming_tape', input.seamingTapeMeters);
    lineItems.push({
      itemCode: 'ACC-TAPE',
      name: calc.product.name,
      unit: calc.product.unit,
      quantity: calc.quantity,
      rate: calc.product.basePrice,
      subtotal: calc.subtotal,
      gstPct: calc.gstPct,
      gstAmount: calc.gstAmount,
      totalWithGst: calc.totalWithGst
    });
    totalTaxable += calc.subtotal;
    totalGst += calc.gstAmount;
    grandTotal += calc.totalWithGst;
  }

  if (input.transportCharges && input.transportCharges > 0) {
    const trans = Math.round(input.transportCharges * 100) / 100;
    lineItems.push({
      itemCode: 'LOGISTICS',
      name: 'Freight and Transportation Handling',
      unit: 'Trip / Consignment',
      quantity: 1,
      rate: trans,
      subtotal: trans,
      gstPct: 0,
      gstAmount: 0,
      totalWithGst: trans
    });
    totalTaxable += trans;
    grandTotal += trans;
  }

  return {
    lineItems,
    subtotal: Math.round(totalTaxable * 100) / 100,
    totalTaxable: Math.round(totalTaxable * 100) / 100,
    totalGst: Math.round(totalGst * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// 7. BACKWARD COMPATIBILITY EXPORTS & CATALOG ALIASES
// ═════════════════════════════════════════════════════════════════════════════

export const ROLL_SFT_STANDARD = SFT_PER_TURF_ROLL; // 540 SFT

export const LANDSCAPE_GRASS_CATALOG: Record<string, { thickness: string; basePrice: number }> = {
  '25mm': { thickness: '25mm', basePrice: 24 },
  '35mm': { thickness: '35mm', basePrice: 28 },
  '40mm': { thickness: '40mm', basePrice: 32 },
  '50mm': { thickness: '50mm', basePrice: 36 }
};

export const SPORTS_TURF_CATALOG: Record<string, { name: string; basePrice: number }> = {
  '15mm_multisports': { name: '15mm 5500 DTEX Multi-Sport Turf', basePrice: 85 },
  '30mm_non_infill': { name: '30mm 13500 DTEX Non-Infill Football Turf', basePrice: 85 },
  '50mm_infill_12000': { name: '50mm 12000 DTEX Football Infill Turf', basePrice: 80 },
  '50mm_infill_14000': { name: '50mm 14000 DTEX Football Infill Turf', basePrice: 85 },
  '50mm_infill_16000': { name: '50mm 16000 DTEX Football Infill Turf', basePrice: 92 },
  '50mm_infill_18000': { name: '50mm 18000 DTEX Football Infill Turf', basePrice: 100 }
};

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

  const sft = requiredSft && requiredSft > 0 ? requiredSft : (explicitRolls ? explicitRolls * 540 : 540);
  const rolls = explicitRolls && explicitRolls > 0 ? explicitRolls : Math.ceil(sft / 540);
  const suppliedSft = rolls * 540;
  const extraSft = suppliedSft - sft;

  const discount = getLandscapeDiscountPerSft(rolls);
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

  const sft = requiredSft && requiredSft > 0 ? requiredSft : (explicitRolls ? explicitRolls * 540 : 540);
  const rolls = explicitRolls && explicitRolls > 0 ? explicitRolls : Math.ceil(sft / 540);
  const suppliedSft = rolls * 540;
  const extraSft = suppliedSft - sft;

  const discount = getSportsTurfDiscountPerSft(rolls);
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
