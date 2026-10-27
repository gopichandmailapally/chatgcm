/**
 * GCM Enterprises AI Document Bridge Client
 * Communicates with https://gcm.enterprises/admin/api/ai-doc-bridge.php
 * to automatically generate sequential estimations, bills, and tax invoices
 * with official company branding, stamps, signatures, and bank details.
 */

export interface BridgeItem {
  description: string;
  qty: number;
  unit: string;
  rate: number;
  hsn?: string;
  specs?: string[];
  gst_rate?: number;
}

export interface GenerateEstimationPayload {
  company_id?: 'COMP-0001' | 'COMP-0002' | 'COMP-0003' | string;
  customer: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    gstin?: string;
  };
  items: BridgeItem[];
  discount_type?: 'percent' | 'amount';
  discount_percent?: number;
  discount_flat?: number;
  is_gst?: boolean;
  gst_mode?: 'cgst_sgst' | 'igst' | 'none';
  terms?: string[];
  notes?: string;
  estimation_subtype?: 'normal' | 'turnkey_court' | 'supply_only' | 'supply_installation' | 'cricket_net';
  turnkey_config?: any;
  channel?: string;
  conversation_id?: string;
}

export interface BridgeEstimationResult {
  success: boolean;
  doc_id: string;
  doc_type: string;
  customer_id?: string;
  company_id: string;
  company_name: string;
  subtotal: number;
  discount_amount: number;
  taxable_value: number;
  grand_total: number;
  amount_in_words: string;
  view_url: string;
  pdf_url: string;
  convert_invoice_url: string;
  convert_bill_url: string;
  created_at: string;
}

const BRIDGE_URL = process.env.GCM_BRIDGE_URL || 'https://gcm.enterprises/admin/api/ai-doc-bridge.php';

export async function generateOfficialEstimation(payload: GenerateEstimationPayload): Promise<BridgeEstimationResult> {
  const bridgeToken = process.env.GCM_BRIDGE_TOKEN;
  if (!bridgeToken || bridgeToken.trim() === '') {
    throw new Error('[Security Guardrail] GCM Bridge authentication token (GCM_BRIDGE_TOKEN) is not configured in environment. Failing closed to prevent unauthorized document generation.');
  }

  try {
    const response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bridgeToken}`,
        'X-Bridge-Token': bridgeToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`GCM Bridge HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json() as BridgeEstimationResult;
    return data;
  } catch (error: any) {
    console.error('[GCM Bridge] Failed to generate official document:', error.message);
    throw error;
  }
}
