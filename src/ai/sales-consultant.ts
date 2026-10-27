/**
 * Chat GCM — Human Sales Consultant & Dialog Engine (2026 Enterprise Edition)
 * Strictly adheres to Chat GCM Critical AI Sales Conversation & Estimation Fix:
 * 1. Introduction once per conversation (persistent state)
 * 2. Requirement-First: Understand -> Collect -> Clarify -> Recommend -> Confirm -> Calculate -> Approve -> Quote
 * 3. Never quote prematurely
 * 4. 1-2 short natural sentences, one question at a time
 * 5. Clean product context locking & switching (with requirement isolation)
 * 6. Supply-only roll calculation for grass & turf (540 SFT/roll, CEILING, discounts per roll, 5% GST)
 * 7. Cricket net mandatory pole-to-pole confirmation & material separation (45mm mesh preferred economical)
 * 8. Balcony nets: strictly genuine RUSSEA™ brand, 100 SFT boundary correction, zero Garware/hooks
 * 9. Invisible Grills: deterministic schedule (<60 SFT = ₹10k fixed, 60-100 ₹160, +₹30 outside Hyd)
 * 10. Cloth Hangers: deterministic 4-8ft ceiling/wall calculation + ₹500 outside Hyd
 * 11. Multiline professional estimate formatting for WhatsApp & Web Chat cards
 * 12. Strict quotation gate & physical visit rules (no hardcoded ₹300 fee)
 */

import { 
  ConversationState, 
  ProductCategory, 
  getConversationState, 
  saveConversationState, 
  switchProductCategory 
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
  LANDSCAPE_GRASS_CATALOG,
  SPORTS_TURF_CATALOG,
  type InstalledNetQualityId
} from "../pricing/universal-pricing-engine.js";

import { calculateCricketNetting } from "../calculators/cricket-net-calculator.js";
import { calculateTurnkeyBoxCricket } from "../calculators/turnkey-box-calculator.js";

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

function detectLanguage(text: string): "telugu" | "hindi" | "english" {
  if (/[\u0C00-\u0C7F]/.test(text) || /\b(namaskaram|enti|cheppandi|kavali|thaggandi|vastara|chustara|rate|dharalu|meeru)\b/i.test(text)) {
    return "telugu";
  }
  if (/[\u0900-\u097F]/.test(text) || /\b(namaste|kitna|chahiye|batao|karo|bhejo|hoga|hai|aap)\b/i.test(text)) {
    return "hindi";
  }
  return "english";
}

function normalizeText(text: string): string {
  return text
    .replace(/[\u00D7\u2715\u2716\u2A2F\u2217]/g, " x ")
    .replace(/(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?/gi, "$1 x $2")
    .replace(/(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?/gi, "$1 x $2 x $3");
}

function extractDimensions(rawText: string): { length?: number; width?: number; height?: number; areaSft?: number } {
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

  // 2D match: e.g. "18 x 9"
  const dim2D = text.match(/(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+(?:\.\d+)?)/i);
  if (dim2D) {
    const l = parseFloat(dim2D[1]);
    const w = parseFloat(dim2D[2]);
    return {
      length: l,
      width: w,
      areaSft: Math.round(l * w)
    };
  }

  // SFT match: e.g. "16000sft", "2000 sft"
  const sftMatch = text.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:sq\s*ft|sqft|sft|square\s*feet|sq\s*feet|sq\.ft|s\.f\.t)/i);
  if (sftMatch) {
    const rawNum = sftMatch[1].replace(/,/g, "");
    return { areaSft: Math.round(parseFloat(rawNum)) };
  }

  return {};
}

function extractFloorNumber(text: string): string | null {
  const match = text.match(/\b(\d+)\s*(?:st|nd|rd|th)?\s*floor|\bfloor\s*(\d+)|\b(\d+)floor\b/i);
  if (match) {
    return match[1] || match[2] || match[3];
  }
  return null;
}

function extractRolls(text: string): number | undefined {
  const rollsMatch = text.match(/(\d+)\s*(?:full\s*)?rolls?\b/i);
  if (rollsMatch) {
    return parseInt(rollsMatch[1], 10);
  }
  return undefined;
}

function detectProductCategory(text: string): ProductCategory | null {
  const lower = text.toLowerCase();

  if (lower.includes("cricket") || lower.includes("batting net") || lower.includes("bowling net") || lower.includes("pitch net") || lower.includes("cage net") || lower.includes("braided net")) {
    return "cricket_net";
  }

  if (lower.includes("artificial grass") || lower.includes("landscape grass") || lower.includes("balcony grass") || lower.includes("garden grass") || (lower.includes("grass") && !lower.includes("turf accessories"))) {
    return "landscape_grass";
  }

  if (lower.includes("sports turf") || lower.includes("football turf") || lower.includes("turf") || lower.includes("50mm turf") || lower.includes("multisport")) {
    return "sports_turf";
  }

  if (lower.includes("pigeon") || lower.includes("balcony net") || lower.includes("safety net") || lower.includes("bird net") || lower.includes("cat net") || lower.includes("monkey net") || lower.includes("పావురాల") || lower.includes("కబూతర్") || lower.includes("कबूतर")) {
    return "pigeon_safety_net";
  }

  if (lower.includes("invisible grill") || lower.includes("ss grill") || lower.includes("stainless steel grill") || lower.includes("గ్రిల్స్") || lower.includes("ग्रिल")) {
    return "invisible_grill";
  }

  if (lower.includes("cloth") || lower.includes("hanger") || lower.includes("drying") || lower.includes("pulley") || lower.includes("హ్యాంగర్") || lower.includes("हैंगर")) {
    return "cloth_hanger";
  }

  if (lower.includes("silica sand") || lower.includes("rubber granule") || lower.includes("speb 7") || lower.includes("seaming tape")) {
    return "turf_accessories";
  }

  if (lower.includes("turnkey") || lower.includes("box cricket")) {
    return "turnkey_project";
  }

  return null;
}

