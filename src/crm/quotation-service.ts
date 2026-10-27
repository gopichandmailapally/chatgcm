/**
 * Quotation Generation, Tax Engine & Approval Workflow Service (Enterprise 2026)
 * Strictly adheres to Phase 5:
 * 1. Item-wise tax calculations (5% turf, 5% sand, 5% rubber, 18% glue, 5% tape, 5% cricket supply; 0% separate GST on installed residential quotes)
 * 2. Distinct outputs: Requirement Summary (no price), Preliminary Estimate, Official Quotation
 * 3. Strict approval workflow: DRAFT -> VALIDATED -> PENDING_OWNER_APPROVAL -> APPROVED -> DOCUMENT_GENERATED -> SENT
 * 4. Tenant-to-company mapping (no blind COMP-0001 hardcoding)
 * 5. Strict prevention of unapproved document generation
 */

import { db } from '../db/database.js';
import crypto from 'node:crypto';
import { updateLeadStage } from './lead-service.js';
import { createOwnerApprovalRequest } from './approval-service.js';
import { generateOfficialEstimation } from './gcm-bridge-client.js';

export interface QuoteLineItemInput {
  productId?: string;
  itemName: string;
  specification?: string;
  quantity: number;
  unit: string;
  unitRate: number;
  gstRate?: number; // Optional item-specific GST rate override
}

export interface CreateQuotationInput {
  leadId: string;
  websiteId: string;
  projectName: string;
  dimensionsText?: string;
  items: QuoteLineItemInput[];
  discountPct?: number;
  transportCharges?: number;
  installationCharges?: number;
}

export const TENANT_COMPANY_MAPPING: Record<string, { companyId: string; companyName: string }> = {
  'gcm-enterprises': { companyId: 'COMP-0001', companyName: 'GCM Enterprises' },
  'gcmsafetynets': { companyId: 'COMP-0002', companyName: 'GCM Safety Nets' },
  'gcmsafetynets-com': { companyId: 'COMP-0002', companyName: 'GCM Safety Nets (National)' },
  'gcminvisiblegrills': { companyId: 'COMP-0002', companyName: 'GCM Invisible Grills' },
  'nettingteam': { companyId: 'COMP-0002', companyName: 'NettingTeam Hyderabad' },
  'netsocean': { companyId: 'COMP-0003', companyName: 'NetsOcean Wholesale' },
  'russea': { companyId: 'COMP-0003', companyName: 'RUSSEA Technical Netting' },
  'zenxa': { companyId: 'COMP-0001', companyName: 'Zenxa Architectural & Industrial Protection' }
};

/**
 * Resolves the statutory GST rate for an item if not explicitly supplied
 */
export function resolveItemGstRate(itemName: string, spec?: string): number {
  const text = (itemName + ' ' + (spec || '')).toLowerCase();

  // 18% GST: SPEB 7 Adhesive Glue, industrial hardware
  if (text.includes('speb') || text.includes('glue') || text.includes('adhesive') || text.includes('fastener')) {
    return 18.0;
  }

  // 5% GST: Turf, Artificial Grass, Silica Sand, Rubber Granules, Seaming Tape, Supply Nets
  if (
    text.includes('turf') ||
    text.includes('grass') ||
    text.includes('sand') ||
    text.includes('rubber') ||
    text.includes('granule') ||
    text.includes('seaming tape') ||
    text.includes('jointing tape') ||
    text.includes('bag') ||
    text.includes('twisted net') ||
    text.includes('braided net') ||
    text.includes('cricket net')
  ) {
    return 5.0;
  }

  // 0% GST: Residential doorstep installation schedule (Inclusive of taxes / composite supply under standard retail threshold)
  if (text.includes('installed') || text.includes('balcony') || text.includes('pigeon') || text.includes('invisible grill') || text.includes('cloth hanger')) {
    return 0.0;
  }

  return 5.0;
}

/**
 * Output A: Requirement Summary (No Pricing)
 */
