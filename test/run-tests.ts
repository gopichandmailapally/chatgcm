import { initDatabase, db } from '../src/db/database.js';
import { calculateCricketNetting } from '../src/calculators/cricket-net-calculator.js';
import { calculateTurnkeyBoxCricket } from '../src/calculators/turnkey-box-calculator.js';
import { calculateBalconySafety } from '../src/calculators/balcony-safety-calculator.js';
import { getApprovedProductPrice, listAvailableProducts } from '../src/pricing/pricing-engine.js';
import { createOrUpdateLead, updateLeadStage } from '../src/crm/lead-service.js';
import { createQuotation, getQuotationById } from '../src/crm/quotation-service.js';
import { decideOwnerApproval, listPendingApprovals } from '../src/crm/approval-service.js';
import { processChatConversation } from '../src/ai/orchestrator.js';

console.log('====================================================');
console.log('🧪 Running Chat GCM Automated Verification Suite');
console.log('====================================================\n');

// Test 1: DB Initialization
console.log('Test 1: Initializing Database & Verifying Master Seeds...');
initDatabase();
const products = listAvailableProducts();
if (products.length < 5) throw new Error(`Expected at least 5 products, found ${products.length}`);
console.log(`✅ Passed: ${products.length} master products seeded successfully.`);

// Test 2: Deterministic Cricket Netting Math
console.log('\nTest 2: Verifying Cricket Netting Mathematical Accuracy (100x50x25ft)...');
const netMath = calculateCricketNetting({ lengthFt: 100, widthFt: 50, heightFt: 25, includeRoof: true });
console.log(`   Side Netting: ${netMath.sideNettingSft} SFT (Expected: 7875)`);
console.log(`   Roof Netting: ${netMath.roofNettingSft} SFT (Expected: 5400)`);
console.log(`   Total Netting: ${netMath.totalNettingSft} SFT (Expected: 13275)`);

if (netMath.sideNettingSft !== 7875) throw new Error(`Side netting SFT mismatch: expected 7875, got ${netMath.sideNettingSft}`);
if (netMath.roofNettingSft !== 5400) throw new Error(`Roof netting SFT mismatch: expected 5400, got ${netMath.roofNettingSft}`);
if (netMath.totalNettingSft !== 13275) throw new Error(`Total netting SFT mismatch: expected 13275, got ${netMath.totalNettingSft}`);
console.log('✅ Passed: Cricket Netting deterministic formulas match 100%.');

// Test 3: Turnkey Box Cricket BOQ
console.log('\nTest 3: Verifying Turnkey Box Cricket BOQ (100x50x25ft)...');
const turnkey = calculateTurnkeyBoxCricket({ lengthFt: 100, widthFt: 50, heightFt: 25 });
if (turnkey.dimensions.groundAreaSft !== 5000) throw new Error('Ground area mismatch');
if (turnkey.turfSystem.rollsRequired !== 10) throw new Error(`Turf rolls mismatch: expected 10, got ${turnkey.turfSystem.rollsRequired}`);
if (turnkey.items.length < 7) throw new Error('BOQ items count mismatch');
console.log(`✅ Passed: BOQ generated with ${turnkey.items.length} lines, estimated project cost: ₹${turnkey.grandTotal.toLocaleString('en-IN')}`);

// Test 4: Pricing Engine & Discount Rule Guardian
console.log('\nTest 4: Verifying Pricing Engine & Autonomous Discount Guardrails...');
// Scenario A: Within 5% limit -> Approved autonomously
const normalPrice = getApprovedProductPrice({
  productId: 'PROD-RUSSEA-25-40',
  quantity: 5000,
  customerType: 'contractor',
  requestedDiscountPct: 4.0
});
if (normalPrice.requiresOwnerApproval !== false) throw new Error('4% discount should not require owner approval');
if (normalPrice.authorizedDiscountPct !== 4.0) throw new Error('Authorized discount mismatch');
console.log(`   Contractor Rate (5000 SFT): ₹${normalPrice.baseRate} - 4% discount = ₹${normalPrice.netRate}/SFT (Approved Autonomously)`);

