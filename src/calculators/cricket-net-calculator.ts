/**
 * Deterministic Cricket & Sports Net Dimension Calculator (Updated 2026)
 * Strictly adheres to Chat GCM Cricket Nets Calculation & Sales Rules:
 * 1. Mandatory Size Confirmation (Pole-to-pole vs extras already included)
 * 2. Installation Extra Allowances (1-14: 0.5ft, 15-50: 1ft, 51-100: 1.5ft, 101-150: 2ft, 151-200: 2.5ft)
 * 3. Individual piece calculation (Top, Length Sides 1 & 2, Width Sides 1 & 2)
 * 4. Braided side nets: 2mm/2.5mm with 40mm/45mm mesh (recommend 45mm for affordability, never 50mm for 2.5mm)
 * 5. Top net for >3,300 SFT: 1.5mm twisted 24-ply 40mm mesh with mandatory ₹0.50/sft customization charge
 * 6. Braided bag calculation: Full bags (3,300 SFT) first, then Full + Half bag (1,650 SFT) if requested
 * 7. Strict material separation: Never combine top twisted net with braided net bags
 * 8. Purely deterministic - NO LLM arithmetic
 */

export interface CricketNetPiece {
  id: 'top' | 'length_side_1' | 'length_side_2' | 'width_side_1' | 'width_side_2';
  name: string;
  dim1Ft: number; // Length or Width
  dim2Ft: number; // Width or Height
  sft: number;
  included: boolean;
  materialType: 'braided' | 'twisted';
}

export interface CricketNetInput {
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  isPoleToPole?: boolean; // If true, apply installation allowances; if false, extras already included
  measurementConfirmed?: boolean; // Customer has explicitly answered the confirmation question
  includeTop?: boolean;
  includeRoof?: boolean; // Backward-compatible alias for includeTop
  includeLengthSide1?: boolean;
  includeLengthSide2?: boolean;
  includeWidthSide1?: boolean;
  includeWidthSide2?: boolean;
  sideThickness?: '2.0mm' | '2.5mm';
  sideMesh?: '40mm' | '45mm'; // 45mm recommended for affordability
}

export interface BagRecommendation {
  fullBagsOnly: {
    bags: number;
    totalSft: number;
    excessSft: number;
    description: string;
  };
  withHalfBag: {
    fullBags: number;
    halfBags: number; // 0 or 1
    totalSft: number;
    excessSft: number;
    description: string;
  };
}

export interface CricketNetCalculationResult {
  measurementConfirmed: boolean;
  isPoleToPole: boolean;
  requiresOwnerConfirmation: boolean;
  ownerConfirmationReason?: string;
  rawDimensions: {
    lengthFt: number;
    widthFt: number;
    heightFt: number;
  };
  allowances: {
    lengthAllowanceFt: number;
    widthAllowanceFt: number;
    heightAllowanceFt: number;
  };
  adjustedDimensions: {
    lengthFt: number;
    widthFt: number;
    heightFt: number;
  };
  pieces: CricketNetPiece[];
  groundFootprintSft: number;
  sideNetting: {
    requiredSft: number;
    recommendedMaterial: string;
    recommendedMesh: string;
    bagRecommendation: BagRecommendation;
    cuttingFeasibility: string;
  };
  topNetting: {
    included: boolean;
    requiredSft: number;
    recommendedMaterial: string;
    recommendedMesh: string;
    isCustomizedTwisted: boolean;
    customizationRatePerSft: number; // Fixed ₹0.50 / SFT for 1.5mm twisted
    totalCustomizationCharge: number;
    note: string;
  };
  summary: {
    totalRequestedSft: number;
    primarySuppliedSft: number; // Full bags for sides + exact top
    primaryExcessSft: number;
    secondarySuppliedSft: number; // Full+Half bags for sides + exact top
    secondaryExcessSft: number;
  };
  hardware: {
    wireRopeRft: number;
    turnbucklesQty: number;
    dShacklesQty: number;
    wireClampsQty: number;
  };
  salesPitch: string;
}

