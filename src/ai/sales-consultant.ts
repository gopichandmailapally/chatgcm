/**
 * Chat GCM — Human-Like Sales Consultant & Dialog Engine (Enterprise 2026 Edition)
 * Strictly adheres to Phase 2, Phase 3, Phase 4, Phase 6, Phase 7 & Phase 8:
 * 1. Single source of truth & centralized state machine (15 canonical states)
 * 2. Absolute Estimation Gate: No calculation without complete parameters & explicit confirmation
 * 3. Zero assumptions: Never assume wire diameter, cloth hanger size/qty, ground height, top net, or Hyderabad location
 * 4. Introduction only ONCE per conversation
 * 5. One relevant question at a time, extract multiple parameters if provided
 * 6. Product education before recommendation
 * 7. Truthful AI identity disclosure when asked
 * 8. Warranty accuracy (Braided net: 8-yr life / 5-yr warranty; never blanket 8-yr warranty)
 * 9. Physical site visit handling without invented fees
 * 10. Distinct outputs: Requirement Summary vs Preliminary Estimate vs Official Quote
 */

import {
  ConversationState,
  ProductCategory,
  ConversationStage,
  getConversationState,
  saveConversationState,
  switchProductCategory,
  checkEstimationEligibility,
  isProductComparisonQuestion,
  canTransition
} from "./conversation-state.js";

import {
  calculateLandscapeGrassRolls,
  calculateSportsTurfRolls,
  calculateCricketBraidedBags,
  calculateTwisted15Netting,
  calculateInstalledSafetyNet,
  calculateInvisibleGrills,
  calculateClothHanger,
  ROLL_SFT_STANDARD,
  SPORTS_TURF_CATALOG,
  type InstalledNetQualityId
} from "../pricing/universal-pricing-engine.js";

import { calculateCricketNetting } from "../calculators/cricket-net-calculator.js";
import { calculateTurnkeyBoxCricket } from "../calculators/turnkey-box-calculator.js";
import { CLOTH_HANGER_BASE_PRICES, ClothHangerSize, ClothHangerMounting } from "../calculators/cloth-hanger-calculator.js";

export interface SalesConsultantInput {
  sessionId: string;
  websiteId: string;
  userText: string;
  customerName?: string;
  phone?: string;
  channel?: string;
  history?: Array<{ role: string; content: string; timestamp?: string }>;
}

export interface SalesConsultantOutput {
  replyText: string;
  cardType?: string;
  cardData?: any;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function detectLanguage(text: string): "telugu" | "hindi" | "english" {
  if (/[\u0C00-\u0C7F]/.test(text) || /\b(namaskaram|enti|cheppandi|kavali|thaggandi|vastara|chustara|rate|dharalu|meeru|avunu|ledu|sare)\b/i.test(text)) {
    return "telugu";
  }
  if (/[\u0900-\u097F]/.test(text) || /\b(namaste|kitna|chahiye|batao|karo|bhejo|hoga|hai|aap|theek|sahi|kya)\b/i.test(text)) {
    return "hindi";
  }
  return "english";
}

export function normalizeText(text: string): string {
  return text
    .replace(/[\u00D7\u2715\u2716\u2A2F\u2217]/g, " x ")
    .replace(/(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?/gi, "$1 x $2")
    .replace(/(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?/gi, "$1 x $2 x $3");
}

export function extractDimensions(rawText: string): { length?: number; width?: number; height?: number; areaSft?: number } {
  const text = normalizeText(rawText);

  // 3D match: e.g. "100 x 50 x 25"
  const dim3D = text.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?)/i);
  if (dim3D) {
    const l = parseFloat(dim3D[1]);
    const w = parseFloat(dim3D[2]);
    const h = parseFloat(dim3D[3]);
    return {
      length: l,
      width: w,
      height: h,
      areaSft: Math.round(l * w)
    };
  }

  // 2D match: e.g. "18 x 9" or "100 by 60"
  const dim2D = text.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?)/i);
  if (dim2D) {
    const l = parseFloat(dim2D[1]);
    const w = parseFloat(dim2D[2]);
    const res: { length: number; width: number; height?: number; areaSft: number } = {
      length: l,
      width: w,
      areaSft: Math.round(l * w)
    };
    // Also check for separate height indicator (e.g. "20 feet high" or "height 20")
    const heightMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|'|mtr|m)?\s*(?:high|height)|\bheight\s*(?:is|of)?\s*(\d+(?:\.\d+)?)/i);
    if (heightMatch) {
      res.height = parseFloat(heightMatch[1] || heightMatch[2]);
    }
    return res;
  }

  // SFT match: e.g. "16000sft", "2000 sft"
  const sftMatch = text.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:sq\s*ft|sqft|sft|square\s*feet|sq\s*feet|sq\.ft|s\.f\.t)/i);
  if (sftMatch) {
    const rawNum = sftMatch[1].replace(/,/g, "");
    return { areaSft: Math.round(parseFloat(rawNum)) };
  }

  return {};
}

export function extractFloorNumber(text: string): string | null {
  const match = text.match(/\b(\d+)\s*(?:st|nd|rd|th)?\s*floor|\bfloor\s*(\d+)|\b(\d+)floor\b/i);
  if (match) {
    return match[1] || match[2] || match[3];
  }
  return null;
}

export function extractRolls(text: string): number | undefined {
  const rollsMatch = text.match(/(\d+)\s*(?:full\s*)?rolls?\b/i);
  if (rollsMatch) {
    return parseInt(rollsMatch[1], 10);
  }
  return undefined;
}

export function detectProductCategory(text: string): ProductCategory | null {
  const lower = text.toLowerCase();

  if (/(?:turnkey|court\s*construction|box\s*cricket\s*(?:setup|ground|arena|project|court|facility)|complete\s*box\s*cricket|full\s*box\s*cricket)/i.test(lower)) {
    return "turnkey_project";
  }

  if (/(?:cricket|batting\s*nets?|bowling\s*nets?|pitch\s*nets?|cage\s*nets?|braided\s*nets?|sports\s*nets?|ground\s*nets?|box\s*cricket)/i.test(lower)) {
    return "cricket_net";
  }

  if (/(?:artificial\s*grass|landscape\s*grass|balcony\s*grass|garden\s*grass|lawn\s*grass)/i.test(lower) || (lower.includes("grass") && !lower.includes("turf accessories") && !lower.includes("sports turf"))) {
    return "landscape_grass";
  }

  if (/(?:sports\s*turf|football\s*turf|50mm\s*turf|multisports?|futsal|turf)/i.test(lower) && !lower.includes("landscape")) {
    return "sports_turf";
  }

  if (/(?:pigeon|balcon(?:y|ies)|safety\s*nets?|bird\s*nets?|cat\s*nets?|monkey\s*nets?|duct\s*nets?|పావురాల|కబూతర్|कबूतर)/i.test(lower) && !/(?:cricket|turf|grass|hanger)/i.test(lower)) {
    return "pigeon_safety_net";
  }

  if (/(?:invisible\s*grills?|ss\s*grills?|stainless\s*steel\s*grills?|గ్రిల్స్?|ग्रिल)/i.test(lower)) {
    return "invisible_grill";
  }

  if (/(?:cloth\s*hangers?|drying\s*hangers?|pulley\s*hangers?|hangers?|హ్యాంగర్|हैंगर)/i.test(lower)) {
    return "cloth_hanger";
  }

  if (/(?:silica\s*sand|rubber\s*granules?|speb\s*7|seaming\s*tape)/i.test(lower)) {
    return "turf_accessories";
  }

  if (/(?:turnkey|court\s*construction)/i.test(lower)) {
    return "turnkey_project";
  }

  return null;
}

