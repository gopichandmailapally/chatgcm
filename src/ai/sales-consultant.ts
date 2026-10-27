/**
 * Chat GCM — Human Sales Consultant & Dialog Engine
 * Strictly adheres to Chat GCM Critical AI Sales Conversation & Estimation Fix:
 * 1. Introduction once per conversation (persistent state)
 * 2. Requirement-First: Understand -> Collect -> Clarify -> Recommend -> Confirm -> Calculate -> Approve -> Quote
 * 3. Never quote prematurely
 * 4. 1-2 short natural sentences, one question at a time
 * 5. Clean product context locking & switching
 * 6. Supply-only roll calculation for grass & turf (540 SFT/roll, CEILING, discounts per roll, 5% GST)
 * 7. Cricket net mandatory pole-to-pole confirmation & material separation (45mm mesh preferred economical)
 * 8. Balcony nets: genuine RUSSEA™ brand, 100 SFT boundary correction, zero Garware/hooks
 * 9. Deterministic calculation via universal-pricing-engine — NO LLM arithmetic
 * 10. Strict quotation gate & physical visit rules
 */

import { 
  ConversationState, 
  ProductCategory, 
  getConversationState, 
  saveConversationState, 
  switchProductCategory 
} from './conversation-state.js';

import {
  calculateLandscapeGrassRolls,
  calculateSportsTurfRolls,
  calculateCricketBraidedBags,
  calculateTwisted15Netting,
  calculateInstalledSafetyNet,
  ROLL_SFT_STANDARD,
  LANDSCAPE_GRASS_CATALOG,
  SPORTS_TURF_CATALOG
} from '../pricing/universal-pricing-engine.js';

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

function detectLanguage(text: string): 'telugu' | 'hindi' | 'english' {
  if (/[\u0C00-\u0C7F]/.test(text) || /\b(namaskaram|enti|cheppandi|kavali|thaggandi|vastara|chustara|rate|dharalu|meeru)\b/i.test(text)) {
    return 'telugu';
  }
  if (/[\u0900-\u097F]/.test(text) || /\b(namaste|kitna|chahiye|batao|karo|bhejo|hoga|hai|aap)\b/i.test(text)) {
    return 'hindi';
  }
  return 'english';
}

