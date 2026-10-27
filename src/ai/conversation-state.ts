/**
 * Chat GCM — Centralized Persisted Conversation State & Customer Profile Engine
 * Strictly adheres to Phase 2, Phase 3 & Phase 7 Requirements:
 * 1. 15 Canonical Explicit Persisted States
 * 2. Absolute Estimation Gate (No estimation without complete requirements & explicit confirmation)
 * 3. Safe Product Comparison without accidental product switching
 * 4. Customer Requirement Profile with multi-category requirements isolation
 * 5. Robust transactional state persistence & error propagation
 */

import { db } from '../db/database.js';
import crypto from 'node:crypto';

export type ProductCategory =
  | 'pigeon_safety_net'
  | 'cricket_net'
  | 'landscape_grass'
  | 'sports_turf'
  | 'invisible_grill'
  | 'cloth_hanger'
  | 'turf_accessories'
  | 'turnkey_project';

/**
 * Phase 2.2 — 15 Canonical Persisted States
 */
export type ConversationStage =
  | 'GREETING'
  | 'INTENT_DISCOVERY'
  | 'REQUIREMENT_COLLECTION'
  | 'PRODUCT_EDUCATION'
  | 'MATERIAL_RECOMMENDATION'
  | 'REQUIREMENT_CONFIRMATION'
  | 'ESTIMATION_READY'
  | 'ESTIMATE_PREPARED'
  | 'QUOTATION_REQUESTED'
  | 'QUOTATION_PENDING_APPROVAL'
  | 'QUOTATION_APPROVED'
  | 'QUOTATION_SENT'
  | 'FOLLOW_UP'
  | 'SITE_VISIT_REQUESTED'
  | 'HUMAN_HANDOFF';

// Backward compatibility alias for legacy callers
export type RequirementStage =
  | ConversationStage
  | 'DISCOVERY'
  | 'IDENTIFYING'
  | 'COLLECTING'
  | 'CLARIFYING'
  | 'RECOMMENDING'
  | 'CONFIRMING'
  | 'CALCULATED'
  | 'ESTIMATE_ELIGIBLE'
  | 'QUOTE_APPROVED';

export interface ConfirmedDimensions {
  length?: number;
  width?: number;
  height?: number;
  areaSft?: number;
  rolls?: number;
  isPoleToPole?: boolean;
  measurementConfirmed?: boolean;
  sidesRequired?: string[];
  hasTop?: boolean;
  floorNumber?: string | number;
}

/**
 * Customer Requirement Profile
 */
export interface CustomerRequirementProfile {
  activeProduct: string | null;
  application: string | null;
  materialPreferences: string | null;
  measurements: ConfirmedDimensions | null;
  quantity: number | null;
  location: string | null;
  supplyInstallationScope: 'supply_only' | 'supply_installation' | null;
  budgetVolunteered?: number | null;
  questionsAnswered: string[];
  pendingClarification?: string | null;
  recommendationHistory: string[];
  customerConfirmed: boolean;
  estimateStatus: 'NONE' | 'PRELIMINARY' | 'PREPARED' | 'OFFICIAL_QUOTE';
  approvalStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
}

export interface ConversationState {
  introduction_completed: boolean;
  active_product_category: ProductCategory | null;
  customer_intent: string | null;
  requirement_status: RequirementStage;
  stage: ConversationStage;
  confirmed_dimensions: ConfirmedDimensions | null;
  selected_material: string | null;
  supply_or_installation: 'supply_only' | 'supply_installation' | null;
  customer_location: string | null;
  quotation_status: 'NOT_REQUESTED' | 'DRAFT' | 'APPROVED' | 'SENT';
  active_quote?: any;
  previous_requirements: Record<string, any>;
  profile: CustomerRequirementProfile;
  last_question_asked?: string;
  pending_confirmation_question?: string;
  notes?: string;
}

export function getDefaultProfile(): CustomerRequirementProfile {
  return {
    activeProduct: null,
    application: null,
    materialPreferences: null,
    measurements: null,
    quantity: null,
    location: null,
    supplyInstallationScope: null,
    budgetVolunteered: null,
    questionsAnswered: [],
    pendingClarification: null,
    recommendationHistory: [],
    customerConfirmed: false,
    estimateStatus: 'NONE',
    approvalStatus: 'NONE'
  };
}

export function getDefaultState(): ConversationState {
  return {
    introduction_completed: false,
    active_product_category: null,
    customer_intent: null,
    requirement_status: 'GREETING',
    stage: 'GREETING',
    confirmed_dimensions: null,
    selected_material: null,
    supply_or_installation: null,
    customer_location: null,
    quotation_status: 'NOT_REQUESTED',
    previous_requirements: {},
    profile: getDefaultProfile()
  };
}

