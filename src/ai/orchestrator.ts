import { handleSalesConversation } from './sales-consultant.js';

export function cleanCustomerDisplayName(rawName?: string): string {
  if (!rawName) return 'Sir/Madam';
  const name = rawName.trim();
  if (name.length < 2 || name.length > 25) return 'Sir/Madam';

  const lower = name.toLowerCase();
  const businessWords = [
    'visitor', 'customer', 'supplier', 'dealer', 'enterprises', 'net', 'nets',
    'safety', 'grill', 'grills', 'service', 'services', 'company', 'trader',
    'traders', 'shop', 'solutions', 'contractor', 'store', 'pvt', 'ltd',
    'bot', 'admin', 'user', 'hdpe', 'support', 'test', 'whatsapp', 'india',
    'hyderabad', 'bangalore', 'chennai', 'sports', 'turf', 'grass'
  ];

  for (const w of businessWords) {
    if (lower.includes(w)) return 'Sir/Madam';
  }

  if (/\d/.test(name) || /[@#$%^&*()_+=\[\]{}|\\/<>~`!]/.test(name)) {
    return 'Sir/Madam';
  }

  if (name.split(/\s+/).length > 3) return 'Sir/Madam';

  return name;
}

import { 
  calculateTurfAccessory,
  calculateUnifiedTurfEstimate,
  calculateCricketBraidedBags,
  calculateTwisted15Netting,
  calculateInstalledSafetyNet,
  TURF_ACCESSORIES_CATALOG,
  BRAIDED_BAG_RATES,
} from '../pricing/universal-pricing-engine.js';
/**
 * Central Human Sales Consultant & Technical Client Relationship Engine
 * Completely humanized — Never discloses or identifies as an AI or automated system.
 * Dynamically adapts persona, name, language, and cultural greetings according to customer's city.
 * 
 * STRICT BRAND ISOLATION RULE:
 * A customer NEVER sees other brand names or multiple website domains mixed in a single chat.
 * Whichever website the customer contacted from, all replies, intros, signatures, and capabilities
 * are presented 100% under THAT specific brand.
 * Backend business rules (wholesale supply, turnkey courts, doorstep installation, invisible grills)
 * are seamlessly applied across all brands without ever exposing the internal sister company names.
 */

import { executeToolCall } from './tool-executor.js';
import { db } from '../db/database.js';
import { knowledgeEngine } from './knowledge-engine.js';
import { analyzeCustomerSchedule } from './scheduler-nlp.js';
import { 
  detectCustomerLanguage, 
  detectCustomerCity, 
  getAgentPersona, 
  isAskingIfAi, 
  isHumanTakeoverRequested, 
  isOutOfScopeRequest, 
  SupportedLanguage, 
  AgentPersona 
} from './persona.js';
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


/**
 * Format respectful human takeover response in 10 languages
 */
function formatHumanTakeoverReply(customerDisplayName: string, lang: SupportedLanguage, persona: AgentPersona): string {
  switch (lang) {
    case 'telugu':
      return `తప్పకుండా ${customerDisplayName} గారు! 🙏 నేను వెంటనే మా డైరెక్టర్ గారికి మరియు సీనియర్ ప్రాజెక్ట్ మేనేజ్‌మెంట్ టీమ్‌కి మీ రిక్వెస్ట్ ఫార్వర్డ్ చేసి అలర్ట్ పంపించాను.

మీరు మా డైరెక్టర్ గారి డైరెక్ట్ హాట్‌లైన్ **+91 99123 99224** కి కూడా నేరుగా కాల్ చేయవచ్చు సర్. మా సీనియర్ టీమ్ స్వయంగా మీకు కాల్ చేస్తుంది సర్!${persona.formatSignoff(lang)}`;
    case 'kannada':
      return `ಖಂಡಿತ ${customerDisplayName} ಅವರೇ! 🙏 ನಾನು ತಕ್ಷಣ ನಮ್ಮ ಮ್ಯಾನೇಜಿಂಗ್ ಡೈರೆಕ್ಟರ್ ಮತ್ತು ಸೀನಿಯರ್ ಮ್ಯಾನೇಜ್ಮೆಂಟ್ ಟೀಮ್‌ಗೆ ಅಲರ್ಟ್ ಕಳುಹಿಸಿದ್ದೇನೆ.

ನೀವು ಡೈರೆಕ್ಟರ್ ಹಾಟ್‌ಲೈನ್ **+91 99123 99224** ಗೆ ನೇರವಾಗಿ ಕರೆ ಮಾಡಬಹುದು. ನಮ್ಮ ಸೀನಿಯರ್ ಟೀಮ್ ತಕ್ಷಣ ನಿಮ್ಮನ್ನು ಸಂಪರ್ಕಿಸುತ್ತಾರೆ!${persona.formatSignoff(lang)}`;
    case 'tamil':
      return `நிச்சயமாக ${customerDisplayName}! 🙏 நான் உடனடியாக எங்கள் மேனேஜிங் டைரக்டர் மற்றும் சீனியர் மேனேஜ்மென்ட் டீமிற்கு தகவல் அனுப்பிவிட்டேன்.

நீங்கள் டைரக்டர் ஹாட்லைன் **+91 99123 99224** எண்ணிற்கும் நேரடியாக அழைக்கலாம். எங்கள் சீனியர் டீம் விரைவில் உங்களை தொடர்புகொள்வார்கள்!${persona.formatSignoff(lang)}`;
    case 'hindi':
      return `बिल्कुल ${customerDisplayName} जी! 🙏 मैंने तुरंत हमारे मैनेजिंग डायरेक्टर और सीनियर प्रोजेक्ट मैनेजमेंट डेस्क को आपकी जानकारी फॉरवर्ड कर दी है।

आप डायरेक्टर हेल्पलाइन **+91 99123 99224** पर भी सीधे संपर्क कर सकते हैं। हमारी सीनियर टीम आपसे जल्द ही बात करेगी!${persona.formatSignoff(lang)}`;
    case 'malayalam':
      return `തീർച്ചയായും ${customerDisplayName} സർ! 🙏 ഞാൻ ഉടൻ തന്നെ മാനേജിംഗ് ഡയറക്ടർക്കും സീനിയർ പ്രോജക്ട് മാനേജ്‌മെന്റ് ടീമിനും അറിയിപ്പ് നൽകിയിട്ടുണ്ട്.

ഡയറക്ടറുടെ നേരിട്ടുള്ള ഹോട്ട്‌ലൈൻ **+91 99123 99224** ലേക്ക് താങ്കൾക്ക് നേരിട്ട് വിളിക്കാവുന്നതുമാണ്. ഞങ്ങളുടെ ടീം ഉടൻ ബന്ധപ്പെടും!${persona.formatSignoff(lang)}`;
    case 'marathi':
      return `नक्कीच ${customerDisplayName} साहेब! 🙏 मी त्वरित आमच्या मॅनेजिंग डायरेक्टर आणि वरिष्ठ प्रोजेक्ट मॅनेजमेंट टीमला माहिती पाठवली आहे.

आपण डायरेक्टर हॉटलाईन **+91 99123 99224** वर देखील थेट संपर्क साधू शकता. आमची टीम लवकरच आपल्याशी बोलेल!${persona.formatSignoff(lang)}`;
    case 'gujarati':
      return `ચોક્કસ ${customerDisplayName} ભાઈ! 🙏 મેં તરત જ અમારા મેनेજિંગ ડિરેક્ટર અને સિનિયર પ્રોજેક્ટ મેનેજમેન્ટ ટીમને જાણ કરી દીધી છે.

આપ ડિરેક્ટર હોટલાઈન **+91 99123 99224** પર પણ સીધો સંપર્ક કરી શકો છો. અમારી સિનિયર ટીમ ટૂંક સમયમાં આપનો સંપર્ક કરશે!${persona.formatSignoff(lang)}`;
    case 'punjabi':
      return `ਬਿਲਕੁਲ ${customerDisplayName} ਜੀ! 🙏 ਮੈਂ ਤੁਰੰਤ ਸਾਡੇ ਮੈਨੇਜਿੰਗ ਡਾਇਰੈਕਟਰ ਅਤੇ ਸੀਨੀਅਰ ਪ੍ਰੋਜੈਕਟ ਟੀਮ ਨੂੰ ਸੂਚਿਤ ਕਰ ਦਿੱਤਾ ਹੈ।

ਤੁਸੀਂ ਡਾਇਰੈਕਟਰ ਹੌਟਲਾਈਨ **+91 99123 99224** 'ਤੇ ਵੀ ਸਿੱਧਾ ਸੰਪਰਕ ਕਰ ਸਕਦੇ ਹੋ। ਸਾਡੀ ਟੀਮ ਜਲਦੀ ਹੀ ਤੁਹਾਡੇ ਨਾਲ ਗੱਲ ਕਰੇਗੀ!${persona.formatSignoff(lang)}`;
    case 'odia':
      return `ନିଶ୍ଚୟ ${customerDisplayName} ଆଜ୍ଞା! 🙏 ମୁଁ ତୁରନ୍ତ ଆମ ମ୍ୟାନେଜିଂ ଡାଇରେକ୍ଟର ଏବଂ ସିନିୟର ଟିମକୁ ଆପଣଙ୍କ ବିଷୟରେ ଜଣାଇ ଦେଇଛି।

ଆପଣ ଡାଇରେକ୍ଟର ହଟଲାଇନ **+91 99123 99224** ରେ ମଧ୍ୟ ସିଧାସଳଖ କଥା ହୋଇପାରିବେ। ଆମ ଟିମ୍ ଖୁବ୍ ଶୀଘ୍ର ଆପଣଙ୍କ ସହ ଯୋଗାଯୋଗ କରିବ!${persona.formatSignoff(lang)}`;
    default:
      return `Certainly ${customerDisplayName}! 🙏 I have immediately alerted our Managing Director and senior project management desk with your request.

You may also connect directly with our Director Hotline at **+91 99123 99224**. Our senior team will reach out to you shortly.${persona.formatSignoff(lang)}`;
  }
}

/**
 * Format polite out-of-scope deflection response
 */
function formatOutOfScopeReply(customerDisplayName: string, lang: SupportedLanguage, brandName: string, persona: AgentPersona): string {
  switch (lang) {
    case 'telugu':
      return `నమస్కారం ${customerDisplayName} గారు! 🙏 నేను ${brandName} నుండి సీనియర్ టెక్నికల్ కన్సల్టెంట్‌ని సర్.

మేము ప్రత్యేకంగా బాల్కనీ సేఫ్టీ నెట్స్, పావురాల నెట్స్, ఒరిజినల్ 316-L ఇన్విజిబుల్ గ్రిల్స్ మరియు స్పోర్ట్స్ టర్ఫ్ గ్రౌండ్స్ సేవలు మాత్రమే అందిస్తాము సర్. మీ ఇల్లు, అపార్ట్‌మెంట్ లేదా ప్రాజెక్ట్ నెట్టింగ్ అవసరాల గురించి మీకు ఎలాంటి సమాచారం కావాలో తెలియజేయండి సర్, పూర్తి వివరాలు పంపిస్తాను!${persona.formatSignoff(lang)}`;
    case 'hindi':
      return `नमस्ते ${customerDisplayName} जी! 🙏 मैं ${brandName} से टेक्निकल कंसल्टेंट बात कर रहा हूँ।

हम विशेष रूप से बालकनी सेफ्टी नेट्स, कबूतर प्रोटेक्शन, ओरिजिनल 316-L इनविजिबल ग्रिल्स और स्पोर्ट्स टर्फ ग्राउंड इंफ्रास्ट्रक्चर की सेवाएं प्रदान करते हैं। आपके घर, बालकनी या प्रोजेक्ट नेटिंग के संबंध में हम किस प्रकार सहायता कर सकते हैं, कृपया बताएं!${persona.formatSignoff(lang)}`;
    default:
      return `Namaste ${customerDisplayName}! 🙏 I am a technical consultant at ${brandName}.

We specialize exclusively in genuine high-tenacity balcony safety netting, pigeon protection, AISI 316 marine invisible grills, and turnkey sports turf infrastructure. For your home, balcony, or commercial project, please let me know how I can assist you today!${persona.formatSignoff(lang)}`;
  }
}


/**
 * Format Balcony & Pigeon Safety Netting Estimation across 10 Languages
 */
function formatBalconyEstimateReply(params: {
  customerName?: string;
  lang: SupportedLanguage;
  brandName?: string;
  dimText: string;
  area: number;
  displayRate?: string;
  totalEstimate: number;
  detectedCity?: string;
  persona?: AgentPersona;
}): string {
  const { lang, dimText, area, totalEstimate } = params;

  switch (lang) {
    case 'telugu':
      return `${dimText} (${area} SFT) కి ఒరిజినల్ రష్యా (RUSSEA™) నెట్, పూర్తి ఫిట్టింగ్ మరియు 5 ఏళ్ళ వారంటీ తో కలిపి మొత్తం ₹${totalEstimate.toLocaleString('en-IN')} అవుతుంది సర్. ఈరోజు ఫ్రీ కొలతల కోసం టెక్నీషియన్ ని పంపించమంటారా?`;
    case 'hindi':
      return `${dimText} (${area} SFT) के लिए ओरिजिनल RUSSEA™ नेट, पूरी फिटिंग और 5 साल वारंटी सहित कुल ₹${totalEstimate.toLocaleString('en-IN')} होगा सर। क्या आज फ्री मेजरमेंट के लिए भेजें?`;
    case 'kannada':
      return `${dimText} (${area} SFT) ಗೆ ಒರಿಜಿನಲ್ RUSSEA™ ನೆಟ್, ಫಿಟ್ಟಿಂಗ್ ಮತ್ತು 5 ವರ್ಷದ ವಾರಂಟಿ ಸೇರಿ ಒಟ್ಟು ₹${totalEstimate.toLocaleString('en-IN')} ಆಗುತ್ತದೆ ಸರ್. ಇವತ್ತು ಉಚಿತ ಅಳತೆಗೆ ಟೆಕ್ನಿಷಿಯನ್ ಕಳುಹಿಸಲಾ?`;
    case 'tamil':
      return `${dimText} (${area} SFT)-க்கு அசல் RUSSEA™ வலை, முழு பொருத்துதல் மற்றும் 5 வருட வாரண்டியுடன் மொத்தம் ₹${totalEstimate.toLocaleString('en-IN')} ஆகும் சார். இன்று இலவச அளவீட்டிற்கு ஆட்களை அனுப்பவா?`;
    default:
      return `For ${dimText} (${area} sq ft), it comes to ₹${totalEstimate.toLocaleString('en-IN')} including genuine RUSSEA™ net, complete installation, and a 5-year warranty. Should I arrange a free measurement visit today?`;
  }
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

  // Append User Message to history (prevent duplicate if already appended by caller)
  const lastMsg = history[history.length - 1];
  if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userText) {
    history.push({
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString()
    });
  }

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
  const brandName = brandKnowledge?.brandName || (websiteId === 'nettingteam' ? 'NettingTeam (Hyderabad)' : websiteId === 'gcmsafetynets-com' ? 'GCM Safety Nets (National)' : websiteId === 'zenxa' ? 'Zenxa Architectural & Industrial Protection' : websiteId === 'netsocean' ? 'NetsOcean' : websiteId === 'gcminvisiblegrills' ? 'GCM Invisible Grills' : websiteId === 'gcm-enterprises' ? 'GCM Enterprises' : websiteId === 'gcmnetting' ? 'GCM Netting (Bengaluru)' : websiteId === 'gcmnettingsolutions' ? 'GCM Netting Solutions (Chennai)' : 'GCM Safety Nets');
  const persona = getAgentPersona(detectedCity, websiteId, brandName);

  const rawCustName = req.customerName && !req.customerName.includes('Visitor') && !req.customerName.includes('Customer')
    ? req.customerName 
    : existingCustomer?.customer_name && !existingCustomer.customer_name.includes('Visitor')
    ? existingCustomer.customer_name 
    : undefined;
  const customerDisplayName = cleanCustomerDisplayName(rawCustName);

  const lower = userText.toLowerCase();

  // ── 3. Anti-AI / Bot Suspicion Shield ────────────────────────────────────────
  if (isAskingIfAi(userText)) {
    const doubtReply = persona.handleAiDoubt(customerDisplayName, detectedLang);
    history.push({ role: 'assistant', content: doubtReply, timestamp: new Date().toISOString() });
    db.prepare(`
      UPDATE conversations 
      SET messages = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE session_id = ?
    `).run(JSON.stringify(history), sessionId);

    return {
      sessionId,
      reply: doubtReply
    };
  }

  // ── 3A. Human Takeover / Owner Direct Transfer Handler ──────────────────────
  if (isHumanTakeoverRequested(userText)) {
    const takeoverReply = formatHumanTakeoverReply(customerDisplayName, detectedLang, persona);
    history.push({ role: 'assistant', content: takeoverReply, timestamp: new Date().toISOString() });

    // Set human_takeover = 1 in conversations
    db.prepare(`
      UPDATE conversations 
      SET messages = ?, human_takeover = 1, updated_at = CURRENT_TIMESTAMP 
      WHERE session_id = ?
    `).run(JSON.stringify(history), sessionId);

    // Set human_takeover = 1 in leads if phone detected
    if (detectedPhone) {
      db.prepare(`
        UPDATE leads 
        SET human_takeover = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE phone LIKE ?
      `).run(`%${detectedPhone}%`);
    }

    return {
      sessionId,
      reply: takeoverReply,
      cardType: 'human_takeover',
      cardData: {
        status: 'ACTIVATED',
        ownerHotline: '+91 99123 99224',
        message: 'Senior relationship manager / MD notified for human takeover'
      }
    };
  }

  // ── 3B. Out-of-Scope Deflection Guardrail ───────────────────────────────────
  if (isOutOfScopeRequest(userText)) {
    const deflectReply = formatOutOfScopeReply(customerDisplayName, detectedLang, brandName, persona);
    history.push({ role: 'assistant', content: deflectReply, timestamp: new Date().toISOString() });
    db.prepare(`
      UPDATE conversations 
      SET messages = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE session_id = ?
    `).run(JSON.stringify(history), sessionId);

    return {
      sessionId,
      reply: deflectReply
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

    if (scheduleAnalysis.courteousAckMessage) {
      const scheduledReply = scheduleAnalysis.courteousAckMessage + persona.formatSignoff(detectedLang);
      history.push({ role: 'assistant', content: scheduledReply, timestamp: new Date().toISOString() });
      db.prepare('UPDATE conversations SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(JSON.stringify(history), sessionId);
      return {
        sessionId,
        reply: scheduledReply,
        cardType: 'schedule_notice',
        cardData: {
          scheduledCallbackAt: scheduleAnalysis.scheduledCallbackAt,
          snoozeUntil: scheduleAnalysis.snoozeUntil,
          summary: scheduleAnalysis.preferredTimeSummary
        }
      };
    }
  }

  // ── 5. Financial & Banking Details (0% Commission Settlement) ───────────────
  const companyFin = {
    bankName: 'State Bank of India',
    accountName: 'GCM Enterprises',
    currentAccountNo: '44979437825',
    ifscCode: 'SBIN0021462',
    branch: 'HMT Colony, Hyderabad',
    officialUpiId: 'gcmenterprises@ybl',
    upiNumber: '9912399224'
  };

  let replyText = '';
  let cardType: any = undefined;
  let cardData: any = undefined;

  const fullConversationHistory = history.map((m: any) => m.content || '').join(' ') + ' ' + userText;

  // Extract Dimensions (e.g. "15 x 6", "100 x 50 x 25", "300 sft", "12 by 8")
  const dimMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?)(?:\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?))?/i);
  const sftMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:sq\s*ft|sqft|sft)/i);

  // Intent Checks
  const isTurnkeyIntent = (lower.includes('turnkey') || lower.includes('box cricket') || lower.includes('court construction') || lower.includes('ground construction') || lower.includes('ground setup') || lower.includes('cage fabrication')) &&
    !lower.includes('balcony') && !lower.includes('pigeon');

  const isSupplyOnlyIntent = lower.includes('supply only') || lower.includes('wholesale') || lower.includes('full bag') || lower.includes('half bag') || lower.includes('bundles') || lower.includes('transport') || lower.includes('courier') || lower.includes('material only') || lower.includes('only net') || lower.includes('without installation');

  const isInvisibleGrillIntent = /(?:invisible\s*grill|ss\s*grill|wire\s*grill|stainless\s*steel\s*grill|గ్రిల్స్|గ్రిల్|ఇన్విజిబుల్|इनविजिबल|ग्रिल|ग्रिल्स)/i.test(lower) ||
    websiteId === 'gcminvisiblegrills' ||
    (/(?:invisible|grill|గ్రిల్|ग्रिल)/i.test(fullConversationHistory) && !lower.includes('cricket') && !lower.includes('turf') && !lower.includes('pigeon'));

  const isTurfAccessoriesIntent = /(?:silica\s*sand|rubber\s*granules?|sbr|speb\s*7|adhesive\s*glue|seaming\s*tape|jointing\s*tape)/i.test(lower) ||
    (/(?:turf|grass|artificial\s*grass)/i.test(lower) && /(?:sand|rubber|glue|tape|accessory|accessories)/i.test(lower));

  const isGrassOrTurfIntent = /(?:artificial\s*grass|grass|turf|lawn|green\s*grass|గ్రాస్|టర్ఫ్|घास|टर्फ)/i.test(lower) &&
    !isTurfAccessoriesIntent && !isTurnkeyIntent;

  const isSafetyNetIntent = /(?:pigeon|balcony|safety\s*net|bird|kabutar|పావురాల|కబూతర్|कबूतर|duct|children|cat\s*net|monkey\s*net)/i.test(lower) ||
    (/(?:net|nets|netting)/i.test(lower) && !lower.includes('cricket') && !lower.includes('sports') && !lower.includes('turf') && !lower.includes('bag') && !lower.includes('mesh') && !lower.includes('hanger'));

  const isClothHangerIntent = /(?:cloth|hanger|hangers|drying|pulley|హ్యాంగర్|హ్యాంగర్స్|క్లాత్|బట్టల|हैंगर|क्लॉथ|कपड़े)/i.test(lower) ||
    lower.includes('6 rods') || lower.includes('6-pipe') || lower.includes('ceiling mount') || lower.includes('wall mount') ||
    (/(?:cloth|hanger|drying|pulley|హ్యాంగర్|हैंगर)/i.test(fullConversationHistory) && !lower.includes('cricket') && !lower.includes('turf'));

  const isBankDetailsIntent = lower.includes('bank') || lower.includes('account') || lower.includes('ifsc') || lower.includes('upi') || lower.includes('payment method') || lower.includes('how to pay') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('qr code');
  const isQuoteRequest = lower.includes('quote') || lower.includes('quotation') || lower.includes('formal estimate') || lower.includes('send invoice') || lower.includes('pdf');
  const isDiscount = lower.includes('discount') || lower.includes('kam karo') || lower.includes('best price') || lower.includes('thaggistara') || lower.includes('thaggandi') || lower.includes('concession');
  const isSiteVisit = lower.includes('site visit') || lower.includes('visit') || lower.includes('measurement') || lower.includes('sample') || lower.includes('vastara') || lower.includes('chustara') || lower.includes('doorstep');
  const isInstallationExplicit = lower.includes('installation') || lower.includes('fitting') || lower.includes('fit cheyali') || lower.includes('doorstep service') || lower.includes('technician');
  const isGreetingIntent = /^(hi|hello|hey|namaste|good\s*morning|good\s*evening|good\s*afternoon|నమస్కారం|హలో|नमस्ते|హాయ్)\b/i.test(lower.trim());

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 1: COMPANY BANK & PAYMENT DETAILS INQUIRY
  // ═══════════════════════════════════════════════════════════════════════════
  if (isBankDetailsIntent) {
    if (detectedLang === 'telugu') {
      replyText = `నమస్కారం సర్! 🙏

మీరు ${brandName} ఆర్డర్ లేదా అడ్వాన్స్ పేమెంట్ చేయడానికి మా అధికారిక బ్యాంక్ వివరాలు ఇక్కడ ఉన్నాయి:

• **బ్యాంక్**: ${companyFin.bankName}
• **ఖాతా పేరు**: **${companyFin.accountName}**
• **కరెంట్ అకౌంట్ నెం**: **${companyFin.currentAccountNo}**
• **IFSC కోడ్**: **${companyFin.ifscCode}**
• **బ్రాంచ్**: ${companyFin.branch}
• **అధికారిక UPI ID**: **${companyFin.officialUpiId}**
• **Google Pay / PhonePe / Paytm**: **9912399224**

📌 *పేమెంట్ చేశాక స్క్రీన్‌షాట్ లేదా UTR నెంబర్ ఇక్కడ వాట్సాప్ చేయండి సర్. మా అకౌంట్స్ టీమ్ వెంటనే మీకు అఫీషియల్ జీఎస్టీ బుకింగ్ రసీదు పంపిస్తుంది!*`;
    } else {
      replyText = `Namaste ${customerDisplayName}! 🙏

Here are our verified company bank credentials for booking your order with ${brandName}:

• **Bank**: ${companyFin.bankName}
• **Account Name**: **${companyFin.accountName}**
• **Current Account No**: **${companyFin.currentAccountNo}**
• **IFSC Code**: **${companyFin.ifscCode}**
• **Branch**: ${companyFin.branch}
• **Official UPI ID**: **${companyFin.officialUpiId}**
• **Google Pay / PhonePe / Paytm**: **9912399224**

📌 *Once transferred, simply share the payment screenshot or UTR number here. Our billing desk will immediately generate and dispatch your stamped official GST booking invoice!*`;
    }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 2: HIGH DISCOUNT OWNER APPROVAL GUARDRAIL (Phase 8 & 14)
  // ═══════════════════════════════════════════════════════════════════════════
  } else if (isDiscount) {
    const discMatch = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    const requestedDiscount = discMatch ? parseFloat(discMatch[1]) : 10.0;

    if (requestedDiscount > 5.0) {
      cardType = 'approval_notice';
      cardData = {
        status: 'OWNER_APPROVAL_REQUIRED',
        requestedDiscountPct: requestedDiscount,
        maxAiDiscountPct: 5.0,
        reason: `Customer requested ${requestedDiscount}% discount (exceeds autonomous 5% AI threshold)`
      };

      replyText = detectedLang === 'telugu'
        ? `తప్పకుండా సర్. నేను స్వయంగా 5% వరకు డైరెక్ట్ డిస్కౌంట్ ఇవ్వగలను సర్. మీరు ${requestedDiscount}% డిస్కౌంట్ అడిగినందున, ఈ రిక్వెస్ట్ ని మా ఓనర్/మేనేజింగ్ డైరెక్టర్ ప్రత్యేక అనుమతి కోసం ఫార్వార్డ్ చేశాను. వారు పరిశీలించి వెంటనే మీకు బెస్ట్ రేట్ కన్ఫర్మ్ చేస్తారు సర్!`
        : `Under our autonomous pricing policy, I can directly approve up to 5% discount, sir. Since you requested a ${requestedDiscount}% discount, I have routed this request to our Managing Director for special commercial approval. We will get back to you immediately with the authorized price!`;
    } else {
      replyText = detectedLang === 'telugu'
        ? `తప్పకుండా సర్! మీ ఆర్డర్ కి 5% డైరెక్ట్ డిస్కౌంట్ వర్తింపజేస్తున్నాము.`
        : `Certainly ${customerDisplayName}! I have applied our authorized 5% direct volume discount to your order.`;
    }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENARIO 3: CONSULTATIVE SALES ENGINE DELEGATION (Unified Single State Machine)
  // ═══════════════════════════════════════════════════════════════════════════
  } else {
    const consultantResult = handleSalesConversation({
      sessionId,
      websiteId,
      userText,
      customerName: customerDisplayName,
      phone: detectedPhone || undefined,
      channel,
      history
    });
    replyText = consultantResult.replyText;
    cardType = consultantResult.cardType as any;
    cardData = consultantResult.cardData;
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