/**
 * Installation Extra Allowance Bracket:
 * 1–14 ft:   0.5 ft
 * 15–50 ft:  1.0 ft
 * 51–100 ft: 1.5 ft
 * 101–150 ft: 2.0 ft
 * 151–200 ft: 2.5 ft
 * Over 200 ft: requires owner confirmation
 */
export function getInstallationAllowance(dim: number): number {
  if (dim <= 0) return 0;
  if (dim <= 14) return 0.5;
  if (dim <= 50) return 1.0;
  if (dim <= 100) return 1.5;
  if (dim <= 150) return 2.0;
  if (dim <= 200) return 2.5;
  return 2.5; // Base cap with owner confirmation flag
}

/**
 * Braided Bag Calculation (3,300 SFT full bag / 1,650 SFT half bag)
 */
export function calculateBraidedBags(requiredSft: number): BagRecommendation {
  const FULL_BAG = 3300;
  const HALF_BAG = 1650;

  if (requiredSft <= 0) {
    return {
      fullBagsOnly: { bags: 0, totalSft: 0, excessSft: 0, description: '0 Bags' },
      withHalfBag: { fullBags: 0, halfBags: 0, totalSft: 0, excessSft: 0, description: '0 Bags' }
    };
  }

  // 1. Primary Recommendation: Full Bags Only
  const fullBagsOnlyCount = Math.ceil(requiredSft / FULL_BAG);
  const fullBagsOnlyTotal = fullBagsOnlyCount * FULL_BAG;
  const fullBagsOnlyExcess = fullBagsOnlyTotal - requiredSft;

  // 2. Secondary Option: Full + Half Bag if customer objects to extra material
  const baseFull = Math.floor(requiredSft / FULL_BAG);
  const remainder = requiredSft - (baseFull * FULL_BAG);

  let withHalfFull = baseFull;
  let withHalfHalf = 0;
  if (remainder === 0) {
    withHalfHalf = 0;
  } else if (remainder <= HALF_BAG) {
    withHalfHalf = 1;
  } else {
    withHalfFull += 1;
    withHalfHalf = 0;
  }

  const withHalfTotal = (withHalfFull * FULL_BAG) + (withHalfHalf * HALF_BAG);
  const withHalfExcess = withHalfTotal - requiredSft;

  return {
    fullBagsOnly: {
      bags: fullBagsOnlyCount,
      totalSft: fullBagsOnlyTotal,
      excessSft: fullBagsOnlyExcess,
      description: `${fullBagsOnlyCount} Full Bag${fullBagsOnlyCount > 1 ? 's' : ''} (100 × 33 ft = ${fullBagsOnlyTotal.toLocaleString('en-IN')} SFT)`
    },
    withHalfBag: {
      fullBags: withHalfFull,
      halfBags: withHalfHalf,
      totalSft: withHalfTotal,
      excessSft: withHalfExcess,
      description: withHalfHalf > 0 
        ? `${withHalfFull} Full Bag${withHalfFull !== 1 ? 's' : ''} (100×33 ft) + 1 Half Bag (50×33 ft) = ${withHalfTotal.toLocaleString('en-IN')} SFT`
        : `${withHalfFull} Full Bag${withHalfFull !== 1 ? 's' : ''} (100×33 ft) = ${withHalfTotal.toLocaleString('en-IN')} SFT`
    }
  };
}

/**
 * Main Deterministic Cricket Net Calculation Function
 */
