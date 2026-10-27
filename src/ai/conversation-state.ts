/**
 * Chat GCM — Persisted Conversation State & Customer Profile Engine
 * Adheres to Phase 2 & Phase 3 Architecture:
 * 1. 13 Canonical Explicit Persisted States
 * 2. Customer Requirement Profile (Multi-category isolation, question tracking, recommendation history)
 * 3. Fail-safe state persistence with error recovery and structured logging
 */

import { db } from '../db/database.js';

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
 * Phase 2 — 13 Explicit Persisted States
 */
export type ConversationStage =
  | 'GREETING'
  | 'DISCOVERY'
  | 'REQUIREMENT_COLLECTION'
  | 'PRODUCT_EDUCATION'
  | 'PRODUCT_RECOMMENDATION'
  | 'REQUIREMENT_CONFIRMATION'
  | 'ESTIMATE_ELIGIBLE'
  | 'ESTIMATE_PREPARED'
  | 'QUOTATION_PENDING_APPROVAL'
  | 'QUOTATION_APPROVED'
  | 'QUOTATION_SENT'
  | 'ORDER_FOLLOW_UP'
  | 'HUMAN_HANDOVER';

// Backward compatibility alias for legacy callers
export type RequirementStage =
  | ConversationStage
  | 'IDENTIFYING'     // Maps to DISCOVERY
  | 'COLLECTING'      // Maps to REQUIREMENT_COLLECTION
  | 'CLARIFYING'      // Maps to PRODUCT_EDUCATION
  | 'RECOMMENDING'    // Maps to PRODUCT_RECOMMENDATION
  | 'CONFIRMING'      // Maps to REQUIREMENT_CONFIRMATION
  | 'CALCULATED'      // Maps to ESTIMATE_PREPARED
  | 'QUOTE_APPROVED'; // Maps to QUOTATION_APPROVED

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
}

/**
 * Phase 3 — Customer Requirement Profile
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
  stage?: ConversationStage;
  confirmed_dimensions: ConfirmedDimensions | null;
  selected_material: string | null;
  supply_or_installation: 'supply_only' | 'supply_installation' | null;
  customer_location: string | null;
  quotation_status: 'NOT_REQUESTED' | 'DRAFT' | 'APPROVED' | 'SENT';
  active_quote?: any;
  previous_requirements: Record<string, any>;
  profile: CustomerRequirementProfile;
  last_question_asked?: string;
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

export function getConversationState(sessionId: string): ConversationState {
  try {
    const row = db.prepare('SELECT state FROM conversations WHERE session_id = ?').get(sessionId) as any;
    if (row && row.state && row.state !== '{}') {
      const parsed = JSON.parse(row.state);
      const stage = (parsed.stage || parsed.requirement_status || 'GREETING') as ConversationStage;
      return {
        introduction_completed: Boolean(parsed.introduction_completed),
        active_product_category: parsed.active_product_category || null,
        customer_intent: parsed.customer_intent || null,
        requirement_status: parsed.requirement_status || stage,
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
    if (state.stage) {
      state.requirement_status = state.stage;
    } else if (state.requirement_status) {
      state.stage = mapToConversationStage(state.requirement_status);
    }

    // Keep profile synchronized
    if (state.profile) {
      state.profile.activeProduct = state.active_product_category;
      state.profile.materialPreferences = state.selected_material;
      state.profile.measurements = state.confirmed_dimensions;
      state.profile.location = state.customer_location;
      state.profile.supplyInstallationScope = state.supply_or_installation;
    }

    db.prepare('UPDATE conversations SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?')
      .run(JSON.stringify(state), sessionId);
  } catch (err) {
    console.error('[ConversationState] Critical: Failed to save state for session', sessionId, err);
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
  state.requirement_status = prev?.requirement_status || state.stage;
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
  }
}

function mapToConversationStage(stage: string): ConversationStage {
  switch (stage) {
    case 'IDENTIFYING': return 'DISCOVERY';
    case 'COLLECTING': return 'REQUIREMENT_COLLECTION';
    case 'CLARIFYING': return 'PRODUCT_EDUCATION';
    case 'RECOMMENDING': return 'PRODUCT_RECOMMENDATION';
    case 'CONFIRMING': return 'REQUIREMENT_CONFIRMATION';
    case 'CALCULATED': return 'ESTIMATE_PREPARED';
    case 'QUOTE_APPROVED': return 'QUOTATION_APPROVED';
    default: return (stage as ConversationStage) || 'DISCOVERY';
  }
}
