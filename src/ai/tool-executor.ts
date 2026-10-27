import { 
  calculateInstalledSafetyNet,
  calculateCricketBraidedBags,
  calculateTwisted15Netting,
  calculateTurfAccessory,
  calculateUnifiedTurfEstimate
} from '../pricing/universal-pricing-engine.js';
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
import { calculateClothHanger } from '../calculators/cloth-hanger-calculator.js';
import { calculateInvisibleGrills } from '../calculators/invisible-grill-calculator.js';
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

    case 'calculate_cloth_hanger': {
      return calculateClothHanger({
        sizeFt: Number(args.sizeFt || 6) as any,
        mountingType: args.mountingType || 'ceiling',
        quantity: args.quantity ? Number(args.quantity) : 1,
        isOutsideHyderabad: args.isOutsideHyderabad === true,
        locationCity: args.locationCity
      });
    }

    case 'calculate_invisible_grills': {
      return calculateInvisibleGrills({
        totalAreaSft: args.totalAreaSft ? Number(args.totalAreaSft) : undefined,
        openings: args.openings,
        isOutsideHyderabad: args.isOutsideHyderabad === true,
        locationCity: args.locationCity,
        wireDiameter: args.wireDiameter,
        spacing: args.spacing
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

    // ── Universal Pricing Engine Dispatches ──────────────────────────────
    case 'calculate_installed_safety_net': {
      return calculateInstalledSafetyNet(
        args.qualityKey || '2.0mm_45mm',
        Number(args.actualAreaSft),
        args.rateMode || 'standard'
      );
    }

    case 'calculate_cricket_braided_bags': {
      return calculateCricketBraidedBags({
        variant: args.variant,
        fullBags: Number(args.fullBags || 0),
        halfBags: Number(args.halfBags || 0),
        mixedBagPolicy: args.mixedBagPolicy || 'SEPARATE_TIERS',
        gstRate: args.gstRate !== undefined ? Number(args.gstRate) : 5.0
      });
    }

    case 'calculate_cricket_twisted_net': {
      return calculateTwisted15Netting(
        Number(args.sft),
        args.includeCustomization !== false
      );
    }

    case 'calculate_turf_accessories': {
      return calculateTurfAccessory(args.accessoryKey, Number(args.quantity));
    }

    case 'calculate_unified_turf': {
      return calculateUnifiedTurfEstimate({
        turfSft: args.turfSft ? Number(args.turfSft) : undefined,
        turfRatePerSft: args.turfRatePerSft ? Number(args.turfRatePerSft) : undefined,
        turfGstPct: args.turfGstPct ? Number(args.turfGstPct) : undefined,
        silicaSandKg: args.silicaSandKg ? Number(args.silicaSandKg) : undefined,
        rubberGranulesKg: args.rubberGranulesKg ? Number(args.rubberGranulesKg) : undefined,
        glueLiters: args.glueLiters ? Number(args.glueLiters) : undefined,
        seamingTapeMeters: args.seamingTapeMeters ? Number(args.seamingTapeMeters) : undefined,
        transportCharges: args.transportCharges ? Number(args.transportCharges) : undefined,
        transportGstPct: args.transportGstPct !== undefined ? Number(args.transportGstPct) : undefined
      });
    }

    default:
      throw new Error(`Unknown tool name: ${toolName}`);
  }
}
