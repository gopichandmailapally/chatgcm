/**
 * GCM Enterprises Turnkey Sports & Box Cricket Calculation Engine
 * Source of Truth: /var/www/gcm.enterprises/admin/turnkey_calculator.php
 * Covers complete Turnkey Box Cricket, Sports Turf, Structural Steel, Lighting, and Civil Bed.
 */

export interface TurnkeyCourtInput {
  lengthFt: number;
  widthFt: number;
  heightFt: number;
  sportType?: string; // 'box_cricket' | 'cricket_training' | 'futsal' | 'multi_sport'
  roofType?: 'light_cable_top' | 'pipe_top' | 'truss_top' | 'open_top';
  packageType?: 'essential' | 'commercial' | 'premium_pro';
  turfType?: 'non_infill_turf' | 'infill_turf_40mm' | 'infill_turf_50mm' | 'curled_pitch_15mm';
  civilBedType?: 'compacted_wmm' | 'pcc_m15_4inch' | 'existing_terrace_ground';
}

export interface TurnkeyBOQItem {
  key: string;
  name: string;
  description: string;
  ratePerSft: number;
  totalAmount: number;
}

export interface TurnkeyBOQResult {
  projectName: string;
  packageKey: string;
  packageName: string;
  dimensions: {
    lengthFt: number;
    widthFt: number;
    heightFt: number;
    groundAreaSft: number;
    perimeterFt: number;
  };
  nettingSpecs: {
    sideNettingSft: number;
    roofNettingSft: number;
    totalNettingSft: number;
    camberPct: number;
    recommendedSideNet: string;
    recommendedRoofNet: string;
  };
  structuralSteel: {
    columnCount: number;
    columnSpacingFt: number;
    horizontalTiePipesRft: number;
    wireRopeGridRft: number;
    spec: string;
  };
  turfSystem: {
    turfAreaSft: number;
    turfType: string;
    rollsRequired: number; // 2m x 25m = 540 SFT/roll
    infillIncluded: boolean;
  };
  lightingSystem: {
    fixtureCount: number;
    wattage: string;
    targetLux: string;
  };
  items: TurnkeyBOQItem[];
  subtotal: number;
  ratePerGroundSft: number;
  gstAmount: number;
  grandTotal: number;
  warrantyYears: number;
  estimatedTimelineDays: number;
}

