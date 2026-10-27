/**
 * GCM Safety Nets Installation & Service Calculation Engine
 * Re-architected to delegate directly to Universal Pricing Engine
 * (Single Source of Truth for Installed Safety Nets, Invisible Grills, and Cloth Hangers)
 */

import {
  calculateInstalledSafetyNet,
  calculateInvisibleGrills,
  calculateClothHanger,
  type InstalledNetQualityId
} from '../pricing/universal-pricing-engine.js';

export interface BalconySection {
  name: string;
  lengthFt: number;
  heightFt: number;
}

export interface BalconyServiceInput {
  serviceType: 'balcony_safety_net' | 'pigeon_net' | 'invisible_grill' | 'duct_net' | 'cloth_hanger';
  sections?: BalconySection[];
  totalAreaSft?: number;
  thicknessMm?: number; // 1.5, 2.0, 2.5, 3.0
  meshOrGapMm?: number; // 30, 40, 45 for nets; 2 or 3 (inches) for grills
  hangerType?: 'ceiling' | 'wall';
  hangerLengthFt?: number; // 4, 5, 6, 7, 8
  quantity?: number;
  isOutsideHyderabad?: boolean;
  locationCity?: string;
}

export interface BalconyServiceResult {
  serviceName: string;
  totalActualSft: number;
  billedSft: number;
  isMinimumBillingApplied: boolean;
  thicknessMm: number;
  meshOrGapText: string;
  ratePerSftOrUnit: number;
  minRate: number;
  maxRate: number;
  totalAmount: number;
  hardwareSpecs: {
    anchorHooksCount: number;
    anchorGrade: string;
    borderRopeRft: number;
    warrantyYears: number;
  };
  installationOffer: string;
}

export function calculateSafetyNetInstallation(input: BalconyServiceInput): BalconyServiceResult {
  const serviceType = input.serviceType || 'balcony_safety_net';

  // 1. Cloth Drying Hangers
  if (serviceType === 'cloth_hanger') {
    const len = (input.hangerLengthFt || 6) as 4 | 5 | 6 | 7 | 8;
    const qty = input.quantity || 1;
    const type = input.hangerType || 'ceiling';

    const hangerRes = calculateClothHanger({
      sizeFt: len,
      mountingType: type as any,
      quantity: qty,
      isOutsideHyderabad: input.isOutsideHyderabad,
      locationCity: input.locationCity
    });

    return {
      serviceName: hangerRes.productName,
      totalActualSft: len,
      billedSft: qty,
      isMinimumBillingApplied: false,
      thicknessMm: 0,
      meshOrGapText: `${len} Feet`,
      ratePerSftOrUnit: hangerRes.finalUnitPrice,
      minRate: hangerRes.finalUnitPrice,
      maxRate: hangerRes.finalUnitPrice,
      totalAmount: hangerRes.totalAmount,
      hardwareSpecs: {
        anchorHooksCount: qty * 6,
        anchorGrade: 'SS 304 Metal Pulley Fasteners',
        borderRopeRft: qty * len * 6,
        warrantyYears: 2
      },
      installationOffer: input.isOutsideHyderabad ? 'Installation Included (+₹500 Outstation Surcharge)' : 'Complete Doorstep Installation Included in Hyderabad'
    };
  }

  // Calculate Total SFT
  let totalSft = input.totalAreaSft || 0;
  if (input.sections && input.sections.length > 0) {
    totalSft = input.sections.reduce((sum, sec) => sum + (sec.lengthFt * sec.heightFt), 0);
  }
  totalSft = Math.round(totalSft);

  // 2. Invisible Grills
  if (serviceType === 'invisible_grill') {
    const grillRes = calculateInvisibleGrills({
      totalAreaSft: totalSft,
      isOutsideHyderabad: input.isOutsideHyderabad,
      locationCity: input.locationCity,
      wireDiameter: (input.thicknessMm === 3.0 ? '3.0mm' : input.thicknessMm === 2.0 ? '2.0mm' : '2.5mm') as any,
      spacing: (input.meshOrGapMm === 3 ? '3-inch' : '2-inch') as any
    });

    return {
      serviceName: grillRes.productName,
      totalActualSft: totalSft,
      billedSft: grillRes.totalAreaSft,
      isMinimumBillingApplied: grillRes.isMinimumBillingApplied,
      thicknessMm: input.thicknessMm || 2.5,
      meshOrGapText: `${input.meshOrGapMm || 2} Inch Line Spacing`,
      ratePerSftOrUnit: grillRes.effectiveRatePerSft,
      minRate: grillRes.effectiveRatePerSft,
      maxRate: grillRes.effectiveRatePerSft,
      totalAmount: grillRes.totalAmount,
      hardwareSpecs: {
        anchorHooksCount: Math.ceil(totalSft * 1.5),
        anchorGrade: grillRes.specifications.wireGrade,
        borderRopeRft: Math.round(Math.sqrt(totalSft) * 4),
        warrantyYears: grillRes.specifications.warrantyYears
      },
      installationOffer: grillRes.summaryText
    };
  }

  // 3. Balcony & Pigeon Safety Nets
  const thickness = input.thicknessMm || (serviceType === 'pigeon_net' ? 1.5 : 2.0);
  const mesh = input.meshOrGapMm || (serviceType === 'pigeon_net' ? 30 : 45);

  let qualityId: InstalledNetQualityId = '2.0mm_45mm';
  if (thickness === 1.5 || mesh === 30) {
    qualityId = '1.5mm_30mm';
  } else if (thickness === 2.5) {
    qualityId = mesh === 40 ? '2.5mm_40mm' : '2.5mm_45mm';
  } else {
    qualityId = mesh === 40 ? '2.0mm_40mm' : '2.0mm_45mm';
  }

  const netRes = calculateInstalledSafetyNet(qualityId, totalSft);

  return {
    serviceName: netRes.qualityName,
    totalActualSft: totalSft,
    billedSft: netRes.billedAreaSft,
    isMinimumBillingApplied: netRes.isMinimumChargeApplied,
    thicknessMm: thickness,
    meshOrGapText: `${mesh}mm Mesh`,
    ratePerSftOrUnit: netRes.ratePerSft,
    minRate: netRes.ratePerSft,
    maxRate: netRes.ratePerSft,
    totalAmount: netRes.totalAmount,
    hardwareSpecs: {
      anchorHooksCount: Math.ceil(netRes.billedAreaSft * 0.9),
      anchorGrade: 'SS 316 Anchor Fasteners + Virgin Nylon 6 Border Ropes',
      borderRopeRft: Math.round(Math.sqrt(netRes.billedAreaSft) * 4),
      warrantyYears: thickness >= 2.5 ? 8 : (thickness >= 2.0 ? 5 : 3)
    },
    installationOffer: netRes.explanation
  };
}

export const calculateBalconySafety = calculateSafetyNetInstallation;