function normalizeText(text: string): string {
  return text
    .replace(/[\u00D7\u2715\u2716\u2A2F\u2217]/g, ' x ')
    .replace(/(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?/gi, '$1 x $2')
    .replace(/(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?\s*(?:x|\*|by)\s*(\d+)\s*(?:ft|feet|foot|'|mtr|m|")?/gi, '$1 x $2 x $3');
}

function extractDimensions(rawText: string): { length?: number; width?: number; height?: number; areaSft?: number } {
  const text = normalizeText(rawText);

  // 3D match: e.g. "100 x 50 x 25" or "100ft x 50ft x 25ft"
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

  // 2D match: e.g. "18 x 9", "18ft x 9ft", "18×9", "18ft×9ft", "15×8", "15x8"
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

  // SFT match: e.g. "16000sft", "16,000 sq ft", "2000 sft"
  const sftMatch = text.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(?:sq\s*ft|sqft|sft|square\s*feet|sq\s*feet|sq\.ft|s\.f\.t)/i);
  if (sftMatch) {
    const rawNum = sftMatch[1].replace(/,/g, '');
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

  // Cricket nets
  if (lower.includes('cricket') || lower.includes('batting net') || lower.includes('bowling net') || lower.includes('pitch net') || lower.includes('cage net') || lower.includes('braided net')) {
    return 'cricket_net';
  }

  // Artificial grass (landscape)
  if (lower.includes('artificial grass') || lower.includes('landscape grass') || lower.includes('balcony grass') || lower.includes('garden grass') || (lower.includes('grass') && !lower.includes('turf accessories'))) {
    return 'landscape_grass';
  }

  // Sports turf
  if (lower.includes('sports turf') || lower.includes('football turf') || lower.includes('turf') || lower.includes('50mm turf') || lower.includes('multisport')) {
    return 'sports_turf';
  }

  // Pigeon & Balcony Safety Net
  if (lower.includes('pigeon') || lower.includes('balcony net') || lower.includes('safety net') || lower.includes('bird net') || lower.includes('cat net') || lower.includes('monkey net') || lower.includes('పావురాల') || lower.includes('కబూతర్') || lower.includes('कबूतर')) {
    return 'pigeon_safety_net';
  }

  // Invisible Grills
  if (lower.includes('invisible grill') || lower.includes('ss grill') || lower.includes('stainless steel grill') || lower.includes('గ్రిల్స్') || lower.includes('ग्रिल')) {
    return 'invisible_grill';
  }

  // Cloth Hangers
  if (lower.includes('cloth') || lower.includes('hanger') || lower.includes('drying') || lower.includes('pulley') || lower.includes('హ్యాంగర్') || lower.includes('हैंगर')) {
    return 'cloth_hanger';
  }

  // Turf accessories
  if (lower.includes('silica sand') || lower.includes('rubber granule') || lower.includes('speb 7') || lower.includes('seaming tape')) {
    return 'turf_accessories';
  }

  // Turnkey project
  if (lower.includes('turnkey') || lower.includes('court construction') || lower.includes('ground construction') || lower.includes('ground setup') || lower.includes('cage fabrication')) {
    return 'turnkey_project';
  }

  return null;
}


function handleProductInquiry(userText: string, category: ProductCategory | null, state: ConversationState): string | null {
  const lower = userText.toLowerCase();

  // 1. Types of nets / Options / Varieties / What varieties
  if (/(types?\s*of|variet|options?|what\s*(?:are\s*the\s*)?types|types\?+|which\s*(?:net|grass|turf|grill)\s*(?:is|to)|kinds?\s*of|available\s*types)/i.test(lower)) {
    if (category === 'pigeon_safety_net' || category === null || lower.includes('safety') || lower.includes('balcony') || lower.includes('net')) {
      const dimMention = state.confirmed_dimensions && state.confirmed_dimensions.areaSft ? (' for your ' + state.confirmed_dimensions.areaSft + ' SFT balcony') : '';
      return 'For balcony safety, we provide 3 main options, sir:\n1. 2.0mm Garware/RUSSEA™ Translucent White Net (economical & strong, 5-year warranty)\n2. 2.5mm Braided Heavy-Duty Net (extra strong for monkeys & pets, 8-year warranty)\n3. Invisible Stainless Steel Grills (ultra-modern with clear view, 10-year warranty)\n\nWhich type would you prefer' + dimMention + '?';
    }
    if (category === 'cricket_net' || lower.includes('cricket')) {
      return 'For cricket nets, we supply:\n• 2mm Braided Net (45mm or 40mm mesh) — lightweight & economical\n• 2.5mm Braided Net (45mm preferred economical, or 40mm mesh) — professional heavy-duty for ground sides\n• 1.5mm Twisted Net (40mm mesh) — lightweight overhead top net for large grounds\n\nWould you prefer 2mm or 2.5mm for your setup?';
    }
    if (category === 'landscape_grass' || lower.includes('grass')) {
      return 'We have 4 landscape grass thicknesses available:\n• 25mm (₹24/SFT) — ideal for balconies and light foot traffic\n• 35mm (₹28/SFT) — most popular, natural lush lawn feel\n• 40mm (₹32/SFT) & 50mm (₹36/SFT) — high-density luxury lawns\n\nAll supplied in full rolls of 540 SFT. Which thickness do you prefer?';
    }
    if (category === 'sports_turf' || lower.includes('turf')) {
      return 'We offer 3 turf specifications:\n• 15mm Multisports (₹85/SFT) — tennis, volleyball & multisport\n• 30mm Non-Infill (₹85/SFT) — maintenance-free football/cricket turf\n• 50mm Infill (₹80–₹100/SFT) — FIFA-standard football turf (12k to 18k DTEX)\n\nWhich sport is your project for?';
    }
    if (category === 'invisible_grill' || lower.includes('grill')) {
      return 'Our invisible grills use high-tensile AISI 316 Marine Grade stainless steel cables with DuPont nylon coating, spaced 2 to 4 inches apart. They withstand 450+ kg load and provide unblocked views with a 10-year rust warranty. Would you like to schedule a sample demo?';
    }
  }

  // 2. Monkey / Pets / Bird safety inquiry
  if (/(monkey|monkeys|cat|cats|dog|dogs|pet|pets|bite|chew|torn|tear)/i.test(lower) || (/(block|stop|prevent|keep\s*away|protection|safe\s*from|trouble|menace|effective)/i.test(lower) && /(pigeon|bird)/i.test(lower))) {
    if (lower.includes('monkey') || lower.includes('cat') || lower.includes('pet')) {
      return 'For protection against monkeys and pets, our 2.5mm heavy-duty braided net or AISI 316 stainless steel invisible grills are the best choice, sir. Standard 2.0mm nets are for pigeons and child safety, whereas 2.5mm braided nets and SS grills cannot be chewed or torn by monkeys or pets. Would you like a quote for the 2.5mm heavy-duty option?';
    }
    return 'Our genuine RUSSEA™ 2.0mm 40mm/45mm mesh completely blocks pigeons, sparrows, and other birds while ensuring 100% natural breeze and sunlight into your balcony.';
  }

  // 3. Warranty / Life / Durability
  if (/(warranty|guarantee|durability|life\s*span|how\s*many\s*years|how\s*long|sun|rain|weather)/i.test(lower)) {
    return 'All our nets are 100% virgin HDPE, UV-stabilized against harsh sun and rain. We provide:\n• 5-year written replacement warranty on 2.0mm standard nets\n• 8-year warranty on 2.5mm heavy-duty braided nets\n• 10-year rust guarantee on AISI 316 invisible grills.\nIf there is any sun degradation, we replace it free of charge.';
  }

  // 4. Colors / Visibility / Airflow / Lighting
  if (/(color|colours?|transparent|translucent|white|green|sunlight|breeze|airflow|block\s*light|view)/i.test(lower)) {
    return 'Balcony safety nets are available in translucent white and green. They allow 100% natural light and full breeze into your balcony without blocking your view. If you want a completely unobstructed modern look, our transparent 316 stainless steel invisible grills are also an excellent option. Which do you prefer?';
  }

  // 5. Installation method / Process / Tile damage
  if (/(how\s*(?:do\s*you\s*)?install|installation\s*process|how\s*is\s*it\s*fixed|drill|drilling|tile\s*damage|damage)/i.test(lower)) {
    return 'For safety nets, our certified technicians install stainless steel fasteners along the balcony border, stretch the net drum-tight using border ropes, and secure it seamlessly without sagging or damaging your balcony tiles. Complete installation is handled by our team in just 2 to 3 hours.';
  }

  return null;
}

// ── Dialog Execution ─────────────────────────────────────────────────────────

export function handleSalesConversation(input: SalesConsultantInput): SalesConsultantOutput {
  const { sessionId, userText } = input;
  const state = getConversationState(sessionId);
  const lang = detectLanguage(userText);
  const lower = userText.toLowerCase().trim();

  // 1. Identity Question Check ("Who are you?", "Which company?")
  const isAskingIdentity = /(who\s*are\s*you|which\s*company|your\s*name|who\s*is\s*this|meeru\s*evaru|aap\s*kaun\s*hai)/i.test(lower);
  if (isAskingIdentity) {
    const idReply = lang === 'telugu'
      ? "నేను జిసిఎమ్ ఎంటర్‌ప్రైజెస్ నుండి వెంకటేష్ ని సర్, సేల్స్ కన్సల్టెంట్‌ని. నేను మీకు ఎలా సహాయపడగలను?"
      : lang === 'hindi'
      ? "मैं जीसीएम एंटरप्राइजेज से वेंकटेश बात कर रहा हूँ। मैं आपकी क्या सहायता कर सकता हूँ?"
      : "Hi, I'm Venkatesh from GCM Enterprises. How can I help you?";
    saveConversationState(sessionId, state);
    return { replyText: idReply };
  }

  // 2. Initial Introduction (Only ONCE per conversation)
  const isGreetingOnly = /^(hi|hello|hey|namaste|good\s*morning|good\s*evening|good\s*afternoon|నమస్కారం|హలో|नमस्ते|హాయ్)\b/i.test(lower) && lower.split(/\s+/).length <= 3;
  
  if (!state.introduction_completed) {
    state.introduction_completed = true;

    // If customer only greeted, send the clean single introduction
    if (isGreetingOnly) {
      saveConversationState(sessionId, state);
      const introReply = lang === 'telugu'
        ? "నమస్కారం, నేను జిసిఎమ్ ఎంటర్‌ప్రైజెస్ నుండి వెంకటేష్ ని. నేను మీకు ఎలా సహాయపడగలను సర్?"
        : lang === 'hindi'
        ? "नमस्ते, मैं जीसीएम एंटरप्राइजेज से वेंकटेश बात कर रहा हूँ। मैं आपकी क्या सहायता कर सकता हूँ?"
        : "Hi, I'm Venkatesh from GCM Enterprises. How can I help you?";
      return { replyText: introReply };
    }
  }

  // If customer repeats a pure greeting in an active conversation
  if (isGreetingOnly && state.introduction_completed) {
    if (state.active_product_category === 'landscape_grass') {
      return { replyText: "Hi! Are you looking for balcony or ground artificial grass?" };
    } else if (state.active_product_category === 'cricket_net') {
      return { replyText: "Hello! What are your cricket ground dimensions (length, width, and height)?" };
    } else if (state.active_product_category === 'pigeon_safety_net') {
      return { replyText: "Hello! What are your balcony dimensions (length and height in feet)?" };
    } else {
      return { replyText: "Hello! How can I assist you with your netting, grass, or grill requirement today?" };
    }
  }

  // 3. Product Category Detection & Clean Switching
  const detectedCat = detectProductCategory(userText);
  if (detectedCat && detectedCat !== state.active_product_category) {
    // Clean switch
    switchProductCategory(state, detectedCat);
  }

  // ── 3A. Scenario 15: Turnkey Project Request (Short & Consultative) ─────────
  if (state.active_product_category === 'turnkey_project' || lower.includes('turnkey')) {
    saveConversationState(sessionId, state);
    return {
      replyText: "Yes, we undertake turnkey sports ground setup including turf, cage netting, and fabrication based on site specifications. What are your ground dimensions and site location to discuss the scope?"
    };
  }

  // ── 3B. Scenario 9: Unknown Dimensions / Site Visit Rules (Section 11) ──────
  const isUnknownDimensions = /(don'?t\s*know|do\s*not\s*know|not\s*sure|no\s*idea|cannot\s*measure|can'?t\s*measure|no\s*measurements?|measurements?\s*lekapothe|theliyadu|maloom\s*nahi|pata\s*nahi)/i.test(lower);
  const isSiteVisitRequested = /(site\s*visit|come\s*and\s*measure|visit\s*my\s*place|send\s*someone|vastara|chustara|inspection)/i.test(lower);

  if (isUnknownDimensions || isSiteVisitRequested) {
    if (state.active_product_category === 'landscape_grass' || state.active_product_category === 'sports_turf') {
      saveConversationState(sessionId, state);
      return {
        replyText: "Artificial grass is material supply-only by full rolls (540 SFT/roll). You can measure the approximate length and width with a measuring tape, or share site photos so we can guide your roll estimate."
      };
    } else {
      saveConversationState(sessionId, state);
      return {
        replyText: "You can measure the length and height in feet using a standard measuring tape, or share balcony photos. In Hyderabad, we can also schedule a site inspection for an approved visiting charge of ₹300 (adjusted against your bill if order is placed). Would you like to schedule a visit?"
      };
    }
  }

  // ── 3C. Customer Frustration / Clarification Guardrail ──────────────────────
  const isFrustrated = /(not\s*getting\s*my\s*point|not\s*understanding|don'?t\s*understand|not\s*listening|you\s*are\s*not\s*getting|point\s*artham|artham\s*kavatledu|samajh\s*nahi)/i.test(lower);
  if (isFrustrated) {
    saveConversationState(sessionId, state);
    if (state.active_product_category === 'invisible_grill') {
      return {
        replyText: "Apologies for the confusion, sir! Could you please tell me your balcony size (e.g. 18x9 ft or 15x8 ft) or how many balconies you have, so I can immediately calculate the price for you?"
      };
    } else {
      return {
        replyText: "Apologies for the confusion, sir! Let me help you directly. Could you please share your site measurements or a photo so I can assist you accurately?"
      };
    }
  }

  // ── 3D. Intercept Customer Product Questions / Inquiries ────────────────────
  const productInquiryReply = handleProductInquiry(userText, state.active_product_category, state);
  if (productInquiryReply) {
    saveConversationState(sessionId, state);
    return { replyText: productInquiryReply };
  }

  // If no active category yet, ask to identify
  if (!state.active_product_category) {
    saveConversationState(sessionId, state);
    return {
      replyText: "Sure. Which product are you looking for: cricket nets, balcony safety nets, artificial grass, or invisible grills?"
    };
  }

  // ── 4. CATEGORY: LANDSCAPE ARTIFICIAL GRASS (Section 7, 8, 10) ──────────────
  if (state.active_product_category === 'landscape_grass') {
    // Supply only rule (Scenario 14)
    if (lower.includes('installation') || lower.includes('fitting') || lower.includes('fit cheyali')) {
      state.supply_or_installation = 'supply_only';
      saveConversationState(sessionId, state);
      return {
        replyText: "All artificial grass and sports turf products are supply only at the configured material prices. Installation is to be arranged by the customer locally."
      };
    }

    // Extract roll count or dimensions
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

    // Extract thickness
    if (lower.includes('25mm')) state.selected_material = '25mm';
    else if (lower.includes('35mm')) state.selected_material = '35mm';
    else if (lower.includes('40mm')) state.selected_material = '40mm';
    else if (lower.includes('50mm')) state.selected_material = '50mm';

    // Extract location
    const cityMatch = userText.match(/\b(hyderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai|delhi)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // Question Step 1: Balcony or Ground application?
    const hasApplication = lower.includes('balcony') || lower.includes('ground') || lower.includes('terrace') || lower.includes('lawn') || lower.includes('garden') || lower.includes('roof');
    if (!state.confirmed_dimensions?.areaSft && !hasApplication && !state.notes?.includes('app_asked')) {
      state.notes = (state.notes || '') + ' app_asked';
      saveConversationState(sessionId, state);
      return { replyText: "Sure. Is it for a balcony or ground?" };
    }

    // Question Step 2: Area or Dimensions?
    if (!state.confirmed_dimensions?.areaSft) {
      saveConversationState(sessionId, state);
      return { replyText: "What is your measured area, or do you have the length and width?" };
    }

    // Question Step 3: Thickness preference
    if (!state.selected_material) {
      saveConversationState(sessionId, state);
      return { replyText: "Which thickness do you prefer: 25mm (₹24), 35mm (₹28), 40mm (₹32), or 50mm (₹36) per SFT?" };
    }

    // Full roll policy clarification if area is not an exact multiple of 540 SFT
    const reqSft = state.confirmed_dimensions.areaSft;
    const reqRolls = state.confirmed_dimensions.rolls || Math.ceil(reqSft / ROLL_SFT_STANDARD);
    const suppliedSft = reqRolls * ROLL_SFT_STANDARD;

    if (reqSft % ROLL_SFT_STANDARD !== 0 && !state.notes?.includes('roll_policy_explained')) {
      state.notes = (state.notes || '') + ' roll_policy_explained';
      saveConversationState(sessionId, state);
      return {
        replyText: `We supply full rolls only, sir. Each roll contains 540 SFT. For your ${reqSft} SFT area, ${reqRolls} full rolls (${suppliedSft} SFT) will be supplied.`
      };
    }

    // Question Step 4: Location
    if (!state.customer_location) {
      saveConversationState(sessionId, state);
      return { replyText: "Which city or delivery location should this be dispatched to?" };
    }

    // Step 5: Requirement Confirmation before calculation
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|send\s*quote|avunu|sare|ha|theek\s*hai)\b/i.test(lower);

    if (!isCustomerConfirming) {
      state.requirement_status = 'CONFIRMING';
      saveConversationState(sessionId, state);
      return {
        replyText: `So you need ${reqRolls} rolls of ${state.selected_material} landscape grass (${suppliedSft} SFT) for delivery to ${state.customer_location} on supply-only basis. Shall I prepare the estimate?`
      };
    }

    // Step 6: Calculation after confirmation
    const variant = state.selected_material as '25mm' | '35mm' | '40mm' | '50mm';
    const calc = calculateLandscapeGrassRolls(variant, reqSft, reqRolls);
    state.requirement_status = 'CALCULATED';
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    return {
      replyText: `For ${calc.requiredRolls} rolls of ${calc.variant} grass (${calc.suppliedSft} SFT @ ₹${calc.finalRatePerSft}/SFT), the material subtotal is ₹${calc.materialSubtotal.toLocaleString('en-IN')} plus 5% GST (₹${calc.gstAmount.toLocaleString('en-IN')}), totaling ₹${calc.totalWithGst.toLocaleString('en-IN')} (supply only). Would you like to proceed with this order?`,
      cardType: 'calculation',
      cardData: calc
    };
  }

  // ── 5. CATEGORY: PREMIUM SPORTS TURF (Section 9, 10) ────────────────────────
  if (state.active_product_category === 'sports_turf') {
    if (lower.includes('installation') || lower.includes('fitting')) {
      state.supply_or_installation = 'supply_only';
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

    if (lower.includes('15mm')) state.selected_material = '15mm_multisports';
    else if (lower.includes('30mm')) state.selected_material = '30mm_non_infill';
    else if (lower.includes('50mm') && lower.includes('18000')) state.selected_material = '50mm_infill_18000';
    else if (lower.includes('50mm') && lower.includes('16000')) state.selected_material = '50mm_infill_16000';
    else if (lower.includes('50mm') && lower.includes('12000')) state.selected_material = '50mm_infill_12000';
    else if (lower.includes('50mm')) state.selected_material = '50mm_infill_14000';

    const cityMatch = userText.match(/\b(hyderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai|delhi)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    if (!state.confirmed_dimensions?.areaSft) {
      saveConversationState(sessionId, state);
      return { replyText: "What is your sports turf area in square feet or pitch dimensions?" };
    }

    if (!state.selected_material) {
      saveConversationState(sessionId, state);
      return { replyText: "Which turf specification do you require: 15mm Multisports (₹85), 30mm Non-Infill (₹85), or 50mm Infill (₹80–₹100) per SFT?" };
    }

    if (!state.customer_location) {
      saveConversationState(sessionId, state);
      return { replyText: "Which delivery location should this sports turf be dispatched to?" };
    }

    const reqSft = state.confirmed_dimensions.areaSft;
    const reqRolls = state.confirmed_dimensions.rolls || Math.ceil(reqSft / ROLL_SFT_STANDARD);
    const suppliedSft = reqRolls * ROLL_SFT_STANDARD;

    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming) {
      state.requirement_status = 'CONFIRMING';
      saveConversationState(sessionId, state);
      return {
        replyText: `So you need ${reqRolls} rolls of ${SPORTS_TURF_CATALOG[state.selected_material]?.name} (${suppliedSft} SFT) for delivery to ${state.customer_location} on supply-only basis. Shall I prepare the estimate?`
      };
    }

    const calc = calculateSportsTurfRolls(state.selected_material, reqSft, reqRolls);
    state.requirement_status = 'CALCULATED';
    state.active_quote = calc;
    saveConversationState(sessionId, state);

    return {
      replyText: `For ${calc.requiredRolls} rolls of ${calc.name} (${calc.suppliedSft} SFT @ ₹${calc.finalRatePerSft}/SFT), the subtotal is ₹${calc.materialSubtotal.toLocaleString('en-IN')} plus 5% GST (₹${calc.gstAmount.toLocaleString('en-IN')}), totaling ₹${calc.totalWithGst.toLocaleString('en-IN')} (supply only). Shall we proceed with dispatch?`,
      cardType: 'calculation',
      cardData: calc
    };
  }

  // ── 6. CATEGORY: CRICKET NETS (Section 5, 6) ────────────────────────────────
  if (state.active_product_category === 'cricket_net') {
    const dims = extractDimensions(userText);
    if (!state.confirmed_dimensions) state.confirmed_dimensions = {};

    if (dims.length && dims.width) {
      state.confirmed_dimensions.length = dims.length;
      state.confirmed_dimensions.width = dims.width;
      if (dims.height) state.confirmed_dimensions.height = dims.height;
    } else if (dims.areaSft) {
      state.confirmed_dimensions.areaSft = dims.areaSft;
    }

    // Check pole-to-pole confirmation
    if (lower.includes('pole to pole') || lower.includes('pole-to-pole') || lower.includes('without extra') || lower.includes('exact pole')) {
      state.confirmed_dimensions.isPoleToPole = true;
      state.confirmed_dimensions.measurementConfirmed = true;
    } else if (lower.includes('extra included') || lower.includes('extras included') || lower.includes('already included') || lower.includes('with extra')) {
      state.confirmed_dimensions.isPoleToPole = false;
      state.confirmed_dimensions.measurementConfirmed = true;
    }

    // Material preference
    if (lower.includes('2.5mm') && lower.includes('40mm')) state.selected_material = '2.5mm_40mm';
    else if (lower.includes('2.5mm') || lower.includes('2.5mm 45mm')) state.selected_material = '2.5mm_45mm';
    else if (lower.includes('2mm') && lower.includes('40mm')) state.selected_material = '2.0mm_40mm';
    else if (lower.includes('2mm') || lower.includes('2mm 45mm')) state.selected_material = '2.0mm_45mm';

    // Sides & Top
    if (lower.includes('top only') || lower.includes('roof only')) {
      state.confirmed_dimensions.sidesRequired = [];
      state.confirmed_dimensions.hasTop = true;
    } else if (lower.includes('without top') || lower.includes('no top') || lower.includes('no roof')) {
      state.confirmed_dimensions.hasTop = false;
      state.confirmed_dimensions.sidesRequired = ['all_4_sides'];
    }

    // Location
    const cityMatch = userText.match(/\b(hyderabad|bangalore|bengaluru|chennai|vijayawada|visakhapatnam|vizag|guntur|warangal|pune|mumbai|delhi)\b/i);
    if (cityMatch) {
      state.customer_location = cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1).toLowerCase();
    }

    // ── Scenario 7: Direct Area SFT for Braided Nets (e.g. 16,000 SFT) ─────────
    if (state.confirmed_dimensions.areaSft && !state.confirmed_dimensions.length) {
      const area = state.confirmed_dimensions.areaSft;
      const fullBags = Math.ceil(area / 3300);
      const suppliedSft = fullBags * 3300;

      // Material choice
      if (!state.selected_material) {
        saveConversationState(sessionId, state);
        return {
          replyText: `For braided nets, standard packing is 3,300 SFT per full bag. For ${area.toLocaleString('en-IN')} SFT, ${fullBags} full bags (${suppliedSft.toLocaleString('en-IN')} SFT) will be supplied. We offer 2mm and 2.5mm braided nets (45mm mesh is the preferred economical choice). Which do you prefer?`
        };
      }

      if (!state.customer_location) {
        saveConversationState(sessionId, state);
        return { replyText: "Which city or delivery location should this be dispatched to?" };
      }

      const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
      if (state.requirement_status !== 'CONFIRMING' && !isCustomerConfirming) {
        state.requirement_status = 'CONFIRMING';
        saveConversationState(sessionId, state);
        return {
          replyText: `So you need ${fullBags} full bags of ${state.selected_material} braided nets (${suppliedSft.toLocaleString('en-IN')} SFT) for delivery to ${state.customer_location}. Shall I calculate the estimate?`
        };
      }

      const calc = calculateCricketBraidedBags({
        variant: state.selected_material as any,
        fullBags,
        halfBags: 0,
        mixedBagPolicy: 'SEPARATE_TIERS',
        gstRate: 5.0
      });

      state.requirement_status = 'CALCULATED';
      state.active_quote = calc;
      saveConversationState(sessionId, state);

      return {
        replyText: `For ${fullBags} full bags of ${state.selected_material} (${suppliedSft.toLocaleString('en-IN')} SFT @ ₹${calc.fullBagRatePerSft.toFixed(2)}/SFT), the subtotal is ₹${calc.subtotal.toLocaleString('en-IN')} plus 5% GST (₹${calc.gstAmount.toLocaleString('en-IN')}), totaling ₹${calc.totalWithGst.toLocaleString('en-IN')} (supply only). Would you like to proceed with this order?`
      };
    }

    // Step 1: Missing dimensions (Scenario 8: Incomplete measurements)
    if (!state.confirmed_dimensions.length || !state.confirmed_dimensions.width) {
      saveConversationState(sessionId, state);
      return { replyText: "What are your ground dimensions: Length, Width, and Height in feet?" };
    }

    if (!state.confirmed_dimensions.height) {
      saveConversationState(sessionId, state);
      return { replyText: "What is the height of your cricket ground or cage in feet?" };
    }

    // Step 2: Mandatory pole-to-pole size confirmation question
    if (state.confirmed_dimensions.measurementConfirmed !== true) {
      saveConversationState(sessionId, state);
      return {
        replyText: "Are these pole-to-pole dimensions, or have you already included extra material for folding and installation?"
      };
    }

    // Step 3: Material explanation & selection
    if (!state.selected_material) {
      saveConversationState(sessionId, state);
      return {
        replyText: "For side nets, we offer 2mm and 2.5mm braided nets (45mm or 40mm mesh). 45mm mesh is the preferred economical choice. Which would you prefer?"
      };
    }

    // Step 4: Location
    if (!state.customer_location) {
      saveConversationState(sessionId, state);
      return { replyText: "Which delivery city or pincode should this be dispatched to?" };
    }

    // Calculate dimensions
    const L = state.confirmed_dimensions.length;
    const W = state.confirmed_dimensions.width;
    const H = state.confirmed_dimensions.height;

    // Apply allowances if pole-to-pole
    const getAllowance = (d: number) => {
      if (d <= 14) return 0.5;
      if (d <= 50) return 1.0;
      if (d <= 100) return 1.5;
      if (d <= 150) return 2.0;
      if (d <= 200) return 2.5;
      return 3.0;
    };

    const adjL = state.confirmed_dimensions.isPoleToPole ? L + getAllowance(L) : L;
    const adjW = state.confirmed_dimensions.isPoleToPole ? W + getAllowance(W) : W;
    const adjH = state.confirmed_dimensions.isPoleToPole ? H + getAllowance(H) : H;

    const sideSft = Math.round((2 * adjL * adjH) + (2 * adjW * adjH));
    const topSft = Math.round(adjL * adjW);
    const groundArea = Math.round(L * W);

    // Large ground recommendation: >3300 SFT top net is 1.5mm twisted
    const isLargeGround = groundArea > 3300;

    // Step 5: Confirmation before calculation
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming) {
      state.requirement_status = 'CONFIRMING';
      saveConversationState(sessionId, state);
      return {
        replyText: `For your ${L}x${W}x${H} ft ground (${state.confirmed_dimensions.isPoleToPole ? 'pole-to-pole' : 'with allowances'}), side netting is ~${sideSft} SFT (${state.selected_material}) and top netting is ${topSft} SFT for delivery to ${state.customer_location}. Shall I prepare the estimation?`
      };
    }

    // Step 6: Calculation
    const fullBags = Math.ceil(sideSft / 3300);
    const sideCalc = calculateCricketBraidedBags({
      variant: state.selected_material as any,
      fullBags,
      halfBags: 0,
      mixedBagPolicy: 'SEPARATE_TIERS',
      gstRate: 5.0
    });

    let totalSubtotal = sideCalc.subtotal;
    let totalGst = sideCalc.gstAmount;
    let grandTotal = sideCalc.totalWithGst;
    let topCalcText = '';

    if (isLargeGround) {
      const topCalc = calculateTwisted15Netting(topSft, true);
      totalSubtotal += topCalc.subtotal;
      totalGst += topCalc.gstAmount;
      grandTotal += topCalc.grandTotal;
      topCalcText = ` plus 1.5mm twisted top net (${topSft} SFT @ ₹${topCalc.totalRatePerSft}/SFT = ₹${topCalc.grandTotal.toLocaleString('en-IN')})`;
    }

    state.requirement_status = 'CALCULATED';
    saveConversationState(sessionId, state);

    return {
      replyText: `For side netting (${sideSft} SFT), ${fullBags} full bag(s) of ${state.selected_material} comes to ₹${sideCalc.totalWithGst.toLocaleString('en-IN')} (incl. 5% GST)${topCalcText}. Grand total is ₹${grandTotal.toLocaleString('en-IN')}. Would you like to proceed with this order?`
    };
  }

  // ── 7. CATEGORY: BALCONY SAFETY & PIGEON NETS ───────────────────────────────
  if (state.active_product_category === 'pigeon_safety_net') {
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

    // Step 1: Ask dimensions if missing
    if (!state.confirmed_dimensions?.areaSft) {
      saveConversationState(sessionId, state);
      return {
        replyText: "What are your balcony dimensions (Length x Height in feet), or how many balconies do you have?"
      };
    }

    // Step 2: Location
    if (!state.customer_location) {
      state.customer_location = 'Hyderabad'; // Default
    }

    const area = state.confirmed_dimensions.areaSft;

    // Step 3: Confirmation before calculation
    const isCustomerConfirming = /^(yes|sure|proceed|ok|okay|calculate|quote|tell\s*me|avunu|sare|ha)\b/i.test(lower);
    if (!isCustomerConfirming) {
      state.requirement_status = 'CONFIRMING';
      saveConversationState(sessionId, state);
      return {
        replyText: `So you require genuine RUSSEA™ balcony safety netting for ${area} SFT with complete professional installation and a 5-year replacement warranty. Shall I calculate the estimate?`
      };
    }

    // Step 4: Deterministic calculation
    const calc = calculateInstalledSafetyNet('2.0mm_45mm', area, 'standard');
    state.requirement_status = 'CALCULATED';
    saveConversationState(sessionId, state);

    return {
      replyText: `For ${area} sq ft, it comes to ₹${calc.totalAmount.toLocaleString('en-IN')} including genuine RUSSEA™ net, complete installation, and a 5-year written warranty. Should I arrange a measurement visit today?`
    };
  }

  // ── 8. CATEGORY: INVISIBLE GRILLS ───────────────────────────────────────────
  if (state.active_product_category === 'invisible_grill') {
    const dims = extractDimensions(userText);
    if (dims.areaSft) {
      if (!state.confirmed_dimensions) state.confirmed_dimensions = {};
      state.confirmed_dimensions.areaSft = dims.areaSft;
      if (dims.length) state.confirmed_dimensions.length = dims.length;
      if (dims.width) state.confirmed_dimensions.width = dims.width;
    }

    const floorNum = extractFloorNumber(userText);
    if (floorNum) {
      state.notes = (state.notes || '') + ` floor_${floorNum}`;
    }

    if (!state.confirmed_dimensions?.areaSft) {
      if (floorNum) {
        saveConversationState(sessionId, state);
        return {
          replyText: `Noted, floor ${floorNum}. What are your balcony dimensions (Length x Height in feet) so I can calculate the SFT?`
        };
      }

      saveConversationState(sessionId, state);
      return { replyText: "What are your balcony dimensions (Length x Height in feet) or how many balconies do you have?" };
    }

    const area = state.confirmed_dimensions.areaSft;
    const L = state.confirmed_dimensions.length;
    const W = state.confirmed_dimensions.width;
    const dimText = (L && W) ? `an ${L}x${W} ft balcony (${area} SFT)` : `${area} SFT`;
    const est = area * 150;
    const floorPrefix = floorNum ? `Noted, floor ${floorNum}. ` : '';
    state.requirement_status = 'CALCULATED';
    saveConversationState(sessionId, state);

    return {
      replyText: `${floorPrefix}For ${dimText}, original AISI 316 Marine Grade Invisible Grills with installation comes to approximately ₹${est.toLocaleString('en-IN')} (₹150/SFT) with a 10-year rust guarantee. Would you like to schedule a sample demo?`
    };
  }

  // ── 9. CATEGORY: CLOTH HANGERS ──────────────────────────────────────────────
  if (state.active_product_category === 'cloth_hanger') {
    const isWallMount = lower.includes('wall');
    const isCeilingMount = lower.includes('ceiling');

    if (!isWallMount && !isCeilingMount) {
      saveConversationState(sessionId, state);
      return { replyText: "Do you prefer Ceiling Mounted (pulley system) or Wall Mounted cloth drying hangers?" };
    }

    return {
      replyText: "Our SS304 6-rod ceiling hangers range from ₹2,500 (4ft) to ₹3,500 (8ft) including complete installation. Which size would you like to install?"
    };
  }

  // Default Fallback: Short, courteous, human
  saveConversationState(sessionId, state);
  return {
    replyText: "Sure. Could you please share your specific dimensions or requirement so I can assist you accurately?"
  };
}