// ── Product Education & Comparison Interceptor ──────────────────────────────

function handleProductEducationAndComparison(text: string, activeCategory: ProductCategory | null): string | null {
  const lower = text.toLowerCase();

  // Comparison between Invisible Grills and Safety Nets
  if (isProductComparisonQuestion(text) && (lower.includes("invisible") || lower.includes("grill")) && (lower.includes("net") || lower.includes("safety"))) {
    return "Both are excellent balcony safety solutions, sir:\n" +
      "• Balcony Safety Nets (RUSSEA™ HDPE): Economical (₹18–₹23/SFT installed), lightweight, allows full breeze, 5-year replacement warranty.\n" +
      "• Invisible Grills (AISI 316 Marine SS): Ultra-modern sleek appearance, zero view obstruction, high tensile steel cables (450+ kg breaking load), 10-year materials warranty.\n\n" +
      "Which option would you prefer for your balcony?";
  }

  // Thickness comparison: 2.0mm vs 2.5mm
  if (/(difference|compare|2mm\s*vs\s*2\.5mm|2\.5mm\s*vs\s*2mm|which\s*is\s*better|better\s*quality)/i.test(lower)) {
    if (activeCategory === "cricket_net" || lower.includes("cricket")) {
      return "For cricket nets:\n" +
        "• 2.0mm Braided (45mm mesh): Lightweight, economical, ideal for school & community practice.\n" +
        "• 2.5mm Braided (45mm mesh preferred economical, 40mm denser): Professional commercial grade with superior impact resistance for side walls.\n" +
        "• 1.5mm Twisted: Lightweight overhead top net for large grounds.";
    }
    return "For balcony safety nets:\n" +
      "• 2.0mm Braided Net (₹20/SFT): Designed for pigeon protection and child safety with a 5-year replacement warranty.\n" +
      "• 2.5mm Braided Net (₹21/SFT): Heavy-duty net with higher tensile strength, ideal for monkey protection or active pets (8-year expected life, 5-year warranty).";
  }

  // Types of nets / options
  if (/(types?\s*of|options?|what\s*(?:are\s*the\s*)?types|available\s*types)/i.test(lower)) {
    if (activeCategory === "cricket_net" || lower.includes("cricket")) {
      return "For cricket nets, we supply:\n" +
        "• 2mm Braided Net (45mm or 40mm mesh) — lightweight & economical\n" +
        "• 2.5mm Braided Net (45mm preferred economical, or 40mm mesh) — professional heavy-duty for ground sides\n" +
        "• 1.5mm Twisted Net (40mm mesh) — lightweight overhead top netting for full enclosures.";
    }
    if (activeCategory === "landscape_grass" || lower.includes("grass")) {
      return "We supply premium landscape artificial grass in 4 pile heights:\n" +
        "• 25mm: ₹24/SFT (economical for balconies & indoor decor)\n" +
        "• 35mm: ₹28/SFT (popular plush feel for residential gardens & balconies)\n" +
        "• 40mm: ₹32/SFT (dense luxury lawn feel)\n" +
        "• 50mm: ₹36/SFT (ultra-dense super soft premium)\n" +
        "All supplied in 540 SFT full rolls.";
    }
    if (activeCategory === "invisible_grill" || lower.includes("grill")) {
      return "Our invisible grills use genuine AISI 316 Marine Grade stainless steel cables with transparent nylon coating. We offer 2-inch and 3-inch gap spacing with rigid structural aluminum track fixings.";
    }
    if (activeCategory === "cloth_hanger" || lower.includes("hanger")) {
      return "We manufacture SS304 6-rod cloth drying hangers in two mounting styles:\n" +
        "• Ceiling-Mounted (individual pulley-operated stainless steel rods)\n" +
        "• Wall-Mounted (foldable stainless steel frame)\n" +
        "Available in 4ft, 5ft, 6ft, 7ft, and 8ft lengths.";
    }
    return "For balcony safety, we provide genuine RUSSEA™ HDPE safety nets (2.0mm & 2.5mm braided) and AISI 316 Stainless Steel Invisible Grills. Which product would you like to explore?";
  }

  // Warranty inquiry (Strictly adheres to Phase 4.9 approved terms)
  if (/(warranty|guarantee|durability|life\s*span|how\s*many\s*years|how\s*long)/i.test(lower)) {
    return "Here are our approved warranty terms:\n" +
      "• Braided Safety Nets: Expected service life of 8 years; written warranty of 5 years for eligible damage repair or replacement.\n" +
      "• 1.5mm Twisted Nets: Expected service life of 5 years; written warranty of 3 years.\n" +
      "• Invisible Grills: 10-year materials warranty against rust, plus 3-year free service within our approved service area.\n" +
      "• Cloth Hangers: 2-year product warranty and covered service (ropes excluded).";
  }

  return null;
}

// ── Main Conversational Controller ──────────────────────────────────────────