// ── Product Education / Customer Question Interceptor ────────────────────────

function handleProductInquiry(text: string, category: ProductCategory | null, state: ConversationState): string | null {
  const lower = text.toLowerCase();

  // 1. Difference between thickness / 2mm vs 2.5mm
  if (/(difference|diff|compare|2mm\s*vs\s*2\.5mm|2\.5mm\s*vs\s*2mm|which\s*is\s*better|better\s*quality)/i.test(lower)) {
    if (category === "cricket_net" || lower.includes("cricket")) {
      return "For cricket nets, 2mm braided net (45mm mesh) is lightweight and very economical for general practice, while 2.5mm braided net is commercial heavy-duty with higher breaking strength, ideal for ground side walls and tournament cages. For overhead roof netting, 1.5mm twisted net is the recommended lightweight option.";
    }
    return "Our 2.0mm genuine RUSSEA™ braided net (₹20/SFT) is designed for pigeon and child safety with a 5-year replacement warranty. Our 2.5mm heavy-duty braided net (₹21/SFT) has higher tensile strength, making it ideal if you need protection against monkeys or active pets, backed by an 8-year warranty.";
  }

  // 2. Types of nets / Options / Varieties
  if (/(types?\s*of|variet|options?|what\s*(?:are\s*the\s*)?types|types\?+|which\s*(?:net|grass|turf|grill)\s*(?:is|to)|kinds?\s*of|available\s*types)/i.test(lower)) {
    if (category === "pigeon_safety_net" || category === null || lower.includes("safety") || lower.includes("balcony") || lower.includes("net")) {
      const dimMention = state.confirmed_dimensions && state.confirmed_dimensions.areaSft ? (" for your " + state.confirmed_dimensions.areaSft + " SFT balcony") : "";
      return "For balcony safety, we provide 3 main options, sir:\n1. 2.0mm genuine RUSSEA™ HDPE Net (economical & strong, 5-year warranty)\n2. 2.5mm Braided Heavy-Duty Net (extra strong for monkeys & pets, 8-year warranty)\n3. AISI 316 Stainless Steel Invisible Grills (ultra-modern with clear view, 10-year warranty)\n\nWhich type would you prefer" + dimMention + "?";
    }
    if (category === "cricket_net" || lower.includes("cricket")) {
      return "For cricket nets, we supply:\n• 2mm Braided Net (45mm or 40mm mesh) — lightweight & economical\n• 2.5mm Braided Net (45mm preferred economical, or 40mm mesh) — professional heavy-duty for ground sides\n• 1.5mm Twisted Net (40mm mesh) — lightweight overhead top net for large grounds\n\nWould you prefer 2mm or 2.5mm for your setup?";
    }
    if (category === "landscape_grass" || lower.includes("grass")) {
      return "We supply premium landscape artificial grass in 4 thicknesses:\n• 25mm: ₹24/SFT (economical for balconies & indoor decor)\n• 35mm: ₹28/SFT (popular plush feel for balconies & gardens)\n• 40mm: ₹32/SFT (dense luxury lawn feel)\n• 50mm: ₹36/SFT (ultra-dense super soft)\nAll supplied in 540 SFT full rolls with volume discounts from 2+ rolls.";
    }
    if (category === "invisible_grill" || lower.includes("grill")) {
      return "Our invisible grills use genuine AISI 316 Marine Grade stainless steel cables with DuPont nylon coating (450+ kg tensile load). We offer 2-inch and 3-inch gap spacing options with high-grade aluminum track fixings and a 10-year rust guarantee.";
    }
  }

  // 3. Monkey / Pets / Bird safety inquiry
  if (/(monkey|monkeys|cat|cats|dog|dogs|pet|pets|bite|chew|torn|tear)/i.test(lower) || (/(block|stop|prevent|keep\s*away|protection|safe\s*from|trouble|menace|effective)/i.test(lower) && /(pigeon|bird)/i.test(lower))) {
    if (lower.includes("monkey") || lower.includes("cat") || lower.includes("pet")) {
      return "For protection against monkeys and pets, our 2.5mm heavy-duty braided net or AISI 316 stainless steel invisible grills are the best choice, sir. Standard 2.0mm nets are for pigeons and child safety, whereas 2.5mm braided nets and SS grills cannot be chewed or torn by monkeys or pets. Would you like a quote for the 2.5mm heavy-duty option?";
    }
    return "Our genuine RUSSEA™ 2.0mm 40mm/45mm mesh completely blocks pigeons, sparrows, and other birds while ensuring 100% natural breeze and sunlight into your balcony.";
  }

  // 4. Warranty / Life / Durability
  if (/(warranty|guarantee|durability|life\s*span|how\s*many\s*years|how\s*long|sun|rain|weather)/i.test(lower)) {
    return "All our nets are 100% virgin HDPE, UV-stabilized against harsh sun and rain. We provide:\n• 5-year written replacement warranty on 2.0mm standard nets\n• 8-year warranty on 2.5mm heavy-duty braided nets\n• 10-year rust guarantee on AISI 316 invisible grills.\nIf there is any sun degradation, we replace it free of charge.";
  }

  // 5. Colors / Visibility / Airflow / Lighting
  if (/(color|colours?|transparent|translucent|white|green|sunlight|breeze|airflow|block\s*light|view)/i.test(lower)) {
    return "Balcony safety nets are available in translucent white and green. They allow 100% natural light and full breeze into your balcony without blocking your view. If you want a completely unobstructed modern look, our transparent 316 stainless steel invisible grills are also an excellent option. Which do you prefer?";
  }

  // 6. Installation method / Process / Tile damage
  if (/(how\s*(?:do\s*you\s*)?install|installation\s*process|how\s*is\s*it\s*fixed|drill|drilling|tile\s*damage|damage)/i.test(lower)) {
    return "For safety nets, our certified technicians install stainless steel fasteners along the balcony border, stretch the net drum-tight using border ropes, and secure it seamlessly without sagging or damaging your balcony tiles. Complete installation is handled by our team in just 2 to 3 hours.";
  }

  return null;
}