export function mapToCanonicalStage(stage: string): ConversationStage {
  switch (stage) {
    case 'DISCOVERY':
    case 'IDENTIFYING':
      return 'INTENT_DISCOVERY';
    case 'COLLECTING':
      return 'REQUIREMENT_COLLECTION';
    case 'CLARIFYING':
      return 'PRODUCT_EDUCATION';
    case 'RECOMMENDING':
    case 'PRODUCT_RECOMMENDATION':
      return 'MATERIAL_RECOMMENDATION';
    case 'CONFIRMING':
      return 'REQUIREMENT_CONFIRMATION';
    case 'ESTIMATE_ELIGIBLE':
      return 'ESTIMATION_READY';
    case 'CALCULATED':
      return 'ESTIMATE_PREPARED';
    case 'QUOTE_APPROVED':
      return 'QUOTATION_APPROVED';
    case 'HUMAN_HANDOVER':
      return 'HUMAN_HANDOFF';
    default:
      return (stage as ConversationStage) || 'INTENT_DISCOVERY';
  }
}

/**
 * Validates state transitions to prevent premature calculations
 */
export function canTransition(from: ConversationStage, to: ConversationStage): boolean {
  if (from === to) return true;
  // Escalation and follow up can be triggered from any state
  if (to === 'HUMAN_HANDOFF' || to === 'SITE_VISIT_REQUESTED' || to === 'FOLLOW_UP') return true;

  switch (from) {
    case 'GREETING':
      return ['INTENT_DISCOVERY', 'REQUIREMENT_COLLECTION', 'PRODUCT_EDUCATION'].includes(to);
    case 'INTENT_DISCOVERY':
      return ['REQUIREMENT_COLLECTION', 'PRODUCT_EDUCATION', 'MATERIAL_RECOMMENDATION'].includes(to);
    case 'REQUIREMENT_COLLECTION':
      return ['PRODUCT_EDUCATION', 'MATERIAL_RECOMMENDATION', 'REQUIREMENT_CONFIRMATION'].includes(to);
    case 'PRODUCT_EDUCATION':
      return ['MATERIAL_RECOMMENDATION', 'REQUIREMENT_COLLECTION', 'REQUIREMENT_CONFIRMATION'].includes(to);
    case 'MATERIAL_RECOMMENDATION':
      return ['REQUIREMENT_CONFIRMATION', 'REQUIREMENT_COLLECTION', 'PRODUCT_EDUCATION'].includes(to);
    case 'REQUIREMENT_CONFIRMATION':
      return ['ESTIMATION_READY', 'REQUIREMENT_COLLECTION', 'MATERIAL_RECOMMENDATION'].includes(to);
    case 'ESTIMATION_READY':
      return ['ESTIMATE_PREPARED', 'REQUIREMENT_COLLECTION'].includes(to);
    case 'ESTIMATE_PREPARED':
      return ['QUOTATION_REQUESTED', 'FOLLOW_UP', 'REQUIREMENT_COLLECTION'].includes(to);
    case 'QUOTATION_REQUESTED':
      return ['QUOTATION_PENDING_APPROVAL', 'QUOTATION_APPROVED'].includes(to);
    case 'QUOTATION_PENDING_APPROVAL':
      return ['QUOTATION_APPROVED', 'HUMAN_HANDOFF'].includes(to);
    case 'QUOTATION_APPROVED':
      return ['QUOTATION_SENT'].includes(to);
    case 'QUOTATION_SENT':
      return ['FOLLOW_UP', 'HUMAN_HANDOFF'].includes(to);
    default:
      return true;
  }
}

/**
 * Phase 2.3 — Absolute Estimation Gate
 * Returns whether all mandatory criteria are satisfied before an estimate can be produced.
 */
export interface EstimationEligibilityResult {
  eligible: boolean;
  missingRequirements: string[];
  reason?: string;
}

export function checkEstimationEligibility(state: ConversationState): EstimationEligibilityResult {
  const missing: string[] = [];

  if (!state.active_product_category) {
    missing.push('product_category');
  }

  // Dimensions / Quantities
  if (state.active_product_category === 'cloth_hanger') {
    if (!state.confirmed_dimensions?.length && !state.confirmed_dimensions?.areaSft && !state.selected_material) {
      missing.push('cloth_hanger_size');
    }
  } else if (state.active_product_category === 'landscape_grass' || state.active_product_category === 'sports_turf') {
    if (!state.confirmed_dimensions?.areaSft && !state.confirmed_dimensions?.rolls) {
      missing.push('dimensions_or_rolls');
    }
  } else if (!state.confirmed_dimensions?.areaSft && !state.confirmed_dimensions?.length) {
    missing.push('dimensions');
  }

  // Material selection
  if (!state.selected_material) {
    missing.push('material_specification');
  }

  // Location
  if (!state.customer_location) {
    missing.push('location');
  }

  // Scope (supply vs install)
  if (!state.supply_or_installation) {
    if (['landscape_grass', 'sports_turf', 'turf_accessories'].includes(state.active_product_category || '')) {
      state.supply_or_installation = 'supply_only';
    } else if (['pigeon_safety_net', 'invisible_grill', 'cloth_hanger'].includes(state.active_product_category || '')) {
      state.supply_or_installation = 'supply_installation';
    } else {
      missing.push('scope_supply_or_installation');
    }
  }

  // Customer confirmation of requirements
  if (!state.profile.customerConfirmed && state.stage !== 'REQUIREMENT_CONFIRMATION' && state.stage !== 'ESTIMATION_READY') {
    missing.push('customer_requirement_confirmation');
  }

  return {
    eligible: missing.length === 0,
    missingRequirements: missing,
    reason: missing.length > 0 ? `Missing required parameters: ${missing.join(', ')}` : undefined
  };
}

