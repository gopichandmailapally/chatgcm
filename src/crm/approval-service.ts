/**
 * Owner Approval Queue Service (Enterprise 2026)
 * Guards against unauthorized discounts, credit approvals, or custom pricing.
 * Strictly adheres to Phase 5.3:
 * State Workflow: DRAFT -> VALIDATED -> PENDING_OWNER_APPROVAL -> APPROVED -> DOCUMENT_GENERATED -> SENT
 * If rejected: PENDING_OWNER_APPROVAL -> REJECTED
 */

import { db } from '../db/database.js';
import crypto from 'node:crypto';
import { updateLeadStage, logLeadActivity } from './lead-service.js';

export interface CreateApprovalInput {
  leadId: string;
  quotationId?: string;
  reason: string;
  requestedDiscountPct?: number;
  proposedRate?: number;
}

export function createOwnerApprovalRequest(input: CreateApprovalInput) {
  const id = 'APV-' + crypto.randomBytes(4).toString('hex').toUpperCase();

  db.prepare(`
    INSERT INTO owner_approvals (id, lead_id, quotation_id, reason, requested_discount_pct, proposed_rate, status)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
  `).run(
    id,
    input.leadId,
    input.quotationId || null,
    input.reason,
    input.requestedDiscountPct || null,
    input.proposedRate || null
  );

  logLeadActivity(
    input.leadId,
    'APPROVAL_REQUESTED',
    `Commercial approval requested: ${input.reason}`,
    'AI Sales Brain'
  );

  return db.prepare('SELECT * FROM owner_approvals WHERE id = ?').get(id) as any;
}

export function decideOwnerApproval(
  approvalId: string,
  decision: 'APPROVED' | 'REJECTED',
  comments?: string,
  approverUser = 'Owner / Managing Director'
) {
  const approval = db.prepare('SELECT * FROM owner_approvals WHERE id = ?').get(approvalId) as any;
  if (!approval) {
    throw new Error(`Approval request not found: ${approvalId}`);
  }

  // Update owner_approvals record
  db.prepare(`
    UPDATE owner_approvals 
    SET status = ?, owner_comments = ?, decided_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(decision, comments || null, approvalId);

  // If attached to a quotation, update quotation status strictly according to state machine
  if (approval.quotation_id) {
    const newQuotationStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    db.prepare(`
      UPDATE quotations 
      SET status = ? 
      WHERE id = ?
    `).run(newQuotationStatus, approval.quotation_id);

    // Update lead stage & activity
    if (decision === 'APPROVED') {
      updateLeadStage(
        approval.lead_id,
        'QUOTATION_APPROVED',
        `Quotation approved by ${approverUser}. Comments: ${comments || 'No comments'}`
      );
      logLeadActivity(
        approval.lead_id,
        'APPROVAL_GRANTED',
        `Commercial approval GRANTED by ${approverUser}. Comments: ${comments || 'Approved'}`,
        approverUser
      );
    } else {
      updateLeadStage(
        approval.lead_id,
        'QUOTATION_REJECTED',
        `Quotation rejected by ${approverUser}. Reason: ${comments || 'Commercial terms declined'}`
      );
      logLeadActivity(
        approval.lead_id,
        'APPROVAL_REJECTED',
        `Commercial approval REJECTED by ${approverUser}. Reason: ${comments || 'Commercial terms declined'}`,
        approverUser
      );
    }
  }

  return db.prepare('SELECT * FROM owner_approvals WHERE id = ?').get(approvalId);
}

export function listPendingApprovals() {
  return db.prepare(`
    SELECT a.*, l.customer_name, l.phone, l.city, q.quote_number, q.grand_total, w.brand_name
    FROM owner_approvals a
    JOIN leads l ON a.lead_id = l.id
    LEFT JOIN quotations q ON a.quotation_id = q.id
    LEFT JOIN websites w ON l.website_id = w.id
    WHERE a.status = 'PENDING'
    ORDER BY a.created_at DESC
  `).all();
}
