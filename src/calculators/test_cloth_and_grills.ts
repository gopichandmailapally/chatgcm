import { calculateClothHanger, ClothHangerSize, ClothHangerMounting } from './cloth-hanger-calculator.js';
import { calculateInvisibleGrills } from './invisible-grill-calculator.js';

function assertEqual(actual: any, expected: any, testName: string) {
  if (actual === expected) {
    console.log(`✅ [PASS] ${testName}: ${actual}`);
  } else {
    console.error(`❌ [FAIL] ${testName}: Expected ${expected}, got ${actual}`);
    process.exit(1);
  }
}

console.log('════════════════════════════════════════════════════════════════');
console.log('TEST SUITE: Cloth Hangers & Invisible Grills Pricing Engines');
console.log('════════════════════════════════════════════════════════════════\n');

// ── PART 1: CLOTH HANGER BASE PRICING & LOCATION SURCHARGES ─────────────────
console.log('--- 1. Cloth Hangers Base Table (Hyderabad) ---');
const ceilingExpected: Record<ClothHangerSize, number> = { 4: 2500, 5: 2750, 6: 3000, 7: 3250, 8: 3500 };
const wallExpected: Record<ClothHangerSize, number> = { 4: 3000, 5: 3250, 6: 3500, 7: 3750, 8: 4000 };

for (const size of [4, 5, 6, 7, 8] as ClothHangerSize[]) {
  const rCeiling = calculateClothHanger({ sizeFt: size, mountingType: 'ceiling', isOutsideHyderabad: false });
  assertEqual(rCeiling.totalAmount, ceilingExpected[size], `Ceiling ${size}ft Hyderabad Qty 1`);

  const rWall = calculateClothHanger({ sizeFt: size, mountingType: 'wall', isOutsideHyderabad: false });
  assertEqual(rWall.totalAmount, wallExpected[size], `Wall ${size}ft Hyderabad Qty 1`);
}

console.log('\n--- 2. Cloth Hangers Outside Hyderabad (+₹500/unit) ---');
for (const size of [4, 5, 6, 7, 8] as ClothHangerSize[]) {
  const rCeilingOut = calculateClothHanger({ sizeFt: size, mountingType: 'ceiling', isOutsideHyderabad: true, locationCity: 'Warangal' });
  assertEqual(rCeilingOut.totalAmount, ceilingExpected[size] + 500, `Ceiling ${size}ft Outside Hyd Qty 1`);

  const rWallOut = calculateClothHanger({ sizeFt: size, mountingType: 'wall', isOutsideHyderabad: true, locationCity: 'Karimnagar' });
  assertEqual(rWallOut.totalAmount, wallExpected[size] + 500, `Wall ${size}ft Outside Hyd Qty 1`);
}

console.log('\n--- 3. Cloth Hangers Quantity Multiplication ---');
// Formula: Total = (Base Price + Outside Hyderabad Charge) × Quantity
const rQtyHyd = calculateClothHanger({ sizeFt: 6, mountingType: 'ceiling', quantity: 3, isOutsideHyderabad: false });
assertEqual(rQtyHyd.totalAmount, 3000 * 3, 'Ceiling 6ft Hyd Qty 3 (3000 * 3 = 9000)');

const rQtyOut = calculateClothHanger({ sizeFt: 6, mountingType: 'wall', quantity: 2, isOutsideHyderabad: true });
assertEqual(rQtyOut.totalAmount, (3500 + 500) * 2, 'Wall 6ft Outside Hyd Qty 2 ((3500+500)*2 = 8000)');

// ── PART 2: INVISIBLE GRILLS PRICING ────────────────────────────────────────
console.log('\n--- 4. Invisible Grills: User Prompt Exact Examples ---');
// Example 1: Hyderabad, 40 SFT = ₹10,000
const ex1 = calculateInvisibleGrills({ totalAreaSft: 40, isOutsideHyderabad: false });
assertEqual(ex1.totalAmount, 10000, 'Example 1: Hyderabad 40 SFT');

