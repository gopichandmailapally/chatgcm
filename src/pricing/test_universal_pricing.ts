import { 
  calculateInstalledSafetyNet,
  calculateCricketBraidedBags,
  calculateTwisted15Netting,
  calculateTurfAccessory,
  calculateUnifiedTurfEstimate
} from './universal-pricing-engine.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ ${msg}`);
}

console.log('================================================================');
console.log('🧪 TESTING UNIVERSAL PRICING & ESTIMATION ENGINE');
console.log('================================================================\n');

// ── 1. INSTALLED SAFETY NETS BOUNDARY CORRECTION ─────────────────────────────
console.log('--- 1. Testing Installed Safety Nets Boundary Rules ---');

// Quality: 2.0mm_45mm (min charge: ₹1650, 101-250 slab standard: ₹24/sft)
const net99 = calculateInstalledSafetyNet('2.0mm_45mm', 99);
assert(net99.isMinimumChargeApplied === true, '99 SFT applies minimum charge');
assert(net99.totalAmount === 1650, '99 SFT charges fixed ₹1,650 minimum');

const net100 = calculateInstalledSafetyNet('2.0mm_45mm', 100);
assert(net100.isMinimumChargeApplied === false, '100 SFT does NOT apply minimum charge');
assert(net100.ratePerSft === 24, '100 SFT receives 101-250 SFT slab rate (₹24/sft)');
assert(net100.totalAmount === 2400, '100 SFT total = 100 × 24 = ₹2,400');

const net101 = calculateInstalledSafetyNet('2.0mm_45mm', 101);
assert(net101.isMinimumChargeApplied === false, '101 SFT does not apply minimum charge');
assert(net101.totalAmount === 101 * 24, '101 SFT total = 101 × 24 = ₹2,424');

const net250 = calculateInstalledSafetyNet('2.0mm_45mm', 250);
assert(net250.ratePerSft === 24, '250 SFT rate is ₹24/sft');
assert(net250.totalAmount === 250 * 24, '250 SFT total = ₹6,000');

const net300 = calculateInstalledSafetyNet('2.0mm_45mm', 300);
assert(net300.ratePerSft === 20, '300 SFT (251-500 slab) rate is ₹20/sft');
assert(net300.totalAmount === 300 * 20, '300 SFT total = ₹6,000');

// Quality: 1.5mm_30mm (min charge: ₹1500, 101-250 slab standard: ₹18/sft)
const pigeon99 = calculateInstalledSafetyNet('1.5mm_30mm', 99);
assert(pigeon99.totalAmount === 1500, '1.5mm 99 SFT fixed charge is ₹1,500');

const pigeon100 = calculateInstalledSafetyNet('1.5mm_30mm', 100);
assert(pigeon100.isMinimumChargeApplied === false, '1.5mm 100 SFT does NOT apply minimum charge');
assert(pigeon100.totalAmount === 1800, '1.5mm 100 SFT total = 100 × 18 = ₹1,800');

// Quality: 2.5mm_40mm (min charge: ₹1800, 101-250 slab standard: ₹28/sft)
const heavy100 = calculateInstalledSafetyNet('2.5mm_40mm', 100);
assert(heavy100.isMinimumChargeApplied === false, '2.5mm 100 SFT does NOT apply minimum charge');
assert(heavy100.totalAmount === 2800, '2.5mm 100 SFT total = 100 × 28 = ₹2,800');

console.log('\n--- 2. Testing Cricket Braided Bag Pricing & Mixed Orders ---');

// 2mm 45mm
const b_2_45_half = calculateCricketBraidedBags({ variant: '2mm_45mm', fullBags: 0, halfBags: 1 });
assert(b_2_45_half.halfBagRatePerSft === 7.50, '2mm 45mm half bag rate = ₹7.50/sft');
assert(b_2_45_half.subtotal === 1650 * 7.50, '2mm 45mm half bag subtotal = ₹12,375');

const b_2_45_1 = calculateCricketBraidedBags({ variant: '2mm_45mm', fullBags: 1, halfBags: 0 });
assert(b_2_45_1.fullBagRatePerSft === 7.00, '2mm 45mm 1 full bag rate = ₹7.00/sft');

const b_2_45_2 = calculateCricketBraidedBags({ variant: '2mm_45mm', fullBags: 2, halfBags: 0 });
assert(b_2_45_2.fullBagRatePerSft === 6.50, '2mm 45mm 2 full bags rate = ₹6.50/sft');