export function calculateTurnkeyBoxCricketBOQ(input: TurnkeyCourtInput): TurnkeyBOQResult {
  const L = Math.max(20, Number(input.lengthFt));
  const W = Math.max(10, Number(input.widthFt));
  const H = Math.max(10, Number(input.heightFt || 25));
  const packageType = input.packageType || 'commercial';
  const roofType = input.roofType || 'light_cable_top';
  const turfType = input.turfType || 'non_infill_turf';
  const civilBedType = input.civilBedType || 'compacted_wmm';

  // Ground area & perimeter
  const groundAreaSft = L * W;
  const perimeterFt = 2 * (L + W);

  // Height adjustment (Standard height = 20ft; extra height adjusts structure/netting)
  const heightAdj = (H - 20) * 1.5;

  // Netting calculation (with 8% roof camber for light_cable_top)
  const sideNettingSft = Math.round(perimeterFt * H * 1.05); // 5% overlap and bottom skirt
  const roofCamber = roofType === 'open_top' ? 0 : 0.08;
  const roofNettingSft = roofType === 'open_top' ? 0 : Math.round(groundAreaSft * (1 + roofCamber));
  const totalNettingSft = sideNettingSft + roofNettingSft;

  // Structural Framework specs
  const columnCount = Math.ceil(perimeterFt / 12.5) + 4; // Columns every 12.5ft + 4 corner ladders
  const horizontalTiePipesRft = Math.round(perimeterFt * Math.ceil(H / 8));
  const wireRopeGridRft = Math.round((perimeterFt * 4) + (L * 4) + (W * 4));

  // Turf rolls calculation (540 SFT per roll) + 4% seam wastage
  const turfAreaSft = Math.round(groundAreaSft * 1.04);
  const rollsRequired = Math.ceil(turfAreaSft / 540);

  // Lighting specs based on ground footprint
  const fixtureCount = groundAreaSft <= 3000 ? 6 : groundAreaSft <= 6000 ? 8 : 12;

  // Itemized Rates matching /var/www/gcm.enterprises/admin/turnkey_calculator.php
  const isCommercial = packageType === 'commercial';
  const isPremium = packageType === 'premium_pro';

  // 1. Civil Base
  let civilRate = 45.0; // Compacted WMM
  let civilDesc = 'Compacted WMM Base: 150mm Wet Mix Macadam base with stone dust leveling and roller compaction.';
  if (civilBedType === 'pcc_m15_4inch') {
    civilRate = 85.0;
    civilDesc = 'PCC M15 Bed: 4-inch concrete slab with broom finish and expansion joints.';
  } else if (civilBedType === 'existing_terrace_ground') {
    civilRate = 0.0;
    civilDesc = 'Existing Ground / Terrace: Prepared sub-base already available (₹0).';
  }

  // 2. Drainage
  const drainRate = civilRate > 0 ? (isCommercial ? 15.0 : isPremium ? 20.0 : 10.0) : 0.0;

  // 3. Structural Steel Framework
  const structureRate = isCommercial ? Math.round((60.0 + (heightAdj * 0.6)) * 100) / 100 : 50.0;

  // 4. Side & Backstop Netting
  const sideNetRate = isCommercial ? Math.round((25.0 + (heightAdj * 0.4)) * 100) / 100 : 20.0;

  // 5. Roof / Top Netting
  let topNetRate = roofType === 'open_top' ? 0.0 : isCommercial ? 8.0 : 6.0;
  if (roofType === 'pipe_top') topNetRate = isCommercial ? 16.0 : 12.0;
  if (roofType === 'truss_top') topNetRate = isCommercial ? 28.0 : 20.0;

  // 6. Artificial Turf Flooring
  let turfRate = 85.0;
  let turfDesc = 'Non-Infill Multi-Sport Artificial Grass Turf 25mm Pile, UV Stabilized with double reinforced backing.';
  if (turfType === 'infill_turf_40mm' || turfType === 'infill_turf_50mm') {
    turfRate = 75.0;
    turfDesc = 'Infill 40mm/50mm Monofilament Turf + Silica Sand + Resilient Rubber Granules.';
  }

  // 7. Infill
  const infillRate = turfType.includes('infill_turf') ? 18.0 : 0.0;

  // 8. Sports LED Floodlights
  const lightingRate = isCommercial ? 22.0 : isPremium ? 28.0 : 18.0;

  // 9. Electrical Cabling & DB
  const electricalRate = isCommercial ? 8.0 : 6.0;

  // 10. Player Access Gate
  const gateRate = isCommercial ? 7.0 : 5.0;

  // 11. Equipment & Court Markings
  const equipmentRate = isCommercial ? 5.0 : 4.0;

  // 12. Anti-Rust Coating
  const finishingRate = isCommercial ? 4.0 : 3.0;

  // 13. Turnkey Installation & Erection
  const installRate = isCommercial ? 8.0 : 6.0;

  // 14. Freight & Dedicated Logistics
  const transportRate = 3.0;

  // 15. Project Management & QC
  const pmRate = isCommercial ? 3.0 : 2.0;

  const items: TurnkeyBOQItem[] = [
    { key: 'civil_base', name: 'Civil Sub-Base', description: civilDesc, ratePerSft: civilRate, totalAmount: Math.round(civilRate * groundAreaSft) },
    { key: 'drainage', name: 'Perimeter Drainage', description: 'Engineered sub-surface drainage trench with catch pits for rainwater discharge.', ratePerSft: drainRate, totalAmount: Math.round(drainRate * groundAreaSft) },
    { key: 'structural_steel', name: 'Structural Steel Framework', description: `Heavy-Duty 40x40 Ladder Framework, ${columnCount} Ladder Columns, horizontal tie purlins, zinc chromate epoxy primer + double PU finish.`, ratePerSft: structureRate, totalAmount: Math.round(structureRate * groundAreaSft) },
    { key: 'side_netting', name: 'Commercial Side & End Netting', description: `RUSSEA™ 2.5mm HDPE Braided 45mm mesh (${sideNettingSft.toLocaleString('en-IN')} SFT) with 8mm border rope & 6mm PVC wire rope tension grid.`, ratePerSft: sideNetRate, totalAmount: Math.round(sideNetRate * groundAreaSft) },
    { key: 'roof_netting', name: 'Overhead Roof Netting', description: roofType === 'open_top' ? 'Open Top Court: No roof netting.' : `High-Tenacity 1.5mm Overhead Roof Netting (${roofNettingSft.toLocaleString('en-IN')} SFT) suspended on high-tension cable grid with 8% camber.`, ratePerSft: topNetRate, totalAmount: Math.round(topNetRate * groundAreaSft) },
    { key: 'turf_flooring', name: 'Multi-Sport Artificial Turf', description: `${turfDesc} (${turfAreaSft.toLocaleString('en-IN')} SFT / ${rollsRequired} Rolls).`, ratePerSft: turfRate, totalAmount: Math.round(turfRate * groundAreaSft) },
    ...(infillRate > 0 ? [{ key: 'infill_system', name: 'Silica Sand & Rubber Infill', description: 'Graded silica sand (15 kg/sqm) + resilient SBR granules (4 kg/sqm).', ratePerSft: infillRate, totalAmount: Math.round(infillRate * groundAreaSft) }] : []),
    { key: 'stadium_lighting', name: 'Stadium Sports LED Lighting', description: `${fixtureCount} Nos 200W High-Lumen Stadium LED Floodlights (IP66, 140 lm/W, 250+ lux avg illumination).`, ratePerSft: lightingRate, totalAmount: Math.round(lightingRate * groundAreaSft) },
    { key: 'electrical_system', name: 'Industrial Electrical System', description: 'Heavy-duty 4-core copper armored cabling, weather-proof DB, digital auto-timer controller, and chemical earthing pit.', ratePerSft: electricalRate, totalAmount: Math.round(electricalRate * groundAreaSft) },
    { key: 'player_gate', name: 'Player Access Gate', description: 'Heavy-duty 4ft x 7ft MS/GI access door with cylinder lock, safety foam padding, and weather-proof hinges.', ratePerSft: gateRate, totalAmount: Math.round(gateRate * groundAreaSft) },
    { key: 'court_markings', name: 'Court Markings & Accessories', description: 'Regulation boundary lines, bowling & popping creases, and official sports accessories.', ratePerSft: equipmentRate, totalAmount: Math.round(equipmentRate * groundAreaSft) },
    { key: 'anti_rust_finish', name: 'Anti-Rust Coating & PU Finish', description: '2 coats epoxy zinc chromate primer + 2 coats weather-shield polyurethane top coat.', ratePerSft: finishingRate, totalAmount: Math.round(finishingRate * groundAreaSft) },
    { key: 'turnkey_installation', name: 'Turnkey Installation & Commissioning', description: 'Laser-guided leveling, certified structural welding, specialized turf seaming, tension rigging, and field commissioning.', ratePerSft: installRate, totalAmount: Math.round(installRate * groundAreaSft) },
    { key: 'freight_transport', name: 'Freight & Staging Logistics', description: 'Dedicated vehicle freight, crane unloading, and safe on-site staging.', ratePerSft: transportRate, totalAmount: Math.round(transportRate * groundAreaSft) },
    { key: 'project_mgmt', name: 'Project Engineering & Handover', description: 'Dedicated project engineer supervision, structural quality inspection, and official test handover.', ratePerSft: pmRate, totalAmount: Math.round(pmRate * groundAreaSft) }
  ];

  const subtotal = items.reduce((sum, it) => sum + it.totalAmount, 0);
  const ratePerGroundSft = Math.round((subtotal / groundAreaSft) * 100) / 100;
  const gstAmount = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + gstAmount;

  return {
    projectName: `Turnkey Box Cricket (${L}ft x ${W}ft x ${H}ft)`,
    packageKey: packageType,
    packageName: isCommercial ? 'Commercial Standard (Best Value)' : isPremium ? 'Premium Pro Club' : 'Essential',
    dimensions: { lengthFt: L, widthFt: W, heightFt: H, groundAreaSft, perimeterFt },
    nettingSpecs: {
      sideNettingSft,
      roofNettingSft,
      totalNettingSft,
      camberPct: roofType === 'open_top' ? 0 : 8,
      recommendedSideNet: 'RUSSEA™ 2.5mm Braided Dark Green HDPE (45mm mesh)',
      recommendedRoofNet: roofType === 'open_top' ? 'None (Open Top)' : 'RUSSEA™ 1.5mm / 24-Ply UV Overhead Netting (35mm mesh)'
    },
    structuralSteel: {
      columnCount,
      columnSpacingFt: 12.5,
      horizontalTiePipesRft,
      wireRopeGridRft,
      spec: 'Heavy-Duty 40x40 GI Ladder Columns (2-Line) with Zinc Chromate Primer + PU Coat'
    },
    turfSystem: {
      turfAreaSft,
      turfType,
      rollsRequired,
      infillIncluded: turfType.includes('infill_turf')
    },
    lightingSystem: {
      fixtureCount,
      wattage: '200W Stadium LED (IP66)',
      targetLux: '250+ Lux Average'
    },
    items,
    subtotal,
    ratePerGroundSft,
    gstAmount,
    grandTotal,
    warrantyYears: isCommercial ? 2 : isPremium ? 3 : 1,
    estimatedTimelineDays: Math.min(30, Math.max(12, Math.round(groundAreaSft / 250)))
  };
}

export const calculateTurnkeyBoxCricket = calculateTurnkeyBoxCricketBOQ;