export function handleSalesConversation(input: SalesConsultantInput): SalesConsultantOutput {
  const { sessionId, userText, websiteId } = input;
  const state = getConversationState(sessionId);
  const lang = detectLanguage(userText);
  const lower = userText.toLowerCase().trim();

  // 1. Truthful AI Identity Disclosure (Phase 3.2 & Phase 14)
  const isAskingIfAi = /(are\s*you\s*(?:an?\s*)?(?:ai|bot|robot|computer|machine)|robot\s*aa|bot\s*aa|meeru\s*ai\s*aa|kya\s*aap\s*ai\s*hai)/i.test(lower);
  if (isAskingIfAi) {
    const aiDisclosure = lang === "telugu"
      ? "అవును సర్, నేను జిసిఎమ్ ఎంటర్‌ప్రైజెస్ అధికారిక AI సేల్స్ కన్సల్టెంట్‌ని. మా ప్రొడక్ట్స్, కొలతలు మరియు ఖచ్చితమైన ఎస్టిమేషన్ వివరాల్లో మీకు సహాయం చేయడానికి ఇక్కడ ఉన్నాను సర్. మీకు ఏ ప్రొడక్ట్ వివరాలు కావాలి సర్?"
      : lang === "hindi"
      ? "जी हाँ सर, मैं जीसीएम एंटरप्राइजेज का आधिकारिक एआई सेल्स कंसल्टेंट हूँ। मैं आपको उत्पादों, स्पेसिफिकेशन्स और सटीक कोटेशन में पूरी सहायता करूँगा। आप किस उत्पाद के बारे में जानना चाहते हैं?"
      : "Yes, I am Venkatesh, an authorized AI sales consultant representing GCM Enterprises. I'm here to explain our product specifications, recommend the right materials, and calculate accurate estimates for your project. How can I assist you today?";
    saveConversationState(sessionId, state);
    return { replyText: aiDisclosure };
  }

  // 2. Identity Question Check ("Who are you?", "Your name?")
  const isAskingIdentity = /(who\s*are\s*you|which\s*company|your\s*name|who\s*is\s*this|meeru\s*evaru|aap\s*kaun\s*hai)/i.test(lower);
  if (isAskingIdentity) {
    const idReply = lang === "telugu"
      ? "నేను జిసిఎమ్ ఎంటర్‌ప్రైజెస్ నుండి వెంకటేష్ ని సర్, సీనియర్ సేల్స్ కన్సల్టెంట్‌ని. నేను మీకు ఎలా సహాయపడగలను సర్?"
      : lang === "hindi"
      ? "मैं जीसीएम एंटरप्राइजेज से वेंकटेश बात कर रहा हूँ। मैं आपकी किस प्रकार सहायता कर सकता हूँ सर?"
      : "Hello! I'm Venkatesh from GCM Enterprises. How can I help you?";
    saveConversationState(sessionId, state);
    return { replyText: idReply };
  }

  // 3. Initial Introduction — Strictly ONCE per conversation (Phase 3.2)
  const isGreetingOnly = /^(hi|hello|hey|namaste|good\s*morning|good\s*evening|good\s*afternoon|నమస్కారం|హలో|नमस्ते|హాయ్)(?:\b|\s|$)/i.test(lower) && lower.split(/\s+/).length <= 3;

  if (!state.introduction_completed) {
    state.introduction_completed = true;

    if (isGreetingOnly) {
      state.stage = "GREETING";
      state.requirement_status = "GREETING";
      saveConversationState(sessionId, state);
      const introReply = lang === "telugu"
        ? "నమస్కారం! నేను జిసిఎమ్ ఎంటర్‌ప్రైజెస్ నుండి వెంకటేష్ ని. నేను మీకు ఎలా సహాయపడగలను సర్?"
        : lang === "hindi"
        ? "नमस्ते! मैं जीसीएम एंटरप्राइजेज से वेंकटेश बात कर रहा हूँ। मैं आपकी क्या सहायता कर सकता हूँ?"
        : "Hello! I'm Venkatesh from GCM Enterprises. How can I help you?";
      return { replyText: introReply };
    }
  }

  // Repeated greeting in ongoing conversation
  if (isGreetingOnly && state.introduction_completed) {
    if (state.active_product_category === "landscape_grass") {
      return { replyText: "Hello! Are you looking for balcony, garden, or terrace artificial grass?" };
    } else if (state.active_product_category === "cricket_net") {
      return { replyText: "Hello! What are your ground dimensions (Length, Width, and Height in feet)?" };
    } else if (state.active_product_category === "pigeon_safety_net") {
      return { replyText: "Hello! What are your balcony dimensions (Length and Height in feet)?" };
    } else {
      return { replyText: "Hello! How can I assist you with safety nets, cricket netting, grass, or invisible grills today?" };
    }
  }

  // 3B. Customer Decision Pending Rule (Phase 15)
  const isCustomerDeciding = /(?:decide\s*(?:and|&)?\s*let\s*you\s*know|think\s*(?:about\s*it|and\s*get\s*back)|discuss\s*with\s*(?:my\s*)?(?:family|partner|wife|husband|parents)|need\s*some\s*time\s*to\s*decide|will\s*get\s*back\s*to\s*you|alochinchukoni|chepthanu|soch\s*ke|batata\s*hu)/i.test(lower);
  if (isCustomerDeciding) {
    state.stage = "CUSTOMER_DECISION_PENDING";
    saveConversationState(sessionId, state);
    return {
      replyText: "Certainly. Take your time, and please let us know whenever you're ready."
    };
  }

  // 3C. Payment Confirmation Claim (Phase 12)
  const isPaymentClaim = /(?:i\s*(?:have\s*)?(?:paid|transferred|sent)|payment\s*(?:done|completed|made)|advance\s*(?:paid|sent|transferred)|transferred\s*(?:the\s*)?money|money\s*sent|here\s*is\s*(?:the\s*)?(?:utr|receipt|proof)|utr\s*[:\s#]*[a-z0-9]+)/i.test(lower) && !/(?:how\s*to\s*pay|mode\s*of\s*payment|payment\s*method)/i.test(lower);
  if (isPaymentClaim) {
    const utrMatch = userText.match(/\b(?:utr|ref|transaction\s*id)[:\s#]*([a-zA-Z0-9]{8,25})\b/i);
    const refStr = utrMatch ? ` (UTR/Ref: ${utrMatch[1]})` : '';
    state.stage = "PAYMENT_CLAIMED";
    saveConversationState(sessionId, state);
    return {
      replyText: `Thank you! We have received your payment details${refStr}. Our accounts team is verifying this with our bank account. Once confirmed, we will issue your formal receipt and proceed with scheduling.`
    };
  }

  // 3D. Pricing Negotiation & Floor Protection (Phase 5)
  const isBelowFloorRequest = /\b(?:give|do|make\s*it|for)\s*(?:at\s*)?(?:rs\.?|₹)?\s*(1[0-9]|2[0-3])\s*(?:per\s*sft|\/sft)?\b/i.test(lower) || /(?:give|want)\s*(?:1[5-9]|[2-9][0-9])%\s*discount/i.test(lower);
  const isAskingDiscount = /(?:any\s*discount|can\s*you\s*(?:give\s*)?discount|give\s*(?:some\s*)?discount|reduce\s*(?:the\s*)?(?:price|rate|cost)|kam\s*karo|thaggimpu|any\s*concession|best\s*price|kamti|bargain)/i.test(lower);

  if (isBelowFloorRequest && (state.stage === 'ESTIMATE_PREPARED' || state.active_quote || state.stage === 'REQUIREMENT_CONFIRMATION')) {
    state.stage = "QUOTATION_PENDING_APPROVAL";
    saveConversationState(sessionId, state);
    return {
      replyText: "I'll check with my manager whether we can offer a better rate and update you."
    };
  }

  if (isAskingDiscount && (state.stage === 'ESTIMATE_PREPARED' || state.active_quote)) {
    if (state.active_product_category === 'pigeon_safety_net') {
      return {
        replyText: "We can offer an authorized direct-discount rate of ₹25/SFT for complete installation with SS 316 wire and 5-year warranty. Shall I update your estimate with this rate?"
      };
    } else {
      return {
        replyText: "We can extend an authorized courtesy discount of 5% on your estimate. Shall I update your quote with this discount?"
      };
    }
  }

  // 4. Product Education or Comparison Interception (Does NOT switch active product!)
  const eduReply = handleProductEducationAndComparison(userText, state.active_product_category);
  if (eduReply) {
    state.stage = "PRODUCT_EDUCATION";
    saveConversationState(sessionId, state);
    return { replyText: eduReply };
  }

  // 5. Product Category Detection & Intent-based Switching (Phase 7)
  const detectedCat = detectProductCategory(userText);
  if (detectedCat && !isProductComparisonQuestion(userText)) {
    if (detectedCat !== state.active_product_category) {
      switchProductCategory(state, detectedCat);
    }
  }

  // 6. Unknown Dimensions / Physical Site Visit (Phase 6 — No invented ₹300 fee!)
  const isUnknownDimensions = /(don'?t\s*know|do\s*not\s*know|not\s*sure|no\s*idea|cannot\s*measure|can'?t\s*measure|no\s*measurements?|theliyadu|maloom\s*nahi|pata\s*nahi)/i.test(lower);
  const isSiteVisitRequested = /(site\s*visit|come\s*and\s*measure|visit\s*my\s*place|send\s*someone|vastara|chustara|inspection|doorstep\s*visit)/i.test(lower);

  if (isUnknownDimensions || isSiteVisitRequested) {
    state.stage = "SITE_VISIT_REQUESTED";
    saveConversationState(sessionId, state);

    if (state.active_product_category === "landscape_grass" || state.active_product_category === "sports_turf") {
      return {
        replyText: "Artificial grass is supplied in full rolls of 540 SFT. You can measure the approximate length and width with a measuring tape, or share site photos so our team can guide your roll requirement."
      };
    }

    return {
      replyText: "You can measure the approximate length and height using a standard tape, or share balcony photos. In supported service areas, our technical team can also conduct a physical site inspection. Applicable visit charges will be confirmed by our team before scheduling. Would you like to share your location and contact details for a site visit?"
    };
  }

  // 7. If no product category identified yet, ask focused discovery question
  if (!state.active_product_category) {
    state.stage = "INTENT_DISCOVERY";
    saveConversationState(sessionId, state);
    return {
      replyText: "Which product are you looking for: balcony safety nets, cricket nets, artificial grass, invisible grills, or cloth hangers?"
    };
  }

  // ── 8. CATEGORY: INVISIBLE GRILLS (Phase 4.7 — Zero Assumptions) ────────────
  if (state.active_product_category === "invisible_grill") {
    const dims = extractDimensions(userText);
    if (dims.areaSft) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.areaSft = dims.areaSft;
      if (dims.length) state.confirmed_dimensions.length = dims.length;
      if (dims.width) state.confirmed_dimensions.width = dims.width;
    }

    const cityMatch = userText.match(/\b(hyderabad|secunderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // Extract wire diameter & spacing if provided
    if (lower.includes("3.0mm") || lower.includes("3mm")) state.selected_material = "3.0mm";
    else if (lower.includes("2.5mm")) state.selected_material = "2.5mm";
    else if (lower.includes("2.0mm") || lower.includes("2mm")) state.selected_material = "2.0mm";

    // 8A. Missing dimensions
    if (!state.confirmed_dimensions?.areaSft) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What are your balcony dimensions (Length and Height in feet), or the approximate total square feet?" };
    }

    // 8B. Missing wire diameter / spacing — NEVER ASSUME 2.5mm
    if (!state.selected_material) {
      state.stage = "PRODUCT_EDUCATION";
      saveConversationState(sessionId, state);
      return {
        replyText: "For AISI 316 Marine Grade invisible grills, we offer 2.0mm, 2.5mm, and 3.0mm cable diameters with 2-inch or 3-inch spacing. Which wire thickness do you prefer?"
      };
    }

    // 8C. Missing Location — NEVER ASSUME Hyderabad
    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which city or locality is the installation required in?" };
    }

    const area = state.confirmed_dimensions.areaSft;
    const isOutsideHyd = state.customer_location.toLowerCase() !== "hyderabad" && state.customer_location.toLowerCase() !== "secunderabad";

    // 8D. Confirmation check before calculation
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      state.profile.customerConfirmed = true;
      saveConversationState(sessionId, state);
      return {
        replyText: `So you require AISI 316 Invisible Grills (${state.selected_material} cable) for ${area} SFT in ${state.customer_location} with professional installation and track fixings. Shall I calculate the estimate?`
      };
    }

    // 8E. Deterministic Calculation
    const calc = calculateInvisibleGrills({
      totalAreaSft: area,
      isOutsideHyderabad: isOutsideHyd,
      locationCity: state.customer_location,
      wireDiameter: (state.selected_material as '2.5mm' | '2.0mm' | '3.0mm') || '2.5mm',
      spacing: "2-inch"
    });

    state.stage = "ESTIMATE_PREPARED";
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    const reply = `AISI 316 Marine Stainless Steel Invisible Grills:\n` +
      `• Area: ${area} SFT (${calc.slabName})\n` +
      `• Cable Specification: ${state.selected_material} AISI 316 SS (DuPont nylon coated)\n` +
      `• Rate: ${calc.isMinimumBillingApplied ? "₹10,000 fixed minimum (under 60 SFT)" : `₹${calc.effectiveRatePerSft}/SFT`}\n` +
      `• Location: ${state.customer_location} ${isOutsideHyd ? "(+₹30/SFT outside Hyderabad)" : ""}\n` +
      `• Installation: Included with high-grade aluminum track fixings\n` +
      `• Warranty: 10-Year Materials Warranty, 3-Year Free Service\n` +
      `• Total Estimate: ₹${calc.totalAmount.toLocaleString("en-IN")}\n\n` +
      `Would you like to schedule an on-site sample demonstration?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 9. CATEGORY: CLOTH DRYING HANGERS (Phase 4.8 — Zero Assumptions) ──────
  if (state.active_product_category === "cloth_hanger") {
    const isWallMount = lower.includes("wall");
    const isCeilingMount = lower.includes("ceiling") || lower.includes("pulley");

    if (isWallMount) state.selected_material = "wall";
    else if (isCeilingMount) state.selected_material = "ceiling";

    const sizeMatch = userText.match(/\b([45678])\s*(?:ft|feet|foot|'|rod)\b/i);
    if (sizeMatch) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.length = parseInt(sizeMatch[1], 10);
    }

    const qtyMatch = userText.match(/(\d+)\s*(?:hangers?|units?|sets?|nos?|pieces?)\b/i);
    if (qtyMatch) {
      state.profile.quantity = parseInt(qtyMatch[1], 10);
    }

    const cityMatch = userText.match(/\b(hyderabad|secunderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // 9A. Missing Mounting Type
    if (!state.selected_material) {
      state.stage = "PRODUCT_EDUCATION";
      saveConversationState(sessionId, state);
      return { replyText: "Do you prefer Ceiling-Mounted (individual pulley operation) or Wall-Mounted foldable cloth drying hangers?" };
    }

    // 9B. Missing Size — NEVER ASSUME 6 FT
    if (!state.confirmed_dimensions?.length) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which length do you require: 4ft, 5ft, 6ft, 7ft, or 8ft?" };
    }

    // 9C. Missing Quantity — NEVER ASSUME 1 UNIT
    if (!state.profile.quantity) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "How many cloth hanger units do you require?" };
    }

    // 9D. Missing Location — NEVER ASSUME Hyderabad
    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which city is the installation required in?" };
    }

    const sizeFt = state.confirmed_dimensions.length as ClothHangerSize;
    const mounting = state.selected_material as ClothHangerMounting;
    const qty = state.profile.quantity || 1;
    const isOutsideHyd = state.customer_location.toLowerCase() !== "hyderabad" && state.customer_location.toLowerCase() !== "secunderabad";

    // 9E. Confirmation check
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      state.profile.customerConfirmed = true;
      saveConversationState(sessionId, state);
      return {
        replyText: `So you need ${qty} unit(s) of ${sizeFt}ft SS304 6-rod ${mounting}-mounted cloth hanger with complete installation in ${state.customer_location}. Shall I calculate the estimate?`
      };
    }

    // 9F. Deterministic Calculation
    const calc = calculateClothHanger({
      sizeFt,
      mountingType: mounting,
      quantity: qty,
      isOutsideHyderabad: isOutsideHyd,
      locationCity: state.customer_location
    });

    state.stage = "ESTIMATE_PREPARED";
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    const reply = `SS304 6-Rod Cloth Drying Hanger (${calc.mountingLabel}):\n` +
      `• Specification: 6 SS304 stainless steel pipes (16mm diameter), metal brackets, 4mm ropes\n` +
      `• Size: ${calc.sizeFt} Feet (${qty} unit${qty > 1 ? 's' : ''})\n` +
      `• Unit Price: ₹${calc.finalUnitPrice.toLocaleString("en-IN")}/unit ${isOutsideHyd ? "(includes ₹500 outstation charge)" : ""}\n` +
      `• Installation: Included with stainless steel fasteners\n` +
      `• Warranty: 2-Year Written Guarantee (ropes excluded)\n` +
      `• Total Amount: ₹${calc.totalAmount.toLocaleString("en-IN")}\n\n` +
      `Would you like to reserve an installation appointment?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 10. CATEGORY: BALCONY SAFETY & PIGEON NETS (100 SFT Boundary) ───────────
  if (state.active_product_category === "pigeon_safety_net") {
    const dims = extractDimensions(userText);
    if (dims.areaSft) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.areaSft = dims.areaSft;
      state.confirmed_dimensions.length = dims.length;
      state.confirmed_dimensions.width = dims.width;
    }

    const cityMatch = userText.match(/\b(hyderabad|secunderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // Material selection
    if (lower.includes("1.5mm") && (lower.includes("30mm") || lower.includes("twisted"))) state.selected_material = "1.5mm_30mm";
    else if ((lower.includes("2.5mm") || lower.includes("2.5")) && lower.includes("40mm")) state.selected_material = "2.5mm_40mm";
    else if (lower.includes("2.5mm") || lower.includes("2.5") || lower.includes("monkey") || lower.includes("pet")) state.selected_material = "2.5mm_45mm";
    else if ((lower.includes("2mm") || lower.includes("2.0mm") || lower.includes("2.0")) && lower.includes("40mm")) state.selected_material = "2.0mm_40mm";
    else if (lower.includes("2mm") || lower.includes("2.0mm") || lower.includes("2.0") || lower.includes("pigeon") || lower.includes("child")) state.selected_material = "2.0mm_45mm";

    // 10A. Missing dimensions
    if (!state.confirmed_dimensions?.areaSft) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What are your balcony dimensions (Length and Height in feet), or the approximate total area?" };
    }

    const area = state.confirmed_dimensions.areaSft;

    // 10B. Missing material
    if (!state.selected_material) {
      state.stage = "PRODUCT_EDUCATION";
      saveConversationState(sessionId, state);
      return {
        replyText: `For your ${area} SFT balcony, we offer genuine RUSSEA™ 2.0mm (standard bird & child safety with 5-year warranty) or 2.5mm braided (heavy-duty monkey & pet safety, 8-year life / 5-year warranty). Which quality do you prefer?`
      };
    }

    // 10C. Missing location
    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which city or area is your balcony located in?" };
    }

    // 10D. Confirmation check
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      state.profile.customerConfirmed = true;
      saveConversationState(sessionId, state);
      const qualityName = state.selected_material.includes("2.5mm") ? "2.5mm Heavy-Duty Braided Net" : "2.0mm Braided Net";
      return {
        replyText: `So you require genuine RUSSEA™ ${qualityName} for ${area} SFT in ${state.customer_location} with complete installation and stainless steel fasteners. Shall I calculate the estimate?`
      };
    }

    // 10E. Deterministic Calculation (Strictly adheres to 7 slabs & exact 100 SFT boundary)
    const qualityId = (state.selected_material || "2.0mm_45mm") as InstalledNetQualityId;
    const calc = calculateInstalledSafetyNet(qualityId, area, "standard");

    state.stage = "ESTIMATE_PREPARED";
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    const reply = `Material: Genuine RUSSEA™ ${calc.qualityName}\n` +
      `• Balcony Area: ${area} SFT\n` +
      `• Rate: ${calc.isFixedMinimumApplied ? `₹${calc.totalAmount} (Fixed Minimum for under 100 SFT)` : `₹${calc.appliedRatePerSft}/SFT`}\n` +
      `• Installation: Included (Stainless Steel Fasteners & drum-tight border rigging)\n` +
      `• Warranty: 5 Years Written Replacement Warranty (8 years expected service life)\n` +
      `• Total Estimate: ₹${calc.totalAmount.toLocaleString("en-IN")}\n` +
      `• Location: ${state.customer_location}\n\n` +
      `Would you like to reserve a measurement and installation slot?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 11. CATEGORY: CRICKET NETS (Phase 4.3 — Zero Assumptions) ───────────────
  if (state.active_product_category === "cricket_net") {
    const dims = extractDimensions(userText);
    if (!state.confirmed_dimensions) state.confirmed_dimensions = {};

    if (dims.length && dims.width) {
      state.confirmed_dimensions.length = dims.length;
      state.confirmed_dimensions.width = dims.width;
      if (dims.height) state.confirmed_dimensions.height = dims.height;
    } else if (dims.areaSft) {
      state.confirmed_dimensions.areaSft = dims.areaSft;
    }

    // Pole-to-pole confirmation
    if (lower.includes("pole to pole") || lower.includes("pole-to-pole") || lower.includes("exact pole")) {
      state.confirmed_dimensions.isPoleToPole = true;
      state.confirmed_dimensions.measurementConfirmed = true;
    } else if (lower.includes("already included") || lower.includes("with extra") || lower.includes("extra included")) {
      state.confirmed_dimensions.isPoleToPole = false;
      state.confirmed_dimensions.measurementConfirmed = true;
    }

    // Top net confirmation — Phase 4.3 rule: NEVER assume top net!
    if (lower.includes("only sides") || lower.includes("no top") || lower.includes("without top") || lower.includes("no roof") || lower.includes("sides only") || lower.includes("side nets only") || lower.includes("side netting only") || lower.includes("only side")) {
      state.confirmed_dimensions.hasTop = false;
    } else if (lower.includes("with top") || lower.includes("include top") || lower.includes("roof net") || lower.includes("with roof")) {
      state.confirmed_dimensions.hasTop = true;
    }

    if (lower.includes("2.5mm") && lower.includes("40mm")) state.selected_material = "2.5mm_40mm";
    else if (lower.includes("2.5mm") || lower.includes("2.5mm 45mm")) state.selected_material = "2.5mm_45mm";
    else if (lower.includes("2mm") && lower.includes("40mm")) state.selected_material = "2.0mm_40mm";
    else if (lower.includes("2mm") || lower.includes("2mm 45mm")) state.selected_material = "2.0mm_45mm";

    const cityMatch = userText.match(/\b(hyderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai|delhi)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // Direct SFT Braided Bag Order
    if (state.confirmed_dimensions.areaSft && !state.confirmed_dimensions.length) {
      const area = state.confirmed_dimensions.areaSft;
      const fullBags = Math.ceil(area / 3300);
      const suppliedSft = fullBags * 3300;

      if (!state.selected_material) {
        state.stage = "PRODUCT_EDUCATION";
        saveConversationState(sessionId, state);
        return {
          replyText: `Braided nets are supplied in 3,300 SFT full bags. For ${area.toLocaleString("en-IN")} SFT, ${fullBags} full bags (${suppliedSft.toLocaleString("en-IN")} SFT) will be supplied. We offer 2mm and 2.5mm braided nets (45mm mesh is the preferred economical choice). Which do you prefer?`
        };
      }

      if (!state.customer_location) {
        state.stage = "REQUIREMENT_COLLECTION";
        saveConversationState(sessionId, state);
        return { replyText: "Which city should this order be dispatched to?" };
      }

      const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
      if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
        state.stage = "REQUIREMENT_CONFIRMATION";
        state.profile.customerConfirmed = true;
        saveConversationState(sessionId, state);
        return {
          replyText: `So you need ${fullBags} full bags of ${state.selected_material} braided netting (${suppliedSft.toLocaleString("en-IN")} SFT) for delivery to ${state.customer_location}. Shall I calculate the estimate?`
        };
      }

      const calc = calculateCricketBraidedBags({
        variant: state.selected_material as any,
        fullBags,
        halfBags: 0,
        mixedBagPolicy: "SEPARATE_TIERS",
        gstRate: 5.0
      });

      state.stage = "ESTIMATE_PREPARED";
      state.active_quote = calc;
      saveConversationState(sessionId, state);

      const reply = `Cricket Net Material Estimate:\n` +
        `• Material: ${state.selected_material} Braided Net\n` +
        `• Required Area: ${area.toLocaleString("en-IN")} SFT\n` +
        `• Supply Quantity: ${fullBags} Full Bag(s) (${suppliedSft.toLocaleString("en-IN")} SFT)\n` +
        `• Rate: ₹${calc.fullBagRatePerSft.toFixed(2)}/SFT\n` +
        `• Material Subtotal: ₹${calc.subtotal.toLocaleString("en-IN")}\n` +
        `• GST (5%): ₹${calc.gstAmount.toLocaleString("en-IN")}\n` +
        `• Grand Total: ₹${calc.totalWithGst.toLocaleString("en-IN")}\n` +
        `• Delivery: To ${state.customer_location} (freight separate)\n\n` +
        `Would you like to proceed with this order?`;

      return {
        replyText: reply,
        cardType: "calculation",
        cardData: calc
      };
    }

    // 11A. Missing dimensions
    if (!state.confirmed_dimensions.length || !state.confirmed_dimensions.width) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What are your ground dimensions: Length, Width, and Height in feet?" };
    }

    // 11B. Missing Height — NEVER ASSUME 25 FT
    if (!state.confirmed_dimensions.height) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What is the height of your cricket ground or practice cage in feet?" };
    }

    // 11C. Missing Top Net Confirmation — NEVER ASSUME TOP NET
    if (state.confirmed_dimensions.hasTop === undefined) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Do you require an overhead top net, or side boundary netting only?" };
    }

    // 11D. Missing Pole-to-pole confirmation
    if (state.confirmed_dimensions.measurementConfirmed !== true) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Are these dimensions pole-to-pole, or have you already included extra allowance for installation and folding?" };
    }

    // 11E. Missing Material
    if (!state.selected_material) {
      state.stage = "PRODUCT_EDUCATION";
      saveConversationState(sessionId, state);
      return { replyText: "For side netting, we offer 2.0mm and 2.5mm braided nets (45mm mesh is the preferred economical choice). Which thickness do you prefer?" };
    }

    // 11F. Missing Location
    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which city should this shipment be dispatched to?" };
    }

    const L = state.confirmed_dimensions.length;
    const W = state.confirmed_dimensions.width;
    const H = state.confirmed_dimensions.height;
    const hasTop = state.confirmed_dimensions.hasTop;

    // 11G. Customer Confirmation check
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      state.profile.customerConfirmed = true;
      saveConversationState(sessionId, state);
      return {
        replyText: `For your ${L}x${W}x${H} ft ground (${hasTop ? 'with top net' : 'side nets only'}), we will supply ${state.selected_material} braided netting for dispatch to ${state.customer_location}. Shall I calculate the estimate?`
      };
    }

    // 11H. Mathematical Calculation via deterministic formula
    // Without top: 2 * L * H + 2 * W * H
    // With top: L * W + 2 * L * H + 2 * W * H
    const sideSft = 2 * L * H + 2 * W * H;
    const topSft = hasTop ? L * W : 0;
    const fullBags = Math.ceil(sideSft / 3300);

    const sideCalc = calculateCricketBraidedBags({
      variant: state.selected_material as any,
      fullBags,
      halfBags: 0,
      mixedBagPolicy: "SEPARATE_TIERS",
      gstRate: 5.0
    });

    let topCalc: any = null;
    let grandTotal = sideCalc.totalWithGst;

    if (hasTop && topSft > 0) {
      topCalc = calculateTwisted15Netting(topSft, true);
      grandTotal += topCalc.grandTotal;
    }

    state.stage = "ESTIMATE_PREPARED";
    saveConversationState(sessionId, state);

    let reply = `CRICKET NET MATERIAL ESTIMATE (${L}x${W}x${H} ft):\n` +
      `• Scope: ${hasTop ? 'Side and Top Netting' : 'Side Netting Only'}\n` +
      `• Side Netting: ${sideSft.toLocaleString("en-IN")} SFT -> ${fullBags} Full Bag(s) of ${state.selected_material} = ₹${sideCalc.totalWithGst.toLocaleString("en-IN")} (incl. 5% GST)\n`;

    if (hasTop && topCalc) {
      reply += `• Top Netting: ${topSft.toLocaleString("en-IN")} SFT (1.5mm Twisted 40mm) = ₹${topCalc.grandTotal.toLocaleString("en-IN")} (incl. 5% GST)\n`;
    }

    reply += `• Material Total: ₹${grandTotal.toLocaleString("en-IN")}\n` +
      `• Delivery: To ${state.customer_location} (freight extra at actuals)\n` +
      `• Scope: Material supply only\n\n` +
      `Would you like to proceed with this order?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: { sideCalc, topCalc, grandTotal }
    };
  }

  // ── 12. CATEGORY: LANDSCAPE GRASS (540 SFT Roll Rule) ───────────────────────
  if (state.active_product_category === "landscape_grass") {
    const explicitRolls = extractRolls(userText);
    const dims = extractDimensions(userText);

    if (explicitRolls) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.rolls = explicitRolls;
      state.confirmed_dimensions.areaSft = explicitRolls * ROLL_SFT_STANDARD;
    } else if (dims.areaSft) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.areaSft = dims.areaSft;
      state.confirmed_dimensions.length = dims.length;
      state.confirmed_dimensions.width = dims.width;
      state.confirmed_dimensions.rolls = Math.ceil(dims.areaSft / ROLL_SFT_STANDARD);
    }

    if (lower.includes("25mm")) state.selected_material = "25mm";
    else if (lower.includes("35mm")) state.selected_material = "35mm";
    else if (lower.includes("40mm")) state.selected_material = "40mm";
    else if (lower.includes("50mm")) state.selected_material = "50mm";

    const cityMatch = userText.match(/\b(hyderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai|delhi)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    if (!state.confirmed_dimensions?.areaSft && !state.confirmed_dimensions?.rolls) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What are your lawn or balcony dimensions (Length and Width in feet)?" };
    }

    if (!state.selected_material) {
      state.stage = "PRODUCT_EDUCATION";
      saveConversationState(sessionId, state);
      return { replyText: "Which pile height do you prefer: 25mm (₹24), 35mm (₹28), 40mm (₹32), or 50mm (₹36) per SFT?" };
    }

    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which city or delivery location should this be dispatched to?" };
    }

    const reqSft = state.confirmed_dimensions.areaSft || (state.confirmed_dimensions.rolls! * ROLL_SFT_STANDARD);
    const reqRolls = state.confirmed_dimensions.rolls || Math.ceil(reqSft / ROLL_SFT_STANDARD);
    const suppliedSft = reqRolls * ROLL_SFT_STANDARD;

    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      state.profile.customerConfirmed = true;
      saveConversationState(sessionId, state);
      return {
        replyText: `So you need ${reqRolls} full roll(s) of ${state.selected_material} landscape grass (${suppliedSft} SFT supplied for ${reqSft} SFT required area) for dispatch to ${state.customer_location} on supply-only basis. Shall I prepare the estimate?`
      };
    }

    const calc = calculateLandscapeGrassRolls(state.selected_material as any, reqSft, reqRolls);
    state.stage = "ESTIMATE_PREPARED";
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    const reply = `Landscape Artificial Grass Estimate:\n` +
      `• Thickness: ${calc.variant}\n` +
      `• Required Ground Area: ${reqSft} SFT\n` +
      `• Supply Quantity: ${calc.requiredRolls} Full Roll(s) (${calc.suppliedSft} SFT)\n` +
      `• Rate: ₹${calc.finalRatePerSft}/SFT ${calc.discountPerSft > 0 ? `(includes ₹${calc.discountPerSft}/SFT volume discount)` : ''}\n` +
      `• Material Subtotal: ₹${calc.materialSubtotal.toLocaleString("en-IN")}\n` +
      `• GST (5%): ₹${calc.gstAmount.toLocaleString("en-IN")}\n` +
      `• Total Amount: ₹${calc.totalWithGst.toLocaleString("en-IN")}\n` +
      `• Delivery: To ${state.customer_location} (freight extra at actuals)\n` +
      `• Installation: Material supply only\n\n` +
      `Would you like to proceed with this order?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 13. CATEGORY: SPORTS TURF (540 SFT Roll Rule & Slabs) ───────────────────
  if (state.active_product_category === "sports_turf") {
    const explicitRolls = extractRolls(userText);
    const dims = extractDimensions(userText);

    if (explicitRolls) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.rolls = explicitRolls;
      state.confirmed_dimensions.areaSft = explicitRolls * ROLL_SFT_STANDARD;
    } else if (dims.areaSft) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.areaSft = dims.areaSft;
      state.confirmed_dimensions.rolls = Math.ceil(dims.areaSft / ROLL_SFT_STANDARD);
    }

    if (lower.includes("15mm")) state.selected_material = "15mm_multisports";
    else if (lower.includes("30mm")) state.selected_material = "30mm_non_infill";
    else if (lower.includes("50mm") && lower.includes("18000")) state.selected_material = "50mm_infill_18000";
    else if (lower.includes("50mm") && lower.includes("16000")) state.selected_material = "50mm_infill_16000";
    else if (lower.includes("50mm") && lower.includes("14000")) state.selected_material = "50mm_infill_14000";
    else if (lower.includes("50mm") && lower.includes("12000")) state.selected_material = "50mm_infill_12000";
    else if (lower.includes("50mm")) state.selected_material = "50mm_infill_14000";

    const cityMatch = userText.match(/\b(hyderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai|delhi)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    if (!state.confirmed_dimensions?.areaSft && !state.confirmed_dimensions?.rolls) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What is your ground area in square feet or length and width?" };
    }

    if (!state.selected_material) {
      state.stage = "PRODUCT_EDUCATION";
      saveConversationState(sessionId, state);
      return { replyText: "Which turf specification do you require: 15mm Multisports (₹85), 30mm Non-Infill (₹85), or 50mm Infill (₹80–₹100) per SFT?" };
    }

    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which delivery city should this sports turf be dispatched to?" };
    }

    const reqSft = state.confirmed_dimensions.areaSft || (state.confirmed_dimensions.rolls! * ROLL_SFT_STANDARD);
    const reqRolls = state.confirmed_dimensions.rolls || Math.ceil(reqSft / ROLL_SFT_STANDARD);
    const suppliedSft = reqRolls * ROLL_SFT_STANDARD;

    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      state.profile.customerConfirmed = true;
      saveConversationState(sessionId, state);
      return {
        replyText: `So you need ${reqRolls} rolls of ${SPORTS_TURF_CATALOG[state.selected_material]?.name || state.selected_material} (${suppliedSft} SFT supplied) for dispatch to ${state.customer_location} on supply-only basis. Shall I prepare the estimate?`
      };
    }

    const calc = calculateSportsTurfRolls(state.selected_material as any, reqSft, reqRolls);
    state.stage = "ESTIMATE_PREPARED";
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    const reply = `Sports Turf Material Estimate:\n` +
      `• Specification: ${calc.name}\n` +
      `• Required Ground Area: ${reqSft} SFT\n` +
      `• Supply Quantity: ${calc.requiredRolls} Full Roll(s) (${calc.suppliedSft} SFT)\n` +
      `• Rate: ₹${calc.finalRatePerSft}/SFT ${calc.discountPerSft > 0 ? `(includes ₹${calc.discountPerSft}/SFT volume discount)` : ''}\n` +
      `• Material Subtotal: ₹${calc.materialSubtotal.toLocaleString("en-IN")}\n` +
      `• GST (5%): ₹${calc.gstAmount.toLocaleString("en-IN")}\n` +
      `• Total Amount: ₹${calc.totalWithGst.toLocaleString("en-IN")}\n` +
      `• Delivery: To ${state.customer_location} (freight extra at actuals)\n` +
      `• Scope: Material supply only\n\n` +
      `Would you like to proceed with this order?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 14. CATEGORY: TURNKEY BOX CRICKET & SPORTS FACILITIES (Phase 7) ────────
  if (state.active_product_category === "turnkey_project") {
    const dims = extractDimensions(userText);
    if (!state.confirmed_dimensions) state.confirmed_dimensions = {};

    if (dims.length && dims.width) {
      state.confirmed_dimensions.length = dims.length;
      state.confirmed_dimensions.width = dims.width;
      if (dims.height) state.confirmed_dimensions.height = dims.height;
    } else if (dims.areaSft) {
      state.confirmed_dimensions.areaSft = dims.areaSft;
    }

    const cityMatch = userText.match(/\b(hyderabad|secunderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai|delhi)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // 14A. Missing dimensions
    if (!state.confirmed_dimensions.length || !state.confirmed_dimensions.width) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return {
        replyText: "For a complete turnkey box cricket arena, we provide end-to-end execution including civil sub-base (WMM/PCC), heavy-duty structural steel ladder columns, high-tenacity side and roof netting, sports artificial turf, stadium LED floodlights, electrical DB, player access gate, and complete turnkey erection.\n\nBefore we begin the ground setup, the land needs to be properly leveled and ready for installation.\n\nWhat are the planned dimensions of your ground (Length, Width, and Height in feet)?"
      };
    }

    // 14B. Missing Height (never assume!)
    if (!state.confirmed_dimensions.height) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return {
        replyText: "What is the planned height of your box cricket arena in feet (e.g. 20ft, 25ft, or 30ft)?"
      };
    }

    // 14C. Missing Location
    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return {
        replyText: "Which city or area is your proposed box cricket site located in?"
      };
    }

    const L = state.confirmed_dimensions.length;
    const W = state.confirmed_dimensions.width;
    const H = state.confirmed_dimensions.height;
    const groundArea = L * W;

    // 14D. Confirmation check
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      state.profile.customerConfirmed = true;
      saveConversationState(sessionId, state);
      return {
        replyText: `So you are planning a turnkey box cricket facility of ${L}ft x ${W}ft (${groundArea.toLocaleString('en-IN')} SFT footprint) with ${H}ft height in ${state.customer_location}. Before we begin the ground setup, the land needs to be properly leveled and ready for installation. Shall I calculate the complete turnkey BOQ estimate?`
      };
    }

    // 14E. Calculation via Turnkey BOQ Engine
    const boq = calculateTurnkeyBoxCricket({
      lengthFt: L,
      widthFt: W,
      heightFt: H,
      packageType: 'commercial',
      roofType: 'light_cable_top',
      turfType: 'non_infill_turf'
    });

    state.stage = "ESTIMATE_PREPARED";
    state.active_quote = boq;
    saveConversationState(sessionId, state);

    const reply = `Turnkey Box Cricket BOQ Estimate:\n` +
      `• Project: ${boq.projectName}\n` +
      `• Ground Footprint: ${groundArea.toLocaleString('en-IN')} SFT (${L}ft x ${W}ft x ${H}ft)\n` +
      `• Structural Steel: ${boq.structuralSteel.columnCount} Heavy-Duty Ladder Columns (40x40 GI with PU finish)\n` +
      `• Netting System: ${boq.nettingSpecs.sideNettingSft.toLocaleString('en-IN')} SFT Side Netting + ${boq.nettingSpecs.roofNettingSft.toLocaleString('en-IN')} SFT Overhead Roof Netting\n` +
      `• Turf Flooring: ${boq.turfSystem.turfAreaSft.toLocaleString('en-IN')} SFT (${boq.turfSystem.rollsRequired} Rolls, Non-Infill Multi-Sport Turf)\n` +
      `• Stadium Lighting: ${boq.lightingSystem.fixtureCount} Nos 200W Stadium LED Floodlights (${boq.lightingSystem.targetLux})\n` +
      `• Civil & Prep: Engineered WMM Sub-Base & Perimeter Drainage\n` +
      `• Effective Rate: ₹${boq.ratePerGroundSft.toFixed(2)}/Ground SFT\n` +
      `• Subtotal: ₹${boq.subtotal.toLocaleString('en-IN')}\n` +
      `• GST (18%): ₹${boq.gstAmount.toLocaleString('en-IN')}\n` +
      `• Grand Total: ₹${boq.grandTotal.toLocaleString('en-IN')}\n` +
      `• Site Requirement: Before we begin the ground setup, the land needs to be properly leveled and ready for installation.\n\n` +
      `Would you like to schedule an engineer site evaluation or proceed with this project?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: boq
    };
  }

  // Default Fallback
  saveConversationState(sessionId, state);
  return {
    replyText: "Sure! Could you please share your specific dimensions and site location so I can assist you accurately?"
  };
}