const b_2_45_4 = calculateCricketBraidedBags({ variant: '2mm_45mm', fullBags: 4, halfBags: 0 });
assert(b_2_45_4.fullBagRatePerSft === 6.00, '2mm 45mm 4 full bags rate = ₹6.00/sft');

const b_2_45_6 = calculateCricketBraidedBags({ variant: '2mm_45mm', fullBags: 6, halfBags: 0 });
assert(b_2_45_6.fullBagRatePerSft === 5.50, '2mm 45mm 6 full bags rate = ₹5.50/sft');

// 2.5mm 40mm
const b_25_40_half = calculateCricketBraidedBags({ variant: '2.5mm_40mm', fullBags: 0, halfBags: 1 });
assert(b_25_40_half.halfBagRatePerSft === 9.00, '2.5mm 40mm half bag rate = ₹9.00/sft');

const b_25_40_1 = calculateCricketBraidedBags({ variant: '2.5mm_40mm', fullBags: 1, halfBags: 0 });
assert(b_25_40_1.fullBagRatePerSft === 8.50, '2.5mm 40mm 1 full bag rate = ₹8.50/sft');

const b_25_40_3 = calculateCricketBraidedBags({ variant: '2.5mm_40mm', fullBags: 3, halfBags: 0 });
assert(b_25_40_3.fullBagRatePerSft === 8.00, '2.5mm 40mm 3 full bags rate = ₹8.00/sft');

const b_25_40_5 = calculateCricketBraidedBags({ variant: '2.5mm_40mm', fullBags: 5, halfBags: 0 });
assert(b_25_40_5.fullBagRatePerSft === 7.50, '2.5mm 40mm 5 full bags rate = ₹7.50/sft');

const b_25_40_8 = calculateCricketBraidedBags({ variant: '2.5mm_40mm', fullBags: 8, halfBags: 0 });
assert(b_25_40_8.fullBagRatePerSft === 7.00, '2.5mm 40mm 8 full bags rate = ₹7.00/sft');

// Mixed Order with Configured Policy
const mixedOrder = calculateCricketBraidedBags({
  variant: '2.5mm_40mm',
  fullBags: 2,
  halfBags: 1,
  mixedBagPolicy: 'SEPARATE_TIERS'
});
assert(mixedOrder.fullBagRatePerSft === 8.00, 'Mixed order: 2 full bags billed at 2-3 bag rate (₹8.00)');
assert(mixedOrder.halfBagRatePerSft === 9.00, 'Mixed order: 1 half bag billed at half bag rate (₹9.00)');
const expectedSubtotal = (2 * 3300 * 8.00) + (1650 * 9.00); // 52800 + 14850 = 67650
assert(mixedOrder.subtotal === expectedSubtotal, `Mixed order subtotal matches exactly ₹${expectedSubtotal}`);

console.log('\n--- 3. Testing 1.5mm Twisted Cricket Nets Boundaries & Customization ---');

// 500 SFT
const tw500 = calculateTwisted15Netting(500);
assert(tw500.baseMaterialRatePerSft === 5.00, '500 SFT base rate is ₹5.00');
assert(tw500.customizationRatePerSft === 0.50, 'Customization rate is ₹0.50');
assert(tw500.totalRatePerSft === 5.50, 'Total rate is ₹5.50');
assert(tw500.subtotal === 2750, '500 SFT subtotal = ₹2,750');
assert(tw500.gstAmount === 137.50, '500 SFT 5% GST = ₹137.50');
assert(tw500.grandTotal === 2887.50, '500 SFT grand total = ₹2,887.50');

// 3,300 SFT
const tw3300 = calculateTwisted15Netting(3300);
assert(tw3300.baseMaterialRatePerSft === 5.00, '3,300 SFT base rate is ₹5.00');

// 3,301 SFT
const tw3301 = calculateTwisted15Netting(3301);
assert(tw3301.baseMaterialRatePerSft === 4.75, '3,301 SFT base rate is ₹4.75');

// 5,000 SFT
const tw5000 = calculateTwisted15Netting(5000);
assert(tw5000.baseMaterialRatePerSft === 4.75, '5,000 SFT base rate is ₹4.75');

// 5,001 SFT
const tw5001 = calculateTwisted15Netting(5001);
assert(tw5001.baseMaterialRatePerSft === 4.50, '5,001 SFT base rate is ₹4.50');

// 10,000 SFT
const tw10000 = calculateTwisted15Netting(10000);
assert(tw10000.baseMaterialRatePerSft === 4.50, '10,000 SFT base rate is ₹4.50');