export function calculateCricketNetting(input: CricketNetInput): CricketNetCalculationResult {
  const { lengthFt: rawL, widthFt: rawW, heightFt: rawH } = input;
  const isPoleToPole = input.isPoleToPole !== false; // Default true if unspecified
  const measurementConfirmed = input.measurementConfirmed === true;

  if (rawL <= 0 || rawW <= 0 || rawH <= 0) {
    throw new Error('Length, width, and height must be positive numbers.');
  }

  // 1. Owner Confirmation Check (> 200 ft)
  let requiresOwnerConfirmation = false;
  let ownerConfirmationReason: string | undefined;
  if (rawL > 200 || rawW > 200 || rawH > 200) {
    requiresOwnerConfirmation = true;
    ownerConfirmationReason = `Dimension exceeds standard 200 ft limit (L: ${rawL}ft, W: ${rawW}ft, H: ${rawH}ft). Production & delivery feasibility requires Managing Director authorization.`;
  }

  // 2. Installation Allowances
  const lAllowance = isPoleToPole ? getInstallationAllowance(rawL) : 0;
  const wAllowance = isPoleToPole ? getInstallationAllowance(rawW) : 0;
  const hAllowance = isPoleToPole ? getInstallationAllowance(rawH) : 0;

  const adjL = rawL + lAllowance;
  const adjW = rawW + wAllowance;
  const adjH = rawH + hAllowance;

  // 3. Piece Breakdown
  const includeTop = input.includeTop !== false && input.includeRoof !== false;
  const includeL1 = input.includeLengthSide1 !== false;
  const includeL2 = input.includeLengthSide2 !== false;
  const includeW1 = input.includeWidthSide1 !== false;
  const includeW2 = input.includeWidthSide2 !== false;

  const topSft = Math.round(adjL * adjW);
  const l1Sft = Math.round(adjL * adjH);
  const l2Sft = Math.round(adjL * adjH);
  const w1Sft = Math.round(adjW * adjH);
  const w2Sft = Math.round(adjW * adjH);

  const groundFootprintSft = topSft;

  // Material distinction: Top is twisted if groundFootprintSft > 3300, sides are braided
  const isTopTwisted = groundFootprintSft > 3300;

  const pieces: CricketNetPiece[] = [
    {
      id: 'top',
      name: `Top Overhead Net (${adjL} × ${adjW} ft)`,
      dim1Ft: adjL,
      dim2Ft: adjW,
      sft: topSft,
      included: includeTop,
      materialType: isTopTwisted ? 'twisted' : 'braided'
    },
    {
      id: 'length_side_1',
      name: `Length Side 1 (${adjL} × ${adjH} ft)`,
      dim1Ft: adjL,
      dim2Ft: adjH,
      sft: l1Sft,
      included: includeL1,
      materialType: 'braided'
    },
    {
      id: 'length_side_2',
      name: `Length Side 2 (${adjL} × ${adjH} ft)`,
      dim1Ft: adjL,
      dim2Ft: adjH,
      sft: l2Sft,
      included: includeL2,
      materialType: 'braided'
    },
    {
      id: 'width_side_1',
      name: `Width Side 1 (Backstop) (${adjW} × ${adjH} ft)`,
      dim1Ft: adjW,
      dim2Ft: adjH,
      sft: w1Sft,
      included: includeW1,
      materialType: 'braided'
    },
    {
      id: 'width_side_2',
      name: `Width Side 2 (Front/Opposite) (${adjW} × ${adjH} ft)`,
      dim1Ft: adjW,
      dim2Ft: adjH,
      sft: w2Sft,
      included: includeW2,
      materialType: 'braided'
    }
  ];

  // 4. Side Netting Totals (Braided)
  const sideNettingSft = (includeL1 ? l1Sft : 0) +
                         (includeL2 ? l2Sft : 0) +
                         (includeW1 ? w1Sft : 0) +
                         (includeW2 ? w2Sft : 0);

  const sideThickness = input.sideThickness || '2.5mm';
  // Default to 45mm mesh for affordability; never allow 50mm for 2.5mm braided
  let sideMesh = input.sideMesh || '45mm';
  if (sideMesh === ('50mm' as any) && sideThickness === '2.5mm') {
    sideMesh = '45mm';
  }

  const bagRecommendation = calculateBraidedBags(sideNettingSft);

  // Cutting feasibility against standard 33 ft bag width
  let cuttingFeasibility = `Standard 33 ft roll width.`;
  if (adjH <= 16.5) {
    cuttingFeasibility = `Height ${adjH} ft fits standard 33 ft roll efficiently (cuts into two seamless strips with zero width wastage).`;
  } else if (adjH <= 33) {
    cuttingFeasibility = `Height ${adjH} ft fits directly within standard 33 ft roll width.`;
  } else {
    cuttingFeasibility = `Height ${adjH} ft exceeds 33 ft roll width; requires seamless factory-stitched horizontal joining.`;
  }

  // 5. Top Netting Totals (Material Separation)
  const topNettingSft = includeTop ? topSft : 0;
  const customizationRatePerSft = (includeTop && isTopTwisted) ? 0.50 : 0;
  const totalCustomizationCharge = (includeTop && isTopTwisted) ? Math.round(topNettingSft * 0.50) : 0;

  const topNetting = {
    included: includeTop,
    requiredSft: topNettingSft,
    recommendedMaterial: isTopTwisted ? '1.5mm Twisted HDPE (24-Ply)' : `${sideThickness} Braided HDPE`,
    recommendedMesh: isTopTwisted ? '40mm Mesh' : sideMesh,
    isCustomizedTwisted: isTopTwisted,
    customizationRatePerSft,
    totalCustomizationCharge,
    note: isTopTwisted
      ? `For ground footprint >3,300 SFT (${groundFootprintSft.toLocaleString('en-IN')} SFT), we recommend 1.5mm 24-ply twisted top net: lightweight, reduces sag, and highly economical. Includes fixed diamond-to-square customization charge of ₹0.50/SFT (₹${totalCustomizationCharge.toLocaleString('en-IN')}).`
      : `Top net customized to ${adjL} × ${adjW} ft (${topNettingSft.toLocaleString('en-IN')} SFT).`
  };

  // 6. Overall Material Summary
  const totalRequestedSft = sideNettingSft + topNettingSft;
  const primarySuppliedSft = bagRecommendation.fullBagsOnly.totalSft + topNettingSft;
  const primaryExcessSft = primarySuppliedSft - totalRequestedSft;

  const secondarySuppliedSft = bagRecommendation.withHalfBag.totalSft + topNettingSft;
  const secondaryExcessSft = secondarySuppliedSft - totalRequestedSft;

  // 7. Hardware Estimation
  const perimeterFt = 2 * (adjL + adjW);
  const perimeterTiers = 4;
  const perimeterWireRft = perimeterFt * perimeterTiers;
  const roofGridWireRft = includeTop ? (Math.ceil(adjL / 15) * adjW + Math.ceil(adjW / 15) * adjL) : 0;
  const totalWireRft = Math.round((perimeterWireRft + roofGridWireRft) * 1.1);
  const turnbucklesQty = Math.ceil(perimeterFt / 25) * 2;
  const dShacklesQty = turnbucklesQty;
  const wireClampsQty = turnbucklesQty * 3;

  // 8. Natural 1-2 sentence sales pitch
  let salesPitch = '';
  if (!measurementConfirmed) {
    salesPitch = `Sir, are these pole-to-pole measurements, or have you already included extra material for installation and folding?`;
  } else {
    salesPitch = `For ${adjL}×${adjW}×${adjH} ft court, side nets require ${sideNettingSft.toLocaleString('en-IN')} SFT (${bagRecommendation.fullBagsOnly.description}). ` +
      (includeTop
        ? `Top net is ${topNettingSft.toLocaleString('en-IN')} SFT (${topNetting.recommendedMaterial}, with ₹0.50/sft customization). Shall I share the official quote?`
        : `Shall I share the official quote?`);
  }

  return {
    measurementConfirmed,
    isPoleToPole,
    requiresOwnerConfirmation,
    ownerConfirmationReason,
    rawDimensions: { lengthFt: rawL, widthFt: rawW, heightFt: rawH },
    allowances: { lengthAllowanceFt: lAllowance, widthAllowanceFt: wAllowance, heightAllowanceFt: hAllowance },
    adjustedDimensions: { lengthFt: adjL, widthFt: adjW, heightFt: adjH },
    pieces,
    groundFootprintSft,
    sideNetting: {
      requiredSft: sideNettingSft,
      recommendedMaterial: `${sideThickness} Braided HDPE`,
      recommendedMesh: `${sideMesh} (Affordable & High Durability)`,
      bagRecommendation,
      cuttingFeasibility
    },
    topNetting,
    summary: {
      totalRequestedSft,
      primarySuppliedSft,
      primaryExcessSft,
      secondarySuppliedSft,
      secondaryExcessSft
    },
    hardware: {
      wireRopeRft: totalWireRft,
      turnbucklesQty,
      dShacklesQty,
      wireClampsQty
    },
    salesPitch
  };
}
