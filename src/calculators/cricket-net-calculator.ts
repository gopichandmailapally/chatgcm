/**
 * Deterministic Cricket & Sports Net Dimension Calculator
 * Encapsulates proven manufacturing math, perimeter overlaps, and roof camber allowances.
 */

export interface CricketNetInput {
  lengthFt: number; // Length in feet
  widthFt: number;  // Width in feet
  heightFt: number; // Height in feet
  includeRoof?: boolean; // Default true
  overlapPct?: number;   // Default 0.05 (5% margin for skirts & tie overlaps)
  camberPct?: number;    // Default 0.08 (8% margin for roof sag and camber clearance)
}

export interface CricketNetCalculationResult {
  dimensions: {
    lengthFt: number;
    widthFt: number;
    heightFt: number;
  };
  perimeterFt: number;
  sideNettingSft: number;
  roofNettingSft: number;
  totalNettingSft: number;
  borderWireRft: number;
  hardware: {
    wireRopeRft: number;
    turnbucklesQty: number;
    dShacklesQty: number;
    wireClampsQty: number;
  };
  explanation: string;
}

export function calculateCricketNetting(input: CricketNetInput): CricketNetCalculationResult {
  const { lengthFt, widthFt, heightFt } = input;
  const includeRoof = input.includeRoof !== false;
  const overlapPct = input.overlapPct ?? 0.05;
  const camberPct = input.camberPct ?? 0.08;

  if (lengthFt <= 0 || widthFt <= 0 || heightFt <= 0) {
    throw new Error('Length, width, and height must be greater than zero.');
  }

  // 1. Perimeter Calculation
  const perimeterFt = 2 * (lengthFt + widthFt);

  // 2. Side & Backstop Netting (includes 5% overlap/skirt)
  const rawSideSft = perimeterFt * heightFt;
  const sideNettingSft = Math.round(rawSideSft * (1 + overlapPct));

  // 3. Overhead Roof / Top Netting (includes 8% camber sag allowance)
  let roofNettingSft = 0;
  if (includeRoof) {
    const rawRoofSft = lengthFt * widthFt;
    roofNettingSft = Math.round(rawRoofSft * (1 + camberPct));
  }

  // 4. Total SFT
  const totalNettingSft = sideNettingSft + roofNettingSft;

  // 5. High-Tension Perimeter & Grid Wire Ropes (Galvanized / PVC Coated)
  // Top tier (Perimeter) + Bottom tier (Perimeter) + 2 Intermediate tiers + Camber cross ropes
  const perimeterTiers = 4; // Top, Bottom, and 2 middle stabilizer lines
  const perimeterWireRft = perimeterFt * perimeterTiers;
  const roofGridWireRft = includeRoof ? (Math.ceil(lengthFt / 15) * widthFt + Math.ceil(widthFt / 15) * lengthFt) : 0;
  const totalWireRft = Math.round((perimeterWireRft + roofGridWireRft) * 1.1); // 10% tensioning margin

  const turnbucklesQty = Math.ceil(perimeterFt / 25) * 2;
  const dShacklesQty = turnbucklesQty;
  const wireClampsQty = turnbucklesQty * 3;

  return {
    dimensions: { lengthFt, widthFt, heightFt },
    perimeterFt,
    sideNettingSft,
    roofNettingSft,
    totalNettingSft,
    borderWireRft: totalWireRft,
    hardware: {
      wireRopeRft: totalWireRft,
      turnbucklesQty,
      dShacklesQty,
      wireClampsQty,
    },
    explanation: `For ${lengthFt}ft x ${widthFt}ft x ${heightFt}ft court: Side Netting is ${sideNettingSft} SFT (includes 5% skirt/overlap), Top Enclosure is ${roofNettingSft} SFT (includes 8% camber allowance). Total net required is ${totalNettingSft} SFT with ${totalWireRft} RFT tension cable grid.`
  };
}