// 10,001 SFT
const tw10001 = calculateTwisted15Netting(10001);
assert(tw10001.baseMaterialRatePerSft === 4.25, '10,001 SFT base rate is ₹4.25');
assert(tw10001.totalRatePerSft === 4.75, '10,001 SFT total rate = ₹4.25 + ₹0.50 = ₹4.75');

console.log('\n--- 4. Testing Turf Installation Accessories (Prompt Examples) ---');

// Example 1 from prompt: 10 kg silica sand
// Subtotal = ₹80, GST 5% = ₹4, Total = ₹84
const sand10 = calculateTurfAccessory('silica_sand', 10);
assert(sand10.subtotal === 80, '10 kg silica sand subtotal = ₹80');
assert(sand10.gstPct === 5, 'Silica sand GST is 5%');
assert(sand10.gstAmount === 4, '10 kg silica sand GST amount = ₹4');
assert(sand10.totalWithGst === 84, '10 kg silica sand total = ₹84');

// Example 2 from prompt: 2 liters SPEB 7 glue
// Subtotal = ₹740, GST 18% = ₹133.20, Total = ₹873.20
const glue2 = calculateTurfAccessory('speb7_glue', 2);
assert(glue2.subtotal === 740, '2 liters SPEB 7 glue subtotal = ₹740');
assert(glue2.gstPct === 18, 'SPEB 7 glue GST is strictly 18%');
assert(glue2.gstAmount === 133.20, '2 liters SPEB 7 glue GST = ₹133.20');
assert(glue2.totalWithGst === 873.20, '2 liters SPEB 7 glue total = ₹873.20');

// Rubber granules (₹36/kg, 5% GST)
const rubber25 = calculateTurfAccessory('rubber_granules', 25);
assert(rubber25.subtotal === 25 * 36, '25 kg rubber granules subtotal = ₹900');
assert(rubber25.gstAmount === 45, '25 kg rubber granules 5% GST = ₹45');
assert(rubber25.totalWithGst === 945, '25 kg rubber granules total = ₹945');

// Seaming tape (₹45/meter, 5% GST)
const tape10 = calculateTurfAccessory('seaming_tape', 10);
assert(tape10.subtotal === 450, '10m seaming tape subtotal = ₹450');
assert(tape10.gstAmount === 22.50, '10m seaming tape 5% GST = ₹22.50');
assert(tape10.totalWithGst === 472.50, '10m seaming tape total = ₹472.50');

console.log('\n--- 5. Testing Unified Turf Estimation (Independent Lines) ---');

const unifiedQuote = calculateUnifiedTurfEstimate({
  turfSft: 1000,
  turfRatePerSft: 85,
  turfGstPct: 18,
  silicaSandKg: 500, // 500 × 8 = 4000, 5% GST = 200
  rubberGranulesKg: 100, // 100 × 36 = 3600, 5% GST = 180
  glueLiters: 10, // 10 × 370 = 3700, 18% GST = 666
  seamingTapeMeters: 50, // 50 × 45 = 2250, 5% GST = 112.50
  transportCharges: 2500,
  transportGstPct: 0
});

assert(unifiedQuote.lineItems.length === 6, 'Unified quotation contains exactly 6 line items');
const expectedTurfSubtotal = 1000 * 85; // 85000
const expectedTurfGst = 85000 * 0.18; // 15300
assert(unifiedQuote.lineItems[0].subtotal === expectedTurfSubtotal, 'Turf subtotal is ₹85,000');
assert(unifiedQuote.lineItems[0].gstAmount === expectedTurfGst, 'Turf GST is ₹15,300');

const expectedTotalSubtotal = 85000 + 4000 + 3600 + 3700 + 2250 + 2500; // 101050
const expectedTotalGst = 15300 + 200 + 180 + 666 + 112.50 + 0; // 16458.50
const expectedGrandTotal = expectedTotalSubtotal + expectedTotalGst; // 117508.50

assert(unifiedQuote.subtotal === expectedTotalSubtotal, `Unified subtotal = ₹${expectedTotalSubtotal}`);
assert(unifiedQuote.totalGst === expectedTotalGst, `Unified total GST = ₹${expectedTotalGst}`);
assert(unifiedQuote.grandTotal === expectedGrandTotal, `Unified grand total = ₹${expectedGrandTotal}`);

console.log('\n================================================================');
console.log('🎉 ALL UNIVERSAL PRICING ENGINE UNIT TESTS PASSED (100%)');
console.log('================================================================');
