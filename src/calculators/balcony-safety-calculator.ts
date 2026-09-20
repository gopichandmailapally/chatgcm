/**
 * GCM Safety Nets Installation & Service Calculation Engine
 * Source of Truth: /var/www/gcmsafetynets.in/assets/js/estimation.js
 * Covers Balcony Safety Nets, Pigeon Nets, Invisible Grills, and Cloth Hangers with Doorstep Installation.
 */

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
  meshOrGapMm?: number; // 30, 40, 45, 50 for nets; 2 or 3 (inches) for grills
  hangerType?: 'ceiling' | 'wall';
  hangerLengthFt?: number; // 4, 5, 6, 7, 8
  quantity?: number;
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

  // Handle Cloth Drying Hangers separately
  if (serviceType === 'cloth_hanger') {
    const len = input.hangerLengthFt || 6;
    const qty = input.quantity || 1;
    const type = input.hangerType || 'ceiling';

    const hangerRates: Record<string, Record<number, { min: number; max: number }>> = {
      ceiling: { 4: { min: 2000, max: 2500 }, 5: { min: 2250, max: 2750 }, 6: { min: 2500, max: 3000 }, 7: { min: 2750, max: 3250 }, 8: { min: 3000, max: 3500 } },
      wall:    { 4: { min: 2500, max: 3000 }, 5: { min: 2750, max: 3250 }, 6: { min: 3000, max: 3500 }, 7: { min: 3250, max: 3750 }, 8: { min: 3500, max: 4000 } }
    };

    const rates = hangerRates[type]?.[len] || { min: 2500, max: 3000 };
    const avgRate = Math.round((rates.min + rates.max) / 2);
    const totalAmount = avgRate * qty;

    return {
      serviceName: `6-Pipe SS Cloth Drying Hanger (${type === 'ceiling' ? 'Ceiling Mounted' : 'Wall Mounted'}, ${len}ft)`,
      totalActualSft: len,
      billedSft: qty,
      isMinimumBillingApplied: false,
      thicknessMm: 0,
      meshOrGapText: `${len} Feet`,
      ratePerSftOrUnit: avgRate,
      minRate: rates.min,
      maxRate: rates.max,
      totalAmount,
      hardwareSpecs: {
        anchorHooksCount: qty * 6,
        anchorGrade: 'SS 202/304 Pulley Fasteners',
        borderRopeRft: qty * len * 6,
        warrantyYears: 2
      },
      installationOffer: 'Free Doorstep Technician Delivery & Installation in Hyderabad'
    };
  }

  // Calculate Total SFT
  let totalSft = input.totalAreaSft || 0;
  if (input.sections && input.sections.length > 0) {
    totalSft = input.sections.reduce((sum, sec) => sum + (sec.lengthFt * sec.heightFt), 0);
  }
  totalSft = Math.round(totalSft);

  // 1. Invisible Grills
  if (serviceType === 'invisible_grill') {
    const thickness = input.thicknessMm || 2.5;
    const gap = input.meshOrGapMm || 2; // 2 inches or 3 inches

    const grillRates: Record<number, Record<number, { min: number; max: number }>> = {
      1.5: { 2: { min: 130, max: 150 }, 3: { min: 120, max: 140 } },
      2.0: { 2: { min: 140, max: 160 }, 3: { min: 130, max: 150 } },
      2.5: { 2: { min: 150, max: 170 }, 3: { min: 140, max: 160 } },
      3.0: { 2: { min: 160, max: 180 }, 3: { min: 150, max: 170 } }
    };

    const rateObj = grillRates[thickness]?.[gap] || { min: 150, max: 170 };
    const avgRate = Math.round((rateObj.min + rateObj.max) / 2);

    const isMin = totalSft < 80;
    const billedSft = isMin ? 80 : totalSft;
    const totalAmount = billedSft * avgRate;

    return {
      serviceName: 'AISI 316 Marine Grade Invisible Grills',
      totalActualSft: totalSft,
      billedSft,
      isMinimumBillingApplied: isMin,
      thicknessMm: thickness,
      meshOrGapText: `${gap} Inch Line Spacing`,
      ratePerSftOrUnit: avgRate,
      minRate: rateObj.min,
      maxRate: rateObj.max,
      totalAmount,
      hardwareSpecs: {
        anchorHooksCount: Math.ceil(totalSft * 1.5),
        anchorGrade: 'AISI 316 Marine Grade Stainless Steel + DuPont Nylon Casing',
        borderRopeRft: Math.round(Math.sqrt(totalSft) * 4),
        warrantyYears: 10
      },
      installationOffer: 'Free Doorstep Measurement & Demo Van across Hyderabad'
    };
  }

  // 2. Balcony & Pigeon Safety Nets
  const thickness = input.thicknessMm || (serviceType === 'pigeon_net' ? 1.5 : 2.0);
  const gap = input.meshOrGapMm || (serviceType === 'pigeon_net' ? 30 : 40);

  // Exact Rate Matrix from /var/www/gcmsafetynets.in/assets/js/estimation.js
  let minPrice = 0;
  let maxPrice = 0;
  let avgRate = 0;
  let minRate = 0;
  let maxRate = 0;
  let isMinApplied = false;
  let billedSft = totalSft;

  if (totalSft < 100) {
    isMinApplied = true;
    billedSft = 100;
    if (thickness <= 1.5) {
      minPrice = maxPrice = 1500;
      avgRate = minRate = maxRate = 15;
    } else if (thickness <= 2.0) {
      minPrice = maxPrice = 1650;
      avgRate = minRate = maxRate = 16.5;
    } else {
      minPrice = maxPrice = 1800;
      avgRate = minRate = maxRate = 18;
    }
  } else {
    // Determine slab
    const slabKey = totalSft < 250 ? '100-250' : totalSft < 500 ? '250-500' : totalSft < 1000 ? '500-1000' : '1000-5000';

    const ratesTable: Record<string, Record<number, Record<number, { min: number; max: number }>>> = {
      '100-250':  { 1.5: { 30: { min: 16, max: 20 } }, 2: { 40: { min: 24, max: 28 }, 45: { min: 22, max: 26 }, 50: { min: 20, max: 24 } }, 2.5: { 40: { min: 26, max: 30 }, 45: { min: 24, max: 28 }, 50: { min: 22, max: 24 } } },
      '250-500':  { 1.5: { 30: { min: 14, max: 18 } }, 2: { 40: { min: 20, max: 24 }, 45: { min: 18, max: 22 }, 50: { min: 16, max: 20 } }, 2.5: { 40: { min: 22, max: 26 }, 45: { min: 20, max: 24 }, 50: { min: 18, max: 22 } } },
      '500-1000': { 1.5: { 30: { min: 12, max: 16 } }, 2: { 40: { min: 18, max: 22 }, 45: { min: 16, max: 20 }, 50: { min: 14, max: 18 } }, 2.5: { 40: { min: 20, max: 24 }, 45: { min: 18, max: 22 }, 50: { min: 16, max: 20 } } },
      '1000-5000':{ 1.5: { 30: { min: 10, max: 14 } }, 2: { 40: { min: 14, max: 18 }, 45: { min: 12, max: 16 }, 50: { min: 10, max: 14 } }, 2.5: { 40: { min: 16, max: 20 }, 45: { min: 14, max: 18 }, 50: { min: 12, max: 16 } } }
    };

    const rateEntry = ratesTable[slabKey]?.[thickness]?.[gap] || { min: 20, max: 24 };
    minRate = rateEntry.min;
    maxRate = rateEntry.max;
    avgRate = Math.round((minRate + maxRate) / 2);
    minPrice = minRate * totalSft;
    maxPrice = maxRate * totalSft;
  }

  const totalAmount = isMinApplied ? minPrice : Math.round(avgRate * totalSft);

  return {
    serviceName: serviceType === 'pigeon_net' ? 'Garware Anti-Pigeon Bird Net' : 'Garware High-Tenacity Balcony Safety Net',
    totalActualSft: totalSft,
    billedSft,
    isMinimumBillingApplied: isMinApplied,
    thicknessMm: thickness,
    meshOrGapText: `${gap}mm Mesh Gap`,
    ratePerSftOrUnit: avgRate,
    minRate,
    maxRate,
    totalAmount,
    hardwareSpecs: {
      anchorHooksCount: Math.ceil(billedSft * 0.9),
      anchorGrade: 'SS 316 Anchor Fasteners + Virgin Nylon 6 Border Ropes',
      borderRopeRft: Math.round(Math.sqrt(billedSft) * 4),
      warrantyYears: 5
    },
    installationOffer: 'Free Doorstep Measurement & Demo Van across Hyderabad & Secunderabad'
  };
}

export const calculateBalconySafety = calculateSafetyNetInstallation;