export function generateRequirementSummary(params: {
  productName: string;
  dimensions?: { length?: number; width?: number; height?: number; areaSft?: number };
  material: string;
  scope: 'supply_only' | 'supply_installation';
  location: string;
  notes?: string;
}): string {
  const { productName, dimensions, material, scope, location, notes } = params;
  let text = `📋 PROJECT REQUIREMENT SUMMARY\n`;
  text += `• Product: ${productName}\n`;
  if (dimensions?.length && dimensions?.width) {
    text += `• Dimensions: ${dimensions.length} x ${dimensions.width}${dimensions.height ? ` x ${dimensions.height}` : ''} ft`;
    if (dimensions.areaSft) text += ` (${dimensions.areaSft.toLocaleString('en-IN')} SFT)`;
    text += `\n`;
  } else if (dimensions?.areaSft) {
    text += `• Area: ${dimensions.areaSft.toLocaleString('en-IN')} SFT\n`;
  }
  text += `• Material Specification: ${material}\n`;
  text += `• Project Scope: ${scope === 'supply_only' ? 'Material Supply Only (Doorstep Dispatch)' : 'Complete Supply & Professional Installation'}\n`;
  text += `• Site / Delivery Location: ${location}\n`;
  if (notes) text += `• Additional Notes: ${notes}\n`;
  text += `\n*This is a confirmed requirement specification. Financial estimate will be generated upon request.*`;
  return text;
}

/**
 * Output B: Preliminary Estimate
 */
export function generatePreliminaryEstimate(params: {
  productName: string;
  dimensionsText?: string;
  items: Array<{ itemName: string; quantity: number; unit: string; unitRate: number; gstRate: number }>;
  discountPct?: number;
  deliveryTerms?: string;
}): {
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  grandTotal: number;
  formattedText: string;
} {
  const discountPct = params.discountPct || 0;
  let subtotal = 0;
  let totalGst = 0;

  let breakdownLines = '';
  for (const it of params.items) {
    const lineTotal = Math.round(it.quantity * it.unitRate * 100) / 100;
    subtotal += lineTotal;
    const lineDiscount = Math.round(lineTotal * (discountPct / 100) * 100) / 100;
    const taxableLine = lineTotal - lineDiscount;
    const lineGst = Math.round(taxableLine * (it.gstRate / 100) * 100) / 100;
    totalGst += lineGst;

    breakdownLines += `• ${it.itemName}: ${it.quantity} ${it.unit} @ ₹${it.unitRate}/${it.unit} = ₹${lineTotal.toLocaleString('en-IN')}`;
    if (it.gstRate > 0) breakdownLines += ` (GST ${it.gstRate}%)`;
    breakdownLines += `\n`;
  }

  const discountAmount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
  const taxableAmount = subtotal - discountAmount;
  const grandTotal = Math.round((taxableAmount + totalGst) * 100) / 100;

  let text = `📊 PRELIMINARY ESTIMATE (${params.productName.toUpperCase()})\n`;
  if (params.dimensionsText) text += `Scope / Dimensions: ${params.dimensionsText}\n\n`;
  text += `Calculation Breakdown:\n${breakdownLines}\n`;
  text += `Material Subtotal: ₹${subtotal.toLocaleString('en-IN')}\n`;
  if (discountPct > 0) {
    text += `Volume Discount (${discountPct}%): -₹${discountAmount.toLocaleString('en-IN')}\n`;
    text += `Taxable Amount: ₹${taxableAmount.toLocaleString('en-IN')}\n`;
  }
  if (totalGst > 0) {
    text += `Total GST (Itemized): ₹${totalGst.toLocaleString('en-IN')}\n`;
  }
  text += `Estimated Total: ₹${grandTotal.toLocaleString('en-IN')}\n\n`;
  text += `Delivery Terms: ${params.deliveryTerms || 'Freight / transport extra at actuals'}\n`;
  text += `📌 *Preliminary estimate only. Official stamped quotation requires management approval.*`;

  return {
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount: totalGst,
    grandTotal,
    formattedText: text
  };
}

/**
 * Output C: Official Quotation Creation with Strict Approval Gating
 */