// Example 2: Outside Hyderabad, 40 SFT = ₹11,200
const ex2 = calculateInvisibleGrills({ totalAreaSft: 40, isOutsideHyderabad: true });
assertEqual(ex2.totalAmount, 11200, 'Example 2: Outside Hyderabad 40 SFT (10000 + 30*40)');

// Example 3: Hyderabad, 80 SFT = ₹12,800
const ex3 = calculateInvisibleGrills({ totalAreaSft: 80, isOutsideHyderabad: false });
assertEqual(ex3.totalAmount, 12800, 'Example 3: Hyderabad 80 SFT (80 * 160)');

// Example 4: Outside Hyderabad, 80 SFT = ₹15,200
const ex4 = calculateInvisibleGrills({ totalAreaSft: 80, isOutsideHyderabad: true });
assertEqual(ex4.totalAmount, 15200, 'Example 4: Outside Hyderabad 80 SFT (80 * 190)');

// Example 5: Hyderabad, 150 SFT = ₹21,000
const ex5 = calculateInvisibleGrills({ totalAreaSft: 150, isOutsideHyderabad: false });
assertEqual(ex5.totalAmount, 21000, 'Example 5: Hyderabad 150 SFT (150 * 140)');

// Example 6: Outside Hyderabad, 150 SFT = ₹25,500
const ex6 = calculateInvisibleGrills({ totalAreaSft: 150, isOutsideHyderabad: true });
assertEqual(ex6.totalAmount, 25500, 'Example 6: Outside Hyderabad 150 SFT (150 * 170)');

console.log('\n--- 5. Invisible Grills: All Slab Boundaries (Hyderabad & Outside) ---');
const slabs = [
  { area: 59, hydRate: 0, hydTotal: 10000, outTotal: 10000 + 30 * 59 },
  { area: 60, hydRate: 160, hydTotal: 60 * 160, outTotal: 60 * 190 },
  { area: 100, hydRate: 160, hydTotal: 100 * 160, outTotal: 100 * 190 },
  { area: 101, hydRate: 140, hydTotal: 101 * 140, outTotal: 101 * 170 },
  { area: 200, hydRate: 140, hydTotal: 200 * 140, outTotal: 200 * 170 },
  { area: 201, hydRate: 130, hydTotal: 201 * 130, outTotal: 201 * 160 },
  { area: 300, hydRate: 130, hydTotal: 300 * 130, outTotal: 300 * 160 },
  { area: 301, hydRate: 120, hydTotal: 301 * 120, outTotal: 301 * 150 },
  { area: 500, hydRate: 120, hydTotal: 500 * 120, outTotal: 500 * 150 },
  { area: 501, hydRate: 110, hydTotal: 501 * 110, outTotal: 501 * 140 },
  { area: 1000, hydRate: 110, hydTotal: 1000 * 110, outTotal: 1000 * 140 },
  { area: 1001, hydRate: 100, hydTotal: 1001 * 100, outTotal: 1001 * 130 },
];

for (const s of slabs) {
  const rHyd = calculateInvisibleGrills({ totalAreaSft: s.area, isOutsideHyderabad: false });
  assertEqual(rHyd.totalAmount, s.hydTotal, `Boundary Hyd ${s.area} SFT`);

  const rOut = calculateInvisibleGrills({ totalAreaSft: s.area, isOutsideHyderabad: true });
  assertEqual(rOut.totalAmount, s.outTotal, `Boundary Outside Hyd ${s.area} SFT`);
}

console.log('\n--- 6. Invisible Grills: Openings Breakdown Input ---');
// 2 openings of 10 x 4 ft = 80 SFT in Hyderabad
const rOpenings = calculateInvisibleGrills({
  openings: [
    { widthFt: 10, heightFt: 4, count: 2, name: 'Balcony Front' }
  ],
  isOutsideHyderabad: false
});
assertEqual(rOpenings.totalAreaSft, 80, 'Openings total SFT = 80');
assertEqual(rOpenings.totalAmount, 12800, 'Openings Hyderabad 80 SFT = 12,800');

console.log('\n================================================================');
console.log('ALL CLOTH HANGER & INVISIBLE GRILL UNIT TESTS PASSED (100%)!');
console.log('================================================================\n');
