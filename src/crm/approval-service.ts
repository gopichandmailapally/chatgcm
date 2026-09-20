/**
 * Owner Approval Queue Service
 * Guards against unauthorized discounts, credit approvals, or custom pricing.
 */

import { db } from '../db/database.js';
import crypto from 'node:crypto';

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

  return db.prepare('SELECT * FROM owner_approvals WHERE id = ?').get(id) as any;
}

export function decideOwnerApproval(approvalId: string, decision: 'APPROVED' | 'REJECTED', comments?: string) {
  const approval = db.prepare('SELECT * FROM owner_approvals WHERE id = ?').get(approvalId) as any;
  if (!approval) {
    throw new Error(`Approval request not found: ${approvalId}`);
  }

  db.prepare(`
    UPDATE owner_approvals 
    SET status = ?, owner_comments = ?, decided_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(decision, comments || null, approvalId);

  // If approved and attached to a quotation, update quotation status
  if (approval.quotation_id) {
    const newStatus = decision === 'APPROVED' ? 'ACCEPTED' : 'DRAFT';
    db.prepare('UPDATE quotations SET status = ? WHERE id = ?').run(newStatus, approval.quotation_id);
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