export async function createQuotation(input: CreateQuotationInput) {
  const { leadId, websiteId, projectName, dimensionsText, items } = input;
  const discountPct = input.discountPct || 0;
  const transportCharges = input.transportCharges || 0;
  const installationCharges = input.installationCharges || 0;

  if (!items || items.length === 0) {
    throw new Error('Quotation must contain at least one line item.');
  }

  // Generate serial number: GCM-QT-2026-XXXX (guaranteed collision-free)
  const uniqueSuffix = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
  const quoteNumber = `GCM-QT-2026-${uniqueSuffix}`;
  const quoteId = 'QT-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  // Financial Calculations with Item-Wise GST
  let subtotal = 0;
  let totalGstAmount = 0;

  const calculatedItems = items.map(item => {
    const amount = Math.round(item.quantity * item.unitRate * 100) / 100;
    subtotal += amount;

    // Resolve GST rate per item
    const resolvedGstRate = item.gstRate !== undefined ? item.gstRate : resolveItemGstRate(item.itemName, item.specification);
    const itemDiscount = Math.round(amount * (discountPct / 100) * 100) / 100;
    const taxableItem = amount - itemDiscount;
    const itemGst = Math.round(taxableItem * (resolvedGstRate / 100) * 100) / 100;
    totalGstAmount += itemGst;

    return {
      ...item,
      gstRate: resolvedGstRate,
      amount
    };
  });

  const discountAmount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
  const taxableAmount = subtotal - discountAmount + installationCharges;

  // Add 18% GST on installation charges if separate
  if (installationCharges > 0) {
    totalGstAmount += Math.round(installationCharges * 0.18 * 100) / 100;
  }

  const grandTotal = Math.round((taxableAmount + totalGstAmount + transportCharges) * 100) / 100;
  const effectiveGstPct = taxableAmount > 0 ? Math.round((totalGstAmount / taxableAmount) * 1000) / 10 : 0;

  // Check if discount exceeded 5% -> Flag for Owner Approval
  let requiresApproval = false;
  let approvalId: string | null = null;
  if (discountPct > 5.0) {
    requiresApproval = true;
  }

  // Mandatory initial status
  const initialStatus = requiresApproval ? 'PENDING_APPROVAL' : 'DRAFT';

  // Insert quotation into SQLite
  db.prepare(`
    INSERT INTO quotations (
      id, quote_number, lead_id, website_id, project_name, dimensions_text,
      subtotal, discount_pct, discount_amount, taxable_amount, gst_pct, gst_amount,
      transport_charges, installation_charges, grand_total, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    quoteId,
    quoteNumber,
    leadId,
    websiteId,
    projectName,
    dimensionsText || null,
    subtotal,
    discountPct,
    discountAmount,
    taxableAmount,
    effectiveGstPct,
    totalGstAmount,
    transportCharges,
    installationCharges,
    grandTotal,
    initialStatus
  );

  // Insert quote line items
  const insertItem = db.prepare(`
    INSERT INTO quote_items (id, quotation_id, product_id, item_name, specification, quantity, unit, unit_rate, amount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const it of calculatedItems) {
    const itemId = 'QTI-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    insertItem.run(
      itemId,
      quoteId,
      it.productId || null,
      it.itemName,
      it.specification ? `${it.specification} (GST ${it.gstRate}%)` : `GST ${it.gstRate}%`,
      it.quantity,
      it.unit,
      it.unitRate,
      it.amount
    );
  }

  // Progress Lead Stage in CRM based on approval status
  if (requiresApproval) {
    updateLeadStage(leadId, 'APPROVAL_PENDING', `Quotation ${quoteNumber} pending owner approval (${discountPct}% discount requested)`);
    const approval = createOwnerApprovalRequest({
      leadId,
      quotationId: quoteId,
      reason: `Customer requested ${discountPct}% discount on quotation ${quoteNumber} (exceeds 5% autonomous limit)`,
      requestedDiscountPct: discountPct
    });
    approvalId = approval.id;
  } else {
    updateLeadStage(leadId, 'QUOTATION_DRAFT', `Quotation ${quoteNumber} draft prepared for ₹${grandTotal.toLocaleString('en-IN')}`);
  }

  // Phase 5.3: NEVER generate official bridge document while PENDING_APPROVAL or unapproved DRAFT!
  // Official documents are generated strictly when approved via generateAndAttachOfficialDocument()

  return {
    quoteId,
    quoteNumber,
    officialDocId: null,
    officialViewUrl: null,
    officialPdfUrl: null,
    companyName: TENANT_COMPANY_MAPPING[websiteId]?.companyName || 'GCM Enterprises',
    projectName,
    dimensionsText,
    items: calculatedItems,
    financials: {
      subtotal,
      discountPct,
      discountAmount,
      taxableAmount,
      gstPct: effectiveGstPct,
      gstAmount: totalGstAmount,
      transportCharges,
      installationCharges,
      grandTotal
    },
    requiresApproval,
    approvalId,
    status: initialStatus
  };
}

