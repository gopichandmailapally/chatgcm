/**
 * Formal Tool (Function Calling) Schemas for Chat GCM
 * Encodes the 3 Master Business Pillars:
 * 1. Turnkey Sports & Box Cricket (gcm.enterprises)
 * 2. Residential Services with Installation (gcmsafetynets.in)
 * 3. Material Sales & Supply-Only Netting (netsocean.com)
 */

export const GCM_TOOLS = [
  // ── Pillar 1: Turnkey Sports & Box Cricket (gcm.enterprises) ──────────────
  {
    type: 'function',
    function: {
      name: 'calculate_turnkey_box_cricket',
      description: 'Calculates complete Turnkey Box Cricket & Sports Turf Bill of Quantities (BOQ) following exact gcm.enterprises rates. Includes concrete civil foundation, 40x40 GI ladder columns, horizontal tie pipes, non-infill turf, overhead cambered netting, and IP66 stadium floodlights.',
      parameters: {
        type: 'object',
        properties: {
          lengthFt: { type: 'number', description: 'Length of ground in feet (e.g. 100)' },
          widthFt: { type: 'number', description: 'Width of ground in feet (e.g. 50)' },
          heightFt: { type: 'number', description: 'Height of steel structure in feet (default 25)' },
          packageType: { type: 'string', enum: ['essential', 'commercial', 'premium_pro'], description: 'Package tier (default commercial standard)' },
          roofType: { type: 'string', enum: ['light_cable_top', 'pipe_top', 'truss_top', 'open_top'], description: 'Roof structure type (default light_cable_top with 8% camber)' },
          turfType: { type: 'string', enum: ['non_infill_turf', 'infill_turf_40mm', 'infill_turf_50mm', 'curled_pitch_15mm'], description: 'Artificial sports grass type' },
          civilBedType: { type: 'string', enum: ['compacted_wmm', 'pcc_m15_4inch', 'existing_terrace_ground'], description: 'Base civil work' }
        },
        required: ['lengthFt', 'widthFt', 'heightFt']
      }
    }
  },

  // ── Pillar 2: Services with Installation (gcmsafetynets.in) ───────────────
  {
    type: 'function',
    function: {
      name: 'calculate_balcony_safety',
      description: 'Calculates residential safety nets and installation following exact gcmsafetynets.in rates. Applies 100 SFT minimum site trip rule, tiered pricing (100-250, 250-500, 500-1000, 1000+ SFT), SS 316 invisible grills, and 6-pipe cloth drying hangers with free doorstep measurement.',
      parameters: {
        type: 'object',
        properties: {
          serviceType: { 
            type: 'string', 
            enum: ['balcony_safety_net', 'pigeon_net', 'invisible_grill', 'duct_net', 'cloth_hanger'],
            description: 'Type of residential safety service'
          },
          sections: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Name of section (e.g. Master Balcony)' },
                lengthFt: { type: 'number', description: 'Length in feet' },
                heightFt: { type: 'number', description: 'Height in feet' }
              },
              required: ['lengthFt', 'heightFt']
            }
          },
          totalAreaSft: { type: 'number', description: 'Direct total square feet if known' },
          thicknessMm: { type: 'number', description: 'Net/wire thickness (1.5mm, 2.0mm, 2.5mm, 3.0mm)' },
          meshOrGapMm: { type: 'number', description: 'Mesh opening (30mm, 40mm, 50mm) or grill gap in inches (2 or 3)' },
          hangerType: { type: 'string', enum: ['ceiling', 'wall'], description: 'For cloth drying hangers' },
          hangerLengthFt: { type: 'number', description: 'Hanger pipe length: 4, 5, 6, 7, or 8 feet' },
          quantity: { type: 'number', description: 'Quantity of hanger units' }
        },
        required: ['serviceType']
      }
    }
  },

  // ── Pillar 3: Material Sales & Supply Only (netsocean.com) ────────────────
  {
    type: 'function',
    function: {
      name: 'calculate_netsocean_supply',
      description: 'Calculates material sales and supply-only netting orders following exact netsocean.com pricing slabs. Handles standard 100ft x 33ft (3300 SFT) bags, custom cut panels, twisted roof nets, split-mesh pricing, 5% GST, and PAN-India courier/transport dispatch without installation.',
      parameters: {
        type: 'object',
        properties: {
          orderType: { type: 'string', enum: ['STANDARD', 'CUSTOM'], description: 'STANDARD for bulk bags, CUSTOM for tailored pieces' },
          lengthFt: { type: 'number', description: 'Court / net length in feet' },
          widthFt: { type: 'number', description: 'Court / net width in feet' },
          heightFt: { type: 'number', description: 'Court / net height in feet (0 if flat sheet)' },
          sidesNetType: { type: 'string', enum: ['HDPE_BRAIDED', 'TWISTED_24PLY'], description: 'Net twine type for sides (default HDPE_BRAIDED)' },
          sidesMeshSize: { type: 'string', enum: ['45mm', '40mm', '35mm', '30mm'], description: 'Mesh opening (default 45mm for cricket)' },
          topNetType: { type: 'string', enum: ['HDPE_BRAIDED', 'TWISTED_24PLY'], description: 'Net twine type for top/roof' },
          topMeshSize: { type: 'string', enum: ['45mm', '40mm', '35mm', '30mm'], description: 'Mesh size for top/roof' }
        },
        required: ['lengthFt', 'widthFt']
      }
    }
  },

  // ── Legacy / Dimension Helper ─────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'calculate_cricket_net_sft',
      description: 'Calculates exact perimeter, side netting SFT, roof netting SFT (with 8% camber allowance), and hardware requirements given court dimensions in feet.',
      parameters: {
        type: 'object',
        properties: {
          lengthFt: { type: 'number', description: 'Length of the cricket pitch/court in feet' },
          widthFt: { type: 'number', description: 'Width of the court in feet' },
          heightFt: { type: 'number', description: 'Height of the netting in feet' },
          includeRoof: { type: 'boolean', description: 'Whether overhead roof enclosure netting is included (default true)' }
        },
        required: ['lengthFt', 'widthFt', 'heightFt']
      }
    }
  },

  // ── CRM, Pricing & Quotation Tools ────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_approved_price',
      description: 'Fetches the current approved base rate from the database for a specific product and calculates allowable discount.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID or SKU (e.g. PROD-RUSSEA-25-40, PROD-GARWARE-NYLON-30)' },
          quantity: { type: 'number', description: 'Quantity in SFT, BAGS, or UNITS' },
          customerType: { type: 'string', enum: ['retail', 'contractor', 'wholesale'], description: 'Customer category' },
          requestedDiscountPct: { type: 'number', description: 'Discount percentage requested by customer' }
        },
        required: ['productId', 'quantity']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_available_products',
      description: 'Fetches active products for a specific brand or website category.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Category filter (e.g. Cricket Nets, Balcony Safety Nets, Invisible Grills)' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'check_stock_availability',
      description: 'Checks real-time inventory count and warehouse location for a product.',
      parameters: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product ID' }
        },
        required: ['productId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_official_quotation',
      description: 'Generates a formal quotation with serial number (GCM-QT-2026-XXXX), line items, GST, and registers it into the GCM ERP system.',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string' },
          phone: { type: 'string' },
          city: { type: 'string' },
          projectName: { type: 'string', description: 'Name of project (e.g. 100x50 Cricket Practice Box)' },
          dimensionsText: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                itemName: { type: 'string' },
                quantity: { type: 'number' },
                unit: { type: 'string' },
                unitRate: { type: 'number' }
              },
              required: ['itemName', 'quantity', 'unit', 'unitRate']
            }
          },
          discountPct: { type: 'number' },
          transportCharges: { type: 'number' }
        },
        required: ['customerName', 'phone', 'projectName', 'items']
      }
    }
  }
];
