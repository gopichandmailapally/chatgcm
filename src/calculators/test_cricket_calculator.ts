import {
  calculateCricketNetting,
  getInstallationAllowance,
  calculateBraidedBags
} from './cricket-net-calculator.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log("=== RUNNING DETERMINISTIC CRICKET NET CALCULATOR TESTS ===");

// 1. Test Allowance Brackets
assert(getInstallationAllowance(10) === 0.5, "10 ft allowance is 0.5 ft");
assert(getInstallationAllowance(14) === 0.5, "14 ft allowance is 0.5 ft");
assert(getInstallationAllowance(15) === 1.0, "15 ft allowance is 1.0 ft");
assert(getInstallationAllowance(50) === 1.0, "50 ft allowance is 1.0 ft");
assert(getInstallationAllowance(51) === 1.5, "51 ft allowance is 1.5 ft");
assert(getInstallationAllowance(100) === 1.5, "100 ft allowance is 1.5 ft");
assert(getInstallationAllowance(101) === 2.0, "101 ft allowance is 2.0 ft");
assert(getInstallationAllowance(150) === 2.0, "150 ft allowance is 2.0 ft");
assert(getInstallationAllowance(151) === 2.5, "151 ft allowance is 2.5 ft");
assert(getInstallationAllowance(200) === 2.5, "200 ft allowance is 2.5 ft");

// 2. Test Pole-to-pole vs Included Extras
const poleToPoleResult = calculateCricketNetting({
  lengthFt: 100, // +1.5 -> 101.5
  widthFt: 50,   // +1.0 -> 51.0
  heightFt: 15,  // +1.0 -> 16.0
  isPoleToPole: true,
  measurementConfirmed: true
});
assert(poleToPoleResult.adjustedDimensions.lengthFt === 101.5, "Pole-to-pole L 100 becomes 101.5");
assert(poleToPoleResult.adjustedDimensions.widthFt === 51.0, "Pole-to-pole W 50 becomes 51.0");
assert(poleToPoleResult.adjustedDimensions.heightFt === 16.0, "Pole-to-pole H 15 becomes 16.0");

const alreadyIncludedResult = calculateCricketNetting({
  lengthFt: 100,
  widthFt: 50,
  heightFt: 15,
  isPoleToPole: false,
  measurementConfirmed: true
});
assert(alreadyIncludedResult.adjustedDimensions.lengthFt === 100, "Already included L 100 remains 100");
assert(alreadyIncludedResult.adjustedDimensions.widthFt === 50, "Already included W 50 remains 50");
assert(alreadyIncludedResult.adjustedDimensions.heightFt === 15, "Already included H 15 remains 15");

// 3. Test Bag Calculation Example from Specification (11,000 SFT)
const bags11k = calculateBraidedBags(11000);
assert(bags11k.fullBagsOnly.bags === 4, "11,000 SFT requires 4 full bags initially");
assert(bags11k.fullBagsOnly.totalSft === 13200, "4 full bags = 13,200 SFT");
assert(bags11k.fullBagsOnly.excessSft === 2200, "4 full bags excess is 2,200 SFT");
assert(bags11k.withHalfBag.fullBags === 3, "With half bag: 3 full bags");
assert(bags11k.withHalfBag.halfBags === 1, "With half bag: 1 half bag");
assert(bags11k.withHalfBag.totalSft === 11550, "3 full + 1 half = 11,550 SFT");
assert(bags11k.withHalfBag.excessSft === 550, "3 full + 1 half excess is 550 SFT");

// 4. Test Material Separation & Top Net for Area > 3,300 SFT
// 100 x 50 ft ground footprint = 5,000 SFT (> 3,300 SFT)
const largeCourt = calculateCricketNetting({
  lengthFt: 100,
  widthFt: 50,
  heightFt: 20,
  isPoleToPole: false,
  measurementConfirmed: true
});
assert(largeCourt.groundFootprintSft === 5000, "Ground footprint is 5,000 SFT");
assert(largeCourt.topNetting.isCustomizedTwisted === true, "Top net is 1.5mm twisted because footprint > 3,300 SFT");
assert(largeCourt.topNetting.customizationRatePerSft === 0.50, "Top net customization rate is fixed at ₹0.50/sft");
assert(largeCourt.topNetting.totalCustomizationCharge === 2500, "Top net customization charge is 5,000 * 0.50 = ₹2,500");
assert(largeCourt.sideNetting.recommendedMesh.includes("45mm"), "Side net recommends 45mm mesh for affordability");

// 5. Test Omission of Sides / Top
const noTopNoBackstop = calculateCricketNetting({
  lengthFt: 100,
  widthFt: 50,
  heightFt: 20,
  isPoleToPole: false,
  includeTop: false,
  includeWidthSide1: false, // Omit backstop
  measurementConfirmed: true
});
assert(noTopNoBackstop.topNetting.included === false, "Top net excluded");
assert(noTopNoBackstop.topNetting.requiredSft === 0, "Top net SFT is 0");
// Sides: 2 length sides (100*20 * 2 = 4000) + 1 width side (50*20 = 1000) = 5000 SFT
assert(noTopNoBackstop.sideNetting.requiredSft === 5000, "Sides SFT is 5000 (4000 length sides + 1000 width side)");

// 6. Test Exceeding 200 ft -> Owner Confirmation Required
const over200 = calculateCricketNetting({
  lengthFt: 220,
  widthFt: 100,
  heightFt: 30,
  measurementConfirmed: true
});
assert(over200.requiresOwnerConfirmation === true, "Dimension > 200 ft requires owner confirmation");

console.log("=== ALL DETERMINISTIC TESTS PASSED SUCCESSFULLY! ===");