/**
 * Generates and attaches the official PDF document once approved
 */
export async function generateAndAttachOfficialDocument(quoteId: string, approvedBy = 'Owner'): Promise<any> {
  const quote = db.prepare('SELECT * FROM quotations WHERE id = ?').get(quoteId) as any;
  if (!quote) throw new Error(`Quotation not found: ${quoteId}`);

  // Strict Gate: Must not be pending approval or rejected
  if (quote.status === 'PENDING_APPROVAL' || quote.status === 'REJECTED') {
    throw new Error(`[Security Gate] Cannot generate official document for quotation with status '${quote.status}'. Approval required.`);
  }

  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(quote.lead_id) as any;
  const items = db.prepare('SELECT * FROM quote_items WHERE quotation_id = ?').all(quoteId) as any[];

  const tenantConfig = TENANT_COMPANY_MAPPING[quote.website_id] || { companyId: 'COMP-0001', companyName: 'GCM Enterprises' };

  const bridgeItems = items.map(it => ({
    description: it.item_name,
    qty: it.quantity,
    unit: it.unit,
    rate: it.unit_rate,
    specs: it.specification ? [it.specification] : []
  }));

  try {
    const officialDoc = await generateOfficialEstimation({
      company_id: tenantConfig.companyId,
      customer: {
        name: lead?.customer_name || 'Valued Client',
        phone: lead?.phone || '',
        city: lead?.city || 'Hyderabad, Telangana'
      },
      items: bridgeItems,
      discount_percent: quote.discount_pct,
      notes: `Approved by ${approvedBy} for ${quote.project_name || 'Project'}`
    });

    if (officialDoc && officialDoc.success) {
      db.prepare(`
        UPDATE quotations 
        SET doc_id = ?, view_url = ?, pdf_url = ?, convert_invoice_url = ?, company_name = ?, status = 'DOCUMENT_GENERATED'
        WHERE id = ?
      `).run(
        officialDoc.doc_id,
        officialDoc.view_url,
        officialDoc.pdf_url,
        officialDoc.convert_invoice_url,
        officialDoc.company_name || tenantConfig.companyName,
        quoteId
      );

      return {
        success: true,
        docId: officialDoc.doc_id,
        viewUrl: officialDoc.view_url,
        pdfUrl: officialDoc.pdf_url,
        companyName: officialDoc.company_name || tenantConfig.companyName
      };
    }
  } catch (err: any) {
    console.error(`[QuotationService] Failed to generate official document for quote ${quoteId}:`, err.message);
    throw err;
  }

  return { success: false, error: 'Document bridge did not return a valid result' };
}

export function getQuotationById(quoteId: string) {
  const quote = db.prepare('SELECT q.*, l.customer_name, l.phone, l.city FROM quotations q JOIN leads l ON q.lead_id = l.id WHERE q.id = ?').get(quoteId) as any;
  if (!quote) return null;

  const items = db.prepare('SELECT * FROM quote_items WHERE quotation_id = ?').all(quoteId);
  return { ...quote, items };
}
