import { processUserMessage } from '../src/ai/orchestrator.js';

async function testScreenshotsRemediation() {
  const sessionId = 'TEST-SCREENSHOT-' + Date.now();
  console.log('--- Step 1: Greeting ---');
  const res1 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'Hi',
    customerName: 'Test Client'
  });
  console.log('Bot:', res1.reply);
  if (res1.reply.includes('ground dimensions')) throw new Error('Failed: asked ground dimensions on general Hi!');

  console.log('\n--- Step 2: Need cloth hanger ---');
  const res2 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'I need cloth hanger',
    customerName: 'Test Client'
  });
  console.log('Bot:', res2.reply);

  console.log('\n--- Step 3: Wall mounted ---');
  const res3 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'Wall mounted',
    customerName: 'Test Client'
  });
  console.log('Bot:', res3.reply);

  console.log('\n--- Step 4: 6ft ---');
  const res4 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: '6ft',
    customerName: 'Test Client'
  });
  console.log('Bot:', res4.reply);

  console.log('\n--- Step 5: Customer replies standalone "3" ---');
  const res5 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: '3',
    customerName: 'Test Client'
  });
  console.log('Bot:', res5.reply);
  if (res5.reply.includes('How many cloth hanger units do you require?')) {
    throw new Error('Failed: Bot repeated the quantity question when client said 3!');
  }

  console.log('\n--- Step 6: Location Hyderabad ---');
  const res6 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'Hyderabad',
    customerName: 'Test Client'
  });
  console.log('Bot:', res6.reply);

  console.log('\n--- Step 7: Confirmation Sure ---');
  const res7 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'Sure',
    customerName: 'Test Client'
  });
  console.log('Bot:', res7.reply);
  if (!res7.reply.includes('10,500')) throw new Error('Failed: Expected ₹10,500 calculation!');

  console.log('\n--- Step 8: Customer replies "Yes please!" to appointment prompt ---');
  const res8 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'Yes please!',
    customerName: 'Test Client'
  });
  console.log('Bot:', res8.reply);
  if (res8.reply.includes('Total Amount: ₹10,500')) {
    throw new Error('Failed: Bot repeated the entire estimate instead of asking for appointment slot!');
  }

  console.log('\n--- Step 9: Customer provides slot "Tomorrow at 11:00 AM" ---');
  const res9 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'Tomorrow at 11:00 AM',
    customerName: 'Test Client'
  });
  console.log('Bot:', res9.reply);
  if (!res9.reply.includes('operations coordinator') && !res9.reply.includes('confirmation')) {
    throw new Error('Failed: Did not route slot to admin operations coordinator!');
  }

  console.log('\n--- Step 10: Customer asks "And also make discount if possible..." ---');
  const res10 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'And also make discount if possible...',
    customerName: 'Test Client'
  });
  console.log('Bot:', res10.reply);
  if (res10.reply.includes('10% discount')) {
    throw new Error('Failed: Bot invented a 10% discount out of nowhere!');
  }
  if (!res10.reply.includes('3%')) {
    throw new Error('Failed: Did not offer first-tier 3% discount!');
  }

  console.log('\n--- Step 11: Explicit 15% discount request ---');
  const res11 = await processUserMessage({
    websiteId: 'gcmsafetynets',
    sessionId,
    message: 'can you give 15% discount?',
    customerName: 'Test Client'
  });
  console.log('Bot:', res11.reply);
  if (!res11.reply.includes('15%') || !res11.reply.includes('Managing Director')) {
    throw new Error('Failed: Did not route explicit 15% discount to Managing Director approval!');
  }

  console.log('\n🌟 ALL 11 STEPS IN THE USER SCREENSHOT FLOW PASSED FLAWLESSLY!');
}

testScreenshotsRemediation().catch(err => {
  console.error(err);
  process.exit(1);
});
