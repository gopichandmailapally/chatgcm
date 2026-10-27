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

export type RequirementStage =
  | 'IDENTIFYING'     // Initial requirement / application
  | 'COLLECTING'      // Gathering measurements / quantities
  | 'CLARIFYING'      // Pole-to-pole? Supply only vs install?
  | 'RECOMMENDING'    // Explaining options (2mm vs 2.5mm 45mm mesh)
  | 'CONFIRMING'      // Summarizing requirements before calculation
  | 'CALCULATED'      // Estimate generated
  | 'QUOTE_APPROVED'; // Ready for formal quote generation

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

export interface ConversationState {
  introduction_completed: boolean;
  active_product_category: ProductCategory | null;
  customer_intent: string | null;
  requirement_status: RequirementStage;
  confirmed_dimensions: ConfirmedDimensions | null;
  selected_material: string | null;
  supply_or_installation: 'supply_only' | 'supply_installation' | null;
  customer_location: string | null;
  quotation_status: 'NOT_REQUESTED' | 'DRAFT' | 'APPROVED' | 'SENT';
  active_quote?: any;
  previous_requirements: Record<string, any>;
  last_question_asked?: string;
  notes?: string;
}

export function getDefaultState(): ConversationState {
  return {
    introduction_completed: false,
    active_product_category: null,
    customer_intent: null,
    requirement_status: 'IDENTIFYING',
    confirmed_dimensions: null,
    selected_material: null,
    supply_or_installation: null,
    customer_location: null,
    quotation_status: 'NOT_REQUESTED',
    previous_requirements: {}
  };
}

export function getConversationState(sessionId: string): ConversationState {
  try {
    const row = db.prepare('SELECT state FROM conversations WHERE session_id = ?').get(sessionId) as any;
    if (row && row.state && row.state !== '{}') {
      const parsed = JSON.parse(row.state);
      return {
        introduction_completed: Boolean(parsed.introduction_completed),
        active_product_category: parsed.active_product_category || null,
        customer_intent: parsed.customer_intent || null,
        requirement_status: parsed.requirement_status || 'IDENTIFYING',
        confirmed_dimensions: parsed.confirmed_dimensions || null,
        selected_material: parsed.selected_material || null,
        supply_or_installation: parsed.supply_or_installation || null,
        customer_location: parsed.customer_location || null,
        quotation_status: parsed.quotation_status || 'NOT_REQUESTED',
        active_quote: parsed.active_quote || undefined,
        previous_requirements: parsed.previous_requirements || {},
        last_question_asked: parsed.last_question_asked || undefined,
        notes: parsed.notes || undefined
      };
    }
  } catch (err) {
    console.warn('[ConversationState] Failed to parse state for', sessionId, err);
  }
  return getDefaultState();
}

export function saveConversationState(sessionId: string, state: ConversationState): void {
  try {
    db.prepare('UPDATE conversations SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?')
      .run(JSON.stringify(state), sessionId);
  } catch (err) {
    console.warn('[ConversationState] Failed to save state for', sessionId, err);
  }
}

export function switchProductCategory(state: ConversationState, newCategory: ProductCategory): void {
  if (state.active_product_category && state.active_product_category !== newCategory) {
    // Save current active category data to previous_requirements
    state.previous_requirements[state.active_product_category] = {
      confirmed_dimensions: state.confirmed_dimensions,
      selected_material: state.selected_material,
      supply_or_installation: state.supply_or_installation,
      requirement_status: state.requirement_status
    };
  }

  // Restore previous requirements if customer is switching back to an earlier category
  const prev = state.previous_requirements[newCategory];
  state.active_product_category = newCategory;
  state.requirement_status = prev?.requirement_status || 'COLLECTING';
  state.confirmed_dimensions = prev?.confirmed_dimensions || null;
  state.selected_material = prev?.selected_material || null;
  state.supply_or_installation = prev?.supply_or_installation || null;
  state.active_quote = undefined;
}
