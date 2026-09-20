/**
 * Central AI Sales Brain Orchestrator
 * Strictly routes inquiries across the 3 Master Business Pillars:
 * 1. Pillar 1: Turnkey Sports & Box Cricket (gcm.enterprises rates)
 * 2. Pillar 2: Doorstep Services with Installation (gcmsafetynets.in rates)
 * 3. Pillar 3: Material Sales & Supply-Only Netting (netsocean.com rates)
 * Includes: Phone Memory for returning customers & Human Takeover detection.
 */

import { executeToolCall } from './tool-executor.js';
import { db } from '../db/database.js';
import crypto from 'node:crypto';

export interface ChatRequest {
  sessionId?: string;
  websiteId: string;
  message: string;
  customerName?: string;
  phone?: string;
  channel?: 'web_chat' | 'whatsapp' | 'phone_call';
}

export interface ChatResponse {
  sessionId: string;
  reply: string;
  cardType?: 'calculation' | 'turnkey_boq' | 'supply_quote' | 'product_pricing' | 'approval_notice' | 'quotation' | 'human_takeover';
  cardData?: any;
}

export async function processUserMessage(req: ChatRequest): Promise<ChatResponse> {
  const sessionId = req.sessionId || 'SES-' + crypto.randomBytes(6).toString('hex');
  const websiteId = req.websiteId || 'gcmsafetynets';
  const channel = req.channel || 'web_chat';
  const userText = req.message.trim();

  // 1. Omnichannel Session & History Tracking
  let conversation = db.prepare('SELECT * FROM conversations WHERE session_id = ?').get(sessionId) as any;
  let history: any[] = [];

  if (!conversation) {
    db.prepare(`
      INSERT INTO conversations (id, website_id, channel, session_id, messages)
      VALUES (?, ?, ?, ?, ?)
    `).run('CONV-' + crypto.randomBytes(4).toString('hex'), websiteId, channel, sessionId, '[]');
  } else {
    try {
      history = JSON.parse(conversation.messages || '[]');
    } catch {
      history = [];
    }
  }

  // Append User Message to history
  history.push({
    role: 'user',
    content: userText,
    timestamp: new Date().toISOString()
  });

  // Extract Phone Number (10 digits starting with 6, 7, 8, 9)
  const phoneMatch = userText.match(/(?:\+91|91|0)?[6-9]\d{9}/);
  const detectedPhone = req.phone || (phoneMatch ? phoneMatch[0].replace(/\D/g, '').slice(-10) : null);

  // ── Phone Memory: Look up returning customer in CRM ────────────────────────
  let existingCustomer: any = null;
  let pastQuotesCount = 0;
  if (detectedPhone) {
    existingCustomer = db.prepare('SELECT * FROM leads WHERE phone LIKE ? ORDER BY created_at DESC LIMIT 1').get(`%${detectedPhone}%`) as any;
    if (existingCustomer) {
      const qCount = db.prepare('SELECT COUNT(*) as cnt FROM quotations WHERE lead_id = ?').get(existingCustomer.id) as any;
      pastQuotesCount = qCount ? qCount.cnt : 0;
    }
  }

  const lower = userText.toLowerCase();

  // ── Human Takeover Trigger Detection ───────────────────────────────────────
  const isHumanTakeover = lower.includes('gopichand') ||
                          lower.includes('speak to owner') ||
                          lower.includes('call me directly') ||
                          lower.includes('talk to human') ||
                          lower.includes('connect to human') ||
                          lower.includes('urgent call');

  if (isHumanTakeover) {
    db.prepare('UPDATE conversations SET human_takeover = 1 WHERE session_id = ?').run(sessionId);
    
    const replyText = `🚨 **Direct Connect with Business Owner Registered!**

I have flagged your request directly for **Mr. Gopichand Mailapally** (Founder & Managing Director, GCM Enterprises).

${detectedPhone 
  ? `Our direct line has recorded your contact number: **+91 ${detectedPhone}**.\nMr. Gopichand or our Senior Technical Director will connect with you via phone / WhatsApp within **10 to 15 minutes**.` 
  : `Please reply with your **Phone Number and City** so Mr. Gopichand can connect with you directly.`}

For urgent commercial inquiries, you can also reach our executive hotline directly at **+91 99123 99224** / **+91 99123 99227**.`;

    history.push({ role: 'assistant', content: replyText, timestamp: new Date().toISOString() });
    db.prepare('UPDATE conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(JSON.stringify(history), sessionId);

    return {
      sessionId,
      reply: replyText,
      cardType: 'human_takeover',
      cardData: { status: 'OWNER_ALERTED', phone: detectedPhone }
    };
  }

  // 2. Intent Identification & Deterministic Rule/Tool Processing
  let replyText = '';
  let cardType: ChatResponse['cardType'] = undefined;
  let cardData: any = undefined;

  // Extract Dimensions (e.g. "100 x 50 x 25", "100*50", "15 x 6", "100 by 50 by 25")
  const dimMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?))?/i);

  // Intent Checks
  const isTurnkeyIntent = lower.includes('turnkey') || lower.includes('box cricket setup') || lower.includes('sports turf setup') || lower.includes('turf setup') || lower.includes('court construction') || lower.includes('cost to build') || lower.includes('cricket ground') || websiteId === 'gcm-enterprises';
  const isSupplyOnlyIntent = lower.includes('supply only') || lower.includes('only supply') || lower.includes('material only') || lower.includes('netting bag') || lower.includes('wholesale') || lower.includes('courier') || lower.includes('rolls') || lower.includes('custom cut') || websiteId === 'netsocean' || websiteId === 'russea';
  const isInstallationServiceIntent = lower.includes('balcony') || lower.includes('window') || lower.includes('pigeon') || lower.includes('bird') || lower.includes('invisible grill') || lower.includes('cloth hanger') || lower.includes('drying hanger') || lower.includes('doorstep') || lower.includes('service') || lower.includes('technician') || websiteId === 'gcmsafetynets' || websiteId === 'gcminvisiblegrills';

  const isDiscount = lower.includes('discount') || lower.includes('concession') || lower.includes('best price') || lower.includes('less') || lower.includes('cheaper');
  const isStock = lower.includes('stock') || lower.includes('available') || lower.includes('ready bags');
  const isQuoteRequest = lower.includes('quotation') || lower.includes('formal quote') || lower.includes('send quote') || lower.includes('bill');
  const isSiteVisit = lower.includes('site visit') || lower.includes('measurement') || lower.includes('free demo') || lower.includes('technician visit');

  // Returning customer greeting prefix
  let welcomePrefix = '';
  if (existingCustomer && pastQuotesCount > 0) {
    welcomePrefix = `👋 *Welcome back, ${existingCustomer.customer_name}!* Glad to assist you again.\n\n`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 1: TURNKEY SPORTS & BOX CRICKET (Rates as per gcm.enterprises)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTurnkeyIntent && (dimMatch || lower.includes('box cricket') || lower.includes('turf'))) {
    const l = dimMatch ? Number(dimMatch[1]) : 100;
    const w = dimMatch ? Number(dimMatch[2]) : 50;
    const h = dimMatch && dimMatch[3] ? Number(dimMatch[3]) : 25;

    const boq = await executeToolCall('calculate_turnkey_box_cricket', {
      lengthFt: l,
      widthFt: w,
      heightFt: h,
      packageType: 'commercial',
      roofType: 'light_cable_top',
      turfType: 'non_infill_turf',
      civilBedType: 'compacted_wmm'
    }, { websiteId });

    cardType = 'turnkey_boq';
    cardData = boq;

    replyText = `${welcomePrefix}🏏 **GCM Enterprises — Turnkey Box Cricket & Sports Turf Estimation**
*(Source: Official gcm.enterprises Turnkey Estimation Engine)*

**Project Dimensions**: ${l}ft (L) x ${w}ft (W) x ${h}ft (H) — **${boq.dimensions.groundAreaSft.toLocaleString('en-IN')} SFT Ground Area**
**Package**: **${boq.packageName}** (~₹${boq.ratePerGroundSft}/SFT Ground Area)

📋 **Turnkey Bill of Quantities (BOQ) Breakdown:**
1. 🏗️ **Structural Framework**: ${boq.structuralSteel.columnCount} GI Ladder Columns (40x40 GI with Zinc Primer + PU Coat) + ${boq.structuralSteel.horizontalTiePipesRft.toLocaleString('en-IN')} RFT Tie Pipes
2. 🕸️ **Heavy-Duty Netting**: ${boq.nettingSpecs.totalNettingSft.toLocaleString('en-IN')} SFT Total
   - Sides: ${boq.nettingSpecs.sideNettingSft.toLocaleString('en-IN')} SFT (RUSSEA™ 2.5mm HDPE Braided, 45mm mesh)
   - Roof: ${boq.nettingSpecs.roofNettingSft.toLocaleString('en-IN')} SFT with 8% Camber Allowance (1.5mm / 24-Ply UV Twisted)
3. 🌿 **Artificial Sports Turf**: ${boq.turfSystem.rollsRequired} Rolls (${boq.turfSystem.turfAreaSft.toLocaleString('en-IN')} SFT) 25mm Non-Infill Multi-Sport Grass
4. 💡 **Stadium Lighting**: ${boq.lightingSystem.fixtureCount} Fixtures 200W IP66 Floodlights (${boq.lightingSystem.targetLux})
5. 🧱 **Civil Base**: Heavy Rolled Compacted WMM Sub-base

💰 **Commercial Summary:**
- **Estimated Subtotal**: ₹${boq.subtotal.toLocaleString('en-IN')}
- **GST (18%)**: ₹${boq.gstAmount.toLocaleString('en-IN')}
- **Turnkey Project Total**: **₹${boq.grandTotal.toLocaleString('en-IN')}**
- **Timeline**: **~${boq.estimatedTimelineDays} Days** to complete turnkey handover
- **Warranty**: **${boq.warrantyYears} Years Structural & Netting Warranty**

Would you like me to generate your official stamped GCM Enterprises Turnkey Quotation PDF?`;

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 3: MATERIAL SALES & SUPPLY ONLY (Rates as per netsocean.com)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isSupplyOnlyIntent && dimMatch) {
    const l = Number(dimMatch[1]);
    const w = Number(dimMatch[2]);
    const h = dimMatch[3] ? Number(dimMatch[3]) : 0;

    const isSplit = h > 0; // If height given, top piece twisted + sides braided
    const supplyResult = await executeToolCall('calculate_netsocean_supply', {
      orderType: h > 0 ? 'CUSTOM' : 'STANDARD',
      lengthFt: l,
      widthFt: w,
      heightFt: h,
      sidesNetType: 'HDPE_BRAIDED',
      sidesMeshSize: '45mm',
      topNetType: isSplit ? 'TWISTED_24PLY' : 'HDPE_BRAIDED',
      topMeshSize: isSplit ? '35mm' : '45mm'
    }, { websiteId });

    cardType = 'supply_quote';
    cardData = supplyResult;

    const extraDimText = `Recommended Cut Size: ${supplyResult.recommendedDimensions.lengthFt}ft x ${supplyResult.recommendedDimensions.widthFt}ft${h > 0 ? ` x ${supplyResult.recommendedDimensions.heightFt}ft` : ''} *(+1 to 2ft tension allowance)*`;

    replyText = `${welcomePrefix}📦 **NetsOcean™ Factory Direct Netting Supply**
*(Source: Official netsocean.com Wholesale Supply Pricing Engine)*

**Netting Dimensions**: ${l}ft x ${w}ft${h > 0 ? ` x ${h}ft` : ''}
${extraDimText}
- **Total Netting SFT**: **${supplyResult.totalSft.toLocaleString('en-IN')} SFT**
${supplyResult.standardBagsCount ? `- **Standard Bags**: **${supplyResult.standardBagsCount} Bag(s)** (100ft x 33ft = 3300 SFT/bag)${supplyResult.extraSft ? ` + ${supplyResult.extraSft} SFT Extra Piece` : ''}` : ''}
${supplyResult.splitPricing && supplyResult.topDetails && supplyResult.sidesDetails ? `- **Side Panels**: ${supplyResult.sidesDetails.sft.toLocaleString('en-IN')} SFT (45mm HDPE Braided @ ₹${supplyResult.sidesDetails.ratePerSft}/SFT)
- **Top / Roof Net**: ${supplyResult.topDetails.sft.toLocaleString('en-IN')} SFT (35mm Twisted Natural Green @ ₹${supplyResult.topDetails.ratePerSft}/SFT)` : `- **Material**: Virgin UV HDPE Braided (45mm Mesh) @ ₹${supplyResult.ratePerSft}/SFT`}

💰 **Supply-Only Pricing:**
- **Material Subtotal**: ₹${supplyResult.subtotal.toLocaleString('en-IN')}
- **GST (5%)**: ₹${supplyResult.gstAmount.toLocaleString('en-IN')}
- **Total Netting Supply**: **₹${supplyResult.totalWithGst.toLocaleString('en-IN')}**
- **Terms**: **Supply Only (DIY Installation)**
- **Dispatch**: ${supplyResult.dispatchInfo.deliveryMode} in heavy-duty waterproof woven bags within 24-48 hours.

Please reply with your **Delivery Pincode & City** to calculate freight transport or express courier charges!`;

  // ═══════════════════════════════════════════════════════════════════════════
  // PILLAR 2: SERVICES WITH INSTALLATION (Rates as per gcmsafetynets.in)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if ((isInstallationServiceIntent || dimMatch) && dimMatch) {
    const l = Number(dimMatch[1]);
    const h = Number(dimMatch[2]);

    const isGrill = lower.includes('grill') || lower.includes('invisible') || websiteId === 'gcminvisiblegrills';
    const isPigeon = lower.includes('pigeon') || lower.includes('bird');
    const svcType = isGrill ? 'invisible_grill' : isPigeon ? 'pigeon_net' : 'balcony_safety_net';

    const balCalc = await executeToolCall('calculate_balcony_safety', {
      serviceType: svcType,
      sections: [{ name: 'Main Balcony', lengthFt: l, heightFt: h }],
      thicknessMm: isGrill ? 2.5 : 2.0,
      meshOrGapMm: isGrill ? 2 : 40
    }, { websiteId });

    cardType = 'calculation';
    cardData = balCalc;

    const minNotice = balCalc.isMinimumBillingApplied 
      ? `\n⚠️ *Notice: Area is ${balCalc.totalActualSft} SFT (< 100 SFT). Billed at the standard 100 SFT minimum technician visit charge.*` 
      : '';

    replyText = `${welcomePrefix}🏢 **GCM Safety Nets — Doorstep Installation Estimation**
*(Source: Official gcmsafetynets.in Doorstep Estimation Calculator)*

**Service**: **${balCalc.serviceName}**
- **Balcony Measurement**: ${l}ft x ${h}ft = **${balCalc.totalActualSft} SFT**
- **Billable Area**: **${balCalc.billedSft} SFT**${minNotice}
- **Approved Installation Rate**: **₹${balCalc.ratePerSftOrUnit}/SFT** (Range: ₹${balCalc.minRate} - ₹${balCalc.maxRate}/SFT)
- **Hardware Included**: ${balCalc.hardwareSpecs.anchorGrade} + ${balCalc.hardwareSpecs.anchorHooksCount} Fastener Anchors
- **Warranty**: **${balCalc.hardwareSpecs.warrantyYears} Years Comprehensive Replacement Warranty**

💰 **Total Estimated Cost**: **₹${balCalc.totalAmount.toLocaleString('en-IN')}** (Net Material + SS Hardware + Technician Labor)

🚐 **${balCalc.installationOffer}**
Would you like to schedule our technician van to visit your home for a free laser measurement and physical sample demonstration?`;

  // ═══════════════════════════════════════════════════════════════════════════
  // CLOTH DRYING HANGERS (Under Pillar 2: gcmsafetynets.in)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (lower.includes('hanger') || lower.includes('cloth') || lower.includes('drying')) {
    const lenMatch = lower.match(/([4-8])\s*(?:ft|feet)/);
    const len = lenMatch ? Number(lenMatch[1]) : 6;

    const hangerCalc = await executeToolCall('calculate_balcony_safety', {
      serviceType: 'cloth_hanger',
      hangerType: lower.includes('wall') ? 'wall' : 'ceiling',
      hangerLengthFt: len,
      quantity: 1
    }, { websiteId });

    cardType = 'calculation';
    cardData = hangerCalc;

    replyText = `${welcomePrefix}🧺 **${hangerCalc.serviceName}**
*(Source: Official gcmsafetynets.in Installation Rates)*

- **Pipe Length**: ${len} Feet (6 Individual Stainless Steel Pipes)
- **Mounting**: Ceiling Pulley System with Smooth Nylon Cords
- **Load Capacity**: Up to 30 kg wet clothes
- **Total Price**: **₹${hangerCalc.totalAmount.toLocaleString('en-IN')}** (Complete Unit + Installation + 2-Yr Warranty)

Would you like to book same-day or next-day installation in Hyderabad?`;

  // ═══════════════════════════════════════════════════════════════════════════
  // DISCOUNT NEGOTIATION
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isDiscount) {
    const discMatch = lower.match(/(\d+)%/);
    const requestedPct = discMatch ? Number(discMatch[1]) : 10;

    if (requestedPct <= 5.0) {
      replyText = `As an authorized AI Sales Agent, I can instantly approve our **${requestedPct}% volume discount** on your order. This reflects immediately on your proforma invoice!`;
      cardType = 'approval_notice';
      cardData = { status: 'INSTANT_APPROVED', discountPct: requestedPct };
    } else {
      replyText = `You requested a **${requestedPct}% discount**. My autonomous limit allows up to **5% instant discount**.

Because your project is important to us, **I have forwarded your discount request directly to Mr. Gopichand Mailapally for special owner approval**.

Please share your **Name and Delivery City**, and the Owner will review and message an approved counter-quote to your WhatsApp within 15 minutes!`;
      cardType = 'approval_notice';
      cardData = { status: 'OWNER_APPROVAL_REQUIRED', requestedPct, maxAllowedPct: 5.0 };
    }

  // ═══════════════════════════════════════════════════════════════════════════
  // FREE SITE VISIT / DOORSTEP MEASUREMENT
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isSiteVisit || (detectedPhone && (lower.includes('visit') || lower.includes('book') || lower.includes('measure')))) {
    replyText = `✅ **Free Doorstep Site Visit Request Registered!**

Our senior installation supervisor has received your request:
- **Service**: 100% Free Doorstep Measurement & Physical Sample Demo Van
- **Timing**: Available 7 days a week (9:00 AM – 7:30 PM)
- **Coverage**: All zones across Hyderabad, Secunderabad, Cyberabad, and regional AP/Telangana branches.

${detectedPhone ? `We have your contact number **+91 ${detectedPhone}** on file. Our field coordinator will call you within 15 minutes to confirm your preferred address and time slot!` : 'Please reply with your **Phone Number and Area/City** so we can assign our nearest technician van!'}`;

  // ═══════════════════════════════════════════════════════════════════════════
  // FORMAL QUOTATION GENERATION (ERP SYNC)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isQuoteRequest || (detectedPhone && (lower.includes('send') || lower.includes('quote')))) {
    const custName = req.customerName || existingCustomer?.customer_name || 'Valued Client';
    const custPhone = detectedPhone || '9912399224';

    let projName = 'Turnkey Cricket & Sports Setup';
    let qItems: any[] = [];
    let disc = 5.0;

    if (websiteId === 'netsocean') {
      projName = 'NetsOcean Factory Direct Netting Supply';
      qItems = [
        { productId: 'PROD-NETSOCEAN-HDPE-45', itemName: 'NetsOcean™ 45mm HDPE Braided Netting Bag (100x33ft)', quantity: 3300, unit: 'SFT', unitRate: 8.0 },
        { productId: 'PROD-NETSOCEAN-TWISTED-35', itemName: 'NetsOcean™ 35mm Twisted Natural Green Roof Netting', quantity: 3300, unit: 'SFT', unitRate: 6.0 }
      ];
    } else if (websiteId === 'gcmsafetynets' || websiteId === 'gcminvisiblegrills') {
      projName = 'Residential Balcony Safety Netting Installation';
      qItems = [
        { productId: 'PROD-GARWARE-NYLON-30', itemName: 'Garware™ High-Tenacity Balcony Safety Net with SS 316 Fasteners', quantity: 250, unit: 'SFT', unitRate: 22.0 }
      ];
    } else {
      projName = 'Turnkey Box Cricket Ground (100ft x 50ft x 25ft)';
      qItems = [
        { productId: 'PROD-TURNKEY-COMMERCIAL', itemName: 'Structural Framework 40x40 GI Columns & Tie Pipes', quantity: 5000, unit: 'SFT', unitRate: 65.0 },
        { productId: 'PROD-TURF-NONINFILL-25', itemName: 'Non-Infill Multi-Sport Turf 25mm with PU Adhesive', quantity: 5200, unit: 'SFT', unitRate: 85.0 },
        { productId: 'PROD-RUSSEA-25-40', itemName: 'RUSSEA™ 2.5mm Braided Netting Enclosure with Camber', quantity: 12500, unit: 'SFT', unitRate: 25.0 }
      ];
    }

    const quoteRes = await executeToolCall('create_official_quotation', {
      customerName: custName,
      phone: custPhone,
      projectName: projName,
      dimensionsText: 'As per technical requirements',
      items: qItems,
      discountPct: disc,
      transportCharges: 0
    }, { websiteId });

    cardType = 'quotation';
    cardData = quoteRes;

    const docIdDisplay = quoteRes.officialDocId ? `${quoteRes.officialDocId} (${quoteRes.quoteNumber})` : quoteRes.quoteNumber;
    replyText = `✅ **Official Quotation #${docIdDisplay} Successfully Generated!**

- **Customer**: ${custName} (+91 ${custPhone})
- **Company**: ${quoteRes.companyName || 'GCM ENTERPRISES'}
- **Project**: ${quoteRes.projectName}
- **Subtotal**: ₹${quoteRes.financials.subtotal.toLocaleString('en-IN')}
- **Discount (${disc}%)**: -₹${quoteRes.financials.discountAmount.toLocaleString('en-IN')}
- **GST (${quoteRes.financials.gstPct || 18}%)**: ₹${quoteRes.financials.gstAmount.toLocaleString('en-IN')}
- **Grand Total**: **₹${quoteRes.financials.grandTotal.toLocaleString('en-IN')}**
${quoteRes.officialViewUrl ? `\n📄 **Official Document Link**: [View / Download PDF Quotation](${quoteRes.officialViewUrl})` : ''}

This quotation has been officially registered in the GCM ERP system. Click the link above to view your official stamped document or print the PDF.`;

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT WELCOMING KNOWLEDGE ASSISTANT
  // ═══════════════════════════════════════════════════════════════════════════
  } else {
    const website = db.prepare('SELECT * FROM websites WHERE id = ?').get(websiteId) as any;
    const brand = website ? website.brand_name : 'GCM Group';

    if (detectedPhone) {
      replyText = `${welcomePrefix}Thank you! I have recorded your contact number **+91 ${detectedPhone}**.

Our engineering and sales team for **${brand}** will connect with you on WhatsApp or phone.

In the meantime, feel free to give me your dimensions or requirements:
- **Turnkey Box Cricket**: e.g., *100x50x25 turnkey* (gcm.enterprises rates)
- **Residential Installation**: e.g., *15x6 balcony net* or *invisible grill* (gcmsafetynets.in rates)
- **Material Supply Only**: e.g., *100x50 supply only* or *wholesale bags* (netsocean.com rates)`;
    } else {
      replyText = `${welcomePrefix}Welcome to **${brand}**! I am your AI Sales Engineer.

I am configured with exact rate sheets across our 3 master business divisions:
1. 🏏 **Turnkey Sports & Box Cricket Setup** (*gcm.enterprises*): Complete ground BOQ including 40x40 GI steel columns, artificial turf, overhead cambered netting, and floodlights.
2. 🏢 **Services with Installation** (*gcmsafetynets.in*): Balcony safety nets, anti-pigeon nets, SS 316 invisible grills, and cloth drying hangers with free doorstep measurement.
3. 📦 **Material Sales & Supply Only** (*netsocean.com*): Factory-direct HDPE netting bags (100x33ft = 3300 SFT), custom cut panels, and twisted roof nets with PAN-India courier/transport dispatch.

What are your court or balcony dimensions, or what can I quote for you today?`;
    }
  }

  // Auto-record lead in CRM if a phone number was detected
  if (detectedPhone) {
    try {
      const existingLead = db.prepare('SELECT id FROM leads WHERE phone LIKE ?').get(`%${detectedPhone}%`) as any;
      if (!existingLead) {
        const leadId = 'LEAD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        db.prepare(`
          INSERT INTO leads (id, website_id, customer_name, phone, requirement_summary, estimated_value, stage)
          VALUES (?, ?, ?, ?, ?, ?, 'NEW')
        `).run(
          leadId,
          websiteId,
          req.customerName || 'Website / WhatsApp Visitor',
          detectedPhone,
          userText,
          cardData?.financials?.grandTotal || cardData?.grandTotal || cardData?.totalWithGst || cardData?.totalAmount || 0
        );
      }
    } catch (err) {
      console.error('Lead auto-registration notice:', err);
    }
  }

  // Append Assistant Response & Persist Conversation
  history.push({
    role: 'assistant',
    content: replyText,
    cardData,
    timestamp: new Date().toISOString()
  });

  db.prepare(`
    UPDATE conversations 
    SET messages = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE session_id = ?
  `).run(JSON.stringify(history), sessionId);

  return {
    sessionId,
    reply: replyText,
    cardType,
    cardData
  };
}

export const processChatConversation = processUserMessage;
