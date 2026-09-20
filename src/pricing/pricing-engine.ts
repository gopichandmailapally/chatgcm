/**
 * Approved Pricing Engine & Discount Rule Guardian
 * Strictly enforces that AI cannot invent rates or exceed owner-authorized discount limits.
 */

import { db } from '../db/database.js';

export interface PriceQuoteRequest {
  productId: string;
  quantity: number;
  customerType?: 'retail' | 'contractor' | 'wholesale';
  requestedDiscountPct?: number;
}

export interface PriceQuoteResponse {
  productId: string;
  productName: string;
  unit: string;
  baseRate: number;
  quantity: number;
  grossAmount: number;
  authorizedDiscountPct: number;
  discountAmount: number;
  netRate: number;
  netAmount: number;
  requiresOwnerApproval: boolean;
  approvalReason?: string;
}

export function getApprovedProductPrice(request: PriceQuoteRequest): PriceQuoteResponse {
  const { productId, quantity } = request;
  const customerType = request.customerType || 'retail';
  const requestedDiscount = request.requestedDiscountPct || 0;

  // 1. Fetch Product
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(productId) as any;
  if (!product) {
    throw new Error(`Product not found or inactive: ${productId}`);
  }

  // 2. Fetch Pricing Rule matching tier and quantity threshold
  const rule = db.prepare(`
    SELECT * FROM pricing_rules 
    WHERE product_id = ? AND customer_type = ? AND min_quantity <= ?
    ORDER BY min_quantity DESC 
    LIMIT 1
  `).get(productId, customerType, quantity) as any;

  let baseRate = 0;
  let maxAiDiscountPct = 5.0;

  if (rule) {
    baseRate = rule.rate_per_unit;
    maxAiDiscountPct = rule.max_ai_discount_pct;
  } else {
    // Fallback to retail base rate
    const retailRule = db.prepare(`
      SELECT * FROM pricing_rules 
      WHERE product_id = ? AND customer_type = 'retail'
      LIMIT 1
    `).get(productId) as any;
    if (!retailRule) {
      throw new Error(`No pricing rule configured for product: ${productId}`);
    }
    baseRate = retailRule.rate_per_unit;
    maxAiDiscountPct = retailRule.max_ai_discount_pct;
  }

  // 3. Discount Boundary Enforcement
  const grossAmount = Math.round(baseRate * quantity * 100) / 100;
  let authorizedDiscountPct = 0;
  let requiresOwnerApproval = false;
  let approvalReason: string | undefined;

  if (requestedDiscount > 0) {
    if (requestedDiscount <= maxAiDiscountPct) {
      // Within AI autonomous authority
      authorizedDiscountPct = requestedDiscount;
    } else {
      // Exceeds AI autonomous limit -> Flag for Owner Approval
      authorizedDiscountPct = maxAiDiscountPct; // AI can only promise up to its limit right now
      requiresOwnerApproval = true;
      approvalReason = `Customer requested ${requestedDiscount}% discount, which exceeds the autonomous AI limit of ${maxAiDiscountPct}%. Requires Owner Decision.`;
    }
  }

  const discountAmount = Math.round(grossAmount * (authorizedDiscountPct / 100) * 100) / 100;
  const netAmount = Math.round((grossAmount - discountAmount) * 100) / 100;
  const netRate = Math.round((netAmount / quantity) * 100) / 100;

  return {
    productId: product.id,
    productName: product.product_name,
    unit: product.unit,
    baseRate,
    quantity,
    grossAmount,
    authorizedDiscountPct,
    discountAmount,
    netRate,
    netAmount,
    requiresOwnerApproval,
    approvalReason
  };
}

export function listAvailableProducts(websiteId?: string, category?: string) {
  let query = 'SELECT * FROM products WHERE is_active = 1';
  const params: any[] = [];

  if (category) {
    query += ' AND category LIKE ?';
    params.push(`%${category}%`);
  }

  if (websiteId) {
    const website = db.prepare('SELECT allowed_categories FROM websites WHERE id = ?').get(websiteId) as any;
    if (website && website.allowed_categories) {
      const cats: string[] = JSON.parse(website.allowed_categories);
      const placeholders = cats.map(() => '?').join(',');
      query += ` AND category IN (${placeholders})`;
      params.push(...cats);
    }
  }

  query += ' ORDER BY category, product_name';
  return db.prepare(query).all(...params);
}