// ── Dialog Execution ─────────────────────────────────────────────────────────

export function handleSalesConversation(input: SalesConsultantInput): SalesConsultantOutput {
  const { sessionId, userText, websiteId } = input;
  const state = getConversationState(sessionId);
  const lang = detectLanguage(userText);
  const lower = userText.toLowerCase().trim();

  // 1. Identity Question Check ("Who are you?", "Are you AI?")
  const isAskingIdentity = /(who\s*are\s*you|which\s*company|your\s*name|who\s*is\s*this|meeru\s*evaru|aap\s*kaun\s*hai)/i.test(lower);
  if (isAskingIdentity) {
    const idReply = lang === "telugu"
      ? "నేను జిసిఎమ్ ఎంటర్‌ప్రైజెస్ నుండి వెంకటేష్ ని సర్, సేల్స్ కన్సల్టెంట్‌ని. నేను మీకు ఎలా సహాయపడగలను?"
      : lang === "hindi"
      ? "मैं जीसीएम एंटरप्राइजेज से वेंकटेश बात कर रहा हूँ। मैं आपकी क्या सहायता कर सकता हूँ?"
      : "Hi, I'm Venkatesh from GCM Enterprises. How can I help you?";
    saveConversationState(sessionId, state);
    return { replyText: idReply };
  }

  // 2. Initial Introduction (Only ONCE per conversation)
  const isGreetingOnly = /^(hi|hello|hey|namaste|good\s*morning|good\s*evening|good\s*afternoon|నమస్కారం|హలో|नमस्ते|హాయ్)\b/i.test(lower) && lower.split(/\s+/).length <= 3;
  
  if (!state.introduction_completed) {
    state.introduction_completed = true;

    if (isGreetingOnly) {
      state.stage = "GREETING";
      saveConversationState(sessionId, state);
      const introReply = lang === "telugu"
        ? "నమస్కారం, నేను జిసిఎమ్ ఎంటర్‌ప్రైజెస్ నుండి వెంకటేష్ ని. నేను మీకు ఎలా సహాయపడగలను సర్?"
        : lang === "hindi"
        ? "नमस्ते, मैं जीसीएम एंटरप्राइजेज से वेंकटेश बात कर रहा हूँ। मैं आपकी क्या सहायता कर सकता हूँ?"
        : "Hi, I'm Venkatesh from GCM Enterprises. How can I help you?";
      return { replyText: introReply };
    }
  }

  // If customer repeats a pure greeting in an active conversation
  if (isGreetingOnly && state.introduction_completed) {
    if (state.active_product_category === "landscape_grass") {
      return { replyText: "Hi! Are you looking for balcony or ground artificial grass?" };
    } else if (state.active_product_category === "cricket_net") {
      return { replyText: "Hello! What are your cricket ground dimensions (length, width, and height)?" };
    } else if (state.active_product_category === "pigeon_safety_net") {
      return { replyText: "Hello! What are your balcony dimensions (length and height in feet)?" };
    } else {
      return { replyText: "Hello! How can I assist you with your netting, grass, or grill requirement today?" };
    }
  }

  // 3. Product Category Detection & Clean Switching
  const detectedCat = detectProductCategory(userText);
  if (detectedCat && detectedCat !== state.active_product_category) {
    switchProductCategory(state, detectedCat);
  }

  // ── 3A. Turnkey Project Request ───────────────────────────────────────────
  if (state.active_product_category === "turnkey_project" || lower.includes("turnkey") || lower.includes("box cricket cost")) {
    const dims = extractDimensions(userText);
    if (dims.length && dims.width) {
      const L = dims.length;
      const W = dims.width;
      const H = dims.height || 25;
      const turnkey = calculateTurnkeyBoxCricket({ lengthFt: L, widthFt: W, heightFt: H });
      state.stage = "ESTIMATE_PREPARED";
      saveConversationState(sessionId, state);

      const reply = `For a turnkey box cricket ground of ${L}x${W}x${H} ft (${turnkey.dimensions.groundAreaSft.toLocaleString("en-IN")} SFT), the complete turnkey project estimate is ₹${turnkey.grandTotal.toLocaleString("en-IN")} including concrete pitch, steel cage fabrication, 50mm non-infill sports turf, 2.5mm heavy-duty enclosure netting, and 8x stadium floodlights. Would you like to schedule a site inspection?`;
      return {
        replyText: reply,
        cardType: "turnkey_boq",
        cardData: turnkey
      };
    }

    state.stage = "REQUIREMENT_COLLECTION";
    saveConversationState(sessionId, state);
    return {
      replyText: "Yes, we undertake turnkey sports ground setup including turf, cage netting, and fabrication based on site specifications. What are your ground dimensions and site location to discuss the scope?"
    };
  }

  // ── 3B. Unknown Dimensions / Site Visit Rules (No hardcoded ₹300 fee) ───────
  const isUnknownDimensions = /(don'?t\s*know|do\s*not\s*know|not\s*sure|no\s*idea|cannot\s*measure|can'?t\s*measure|no\s*measurements?|measurements?\s*lekapothe|theliyadu|maloom\s*nahi|pata\s*nahi)/i.test(lower);
  const isSiteVisitRequested = /(site\s*visit|come\s*and\s*measure|visit\s*my\s*place|send\s*someone|vastara|chustara|inspection)/i.test(lower);

  if (isUnknownDimensions || isSiteVisitRequested) {
    if (state.active_product_category === "landscape_grass" || state.active_product_category === "sports_turf") {
      state.stage = "PRODUCT_EDUCATION";
      saveConversationState(sessionId, state);
      return {
        replyText: "Artificial grass is material supply-only by full rolls (540 SFT/roll). You can measure the approximate length and width with a measuring tape, or share site photos so we can guide your roll estimate."
      };
    } else {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return {
        replyText: "You can measure the length and height in feet using a standard measuring tape, or share balcony photos. In Hyderabad, we can also schedule our technical team for an on-site laser measurement visit. Would you like to schedule a visit?"
      };
    }
  }

  // ── 3C. Customer Frustration Guardrail ─────────────────────────────────────
  const isFrustrated = /(not\s*getting\s*my\s*point|not\s*understanding|don'?t\s*understand|not\s*listening|you\s*are\s*not\s*getting|point\s*artham|artham\s*kavatledu|samajh\s*nahi)/i.test(lower);
  if (isFrustrated) {
    saveConversationState(sessionId, state);
    return {
      replyText: "Apologies for the confusion, sir! Let me help you directly. Could you please share your site measurements or requirement so I can assist you accurately?"
    };
  }

  // ── 3D. Intercept Customer Product Questions / Inquiries First ────────────
  const productInquiryReply = handleProductInquiry(userText, state.active_product_category, state);
  if (productInquiryReply) {
    state.stage = "PRODUCT_EDUCATION";
    saveConversationState(sessionId, state);
    return { replyText: productInquiryReply };
  }

  // If no active category yet, ask to identify
  if (!state.active_product_category) {
    state.stage = "DISCOVERY";
    saveConversationState(sessionId, state);
    return {
      replyText: "Sure. Which product are you looking for: cricket nets, balcony safety nets, artificial grass, or invisible grills?"
    };
  }

  // ── 4. CATEGORY: LANDSCAPE ARTIFICIAL GRASS (540 SFT Roll Rule) ─────────────
  if (state.active_product_category === "landscape_grass") {
    if (lower.includes("installation") || lower.includes("fitting") || lower.includes("fit cheyali")) {
      state.supply_or_installation = "supply_only";
      saveConversationState(sessionId, state);
      return {
        replyText: "All artificial grass and sports turf products are supply only at the configured material prices. Installation is to be arranged by the customer locally."
      };
    }

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

    if (!state.confirmed_dimensions?.areaSft) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What is your measured area, or do you have the length and width?" };
    }

    if (!state.selected_material) {
      state.stage = "PRODUCT_RECOMMENDATION";
      saveConversationState(sessionId, state);
      return { replyText: "Which thickness do you prefer: 25mm (₹24), 35mm (₹28), 40mm (₹32), or 50mm (₹36) per SFT?" };
    }

    const reqSft = state.confirmed_dimensions.areaSft;
    const reqRolls = state.confirmed_dimensions.rolls || Math.ceil(reqSft / ROLL_SFT_STANDARD);
    const suppliedSft = reqRolls * ROLL_SFT_STANDARD;

    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which city or delivery location should this be dispatched to?" };
    }

    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|send\s*quote|avunu|sare|ha|theek\s*hai)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      saveConversationState(sessionId, state);
      return {
        replyText: `So you need ${reqRolls} rolls of ${state.selected_material} landscape grass (${suppliedSft} SFT) for delivery to ${state.customer_location} on supply-only basis. Shall I prepare the estimate?`
      };
    }

    const variant = state.selected_material as "25mm" | "35mm" | "40mm" | "50mm";
    const calc = calculateLandscapeGrassRolls(variant, reqSft, reqRolls);
    state.stage = "ESTIMATE_PREPARED";
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    const reply = `Material: Landscape Grass (${calc.variant})\n` +
      `Required Area: ${reqSft} SFT\n` +
      `Supply Quantity: ${calc.requiredRolls} Full Roll(s)\n` +
      `Supplied Area: ${calc.suppliedSft} SFT\n` +
      `Rate: ₹${calc.finalRatePerSft}/SFT (Discount: ₹${calc.discountPerSft}/SFT)\n` +
      `Material Subtotal: ₹${calc.materialSubtotal.toLocaleString("en-IN")}\n` +
      `GST (5%): ₹${calc.gstAmount.toLocaleString("en-IN")}\n` +
      `Total: ₹${calc.totalWithGst.toLocaleString("en-IN")}\n` +
      `Delivery: To ${state.customer_location} (freight extra)\n` +
      `Installation: Not included (supply only)\n\n` +
      `Would you like to proceed with this order?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 5. CATEGORY: PREMIUM SPORTS TURF (540 SFT Roll Rule) ───────────────────
  if (state.active_product_category === "sports_turf") {
    if (lower.includes("installation") || lower.includes("fitting")) {
      state.supply_or_installation = "supply_only";
      saveConversationState(sessionId, state);
      return {
        replyText: "Sports turf is material supply only, sir. Installation, adhesive, and transport are charged separately as per project scope."
      };
    }

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

    if (!state.confirmed_dimensions?.areaSft) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What is your sports turf area in square feet or pitch dimensions?" };
    }

    if (!state.selected_material) {
      state.stage = "PRODUCT_RECOMMENDATION";
      saveConversationState(sessionId, state);
      return { replyText: "Which turf specification do you require: 15mm Multisports (₹85), 30mm Non-Infill (₹85), or 50mm Infill (₹80–₹100) per SFT?" };
    }

    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which delivery location should this sports turf be dispatched to?" };
    }

    const reqSft = state.confirmed_dimensions.areaSft;
    const reqRolls = state.confirmed_dimensions.rolls || Math.ceil(reqSft / ROLL_SFT_STANDARD);
    const suppliedSft = reqRolls * ROLL_SFT_STANDARD;

    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      saveConversationState(sessionId, state);
      return {
        replyText: `So you need ${reqRolls} rolls of ${SPORTS_TURF_CATALOG[state.selected_material]?.name || state.selected_material} (${suppliedSft} SFT) for delivery to ${state.customer_location} on supply-only basis. Shall I prepare the estimate?`
      };
    }

    const calc = calculateSportsTurfRolls(state.selected_material, reqSft, reqRolls);
    state.stage = "ESTIMATE_PREPARED";
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    const reply = `Material: ${calc.name}\n` +
      `Required Area: ${reqSft} SFT\n` +
      `Supply Quantity: ${calc.requiredRolls} Full Roll(s)\n` +
      `Supplied Area: ${calc.suppliedSft} SFT\n` +
      `Rate: ₹${calc.finalRatePerSft}/SFT (Discount: ₹${calc.discountPerSft}/SFT)\n` +
      `Material Subtotal: ₹${calc.materialSubtotal.toLocaleString("en-IN")}\n` +
      `GST (5%): ₹${calc.gstAmount.toLocaleString("en-IN")}\n` +
      `Total: ₹${calc.totalWithGst.toLocaleString("en-IN")}\n` +
      `Delivery: To ${state.customer_location} (transport separate)\n` +
      `Installation: Not included (supply only)\n\n` +
      `Shall we proceed with dispatch?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 6. CATEGORY: CRICKET NETS (Bags & Twisted Slabs) ───────────────────────
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

    if (lower.includes("pole to pole") || lower.includes("pole-to-pole") || lower.includes("without extra") || lower.includes("exact pole")) {
      state.confirmed_dimensions.isPoleToPole = true;
      state.confirmed_dimensions.measurementConfirmed = true;
    } else if (lower.includes("extra included") || lower.includes("extras included") || lower.includes("already included") || lower.includes("with extra")) {
      state.confirmed_dimensions.isPoleToPole = false;
      state.confirmed_dimensions.measurementConfirmed = true;
    }

    if (lower.includes("2.5mm") && lower.includes("40mm")) state.selected_material = "2.5mm_40mm";
    else if (lower.includes("2.5mm") || lower.includes("2.5mm 45mm")) state.selected_material = "2.5mm_45mm";
    else if (lower.includes("2mm") && lower.includes("40mm")) state.selected_material = "2.0mm_40mm";
    else if (lower.includes("2mm") || lower.includes("2mm 45mm")) state.selected_material = "2.0mm_45mm";

    const cityMatch = userText.match(/\b(hyderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai|delhi)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // Direct SFT Braided inquiry (e.g. 11,000 SFT or 16,000 SFT)
    if (state.confirmed_dimensions.areaSft && !state.confirmed_dimensions.length) {
      const area = state.confirmed_dimensions.areaSft;
      const fullBags = Math.ceil(area / 3300);
      const suppliedSft = fullBags * 3300;

      if (!state.selected_material) {
        state.stage = "PRODUCT_RECOMMENDATION";
        saveConversationState(sessionId, state);
        return {
          replyText: `For braided nets, standard packing is 3,300 SFT per full bag. For ${area.toLocaleString("en-IN")} SFT, ${fullBags} full bags (${suppliedSft.toLocaleString("en-IN")} SFT) will be supplied. We offer 2mm and 2.5mm braided nets (45mm mesh is the preferred economical choice). Which do you prefer?`
        };
      }

      if (!state.customer_location) {
        state.stage = "REQUIREMENT_COLLECTION";
        saveConversationState(sessionId, state);
        return { replyText: "Which city or delivery location should this be dispatched to?" };
      }

      const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
      if (state.stage !== "REQUIREMENT_CONFIRMATION" && !isCustomerConfirming) {
        state.stage = "REQUIREMENT_CONFIRMATION";
        saveConversationState(sessionId, state);
        return {
          replyText: `So you need ${fullBags} full bags of ${state.selected_material} braided nets (${suppliedSft.toLocaleString("en-IN")} SFT) for delivery to ${state.customer_location}. Shall I calculate the estimate?`
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

      const reply = `Material: ${state.selected_material} Braided Net\n` +
        `Required Area: ${area.toLocaleString("en-IN")} SFT\n` +
        `Supply Quantity: ${fullBags} Full Bag(s)\n` +
        `Supplied Area: ${suppliedSft.toLocaleString("en-IN")} SFT\n` +
        `Rate: ₹${calc.fullBagRatePerSft.toFixed(2)}/SFT\n` +
        `Material Subtotal: ₹${calc.subtotal.toLocaleString("en-IN")}\n` +
        `GST (5%): ₹${calc.gstAmount.toLocaleString("en-IN")}\n` +
        `Total: ₹${calc.totalWithGst.toLocaleString("en-IN")}\n` +
        `Delivery: To ${state.customer_location} (freight separate)\n` +
        `Installation: Not included (supply only)\n\n` +
        `Would you like to proceed with this order?`;

      return {
        replyText: reply,
        cardType: "calculation",
        cardData: calc
      };
    }

    // Missing dimensions
    if (!state.confirmed_dimensions.length || !state.confirmed_dimensions.width) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What are your ground dimensions: Length, Width, and Height in feet?" };
    }

    if (!state.confirmed_dimensions.height) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "What is the height of your cricket ground or cage in feet?" };
    }

    const L = state.confirmed_dimensions.length;
    const W = state.confirmed_dimensions.width;
    const H = state.confirmed_dimensions.height;

    // Deterministic calculation via cricket-net-calculator
    const netMath = calculateCricketNetting({
      lengthFt: L,
      widthFt: W,
      heightFt: H,
      includeRoof: true,
      isPoleToPole: state.confirmed_dimensions.isPoleToPole ?? true,
      measurementConfirmed: state.confirmed_dimensions.measurementConfirmed ?? false
    });

    // Step 2: Pole-to-pole confirmation question if unconfirmed
    if (state.confirmed_dimensions.measurementConfirmed !== true) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return {
        replyText: "Are these pole-to-pole dimensions, or have you already included extra material for folding and installation?",
        cardType: "calculation",
        cardData: netMath
      };
    }

    // Step 3: Material selection
    if (!state.selected_material) {
      state.stage = "PRODUCT_RECOMMENDATION";
      saveConversationState(sessionId, state);
      return {
        replyText: "For side nets, we offer 2mm and 2.5mm braided nets (45mm or 40mm mesh). 45mm mesh is the preferred economical choice. Which would you prefer?",
        cardType: "calculation",
        cardData: netMath
      };
    }

    // Step 4: Location
    if (!state.customer_location) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return { replyText: "Which delivery city or pincode should this be dispatched to?" };
    }

    // Step 5: Confirmation before finalized pricing
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      saveConversationState(sessionId, state);
      return {
        replyText: `For your ${L}x${W}x${H} ft ground, side netting requires ${netMath.sideNetting.requiredSft.toLocaleString("en-IN")} SFT (${state.selected_material}) and top netting is ${netMath.topNetting.requiredSft.toLocaleString("en-IN")} SFT for delivery to ${state.customer_location}. Shall I prepare the estimation?`,
        cardType: "calculation",
        cardData: netMath
      };
    }

    // Step 6: Calculation breakdown
    const sideSft = netMath.sideNetting.requiredSft;
    const topSft = netMath.topNetting.requiredSft;
    const fullBags = Math.ceil(sideSft / 3300);

    const sideCalc = calculateCricketBraidedBags({
      variant: state.selected_material as any,
      fullBags,
      halfBags: 0,
      mixedBagPolicy: "SEPARATE_TIERS",
      gstRate: 5.0
    });

    const topCalc = calculateTwisted15Netting(topSft, true);
    const grandTotal = sideCalc.totalWithGst + topCalc.grandTotal;

    state.stage = "ESTIMATE_PREPARED";
    saveConversationState(sessionId, state);

    const reply = `Cricket Netting Estimate (${L}x${W}x${H} ft Court):\n` +
      `• Side Netting: ${sideSft.toLocaleString("en-IN")} SFT -> ${fullBags} Full Bag(s) of ${state.selected_material} = ₹${sideCalc.totalWithGst.toLocaleString("en-IN")} (incl. 5% GST)\n` +
      `• Top Netting: ${topSft.toLocaleString("en-IN")} SFT (1.5mm Twisted 40mm) = ₹${topCalc.grandTotal.toLocaleString("en-IN")} (incl. ₹0.50 customisation & 5% GST)\n` +
      `• Grand Total: ₹${grandTotal.toLocaleString("en-IN")} (Material Supply)\n` +
      `• Delivery: To ${state.customer_location}\n\n` +
      `Would you like to proceed with this order?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: {
        netMath,
        sideCalc,
        topCalc,
        grandTotal
      }
    };
  }

  // ── 7. CATEGORY: BALCONY SAFETY & PIGEON NETS ──────────────────────────────
  if (state.active_product_category === "pigeon_safety_net") {
    const dims = extractDimensions(userText);
    if (dims.areaSft) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.areaSft = dims.areaSft;
      state.confirmed_dimensions.length = dims.length;
      state.confirmed_dimensions.width = dims.width;
    }

    const cityMatch = userText.match(/\b(hyderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // Material variant selection
    if (lower.includes("1.5mm") && (lower.includes("30mm") || lower.includes("twisted"))) state.selected_material = "1.5mm_30mm";
    else if ((lower.includes("2.5mm") || lower.includes("2.5")) && lower.includes("40mm")) state.selected_material = "2.5mm_40mm";
    else if (lower.includes("2.5mm") || lower.includes("2.5") || lower.includes("monkey") || lower.includes("pet")) state.selected_material = "2.5mm_45mm";
    else if ((lower.includes("2mm") || lower.includes("2.0mm") || lower.includes("2.0")) && lower.includes("40mm")) state.selected_material = "2.0mm_40mm";
    else if (lower.includes("2mm") || lower.includes("2.0mm") || lower.includes("2.0") || lower.includes("pigeon") || lower.includes("child")) state.selected_material = "2.0mm_45mm";

    // Step 1: Missing dimensions
    if (!state.confirmed_dimensions?.areaSft) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      return {
        replyText: "What are your balcony dimensions (Length x Height in feet), or how many balconies do you have?"
      };
    }

    if (!state.customer_location) {
      state.customer_location = "Hyderabad";
    }

    const area = state.confirmed_dimensions.areaSft;

    // Step 2: Quality/Thickness recommendation if not chosen
    if (!state.selected_material) {
      state.stage = "PRODUCT_RECOMMENDATION";
      saveConversationState(sessionId, state);
      return {
        replyText: `For your ${area} SFT balcony, we offer genuine RUSSEA™ 2.0mm (standard bird & child safety with 5-year warranty) or 2.5mm braided (heavy-duty monkey & pet safety with 8-year warranty). Which quality do you prefer?`
      };
    }

    // Step 3: Confirmation
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower) || lower.includes("calculate") || lower.includes("quote");
    if (!isCustomerConfirming && state.stage !== "REQUIREMENT_CONFIRMATION") {
      state.stage = "REQUIREMENT_CONFIRMATION";
      saveConversationState(sessionId, state);
      const qualityName = state.selected_material === "2.5mm_45mm" ? "2.5mm Heavy-Duty Braided Net" : "2.0mm Braided Net";
      return {
        replyText: `So you require genuine RUSSEA™ ${qualityName} for ${area} SFT with complete professional installation and stainless steel fasteners. Shall I calculate the estimate?`
      };
    }

    // Step 4: Deterministic calculation (Strictly follows 7 approved slabs & 100 SFT boundary)
    const qualityId = (state.selected_material || "2.0mm_45mm") as InstalledNetQualityId;
    const calc = calculateInstalledSafetyNet(qualityId, area, "standard");
    state.stage = "ESTIMATE_PREPARED";
    saveConversationState(sessionId, state);

    const reply = `Material: Genuine RUSSEA™ ${calc.qualityName}\n` +
      `Balcony Area: ${area} SFT\n` +
      `Rate: ${calc.isFixedMinimumApplied ? `₹${calc.totalAmount} (Fixed Minimum under 100 SFT)` : `₹${calc.appliedRatePerSft}/SFT`}\n` +
      `Installation: Included (SS Fasteners & drum-tight rigging)\n` +
      `Warranty: ${calc.qualityId.includes("2.5mm") ? "8 Years Written Warranty" : "5 Years Written Warranty"}\n` +
      `Total Estimate: ₹${calc.totalAmount.toLocaleString("en-IN")}\n\n` +
      `Would you like to reserve a measurement and installation slot?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 8. CATEGORY: INVISIBLE GRILLS (Owner Approved Schedule) ────────────────
  if (state.active_product_category === "invisible_grill") {
    const dims = extractDimensions(userText);
    if (dims.areaSft) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.areaSft = dims.areaSft;
      if (dims.length) state.confirmed_dimensions.length = dims.length;
      if (dims.width) state.confirmed_dimensions.width = dims.width;
    }

    const floorNum = extractFloorNumber(userText);
    if (floorNum) {
      state.notes = (state.notes || "") + ` floor_${floorNum}`;
    }

    const cityMatch = userText.match(/\b(hyderabad|secunderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    } else if (!state.customer_location) {
      state.customer_location = "Hyderabad";
    }

    if (!state.confirmed_dimensions?.areaSft) {
      state.stage = "REQUIREMENT_COLLECTION";
      saveConversationState(sessionId, state);
      if (floorNum) {
        return {
          replyText: `Noted, floor ${floorNum}. What are your balcony dimensions (Length x Height in feet) so I can calculate the exact SFT?`
        };
      }
      return { replyText: "What are your balcony dimensions (Length x Height in feet) or how many balconies do you have?" };
    }

    const area = state.confirmed_dimensions.areaSft;
    const isOutsideHyd = state.customer_location.toLowerCase() !== "hyderabad" && state.customer_location.toLowerCase() !== "secunderabad";

    // Calculation via owner approved schedule
    const calc = calculateInvisibleGrills({
      totalAreaSft: area,
      isOutsideHyderabad: isOutsideHyd,
      locationCity: state.customer_location,
      wireDiameter: "2.5mm",
      spacing: "2-inch"
    });

    state.stage = "ESTIMATE_PREPARED";
    saveConversationState(sessionId, state);

    const floorPrefix = floorNum ? `Noted, floor ${floorNum}. ` : "";
    const reply = `${floorPrefix}AISI 316 Marine Stainless Steel Invisible Grills:\n` +
      `Area: ${area} SFT (${calc.slabName})\n` +
      `Rate: ${calc.isMinimumBillingApplied ? "₹10,000 fixed (under 60 SFT)" : `₹${calc.effectiveRatePerSft}/SFT`}\n` +
      `Location: ${state.customer_location} ${isOutsideHyd ? "(+₹30/SFT outside Hyd)" : ""}\n` +
      `Installation: Included with high-grade aluminum track fixings\n` +
      `Warranty: 10-Year Rust Guarantee\n` +
      `Total Estimate: ₹${calc.totalAmount.toLocaleString("en-IN")}\n\n` +
      `Would you like to schedule a physical sample demonstration?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // ── 9. CATEGORY: CLOTH HANGERS (Approved 4-8ft Schedule) ───────────────────
  if (state.active_product_category === "cloth_hanger") {
    const isWallMount = lower.includes("wall");
    const isCeilingMount = lower.includes("ceiling");

    const sizeMatch = userText.match(/\b([45678])\s*(?:ft|feet|foot|')?\b/);
    const sizeFt = sizeMatch ? (parseInt(sizeMatch[1], 10) as 4 | 5 | 6 | 7 | 8) : 6;

    if (!isWallMount && !isCeilingMount) {
      state.stage = "PRODUCT_EDUCATION";
      saveConversationState(sessionId, state);
      return { replyText: "Do you prefer Ceiling Mounted (pulley system) or Wall Mounted cloth drying hangers?" };
    }

    const mountingType = isWallMount ? "wall" : "ceiling";
    const cityMatch = userText.match(/\b(hyderabad|secunderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    } else if (!state.customer_location) {
      state.customer_location = "Hyderabad";
    }

    const isOutsideHyd = state.customer_location.toLowerCase() !== "hyderabad" && state.customer_location.toLowerCase() !== "secunderabad";

    const calc = calculateClothHanger({
      sizeFt,
      mountingType,
      quantity: 1,
      isOutsideHyderabad: isOutsideHyd,
      locationCity: state.customer_location
    });

    state.stage = "ESTIMATE_PREPARED";
    saveConversationState(sessionId, state);

    const reply = `SS304 6-Rod Cloth Drying Hanger (${calc.mountingLabel}):\n` +
      `Size: ${calc.sizeFt} Feet (6 Heavy-Duty SS Pipes)\n` +
      `Location: ${state.customer_location} ${isOutsideHyd ? "(+₹500 outside Hyd)" : ""}\n` +
      `Installation: Complete professional installation included\n` +
      `Warranty: 2-Year Written Guarantee\n` +
      `Total Amount: ₹${calc.totalAmount.toLocaleString("en-IN")}\n\n` +
      `Would you like to reserve an installation slot?`;

    return {
      replyText: reply,
      cardType: "calculation",
      cardData: calc
    };
  }

  // Default Fallback
  saveConversationState(sessionId, state);
  return {
    replyText: "Sure. Could you please share your specific dimensions or requirement so I can assist you accurately?"
  };
}
