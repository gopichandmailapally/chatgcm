/**
 * Chat GCM — Automated Regression Test Suite
 * Validates all 15 Scenarios specified in Section 16:
 * 1. Customer asks for pigeon nets.
 * 2. Customer changes from pigeon nets to artificial grass.
 * 3. Customer requests 35mm grass for 540 SFT.
 * 4. Customer requests 35mm grass for 2,000 SFT.
 * 5. Customer requests 10 full rolls.
 * 6. Customer requests 11 rolls.
 * 7. Customer requests 16,000 SFT braided cricket nets.
 * 8. Customer provides incomplete measurements.
 * 9. Customer does not know site dimensions.
 * 10. Customer requests an official quotation.
 * 11. Customer changes products multiple times.
 * 12. WhatsApp webhook retries the same message.
 * 13. Customer asks the agent's identity again.
 * 14. Customer asks for installation on a supply-only product.
 * 15. Customer requests a complete turnkey project.
 */

import { processUserMessage } from './orchestrator.js';
import { recordIdempotency } from '../db/database.js';

interface TestResult {
  scenarioNumber: number;
  scenarioName: string;
  passed: boolean;
  transcript: Array<{ user: string; ai: string }>;
  error?: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log('═══════════════════════════════════════════════════════════════════════════');
  console.log('🤖 CHAT GCM — CRITICAL AI SALES CONVERSATION TEST SUITE (15 SCENARIOS)');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  // ── SCENARIO 1: Customer asks for pigeon nets ─────────────────────────────
  {
    const sId = 'TEST-SCEN-1-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Hi'
    });
    transcript.push({ user: 'Hi', ai: r1.reply });

    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I need pigeon nets for my balcony'
    });
    transcript.push({ user: 'I need pigeon nets for my balcony', ai: r2.reply });

    // Validate: introduced once, asked for dimensions, did NOT quote immediately
    if (!r1.reply.includes("Hi, I'm Venkatesh from GCM Enterprises")) passed = false;
    if (r2.reply.includes("Hi, I'm Venkatesh")) passed = false; // Must not re-introduce
    if (!r2.reply.toLowerCase().includes('dimension') && !r2.reply.toLowerCase().includes('feet')) passed = false;
    if (r2.reply.includes('₹')) passed = false; // No premature quotation

    results.push({
      scenarioNumber: 1,
      scenarioName: 'Customer asks for pigeon nets',
      passed,
      transcript
    });
  }

  // ── SCENARIO 2: Customer changes from pigeon nets to artificial grass ─────
  {
    const sId = 'TEST-SCEN-2-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Hi, I need balcony nets'
    });
    transcript.push({ user: 'Hi, I need balcony nets', ai: r1.reply });

    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Actually, I need artificial grass'
    });
    transcript.push({ user: 'Actually, I need artificial grass', ai: r2.reply });

    // Validate: no re-introduction, cleanly switched context, asked application
    if (r2.reply.includes("Hi, I'm Venkatesh")) passed = false;
    if (!r2.reply.toLowerCase().includes('balcony') && !r2.reply.toLowerCase().includes('ground') && !r2.reply.toLowerCase().includes('area')) passed = false;

    results.push({
      scenarioNumber: 2,
      scenarioName: 'Customer changes from pigeon nets to artificial grass',
      passed,
      transcript
    });
  }

  // ── SCENARIO 3: Customer requests 35mm grass for 540 SFT ───────────────────
  {
    const sId = 'TEST-SCEN-3-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    // Direct multi-detail enquiry
    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I need 35mm grass for 540 SFT balcony in Hyderabad'
    });
    transcript.push({ user: 'I need 35mm grass for 540 SFT balcony in Hyderabad', ai: r1.reply });

    // Confirm requirement
    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Yes, please calculate'
    });
    transcript.push({ user: 'Yes, please calculate', ai: r2.reply });

    // 540 SFT = 1 full roll. 35mm base = ₹28/SFT. Rate = ₹28.
    // Subtotal = 540 * 28 = ₹15,120. GST (5%) = ₹756. Total = ₹15,876.
    if (!r2.reply.includes('15,876') && !r2.reply.includes('15,120')) passed = false;
    if (!r2.reply.toLowerCase().includes('supply only')) passed = false;

    results.push({
      scenarioNumber: 3,
      scenarioName: 'Customer requests 35mm grass for 540 SFT (1 roll)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 4: Customer requests 35mm grass for 2,000 SFT ─────────────────
  {
    const sId = 'TEST-SCEN-4-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I need 35mm artificial grass for 2000 SFT in Bangalore'
    });
    transcript.push({ user: 'I need 35mm artificial grass for 2000 SFT in Bangalore', ai: r1.reply });

    // Full roll policy should be stated: CEILING(2000/540) = 4 rolls (2,160 SFT)
    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Ok, that works. Please quote.'
    });
    transcript.push({ user: 'Ok, that works. Please quote.', ai: r2.reply });

    // 4 rolls: Base ₹28 - ₹2 discount = ₹26/SFT.
    // Quantity = 4 * 540 = 2,160 SFT. Subtotal = ₹56,160. GST = ₹2,808. Total = ₹58,968.
    if (!r2.reply.includes('56,160') || !r2.reply.includes('58,968')) passed = false;

    results.push({
      scenarioNumber: 4,
      scenarioName: 'Customer requests 35mm grass for 2,000 SFT (4 rolls with ₹2 discount)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 5: Customer requests 10 full rolls ────────────────────────────
  {
    const sId = 'TEST-SCEN-5-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Need 10 full rolls of 35mm grass in Hyderabad'
    });
    transcript.push({ user: 'Need 10 full rolls of 35mm grass in Hyderabad', ai: r1.reply });

    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Yes, proceed'
    });
    transcript.push({ user: 'Yes, proceed', ai: r2.reply });

    // 10 rolls: 7-10 rolls discount = ₹3/SFT. Rate = ₹28 - ₹3 = ₹25/SFT.
    // Supplied SFT = 10 * 540 = 5,400 SFT. Subtotal = 5400 * 25 = ₹1,35,000.
    // GST (5%) = ₹6,750. Total = ₹1,41,750.
    if (!r2.reply.includes('1,35,000') || !r2.reply.includes('1,41,750')) passed = false;

    results.push({
      scenarioNumber: 5,
      scenarioName: 'Customer requests 10 full rolls (₹3/SFT discount slab)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 6: Customer requests 11 rolls ─────────────────────────────────
  {
    const sId = 'TEST-SCEN-6-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I want 11 rolls of 35mm grass delivered to Chennai'
    });
    transcript.push({ user: 'I want 11 rolls of 35mm grass delivered to Chennai', ai: r1.reply });

    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Yes, calculate'
    });
    transcript.push({ user: 'Yes, calculate', ai: r2.reply });

    // 11 rolls: Above 10 rolls discount = ₹4/SFT. Rate = ₹28 - ₹4 = ₹24/SFT.
    // Supplied SFT = 11 * 540 = 5,940 SFT. Subtotal = 5940 * 24 = ₹1,42,560.
    // GST = ₹7,128. Total = ₹1,49,688.
    if (!r2.reply.includes('1,42,560') || !r2.reply.includes('1,49,688')) passed = false;

    results.push({
      scenarioNumber: 6,
      scenarioName: 'Customer requests 11 rolls (₹4/SFT discount slab)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 7: Customer requests 16,000 SFT braided cricket nets ─────────
  {
    const sId = 'TEST-SCEN-7-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'netsocean',
      sessionId: sId,
      message: 'I need 16,000 SFT braided cricket nets'
    });
    transcript.push({ user: 'I need 16,000 SFT braided cricket nets', ai: r1.reply });

    // 16,000 SFT / 3,300 = 5 full bags (16,500 SFT)
    // AI explains 3,300 SFT/bag standard, recommends full bags, offers 2mm / 2.5mm 45mm preferred economical
    if (!r1.reply.includes('3,300') || !r1.reply.includes('5 full bag')) passed = false;

    const r2 = await processUserMessage({
      websiteId: 'netsocean',
      sessionId: sId,
      message: '2.5mm 45mm mesh for delivery to Hyderabad'
    });
    transcript.push({ user: '2.5mm 45mm mesh for delivery to Hyderabad', ai: r2.reply });

    const r3 = await processUserMessage({
      websiteId: 'netsocean',
      sessionId: sId,
      message: 'Yes, confirm estimate'
    });
    transcript.push({ user: 'Yes, confirm estimate', ai: r3.reply });

    // 5 full bags of 2.5mm 45mm: 5 * 3300 = 16,500 SFT @ ₹6.50/SFT (for 4-5 bags tier)
    // Subtotal = ₹1,07,250. GST (5%) = ₹5,362.50. Total = ₹1,12,612.50.
    if (!r3.reply.includes('1,07,250') || !r3.reply.includes('1,12,612')) passed = false;

    results.push({
      scenarioNumber: 7,
      scenarioName: 'Customer requests 16,000 SFT braided cricket nets (5 full bags)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 8: Customer provides incomplete measurements ─────────────────
  {
    const sId = 'TEST-SCEN-8-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I need cricket nets for 60ft length and 20ft width'
    });
    transcript.push({ user: 'I need cricket nets for 60ft length and 20ft width', ai: r1.reply });

    // Should ask for missing height
    if (!r1.reply.toLowerCase().includes('height')) passed = false;

    results.push({
      scenarioNumber: 8,
      scenarioName: 'Customer provides incomplete measurements (Missing Height)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 9: Customer does not know site dimensions ─────────────────────
  {
    const sId = 'TEST-SCEN-9-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I want balcony pigeon nets but I do not know measurements'
    });
    transcript.push({ user: 'I want balcony pigeon nets but I do not know measurements', ai: r1.reply });

    // Must offer measurement guidance or photo sharing, and disclose approved visit charges (₹300)
    if (!r1.reply.toLowerCase().includes('tape') && !r1.reply.toLowerCase().includes('photo')) passed = false;
    if (!r1.reply.includes('300')) passed = false;

    results.push({
      scenarioNumber: 9,
      scenarioName: 'Customer does not know site dimensions (Measurement tips & ₹300 visit fee)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 10: Customer requests an official quotation ──────────────────
  {
    const sId = 'TEST-SCEN-10-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Send me an official quotation'
    });
    transcript.push({ user: 'Send me an official quotation', ai: r1.reply });

    // Strict quotation gate: must ask which product and dimensions first
    if (!r1.reply.toLowerCase().includes('product') && !r1.reply.toLowerCase().includes('dimension') && !r1.reply.toLowerCase().includes('area')) passed = false;
    if (r1.reply.includes('₹')) passed = false; // No fake number

    results.push({
      scenarioNumber: 10,
      scenarioName: 'Customer requests an official quotation (Strict Quotation Gate)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 11: Customer changes products multiple times ─────────────────
  {
    const sId = 'TEST-SCEN-11-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I need pigeon nets'
    });
    transcript.push({ user: 'I need pigeon nets', ai: r1.reply });

    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Actually tell me about artificial grass'
    });
    transcript.push({ user: 'Actually tell me about artificial grass', ai: r2.reply });

    const r3 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'No, what about cricket nets?'
    });
    transcript.push({ user: 'No, what about cricket nets?', ai: r3.reply });

    // Check no re-introductions, correct product context each time
    if (r2.reply.includes("Hi, I'm Venkatesh")) passed = false;
    if (r3.reply.includes("Hi, I'm Venkatesh")) passed = false;
    if (!r3.reply.toLowerCase().includes('cricket') && !r3.reply.toLowerCase().includes('ground') && !r3.reply.toLowerCase().includes('dimension')) passed = false;

    results.push({
      scenarioNumber: 11,
      scenarioName: 'Customer changes products multiple times (Clean Context Locking)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 12: WhatsApp webhook retries the same message ─────────────────
  {
    const testWamid = 'WAMID-RETRY-TEST-' + Date.now();
    const testPhone = '919912399224';

    const isFirstTime = recordIdempotency(testWamid, testPhone);
    const isRetry = recordIdempotency(testWamid, testPhone);

    const passed = isFirstTime === true && isRetry === false;

    results.push({
      scenarioNumber: 12,
      scenarioName: 'WhatsApp webhook retries the same message (Idempotency Guard)',
      passed,
      transcript: [
        { user: `Message ${testWamid}`, ai: `isFirstTime=${isFirstTime}, isRetry=${isRetry} (duplicate skipped)` }
      ]
    });
  }

  // ── SCENARIO 13: Customer asks the agent identity again ───────────────────
  {
    const sId = 'TEST-SCEN-13-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Hi'
    });
    transcript.push({ user: 'Hi', ai: r1.reply });

    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Who are you and which company is this?'
    });
    transcript.push({ user: 'Who are you and which company is this?', ai: r2.reply });

    // Brief identity without long ads
    if (!r2.reply.includes('Venkatesh') || !r2.reply.includes('GCM Enterprises')) passed = false;
    if (r2.reply.length > 150) passed = false; // Must be short & crisp

    results.push({
      scenarioNumber: 13,
      scenarioName: 'Customer asks agent identity again (Crisp Brief Identity)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 14: Customer asks for installation on supply-only product ────
  {
    const sId = 'TEST-SCEN-14-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I want artificial grass with installation service'
    });
    transcript.push({ user: 'I want artificial grass with installation service', ai: r1.reply });

    // Must clearly state supply only policy
    if (!r1.reply.toLowerCase().includes('supply only') && !r1.reply.toLowerCase().includes('material only')) passed = false;

    results.push({
      scenarioNumber: 14,
      scenarioName: 'Customer asks for installation on a supply-only product (Grass Policy)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 15: Customer requests a complete turnkey project ─────────────
  {
    const sId = 'TEST-SCEN-15-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    const r1 = await processUserMessage({
      websiteId: 'gcm-enterprises',
      sessionId: sId,
      message: 'Do you do complete turnkey box cricket ground setup?'
    });
    transcript.push({ user: 'Do you do complete turnkey box cricket ground setup?', ai: r1.reply });

    // Must be short & consultative, not an unsolicited 50-line commercial advertisement
    if (r1.reply.length > 300) passed = false;
    if (!r1.reply.toLowerCase().includes('turnkey') || !r1.reply.toLowerCase().includes('dimension')) passed = false;

    results.push({
      scenarioNumber: 15,
      scenarioName: 'Customer requests a complete turnkey project (Short & Consultative)',
      passed,
      transcript
    });
  }

  // ── SCENARIO 16: Customer uses Unicode multiplication and floor notation ───
  {
    const sId = 'TEST-SCEN-16-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    // 1. "I need invisible grill"
    const r1 = await processUserMessage({
      websiteId: 'gcminvisiblegrills',
      sessionId: sId,
      message: 'I need invisible grill'
    });
    transcript.push({ user: 'I need invisible grill', ai: r1.reply });

    // 2. Unicode "18×9"
    const r2 = await processUserMessage({
      websiteId: 'gcminvisiblegrills',
      sessionId: sId,
      message: '18×9'
    });
    transcript.push({ user: '18×9', ai: r2.reply });

    // 18 x 9 = 162 SFT @ ₹150 = ₹24,300
    if (!r2.reply.includes('162') || !r2.reply.includes('24,300')) passed = false;

    // 3. User provides alternative "15×8"
    const r3 = await processUserMessage({
      websiteId: 'gcminvisiblegrills',
      sessionId: sId,
      message: '15×8'
    });
    transcript.push({ user: '15×8', ai: r3.reply });

    // 15 x 8 = 120 SFT @ ₹150 = ₹18,000
    if (!r3.reply.includes('120') || !r3.reply.includes('18,000')) passed = false;

    // 4. Frustration test
    const r4 = await processUserMessage({
      websiteId: 'gcminvisiblegrills',
      sessionId: sId,
      message: 'You are not getting my point'
    });
    transcript.push({ user: 'You are not getting my point', ai: r4.reply });

    if (!r4.reply.toLowerCase().includes('apologies') && !r4.reply.toLowerCase().includes('confusion')) passed = false;

    results.push({
      scenarioNumber: 16,
      scenarioName: 'Customer uses Unicode multiplication (18×9, 15×8) and frustration handling',
      passed,
      transcript
    });
  }

  // ── SCENARIO 17: Customer asks "Types of nets??" instead of confirming estimate
  {
    const sId = 'TEST-SCEN-17-' + Date.now();
    const transcript: any[] = [];
    let passed = true;

    // 1. "Need balcony safety nets"
    const r1 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Need balcony safety nets'
    });
    transcript.push({ user: 'Need balcony safety nets', ai: r1.reply });

    // 2. "19×8"
    const r2 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: '19×8'
    });
    transcript.push({ user: '19×8', ai: r2.reply });
    // Must ask confirmation, NOT quote yet
    if (!r2.reply.includes('152 SFT') || r2.reply.includes('₹')) passed = false;

    // 3. Customer asks "Types of nets??"
    const r3 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Types of nets??'
    });
    transcript.push({ user: 'Types of nets??', ai: r3.reply });
    // Must explain options (2.0mm, 2.5mm, Invisible grills) and NOT quote!
    if (!r3.reply.includes('2.0mm') || !r3.reply.includes('2.5mm') || r3.reply.includes('₹3,648')) passed = false;

    // 4. Customer repeats "I asked you types of nets??"
    const r4 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'I asked you types of nets??'
    });
    transcript.push({ user: 'I asked you types of nets??', ai: r4.reply });
    if (!r4.reply.includes('2.0mm') || r4.reply.includes('₹3,648')) passed = false;

    // 5. Customer finally chooses and confirms "Yes calculate for 2.0mm"
    const r5 = await processUserMessage({
      websiteId: 'gcmsafetynets',
      sessionId: sId,
      message: 'Yes calculate for 2.0mm'
    });
    transcript.push({ user: 'Yes calculate for 2.0mm', ai: r5.reply });
    // Now calculation should happen!
    if (!r5.reply.includes('3,648')) passed = false;

    results.push({
      scenarioNumber: 17,
      scenarioName: 'Customer asks "Types of nets??" during confirmation (Interception without premature estimation)',
      passed,
      transcript
    });
  }

  // ── Summary Report ────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');

  let passedCount = 0;
  for (const r of results) {
    const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${statusIcon} | Scenario ${r.scenarioNumber}: ${r.scenarioName}`);
    if (r.passed) passedCount++;
    else {
      console.log('   Transcript:');
      for (const t of r.transcript) {
        console.log(`     User: "${t.user}"`);
        console.log(`     AI:   "${t.ai}"`);
      }
    }
  }

  console.log(`\nTotal Scenarios: ${results.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${results.length - passedCount}`);
  console.log(`Success Rate: ${((passedCount / results.length) * 100).toFixed(1)}%\n`);

  if (passedCount === results.length) {
    console.log('🎉 ALL 15 CRITICAL SCENARIOS PASSED WITH 100% SUCCESS!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
