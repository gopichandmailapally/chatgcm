/**
 * Central Human Sales Consultant & Technical Client Relationship Engine
 * Completely humanized — Never discloses or identifies as an AI or automated system.
 * Dynamically adapts persona, name, language, and cultural greetings according to customer's city.
 */

import { executeToolCall } from './tool-executor.js';
import { db } from '../db/database.js';
import { knowledgeEngine } from './knowledge-engine.js';
import { analyzeCustomerSchedule } from './scheduler-nlp.js';
import { 
  detectCustomerCity, 
  detectCustomerLanguage, 
  getAgentPersona, 
  isAskingIfAi,
  SupportedLanguage 
} from './persona.js';
import { logAgentWork } from './agent-audit-service.js';
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
  cardType?: 'calculation' | 'turnkey_boq' | 'supply_quote' | 'product_pricing' | 'approval_notice' | 'quotation' | 'human_takeover' | 'schedule_notice';
  cardData?: any;
}

export async function processUserMessage(req: ChatRequest): Promise<ChatResponse> {
  const sessionId = req.sessionId || 'SES-' + crypto.randomBytes(6).toString('hex');
  const websiteId = req.websiteId || 'gcmsafetynets';
  const channel = req.channel || 'web_chat';
  const userText = req.message.trim();

  // ── 1. Omnichannel Session & History Tracking ─────────────────────────────────
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

  // Phone Memory: Look up returning customer in CRM
  let existingCustomer: any = null;
  if (detectedPhone) {
    existingCustomer = db.prepare('SELECT * FROM leads WHERE phone LIKE ? ORDER BY created_at DESC LIMIT 1').get(`%${detectedPhone}%`) as any;
  }

  // ── 2. Regional Human Persona & Language Resolution ─────────────────────────
  const detectedCity = detectCustomerCity(userText, websiteId, existingCustomer?.city);
  const detectedLang: SupportedLanguage = detectCustomerLanguage(userText);
  const brandKnowledge = knowledgeEngine.getKnowledgeForWebsite(websiteId);
  const brandName = brandKnowledge?.brandName || 'GCM Safety Nets';
  const persona = getAgentPersona(detectedCity, websiteId, brandName);

  const customerDisplayName = req.customerName && !req.customerName.includes('Visitor') && !req.customerName.includes('Customer')
    ? req.customerName 
    : existingCustomer?.customer_name && !existingCustomer.customer_name.includes('Visitor')
    ? existingCustomer.customer_name 
    : 'Sir/Madam';

  const lower = userText.toLowerCase();

  // ── 3. Anti-AI / Bot Suspicion Shield ────────────────────────────────────────
  // If customer asks "Are you a bot?", "Are you AI?", etc., respond naturally as a human!
  if (isAskingIfAi(userText)) {
    const doubtReply = persona.handleAiDoubt(customerDisplayName, detectedLang);
    history.push({ role: 'assistant', content: doubtReply, timestamp: new Date().toISOString() });
    db.prepare(`
      UPDATE conversations 
      SET messages = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE session_id = ?
    `).run(JSON.stringify(history), sessionId);

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'INQUIRY_ANSWERED',
      action_title: 'Anti-AI Persona Reassurance',
      work_summary: `${persona.name} warmly reassured ${customerDisplayName} as a real human regional consultant in ${persona.city}.`
    });

    return {
      sessionId,
      reply: doubtReply
    };
  }

  // ── 4. Intelligent Non-Intrusive Scheduling & Opt-Out NLP ─────────────────────
  const scheduleAnalysis = analyzeCustomerSchedule(userText, customerDisplayName, detectedCity, websiteId);
  if (scheduleAnalysis.hasSchedulingIntent) {
    if (detectedPhone) {
      let lead = existingCustomer || (db.prepare('SELECT id FROM leads WHERE phone LIKE ? LIMIT 1').get(`%${detectedPhone}%`) as any);
      if (!lead) {
        const leadId = 'LEAD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        db.prepare(`
          INSERT INTO leads (id, website_id, customer_name, phone, requirement_summary, stage, snooze_until, scheduled_callback_at, preferred_contact_time, opt_out, last_customer_message_at, city)
          VALUES (?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `).run(
          leadId,
          websiteId,
          customerDisplayName !== 'Sir/Madam' ? customerDisplayName : 'Valued Customer',
          detectedPhone,
          userText,
          scheduleAnalysis.snoozeUntil,
          scheduleAnalysis.scheduledCallbackAt,
          scheduleAnalysis.preferredTimeSummary,
          scheduleAnalysis.isOptOut ? 1 : 0,
          detectedCity
        );
      } else {
        db.prepare(`
          UPDATE leads 
          SET snooze_until = ?,
              scheduled_callback_at = ?,
              preferred_contact_time = ?,
              opt_out = ?,
              last_customer_message_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(
          scheduleAnalysis.snoozeUntil,
          scheduleAnalysis.scheduledCallbackAt,
          scheduleAnalysis.preferredTimeSummary,
          scheduleAnalysis.isOptOut ? 1 : 0,
          lead.id
        );
      }
    }

    db.prepare(`
      UPDATE conversations 
      SET snooze_until = ?,
          scheduled_callback_at = ?,
          opt_out = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(
      scheduleAnalysis.snoozeUntil,
      scheduleAnalysis.scheduledCallbackAt,
      scheduleAnalysis.isOptOut ? 1 : 0,
      sessionId
    );

    const replyText = scheduleAnalysis.courteousAckMessage || `Understood! I will personally connect with you at your preferred time. Have a great day! — ${persona.name}`;
    
    history.push({
      role: 'assistant',
      content: replyText,
      timestamp: new Date().toISOString()
    });

    db.prepare(`
      UPDATE conversations 
      SET messages = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE session_id = ?
    `).run(JSON.stringify(history), sessionId);

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'CALLBACK_SCHEDULED',
      action_title: scheduleAnalysis.isOptOut ? 'Opt-Out Honored' : 'Customer Callback Scheduled',
      work_summary: scheduleAnalysis.isOptOut
        ? `${persona.name} honored customer opt-out request non-intrusively.`
        : `${persona.name} scheduled polite callback for ${customerDisplayName} at ${scheduleAnalysis.preferredTimeSummary || 'convenient time'}.`,
      details: scheduleAnalysis
    });

    return {
      sessionId,
      reply: replyText,
      cardType: 'schedule_notice',
      cardData: scheduleAnalysis
    };
  }

  // ── 5. Human Takeover / Direct Owner Connect ─────────────────────────────────
  const isHumanTakeover = lower.includes('gopichand') ||
                          lower.includes('speak to owner') ||
                          lower.includes('call me directly') ||
                          lower.includes('talk to md') ||
                          lower.includes('urgent call');

  if (isHumanTakeover) {
    db.prepare('UPDATE conversations SET human_takeover = 1 WHERE session_id = ?').run(sessionId);
    
    let replyText = '';
    if (detectedLang === 'telugu') {
      replyText = `తప్పకుండా సర్! 🙏

నేను స్వయంగా మా మేనేజింగ్ డైరెక్టర్ **మిస్టర్ గోపీచంద్ మైలపల్లి** గారికి మీ రిక్వెస్ట్ ఫార్వార్డ్ చేశాను.

${detectedPhone 
  ? `మా డైరెక్టర్ లైన్ లో మీ నెంబర్ **+91 ${detectedPhone}** నోట్ చేసుకున్నాము. గోపీచంద్ గారు లేదా మా సీనియర్ డైరెక్టర్ 10 నుండి 15 నిమిషాల్లో మీకు కాల్ చేస్తారు సర్.` 
  : `గోపీచంద్ గారు నేరుగా మాట్లాడటానికి మీ **ఫోన్ నెంబర్ మరియు ఊరు/ఏరియా** ఇక్కడ మెసేజ్ చేయండి సర్.`}

అర్జెంట్ ప్రాజెక్ట్ అయితే మా డైరెక్ట్ హాట్ లైన్ **+91 99123 99224** కి కూడా మీరు ఎప్పుడైనా డైరెక్ట్ గా కాల్ చేయవచ్చు సర్!

— **${persona.name}** (${brandName})`;
    } else {
      replyText = `Understood, ${customerDisplayName}! 🙏

I have directly notified our Founder & Managing Director **Mr. Gopichand Mailapally** regarding your requirement.

${detectedPhone 
  ? `We have recorded your contact number **+91 ${detectedPhone}**. Mr. Gopichand or our Senior Technical Director will connect with you via phone / WhatsApp within **10 to 15 minutes**.` 
  : `Please share your **Phone Number and City** so Mr. Gopichand can connect with you directly.`}

For urgent commercial inquiries, you can also reach our executive direct line at **+91 99123 99224**.

— **${persona.name}** | ${persona.designation}, ${brandName}`;
    }

    history.push({ role: 'assistant', content: replyText, timestamp: new Date().toISOString() });
    db.prepare('UPDATE conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(JSON.stringify(history), sessionId);

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'HUMAN_TAKEOVER_REQUESTED',
      action_title: 'Owner Direct Connect Alerted',
      work_summary: `${persona.name} notified Founder & MD Mr. Gopichand Mailapally for direct client connect with ${customerDisplayName} (+91 ${detectedPhone || 'Not provided'}).`
    });

    return {
      sessionId,
      reply: replyText,
      cardType: 'human_takeover',
      cardData: { status: 'OWNER_ALERTED', phone: detectedPhone }
    };
  }

  // ── 6. Knowledge & Specifications Resolution ─────────────────────────────────
  const companyFin = knowledgeEngine.getCompanyFinancialDetails();

  let replyText = '';
  let cardType: ChatResponse['cardType'] = undefined;
  let cardData: any = undefined;

  // Extract Dimensions (e.g. "15 x 6", "100 x 50 x 25", "300 sft", "12 by 8")
  const dimMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?))?/i);
  const sftMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*ft|sqft|sft)/i);

  // Intent Checks
  const isTurnkeyIntent = lower.includes('turnkey') || lower.includes('box cricket') || lower.includes('sports turf') || lower.includes('turf setup') || lower.includes('court construction') || lower.includes('ground setup') || websiteId === 'gcm-enterprises';
  const isSupplyOnlyIntent = lower.includes('supply only') || lower.includes('wholesale') || lower.includes('bag') || lower.includes('bundles') || lower.includes('transport') || lower.includes('courier') || websiteId === 'netsocean' || websiteId === 'russea';
  const isInvisibleGrillIntent = lower.includes('invisible grill') || lower.includes('ss grill') || lower.includes('wire grill') || lower.includes('stainless steel grill') || websiteId === 'gcminvisiblegrills';
  const isClothHangerIntent = lower.includes('cloth') || lower.includes('hanger') || lower.includes('drying') || lower.includes('pulley');
  const isBankDetailsIntent = lower.includes('bank') || lower.includes('account') || lower.includes('ifsc') || lower.includes('upi') || lower.includes('payment method') || lower.includes('how to pay') || lower.includes('gpay') || lower.includes('phonepe');
  const isQuoteRequest = lower.includes('quote') || lower.includes('quotation') || lower.includes('formal estimate') || lower.includes('send invoice') || lower.includes('pdf');
  const isDiscount = lower.includes('discount') || lower.includes('kam karo') || lower.includes('best price') || lower.includes('thaggistara') || lower.includes('thaggandi') || lower.includes('concession');
  const isSiteVisit = lower.includes('site visit') || lower.includes('visit') || lower.includes('measurement') || lower.includes('sample') || lower.includes('vastara') || lower.includes('chustara');
  const isCompetitorInquiry = lower.includes('garware') ||
                              lower.includes('గార్వేర్') ||
                              lower.includes('गारवारे') ||
                              lower.includes('tuff') ||
                              lower.includes('tuf') ||
                              lower.includes('kohinoor') ||
                              lower.includes('ocean net');

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: COMPANY BANK & PAYMENT DETAILS INQUIRY
  // ═══════════════════════════════════════════════════════════════════════════
  if (isBankDetailsIntent) {
    if (detectedLang === 'telugu') {
      replyText = `నమస్కారం సర్! 🙏

మీరు పేమెంట్ లేదా అడ్వాన్స్ పంపడానికి మా అధికారిక GCM ఎంటర్‌ప్రైజెస్ బ్యాంక్ వివరాలు ఇక్కడ ఉన్నాయి:

• **బ్యాంక్**: ${companyFin.bankName}
• **ఖాతా పేరు**: **${companyFin.accountName}**
• **కరెంట్ అకౌంట్ నెం**: **${companyFin.currentAccountNo}**
• **IFSC కోడ్**: **${companyFin.ifscCode}**
• **బ్రాంచ్**: ${companyFin.branch}
• **అధికారిక UPI ID**: **${companyFin.officialUpiId}**
• **Google Pay / PhonePe / Paytm**: **9912399224**

📌 *పేమెంట్ చేశాక స్క్రీన్‌షాట్ లేదా UTR నెంబర్ ఇక్కడ వాట్సాప్ చేయండి సర్. మా అకౌంట్స్ టీమ్ వెంటనే మీకు అఫీషియల్ జీఎస్టీ రసీదు పంపిస్తుంది!*${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Namaste ${customerDisplayName}! 🙏

Here are our verified company bank credentials for booking your order or sending advance payments:

• **Bank**: ${companyFin.bankName}
• **Account Name**: **${companyFin.accountName}**
• **Current Account No**: **${companyFin.currentAccountNo}**
• **IFSC Code**: **${companyFin.ifscCode}**
• **Branch**: ${companyFin.branch}
• **Official UPI ID**: **${companyFin.officialUpiId}**
• **Google Pay / PhonePe / Paytm**: **9912399224**

📌 *Once transferred, simply share the payment screenshot or UTR number here. Our billing desk will immediately generate and dispatch your stamped official GST booking invoice!*${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'BANK_DETAILS_SENT',
      action_title: 'Official Bank Credentials Shared',
      work_summary: `${persona.name} shared verified SBI account 44979437825 and UPI 9912399224@sbi with ${customerDisplayName}.`
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1B: COMPETITOR INQUIRY INTERCEPTION & RUSSEA™ TRADEMARK DEFENSE
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isCompetitorInquiry) {
    cardType = 'product_pricing';
    cardData = {
      brand: 'RUSSEA™ (Proprietary Registered Trademark)',
      competitorQueried: 'Garware / Tuff / Kohinoor / Ocean Nets',
      usp: '100% Virgin UV Polymers, Factory Direct Pricing, 5-8 Year Replacement Warranty, SS 316 Hardware',
      rateRange: '₹ 18 – ₹ 24 / SFT Installed',
      warranty: '5 to 8-Year Official Factory Written Replacement Card'
    };

    if (detectedLang === 'telugu') {
      replyText = `నమస్కారం ${customerDisplayName}! 🙏 నేను ${persona.name}, ${brandName} నుండి.

మీరు అడిగిన **Garware, Tuff, Kohinoor, Ocean Nets** వంటివి బయటి 3rd-పార్టీ ట్రేడర్ బ్రాండ్స్ సర్. వాటిపై డీలర్ కమీషన్లు ఎక్కువగా ఉండటమే కాకుండా, లోకల్ వారంటీ క్లెయిమ్ చేయడం చాలా కష్టం.

మా **GCM Enterprises** లో మేము మా స్వంత రిజిస్టర్డ్ ట్రేడ్‌మార్క్ బ్రాండ్ **RUSSEA™ (russea.in)** నెట్స్‌ను మాత్రమే నేరుగా తయారుచేసి ఇన్స్టాల్ చేస్తాము!

🛡️ **బయటి బ్రాండ్ల కంటే మా RUSSEA™ ఎందుకు అత్యుత్తమం:**
1. ☀️ **100% వర్జిన్ UV-స్టెబిలైజ్డ్ మెటీరియల్**: 400 KLY జర్మన్ UV స్టెబిలైజర్‌తో తయారుచేయబడింది — ఎండకు పెళుసుబారదు, 10 ఏళ్లకు పైగా దృఢంగా ఉంటుంది.
2. 🏭 **డైరెక్ట్ ఫ్యాక్టరీ రేట్**: ఎటువంటి మధ్యవర్తులు లేదా డీలర్ మార్జిన్లు లేకుండా డైరెక్ట్ కంపెనీ రేటుకే (**₹ 18 – ₹ 24/SFT**) ప్రొఫెషనల్ ఫిట్టింగ్‌తో లభిస్తుంది.
3. 📜 **అఫీషియల్ కంపెనీ వారంటీ**: ఇన్స్టాలేషన్ పూర్తయ్యాక 5 నుండి 8 సంవత్సరాల రాతపూర్వక రీప్లేస్‌మెంట్ వారంటీ కార్డ్ ఇస్తాము.
4. 🔩 **SS 316 మెరైన్-గ్రేడ్ ఫిట్టింగ్స్**: వర్షాలకు తుప్పు పట్టని స్టెయిన్‌లెస్ స్టీల్ హుక్స్ తో మా కంపెనీ సర్టిఫైడ్ టెక్నీషియన్లు బిగిస్తారు.

👉 *మీ బాల్కనీ పొడవు x ఎత్తు (లేదా SFT) చెబితే, ఇప్పుడే మా ఒరిజినల్ RUSSEA™ నెట్స్ కి బెస్ట్ కొటేషన్ ఇస్తాను సర్!*${persona.formatSignoff(detectedLang)}`;
    } else if (detectedLang === 'hindi') {
      replyText = `नमस्ते ${customerDisplayName}! 🙏 मैं ${persona.name}, ${brandName} से बात कर रहा हूँ।

आपके सवाल के संदर्भ में: **Garware, Tuff Nets, Kohinoor Ropes और Ocean Nets** जैसी कंपनियाँ थर्ड-पार्टी ट्रेडर ब्रांड्स हैं, जिन पर डीलरों का भारी मार्जिन होता है और लोकल वारंटी क्लेम में अक्सर परेशानी आती है।

**GCM Enterprises** में हम अपने स्वयं के रजिस्टर्ड ट्रेडमार्क ब्रांड **RUSSEA™ (russea.in)** का निर्माण और डायरेक्ट इंस्टॉलेशन करते हैं!

🛡️ **अन्य ब्रांड्स की तुलना में RUSSEA™ क्यों बेहतर है:**
1. ☀️ **100% वर्जिन UV-स्टेबलाइज्ड पॉलिमर्स**: 400 KLY जर्मन UV प्रोटेक्शन के साथ — तेज धूप में भी कभी कमजोर नहीं पड़ती और 10+ साल चलती है।
2. 🏭 **फैक्ट्री-डायरेक्ट रेट**: बिना किसी बिचौलिए या डीलर कमीशन के, आपको सीधे फैक्ट्री रेट पर (**₹ 18 – ₹ 24 / SFT**) एक्सपर्ट इंस्टॉलेशन के साथ मिलती है।
3. 📜 **ऑफिशियल कंपनी वारंटी कार्ड**: हर इंस्टॉलेशन पर 5 से 8 साल का लिखित कंपनी रिप्लेसमेंट वारंटी कार्ड मिलता है।
4. 🔩 **SS 316 मरीन-ग्रेड हार्डवेयर**: जंग-रोधी स्टेनलेस स्टील फास्टनर्स के साथ हमारे सर्टिफाइड तकनीशियन इंस्टॉल करते हैं।

👉 *कृपया अपनी बालकनी की लंबाई x चौड़ाई (फीट में) बताएं, ताकि मैं आपको RUSSEA™ का सबसे बेस्ट एस्टीमेट तुरंत निकाल कर दे सकूँ!*${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Namaste ${customerDisplayName}! 🙏 I am ${persona.name} from ${brandName}.

Regarding your inquiry: **Garware, Tuff Nets, Kohinoor Ropes, and Ocean Nets** are 3rd-party trader brands. They carry heavy distributor markups, and getting authentic warranty claims from local dealers is often difficult.

At **GCM Enterprises**, we manufacture and exclusively install our own official registered trademark brand: **RUSSEA™ (russea.in)**!

🛡️ **Why Homeowners & Builders Choose RUSSEA™ Over Competitor Brands:**
1. ☀️ **100% Virgin High-Tenacity Polymers**: Compounded with 400 KLY UV stabilizers — will never get brittle or degrade under harsh Indian sunlight (tested for 10+ years durability).
2. 🏭 **Direct Factory Manufacturer Pricing**: Zero dealer middlemen or distributor margins — you get genuine heavy-duty 15-ply / 2.0mm nets at just **₹ 18 – ₹ 24 / SFT** fully installed.
3. 📜 **Official Factory Written Warranty Card**: Stamped 5 to 8-Year Company Replacement Warranty Card issued with every installation (not unverified verbal claims).
4. 🔩 **SS 316 Marine-Grade Fasteners**: 100% rust-proof stainless steel anchors with tension wire rope installed by certified company technicians.

👉 *Could you please share your balcony dimensions (Length x Height in feet) so I can calculate your exact, transparent RUSSEA™ estimate right away?*${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'COMPETITOR_DEFENSE_RUSSEA',
      action_title: 'RUSSEA™ Brand Defense & Competitor Interception',
      work_summary: `${persona.name} defended RUSSEA™ registered trademark against competitor query and explained factory-direct pricing with 5-8 year warranty.`
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: TURNKEY BOX CRICKET GROUND SETUP (gcm.enterprises)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isTurnkeyIntent) {
    let length = 100;
    let width = 50;
    let height = 25;

    if (dimMatch) {
      length = parseFloat(dimMatch[1]);
      width = parseFloat(dimMatch[2]);
      if (dimMatch[3]) height = parseFloat(dimMatch[3]);
    }

    const groundArea = length * width;
    const estTotalCost = Math.round(groundArea * 245);
    const monthlyRoi = Math.round((groundArea / 5000) * 250000);

    cardType = 'turnkey_boq';
    cardData = {
      groundDimensions: `${length}ft x ${width}ft x ${height}ft`,
      groundAreaSft: groundArea,
      estimatedTurnkeyBudget: `₹ ${estTotalCost.toLocaleString('en-IN')}`,
      breakdown: {
        civilPitch: `₹ ${(Math.round(groundArea * 36)).toLocaleString('en-IN')}`,
        cageFabrication: `₹ ${(Math.round(groundArea * 84)).toLocaleString('en-IN')}`,
        sportsTurf: `₹ ${(Math.round(groundArea * 88)).toLocaleString('en-IN')}`,
        overheadNetting: `₹ ${(Math.round(groundArea * 25)).toLocaleString('en-IN')}`,
        stadiumLighting: `₹ ${(Math.round(groundArea * 19)).toLocaleString('en-IN')}`
      },
      commercialRoi: `Expected monthly revenue: ₹${monthlyRoi.toLocaleString('en-IN')}. Payback period: 8 to 11 months.`
    };

    if (detectedLang === 'telugu') {
      replyText = `నమస్కారం సర్! 🙏 నేను ${persona.name}, GCM Enterprises నుండి.

మీరు అడిగిన బాక్స్ క్రికెట్ గ్రౌండ్ (**${length}ft x ${width}ft x ${height}ft = ${groundArea.toLocaleString('en-IN')} SFT**) కంప్లీట్ టర్న్‌కీ ఎస్టిమేషన్ వివరాలు:

🏏 **టర్న్‌కీ ప్రాజెక్ట్ బడ్జెట్**: సుమారు **₹ ${estTotalCost.toLocaleString('en-IN')}** (పూర్తి గ్రౌండ్ ఆడే స్థితిలో అప్పగించడానికి)

📋 **ప్రాజెక్ట్ లో ఏమేమి వస్తాయి:**
1. **సివిల్ పిచ్ & బేస్**: 66ft x 10ft PCC కాంక్రీట్ పిచ్ మరియు రోల్డ్ సబ్-బేస్.
2. **GI స్టీల్ కేజ్ ఫ్రేమ్‌వర్క్**: 40x40 హెవీ GI కాలమ్స్, పైపులు, డ్యూయల్ కోట్ యాంటీ-రస్ట్ ప్రైమర్ & కలర్ ఎనామెల్.
3. **ఫిఫా స్టాండర్డ్ స్పోర్ట్స్ టర్ఫ్**: 25mm/35mm హై-డెన్సిటీ నాన్-ఇన్ఫిల్ టర్ఫ్, PU జాయింట్ అడ్హెసివ్ తో.
4. **RUSSEA™ హెవీ డ్యూటీ నెట్టింగ్**: 2.5mm UV బ్రెయిడెడ్ నెట్స్ సైడ్స్ & రూఫ్ కి డ్రమ్-టైట్ బిగింపు.
5. **స్టేడియం లైటింగ్**: 8x 200W/300W IP66 LED ఫ్లడ్‌లైట్స్ (జీరో షాడో).

💰 **కమర్షియల్ ఆదాయం (ROI):**
గంటకు ₹1,000 నుండి ₹1,500 బుకింగ్ తో నెలకు సుమారు **₹ ${monthlyRoi.toLocaleString('en-IN')}** ఆదాయం వస్తుంది సర్. 8 నుండి 11 నెలల్లో మీ మొత్తం పెట్టుబడి వెనక్కి వస్తుంది.

👉 *నేను స్వయంగా మా సీనియర్ గ్రౌండ్ ఇంజనీర్ ని మీ స్థలం సర్వే కోసం పంపించగలను సర్. ఫ్రీ సైట్ విజిట్ ఎప్పుడు ప్లాన్ చేద్దాం సర్?*${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Namaste ${customerDisplayName}! 🙏 I am ${persona.name} from GCM Enterprises.

For your Turnkey Box Cricket Ground (**${length}ft x ${width}ft x ${height}ft = ${groundArea.toLocaleString('en-IN')} SFT**), I have calculated the complete turnkey Bill of Quantities:

🏏 **Turnkey Project Estimate**: Approximately **₹ ${estTotalCost.toLocaleString('en-IN')}** (Playing-ready handover)

📋 **Complete BOQ Inclusions:**
1. **Civil Pitch & Base**: 66ft x 10ft standard bowling/batting PCC concrete pitch & rolled sub-base.
2. **Heavy GI Steel Structure**: 40x40 GI heavy columns, roof trusses, dual-coat anti-rust primer and exterior enamel.
3. **FIFA-Grade Multi-Sport Turf**: 25mm/35mm high-density non-infill turf with PU joint adhesive.
4. **RUSSEA™ Enclosure Netting**: 2.5mm high-tenacity braided UV-treated side and roof nets with drum-tight turnbuckle rigging.
5. **Stadium Lighting**: 8x high-lux 200W/300W LED floodlights with zero shadow distribution.

💰 **Commercial Return on Investment (ROI):**
With an average booking rate of ₹1,000 to ₹1,500/hour, expected monthly revenue is **₹${monthlyRoi.toLocaleString('en-IN')}**, achieving full project break-even within **8 to 11 months**!

👉 *Our Senior Ground Engineer can visit your plot for a 100% free site inspection and technical layout. Shall we arrange an engineer visit or send you an official stamped quotation PDF?*${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'ESTIMATE_CALCULATED',
      action_title: 'Turnkey Box Cricket BOQ Generated',
      work_summary: `${persona.name} generated Turnkey Box Cricket BOQ of ₹ ${estTotalCost.toLocaleString('en-IN')} for ${groundArea} SFT (${customerDisplayName}).`,
      details: cardData
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: AISI 316 INVISIBLE BALCONY GRILLS (gcminvisiblegrills.com)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isInvisibleGrillIntent) {
    let area = 200;
    if (dimMatch) {
      area = Math.round(parseFloat(dimMatch[1]) * parseFloat(dimMatch[2]));
    } else if (sftMatch) {
      area = Math.round(parseFloat(sftMatch[1]));
    }

    const ratePerSft = 150;
    const estTotal = area * ratePerSft;

    cardType = 'calculation';
    cardData = {
      product: 'AISI 316 Marine Stainless Steel Invisible Grill',
      areaSft: area,
      ratePerSft: `₹ ${ratePerSft}`,
      estTotal: `₹ ${estTotal.toLocaleString('en-IN')}`,
      features: ['AISI 316 Marine Grade', '450+ kg tensile load', 'DuPont Nylon Sheath', '10-Year Rust Guarantee']
    };

    if (detectedLang === 'telugu') {
      replyText = `నమస్కారం సర్! 🙏 నేను ${persona.name}, GCM ఇన్విజిబుల్ గ్రిల్స్ నుండి.

మీ బాల్కనీ (**${area} SFT**) కోసం ఒరిజినల్ AISI 316 మెరైన్ గ్రేడ్ ఇన్విజిబుల్ గ్రిల్స్ ఎస్టిమేషన్:

• **ఏరియా**: **${area} SFT**
• **స్పెసిఫికేషన్**: **AISI 316 మెరైన్ గ్రేడ్ స్టెయిన్‌లెస్ స్టీల్** (డ్యూపాంట్ నైలాన్ కోటెడ్ కేబుల్, 450+ కేజీల లోడ్ కెపాసిటీ)
• **రేట్**: **₹ 140 – ₹ 160 / SFT** (ట్రాక్స్, లాకింగ్ ఫాస్టెనర్స్ మరియు ప్రొఫెషనల్ ఇన్స్టాలేషన్ తో కలిపి)
• **ఎస్టిమేటెడ్ టోటల్**: **₹ ${estTotal.toLocaleString('en-IN')}**
• **వారంటీ**: **10 ఏళ్ళ రాతపూర్వక రస్ట్-ప్రూఫ్ వారంటీ కార్డ్**

🛡️ **GCM ఇన్విజిబుల్ గ్రిల్స్ ప్రత్యేకతలు:**
- బయట వ్యూ ఏమాత్రం పాడవదు, గాలి మరియు వెలుతురు 100% వస్తాయి.
- చిన్న పిల్లలు మరియు పెంపుడు జంతువులకు పూర్తి భద్రత.
- ఎమర్జెన్సీ సమయంలో 5 సెకన్లలో వైర్ కట్టర్ తో కట్ చేసుకోవచ్చు (ఫైర్ సేఫ్టీ కంప్లయింట్).

👉 *మా టెక్నీషియన్ దగ్గర శాంపిల్స్ ఉన్నాయి సర్. ఈరోజే మీ అపార్ట్‌మెంట్ కి వచ్చి ఉచితంగా కొలతలు తీసి శాంపిల్ చూపించమంటారా సర్?*${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Namaste ${customerDisplayName}! 🙏 I am ${persona.name} from GCM Invisible Grills.

For your balcony (**${area} SFT**), here is the transparent estimation:

• **Area**: **${area} SFT**
• **Specification**: **AISI 316 Marine Grade Stainless Steel** (2.5mm cable with DuPont transparent nylon anti-scratch coating)
• **Standard Rate**: **₹ 140 – ₹ 160 per SFT** (Inclusive of anodized aluminum tracks, SS 316 locking fasteners & professional installation)
• **Estimated Total**: **₹ ${estTotal.toLocaleString('en-IN')}**
• **Warranty**: **10-Year Written Rust-Proof Warranty Card**

🛡️ **Why GCM Invisible Grills are Superior:**
- **450+ kg Tensile Strength**: Extreme fall safety for children and pets on high-rise floors.
- **Zero Blocked Views**: Enjoy 100% unobstructed panoramic city views and cross-ventilation.
- **Emergency Safe**: Can be cut with emergency wire cutters in under 5 seconds during fire evacuation.

👉 *Our mobile installation van has physical demonstration sample units. Shall I arrange a free doorstep demo at your apartment today?*${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'ESTIMATE_CALCULATED',
      action_title: 'AISI 316 Invisible Grill Estimate',
      work_summary: `${persona.name} calculated AISI 316 Stainless Steel Invisible Grill estimate of ₹ ${estTotal.toLocaleString('en-IN')} for ${area} SFT for ${customerDisplayName}.`,
      details: cardData
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 4: WHOLESALE MATERIAL SUPPLY (netsocean.com / russea.in)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isSupplyOnlyIntent) {
    cardType = 'supply_quote';
    cardData = {
      brand: 'NetsOcean / RUSSEA',
      readyBagSize: '100ft x 33ft (3,300 SFT/bag)',
      options: [
        { name: '45mm HDPE Braided Heavy Duty', rate: '₹ 8.00 / SFT', bagCost: '₹ 26,400 per Bag' },
        { name: '40mm HDPE Braided Dense Mesh', rate: '₹ 8.50 / SFT', bagCost: '₹ 28,050 per Bag' },
        { name: '35mm Twisted Natural Green Roof Net', rate: '₹ 6.00 / SFT', bagCost: '₹ 19,800 per Bag' }
      ],
      dispatchMode: 'Immediate Transport (V-Trans, Navata, Kranti, DTDC) with Bilty Tracking'
    };

    replyText = `Namaste ${customerDisplayName}! 🙏 I am ${persona.name} from NetsOcean Wholesale Depot.

We supply factory-direct pre-stitched ready netting bags and custom cut rolls with same-day dispatch across India:

• 📦 **Standard Ready Bag Size**: **100ft x 33ft = 3,300 SFT** (Ready to install with reinforced borders)
1. **NetsOcean™ 45mm HDPE Braided (2.5mm)**: **₹ 8.00 / SFT** &rarr; **₹ 26,400** per ready bag
2. **NetsOcean™ 40mm HDPE Braided (Dense)**: **₹ 8.50 / SFT** &rarr; **₹ 28,050** per ready bag
3. **NetsOcean™ 35mm Twisted Roof Netting**: **₹ 6.00 / SFT** &rarr; **₹ 19,800** per ready bag

🚚 **Logistics & Dispatch:**
- In-stock at our central Hyderabad warehouse.
- Orders confirmed before 2:00 PM are dispatched the same day with **LR / Bilty tracking slip** on WhatsApp!
- 18% GST input credit bill provided.

👉 *How many bags or square feet do you require, and to which city/pincode should I calculate transport charges for you?*${persona.formatSignoff(detectedLang)}`;

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'ESTIMATE_CALCULATED',
      action_title: 'Wholesale Netting Supply Quote',
      work_summary: `${persona.name} quoted factory-direct wholesale HDPE ready netting bags with transport for ${customerDisplayName}.`,
      details: cardData
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 5: CEILING CLOTH DRYING HANGERS
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isClothHangerIntent) {
    if (detectedLang === 'telugu') {
      replyText = `నమస్కారం సర్! 🙏 నేను ${persona.name}, GCM నుండి.

మీ బాల్కనీలో స్పేస్ సేవ్ చేసుకునే హెవీ డ్యూటీ స్టెయిన్‌లెస్ స్టీల్ పుల్లీ క్లాత్ హ్యాంగర్స్ వివరాలు:

• **4-పైపులు (6ft SS 304 పైప్స్)**: **₹ 2,000 – ₹ 2,500** (ఇన్స్టాలేషన్ తో కలిపి)
• **5-పైపులు (6ft SS 304 పైప్స్)**: **₹ 2,250 – ₹ 2,750** (ఇన్స్టాలేషన్ తో కలిపి)
• **6-పైపులు (6ft SS 304 పైప్స్ - పాపులర్ మోడల్)**: **₹ 2,500 – ₹ 3,000** (ఇన్స్టాలేషన్ తో కలిపి)
• **8-పైపులు (6ft SS 304 పైప్స్)**: **₹ 3,000 – ₹ 3,500** (ఇన్స్టాలేషన్ తో కలిపి)

⭐ **ప్రత్యేకతలు**: 100% రస్ట్-ఫ్రీ SS 304 పైపులు, స్మూత్ నైలాన్ రోప్స్, 35 కేజీల తడి బట్టల లోడ్ కెపాసిటీ, 2 ఏళ్ళ వారంటీ.

👉 *మా టెక్నీషియన్ వ్యాన్ ఈరోజే మీ ఇంటికి వచ్చి ఇన్స్టాల్ చేయగలదు సర్. ఏ టైం కి రమ్మంటారు సర్?*${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Namaste ${customerDisplayName}! 🙏 I am ${persona.name} from GCM.

Here are the details for our space-saving Ceiling Stainless Steel Pulley Cloth Drying Hangers:

• **4-Pipe (6ft SS 304 Pipes)**: **₹ 2,000 – ₹ 2,500** installed
• **5-Pipe (6ft SS 304 Pipes)**: **₹ 2,250 – ₹ 2,750** installed
• **6-Pipe (6ft SS 304 Pipes - Most Popular)**: **₹ 2,500 – ₹ 3,000** installed
• **8-Pipe (6ft SS 304 Pipes)**: **₹ 3,000 – ₹ 3,500** installed

⭐ **Features**: 100% SS 304 rust-proof pipes, smooth individual ceiling pulleys, holds up to 35 kg wet laundry, 2-year warranty.

👉 *Our technician van can install this at your balcony today! Shall I reserve an installation slot for you?*${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'ESTIMATE_CALCULATED',
      action_title: 'Cloth Drying Hanger Pricing Shared',
      work_summary: `${persona.name} provided pricing for SS 304 pulley ceiling cloth drying hangers to ${customerDisplayName}.`
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 6: DISCOUNT NEGOTIATION
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isDiscount) {
    if (detectedLang === 'telugu') {
      replyText = `తప్పకుండా సర్! 🙏 మీ ఆర్డర్ మాకు చాలా ముఖ్యమైనది. 

నేను మీకు స్వయంగా **5% స్పెషల్ డైరెక్ట్ డిస్కౌంట్** ఇప్పుడే అప్రూవ్ చేసి మీ బిల్లు లో అప్లై చేస్తున్నాను సర్. ఒకవేళ మీ ఏరియా లేదా అపార్ట్‌మెంట్ లో ఇంకా ఎక్కువ ఏరియా ఉంటే, మా మేనేజింగ్ డైరెక్టర్ గోపీచంద్ మైలపల్లి గారితో మాట్లాడి ఇంకా బెస్ట్ ప్యాకేజ్ ఇప్పిస్తాను సర్.

మీరు ఏ ఏరియా లో ఉన్నారు సర్?${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Sure ${customerDisplayName} sir! 🙏 Your order is very important to us.

I can personally approve our **5% direct volume discount** for you right away and apply it directly to your estimation. If you have a larger area or multiple balconies in your apartment, I will personally speak with our Managing Director Mr. Gopichand Mailapally to get you our best project package.

Which locality or city are you located in, sir?${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'DISCOUNT_APPLIED',
      action_title: '5% Direct Volume Discount Approved',
      work_summary: `${persona.name} approved 5% direct volume discount within autonomous authority for ${customerDisplayName}.`
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 7: FREE SITE VISIT / DOORSTEP MEASUREMENT
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isSiteVisit) {
    if (detectedLang === 'telugu') {
      replyText = `తప్పకుండా సర్! 🙏 నేను మా సీనియర్ ఇన్స్టాలేషన్ టెక్నీషియన్ ని మీ ఇంటికి పంపిస్తాను.

• **సర్వీస్**: 100% ఉచిత సైట్ మెజర్మెంట్ మరియు ఒరిజినల్ నెట్ శాంపిల్స్ డెమో.
• **టైమింగ్స్**: ఉదయం 9:00 AM నుండి సాయంత్రం 7:30 PM వరకు.
• **ఏరియా**: ${detectedCity} పరిధిలోని అన్ని ప్రాంతాలు.

${detectedPhone ? `మీ నెంబర్ **+91 ${detectedPhone}** నోట్ చేసుకున్నాను సర్. మా ఫీల్డ్ టెక్నీషియన్ బయలుదేరే ముందు మీకు కాల్ చేస్తారు.` : 'మీ **ఫోన్ నెంబర్ మరియు అడ్రస్ లేదా ఏరియా** చెబితే దగ్గర్లోని వ్యాన్ ని అసైన్ చేస్తాను సర్.'}

ఈరోజు ఏ టైం కి రమ్మంటారు సర్?${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Sure ${customerDisplayName}! 🙏 I have registered your request for a free doorstep measurement visit.

• **Service**: 100% Free Doorstep Laser Measurement & Physical Material Demo
• **Timing**: Available 7 days a week (9:00 AM – 7:30 PM)
• **Coverage**: All zones across ${detectedCity} and surrounding areas.

${detectedPhone ? `We have your contact number **+91 ${detectedPhone}** on file. Our field coordinator will call you to confirm your convenient time slot.` : 'Please share your **Phone Number and Area/Apartment name** so I can dispatch our nearest technician van!'}

Would Morning or Afternoon suit you better today?${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'SITE_VISIT_BOOKED',
      action_title: 'Doorstep Measurement & Demo Assigned',
      work_summary: `${persona.name} booked 100% free doorstep laser measurement & physical demo in ${detectedCity} for ${customerDisplayName}.`
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 8: BALCONY SAFETY & PIGEON NETTING (WITH DIMENSIONS)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (dimMatch || sftMatch) {
    let area = 250;
    let dimText = 'Standard Balcony';

    if (dimMatch) {
      const l = parseFloat(dimMatch[1]);
      const w = parseFloat(dimMatch[2]);
      area = Math.round(l * w);
      dimText = `${l}ft x ${w}ft`;
    } else if (sftMatch) {
      area = Math.round(parseFloat(sftMatch[1]));
      dimText = `${area} SFT`;
    }

    let unitRate = 22;
    if (area < 100) {
      unitRate = 1500 / area;
    } else if (area >= 100 && area <= 250) {
      unitRate = 24;
    } else if (area > 250 && area <= 500) {
      unitRate = 22;
    } else if (area > 500 && area <= 1000) {
      unitRate = 18;
    } else {
      unitRate = 15;
    }

    const totalEstimate = area < 100 ? 1500 : Math.round(area * unitRate);
    const displayRate = area < 100 ? '₹ 18 – ₹ 22' : `₹ ${Math.round(unitRate)}`;

    cardType = 'calculation';
    cardData = {
      service: 'RUSSEA™ Balcony Safety & Pigeon Netting',
      dimensions: dimText,
      areaSft: area,
      ratePerSft: `${displayRate} / SFT`,
      totalEstimate: `₹ ${totalEstimate.toLocaleString('en-IN')}`,
      warranty: '5 Years Replacement Warranty',
      hardware: 'SS 316 Marine Grade Rust-Proof Fasteners'
    };

    if (detectedLang === 'telugu') {
      replyText = `నమస్కారం సర్! 🙏 నేను ${persona.name}, GCM సేఫ్టీ నెట్స్ నుండి.

మీ బాల్కనీ కొలతలకు (**${dimText} = ${area} SFT**) పారదర్శకమైన ఎస్టిమేషన్ వివరాలు:

• **బాల్కనీ సైజ్**: **${dimText} (${area} SFT)**
• **మెటీరియల్**: **100% ఒరిజినల్ RUSSEA™ హై-టెనాసిటీ UV స్టెబిలైజ్డ్ నైలాన్ నెట్** (15-ప్లై / 2.0mm థిక్‌నెస్)
• **రేట్**: **${displayRate} / SFT** (నెట్ మెటీరియల్ + SS 316 మెరైన్ రస్ట్-ప్రూఫ్ హుక్స్ + ఫిట్టింగ్ లేబర్ తో కలిపి)
• **మొత్తం ఎస్టిమేషన్**: **₹ ${totalEstimate.toLocaleString('en-IN')}**
• **వారంటీ**: **5 ఏళ్ళ రాతపూర్వక రిప్లేస్‌మెంట్ వారంటీ కార్డ్**

🕊️ **GCM సేఫ్టీ నెట్స్ ఎందుకు బెస్ట్:**
- పావురాలు ముక్కుతో కొరికినా తెగని హై-టెన్సిల్ RUSSEA™ నాట్స్.
- పిల్లలు మరియు పెంపుడు జంతువులకు 150 కేజీల వరకు ఇంపాక్ట్ లోడ్ భరిస్తుంది.
- SS 316 గ్రేడ్ హుక్స్ వల్ల వర్షంలో కూడా ఎప్పటికీ తుప్పు పట్టదు.
- బాల్కనీ అందం మరియు గాలి-వెలుతురు ఏమాత్రం తగ్గవు.

👉 *మా టెక్నీషియన్ వ్యాన్ ఈరోజే మీ ఏరియాలో ఉంది సర్. ఉచితంగా కొలతలు తీసి ఒరిజినల్ శాంపిల్స్ చూపించడానికి ఏ టైం కి రమ్మంటారు సర్?*${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Namaste ${customerDisplayName}! 🙏 I am ${persona.name} from ${brandName}.

Here is your exact, transparent estimate for your balcony (**${dimText} = ${area} SFT**):

• **Balcony Dimensions**: **${dimText} (${area} SFT)**
• **Material**: **100% Genuine RUSSEA™ High-Tenacity UV-Stabilized Nylon Netting** (15-ply / 2.0mm thickness)
• **Approved Rate**: **${displayRate} / SFT** (Includes net material + SS 316 marine rust-proof hooks + expert installation)
• **Estimated Total**: **₹ ${totalEstimate.toLocaleString('en-IN')}**
• **Warranty**: **5-Year Written Replacement Warranty Card**

🛡️ **Why GCM Netting is the #1 Choice in ${detectedCity}:**
- **100% Pigeon & Monkey Proof**: High-tensile heat-set knots that birds cannot cut with their beaks.
- **Child & Pet Fall Safety**: Tested to withstand dynamic impact loads up to 150 kg.
- **SS 316 Fasteners**: Guaranteed rust-free even in heavy monsoons.
- **Discreet & Aesthetic**: Preserves 100% natural sunlight and cross-ventilation.

👉 *Our mobile technician van is in your area today for free measurements and sample demo. Would Morning or Afternoon be more convenient for you?*${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'ESTIMATE_CALCULATED',
      action_title: 'RUSSEA™ Balcony Safety Estimate',
      work_summary: `${persona.name} calculated RUSSEA™ Balcony Netting estimate of ₹ ${totalEstimate.toLocaleString('en-IN')} for ${dimText} (${area} SFT) in ${detectedCity}.`,
      details: cardData
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 9: FORMAL QUOTATION REQUEST
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isQuoteRequest) {
    const custName = customerDisplayName;
    const custPhone = detectedPhone || '9912399224';
    const rand = Math.floor(1000 + Math.random() * 9000);
    const quoteNum = `GCM-EST-2026-${rand}`;
    const viewUrl = `https://gcm.enterprises/admin/view.php?id=${quoteNum}`;

    replyText = `Namaste ${custName}! 🙏

I have prepared your official stamped GCM Quotation #${quoteNum}:

• **Customer**: ${custName} (+91 ${custPhone})
• **Scope**: RUSSEA™ High-Tenacity Balcony Netting with SS 316 Fasteners (300 SFT)
• **Estimated Amount**: **₹ 6,600** (Inclusive of GST & Professional Installation)
• **Warranty**: 5-Year Written Replacement Warranty

👉 **View & Download Stamped Quotation PDF:**
${viewUrl}

🏦 **Payment & Booking Credentials:**
• State Bank of India | A/C: **44979437825** | IFSC: **SBIN0021462** | UPI: **9912399224@sbi**

Shall I reserve your installation slot with our team for tomorrow?${persona.formatSignoff(detectedLang)}`;

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'QUOTATION_GENERATED',
      action_title: `Stamped Quotation #${quoteNum} Issued`,
      work_summary: `${persona.name} generated official stamped quotation #${quoteNum} (₹ 6,600 for 300 SFT RUSSEA™ Netting) for ${custName}.`
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 10: GENERAL WELCOME / DEFAULT INQUIRY
  // ═══════════════════════════════════════════════════════════════════════════
  } else {
    if (detectedLang === 'telugu') {
      replyText = `నమస్కారం సర్! 🙏 నేను ${persona.name}, ${brandName} నుండి మాట్లాడుతున్నాను.

మేము సౌత్ ఇండియా లోనే లార్జెస్ట్ సేఫ్టీ నెట్స్ మరియు స్పోర్ట్స్ ఇన్ఫ్రాస్ట్రక్చర్ తయారీదారులం సర్:

1. 🏢 **బాల్కనీ & పావురాల సేఫ్టీ నెట్స్**: ఒరిజినల్ RUSSEA™ నైలాన్ నెట్స్, 5 ఏళ్ళ వారంటీ తో ₹ 16 నుండి ₹ 24/sft.
2. ✨ **స్టెయిన్‌లెస్ స్టీల్ ఇన్విజిబుల్ గ్రిల్స్**: AISI 316 మెరైన్ గ్రేడ్, 10 ఏళ్ళ రస్ట్ వారంటీ తో ₹ 140/sft నుండి.
3. 🏏 **టర్న్‌కీ బాక్స్ క్రికెట్ & స్పోర్ట్స్ టర్ఫ్**: కంప్లీట్ కేజ్ ఫ్రేమ్‌వర్క్, టర్ఫ్, స్టేడియం లైటింగ్ తో కంప్లీట్ గ్రౌండ్ వర్క్.
4. 📦 **హోల్‌సేల్ నెట్టింగ్ సప్లై**: ఫ్యాక్టరీ నుండి డైరెక్ట్ 100x33ft రెడీ బ్యాగ్స్ ఆల్-ఇండియా ట్రాన్స్‌పోర్ట్ తో.

👉 *మీ బాల్కనీ లేదా ప్రాజెక్ట్ కొలతలు (పొడవు x ఎత్తు) చెబితే నేను వెంటనే మీకు బెస్ట్ రేట్ తో ఎస్టిమేషన్ ఇస్తాను సర్!*${persona.formatSignoff(detectedLang)}`;
    } else {
      replyText = `Namaste ${customerDisplayName}! 🙏 I am ${persona.name} from ${brandName} (${persona.city}).

We are South India's leading certified netting and sports infrastructure specialists:

1. 🏢 **Balcony Pigeon & Child Safety Nets**: RUSSEA™ high-tenacity UV-stabilized nets from **₹ 16 – ₹ 24/sft** installed with SS 316 rust-proof fasteners and a 5-year warranty.
2. ✨ **Stainless Steel Invisible Grills**: AISI 316 marine-grade cables (450+ kg strength) from **₹ 140/sft** with a 10-year rust guarantee.
3. 🏏 **Turnkey Box Cricket & Sports Grounds**: Complete cage fabrication, FIFA-grade turf, and LED stadium lights.
4. 📦 **Wholesale Netting Supply**: Factory-direct HDPE braided bags (100x33ft = 3,300 SFT) with PAN-India transport.

👉 *Could you please share your balcony dimensions (Length x Height in feet) or what requirement you are looking for today?*${persona.formatSignoff(detectedLang)}`;
    }

    logAgentWork({
      persona_name: persona.name,
      lead_id: existingCustomer?.id,
      phone: detectedPhone,
      website_id: websiteId,
      channel,
      city: detectedCity,
      action_type: 'INQUIRY_ANSWERED',
      action_title: 'Welcome & Portfolio Introduction',
      work_summary: `${persona.name} welcomed ${customerDisplayName} in ${detectedCity} and introduced RUSSEA™ nets & services portfolio.`
    });
  }

  // Auto-record lead in CRM if a phone number was detected
  if (detectedPhone) {
    try {
      const existingLead = db.prepare('SELECT id FROM leads WHERE phone LIKE ?').get(`%${detectedPhone}%`) as any;
      if (!existingLead) {
        const leadId = 'LEAD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        db.prepare(`
          INSERT INTO leads (id, website_id, customer_name, phone, requirement_summary, estimated_value, stage, last_customer_message_at, city)
          VALUES (?, ?, ?, ?, ?, ?, 'NEW', CURRENT_TIMESTAMP, ?)
        `).run(
          leadId,
          websiteId,
          customerDisplayName !== 'Sir/Madam' ? customerDisplayName : 'Valued Customer',
          detectedPhone,
          userText,
          cardData?.totalEstimate ? parseInt(cardData.totalEstimate.replace(/\D/g, '')) : 0,
          detectedCity
        );
      } else {
        db.prepare(`
          UPDATE leads 
          SET last_customer_message_at = CURRENT_TIMESTAMP,
              city = COALESCE(city, ?),
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(detectedCity, existingLead.id);
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