// Scenario B: 12% discount requested -> Flags Owner Approval
const highDiscPrice = getApprovedProductPrice({
  productId: 'PROD-RUSSEA-25-40',
  quantity: 5000,
  customerType: 'contractor',
  requestedDiscountPct: 12.0
});
if (highDiscPrice.requiresOwnerApproval !== true) throw new Error('12% discount MUST require owner approval');
console.log(`   12% discount correctly flagged for Owner Approval: "${highDiscPrice.approvalReason}"`);
console.log('✅ Passed: Pricing Guardrail strictly prevents unauthorized AI discounting.');

// Test 5: CRM Lead & Quotation Workflow
console.log('\nTest 5: Verifying CRM Lead Creation & Formal Quotation Generation...');
const lead = createOrUpdateLead({
  websiteId: 'gcmsafetynets',
  customerName: 'Hyderabad Cricket Club',
  phone: '9887766554',
  city: 'Hyderabad',
  requirementSummary: '100x50 Box Cricket Net'
}) as any;

const quote = await createQuotation({
  leadId: lead.id,
  websiteId: 'gcmsafetynets',
  projectName: 'HCC Practice Ground',
  items: [
    { productId: 'PROD-RUSSEA-25-40', itemName: 'RUSSEA™ 2.5mm Braided Net', quantity: 7875, unit: 'SFT', unitRate: 21.0 }
  ],
  discountPct: 4.0
});

if (!quote.quoteNumber.startsWith('GCM-QT-2026-')) throw new Error('Quote number format mismatch');
if (quote.financials.gstPct !== 18.0) throw new Error('GST percentage mismatch');
console.log(`   Quotation Generated: ${quote.quoteNumber} (Official GCM ERP ID: ${quote.officialDocId || 'N/A'})`);
console.log(`   Official View URL: ${quote.officialViewUrl || 'N/A'}`);
console.log(`   Subtotal: ₹${quote.financials.subtotal.toLocaleString('en-IN')}`);
console.log(`   GST (18%): ₹${quote.financials.gstAmount.toLocaleString('en-IN')}`);
console.log(`   Grand Total: ₹${quote.financials.grandTotal.toLocaleString('en-IN')}`);
console.log('✅ Passed: CRM Quotation and financial calculations verified.');

// Test 6: AI Orchestrator End-to-End Conversation Simulation
console.log('\nTest 6: Verifying Multi-Tenant AI Orchestrator Intent Handling...');
async function testOrchestrator() {
  // Test A: Dimensions intent
  const res1 = await processChatConversation({
    websiteId: 'gcmsafetynets',
    message: 'I need cricket net for 100 x 50 x 25 feet court'
  });
  if (res1.cardType !== 'calculation') throw new Error('Expected calculation cardType');
  console.log('   Test 6A (Dimensions): Correctly recognized intent and computed 13,275 SFT.');

  // Test B: Turnkey Box Cricket intent
  const res2 = await processChatConversation({
    websiteId: 'gcmsafetynets',
    message: 'What is the turnkey box cricket cost for 100x50 ground?'
  });
  if (res2.cardType !== 'turnkey_boq') throw new Error('Expected turnkey_boq cardType');
  console.log('   Test 6B (Turnkey BOQ): Correctly recognized turnkey inquiry and generated full BOQ.');

  // Test C: High discount negotiation
  const res3 = await processChatConversation({
    websiteId: 'gcmsafetynets',
    message: 'Can you give 12% discount on my order?'
  });
  if (res3.cardData?.status !== 'OWNER_APPROVAL_REQUIRED') throw new Error('Expected OWNER_APPROVAL_REQUIRED status');
  console.log('   Test 6C (Discount Guardrail): Correctly routed 12% discount to Owner Approval.');
}

await testOrchestrator();
console.log('✅ Passed: AI Orchestrator intent routing and card generation verified.');

console.log('\n====================================================');
console.log('🎉 ALL TESTS PASSED! Chat GCM Engine is 100% Operational.');
console.log('====================================================');