/**
 * Phase 7 — Product Comparison vs Intent to Switch Detection
 */
export function isProductComparisonQuestion(text: string): boolean {
  const lower = text.toLowerCase();
  // Ensure standalone comparison keywords rather than substrings like 'for' or 'floor'
  if (/\b(?:vs|versus)\b/i.test(lower)) {
    return true;
  }
  const comparisonPhrases = [
    'better than', 'difference between', 'which is better', 'which one is better',
    'better between', 'quality difference', 'compare both', 'enti difference', 'em difference', 'kya farak'
  ];
  return comparisonPhrases.some(phrase => lower.includes(phrase));
}

export function getConversationState(sessionId: string): ConversationState {
  try {
    const row = db.prepare('SELECT state FROM conversations WHERE session_id = ?').get(sessionId) as any;
    if (row && row.state && row.state !== '{}') {
      const parsed = JSON.parse(row.state);
      const stage = mapToCanonicalStage(parsed.stage || parsed.requirement_status || 'GREETING');
      return {
        introduction_completed: Boolean(parsed.introduction_completed),
        active_product_category: parsed.active_product_category || null,
        customer_intent: parsed.customer_intent || null,
        requirement_status: stage,
        stage,
        confirmed_dimensions: parsed.confirmed_dimensions || null,
        selected_material: parsed.selected_material || null,
        supply_or_installation: parsed.supply_or_installation || null,
        customer_location: parsed.customer_location || null,
        quotation_status: parsed.quotation_status || 'NOT_REQUESTED',
        active_quote: parsed.active_quote || undefined,
        previous_requirements: parsed.previous_requirements || {},
        profile: parsed.profile || getDefaultProfile(),
        last_question_asked: parsed.last_question_asked || undefined,
        pending_confirmation_question: parsed.pending_confirmation_question || undefined,
        notes: parsed.notes || undefined
      };
    }
  } catch (err) {
    console.error('[ConversationState] Failed to parse state for session', sessionId, err);
  }
  return getDefaultState();
}

export function saveConversationState(sessionId: string, state: ConversationState): void {
  try {
    // Keep stage & requirement_status synchronized
    if (!state.stage) {
      state.stage = 'INTENT_DISCOVERY';
    }
    state.requirement_status = state.stage;

    // Keep profile synchronized
    if (state.profile) {
      state.profile.activeProduct = state.active_product_category;
      state.profile.materialPreferences = state.selected_material;
      state.profile.measurements = state.confirmed_dimensions;
      state.profile.location = state.customer_location;
      state.profile.supplyInstallationScope = state.supply_or_installation;
    }

    const payload = JSON.stringify(state);

    // Ensure session exists
    const exists = db.prepare('SELECT id FROM conversations WHERE session_id = ?').get(sessionId);
    if (exists) {
      db.prepare('UPDATE conversations SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?')
        .run(payload, sessionId);
    } else {
      const convId = 'CONV-' + crypto.randomUUID();
      db.prepare(`
        INSERT INTO conversations (id, website_id, session_id, state, messages)
        VALUES (?, 'gcm-enterprises', ?, ?, '[]')
      `).run(convId, sessionId, payload);
    }
  } catch (err: any) {
    console.error(`[ConversationState Critical] Failed to persist state for session ${sessionId}:`, err.message);
    throw new Error(`Conversation state persistence failure: ${err.message}`);
  }
}

export function switchProductCategory(state: ConversationState, newCategory: ProductCategory): void {
  if (state.active_product_category && state.active_product_category !== newCategory) {
    // Isolate & archive previous category requirements
    state.previous_requirements[state.active_product_category] = {
      confirmed_dimensions: state.confirmed_dimensions,
      selected_material: state.selected_material,
      supply_or_installation: state.supply_or_installation,
      requirement_status: state.requirement_status,
      stage: state.stage,
      active_quote: state.active_quote
    };
  }

  // Restore archived requirements if customer is returning to a previously discussed product
  const prev = state.previous_requirements[newCategory];
  state.active_product_category = newCategory;
  state.stage = prev?.stage || 'REQUIREMENT_COLLECTION';
  state.requirement_status = state.stage;
  state.confirmed_dimensions = prev?.confirmed_dimensions || null;
  state.selected_material = prev?.selected_material || null;
  state.supply_or_installation = prev?.supply_or_installation || null;
  state.active_quote = prev?.active_quote || undefined;

  // Never leak assumptions across categories
  if (!prev) {
    state.confirmed_dimensions = null;
    state.selected_material = null;
    state.supply_or_installation = null;
    state.active_quote = undefined;
    state.profile.customerConfirmed = false;
  }
}
