/**
 * Tool Execution Dispatcher
 * Directly connects AI tool requests to deterministic algorithms and database queries.
 * Enforces the 3 Master Business Pillars:
 * 1. gcm.enterprises (Turnkey Sports / Box Cricket)
 * 2. gcmsafetynets.in (Doorstep Services with Installation)
 * 3. netsocean.com (Material Sales & Supply Only)
 */

import { calculateCricketNetting } from '../calculators/cricket-net-calculator.js';
import { calculateTurnkeyBoxCricketBOQ, calculateTurnkeyBoxCricket } from '../calculators/turnkey-box-calculator.js';
import { calculateSafetyNetInstallation, calculateBalconySafety } from '../calculators/balcony-safety-calculator.js';
import { calculateNetsOceanSupply } from '../calculators/netsocean-supply-calculator.js';
import { getApprovedProductPrice, listAvailableProducts } from '../pricing/pricing-engine.js';
import { createOrUpdateLead } from '../crm/lead-service.js';
import { createQuotation } from '../crm/quotation-service.js';
import { db } from '../db/database.js';

export interface ToolCallContext {
  websiteId: string;
  sessionId?: string;
  leadId?: string;
}

export async function executeToolCall(toolName: string, args: any, context: ToolCallContext): Promise<any> {
  switch (toolName) {
    // ── Pillar 1: Turnkey Sports & Box Cricket (gcm.enterprises) ───────────
    case 'calculate_turnkey_box_cricket': {
      return calculateTurnkeyBoxCricketBOQ({
        lengthFt: Number(args.lengthFt),
        widthFt: Number(args.widthFt),
        heightFt: Number(args.heightFt || 25),
        packageType: args.packageType || 'commercial',
        roofType: args.roofType || 'light_cable_top',
        turfType: args.turfType || 'non_infill_turf',
        civilBedType: args.civilBedType || 'compacted_wmm'
      });
    }

    // ── Pillar 2: Residential Services with Installation (gcmsafetynets.in) 
    case 'calculate_balcony_safety': {
      return calculateSafetyNetInstallation({
        serviceType: args.serviceType || 'balcony_safety_net',
        sections: args.sections,
        totalAreaSft: args.totalAreaSft ? Number(args.totalAreaSft) : undefined,
        thicknessMm: args.thicknessMm ? Number(args.thicknessMm) : undefined,
        meshOrGapMm: args.meshOrGapMm ? Number(args.meshOrGapMm) : undefined,
        hangerType: args.hangerType,
        hangerLengthFt: args.hangerLengthFt ? Number(args.hangerLengthFt) : undefined,
        quantity: args.quantity ? Number(args.quantity) : undefined
      });
    }

    // ── Pillar 3: Material Sales & Supply Only (netsocean.com) ─────────────
    case 'calculate_netsocean_supply': {
      return calculateNetsOceanSupply({
        orderType: args.orderType || 'STANDARD',
        lengthFt: Number(args.lengthFt),
        widthFt: Number(args.widthFt),
        heightFt: args.heightFt ? Number(args.heightFt) : 0,
        sidesNetType: args.sidesNetType || 'HDPE_BRAIDED',
        sidesMeshSize: args.sidesMeshSize || '45mm',
        topNetType: args.topNetType,
        topMeshSize: args.topMeshSize
      });
    }

    // ── Legacy Netting SFT ────────────────────────────────────────────────
    case 'calculate_cricket_net_sft': {
      return calculateCricketNetting({
        lengthFt: Number(args.lengthFt),
        widthFt: Number(args.widthFt),
        heightFt: Number(args.heightFt),
        includeRoof: args.includeRoof !== false
      });
    }

    // ── Approved Pricing Matrix ───────────────────────────────────────────
    case 'get_approved_price': {
      return getApprovedProductPrice({
        productId: args.productId,
        quantity: Number(args.quantity),
        customerType: args.customerType || 'retail',
        requestedDiscountPct: Number(args.requestedDiscountPct || 0)
      });
    }

    case 'list_available_products': {
      return listAvailableProducts(context.websiteId, args.category);
    }

    case 'check_stock_availability': {
      const stock = db.prepare(`
        SELECT i.*, p.product_name, p.unit 
        FROM inventory i 
        JOIN products p ON i.product_id = p.id 
        WHERE i.product_id = ?
      `).get(args.productId) as any;

      if (!stock) {
        return { available: false, message: `No stock record found for product ID ${args.productId}` };
      }
      return {
        available: stock.available_units > 0,
        availableUnits: stock.available_units,
        unitType: stock.unit_type,
        warehouse: stock.warehouse_location
      };
    }

    case 'create_official_quotation': {
      // 1. Ensure Lead exists
      const lead = createOrUpdateLead({
        websiteId: context.websiteId,
        customerName: args.customerName,
        phone: args.phone,
        city: args.city || 'Hyderabad',
        requirementSummary: `${args.projectName} - ${args.dimensionsText || ''}`
      }) as any;

      // 2. Create Quotation in GCM ERP
      return await createQuotation({
        leadId: lead.id,
        websiteId: context.websiteId,
        projectName: args.projectName,
        dimensionsText: args.dimensionsText,
        items: args.items,
        discountPct: Number(args.discountPct || 0),
        transportCharges: Number(args.transportCharges || 0)
      });
    }

    default:
      throw new Error(`Unknown tool name: ${toolName}`);
  }
}
