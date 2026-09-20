import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = process.env.DB_DIR || '/var/www/chatgcm.in/data';
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const DB_PATH = path.join(DB_DIR, 'gcm_master.sqlite');
export const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL mode for high performance
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    -- 1. Multi-Tenant Websites Registry
    CREATE TABLE IF NOT EXISTS websites (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      business_model TEXT DEFAULT 'doorstep_service', -- 'turnkey', 'doorstep_service', 'supply_only'
      tagline TEXT,
      primary_phone TEXT NOT NULL,
      primary_email TEXT NOT NULL,
      allowed_categories TEXT NOT NULL, -- JSON array
      primary_color TEXT DEFAULT '#2563eb',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Master Products Catalog
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      brand TEXT NOT NULL, -- 'RUSSEA', 'GARWARE', 'GCM', 'NETSOCEAN'
      category TEXT NOT NULL, -- 'Cricket Nets', 'Pigeon Nets', 'Invisible Grills', 'Turnkey Sports', etc.
      product_name TEXT NOT NULL,
      material TEXT NOT NULL, -- 'HDPE Braided', 'High-Tenacity Nylon', 'SS 316 Marine Grade'
      thickness TEXT NOT NULL, -- '2.5mm', '2.0mm', '1.5mm'
      mesh_size TEXT NOT NULL, -- '40mm', '30mm', '50mm', '45mm'
      color TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'SFT', -- 'SFT', 'BAG', 'ROLL', 'UNIT'
      specification TEXT,
      warranty_years INTEGER DEFAULT 5,
      requires_site_visit INTEGER DEFAULT 0,
      supply_only INTEGER DEFAULT 0,
      turnkey_project INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. Approved Pricing Matrix (Single Source of Truth)
    CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      customer_type TEXT NOT NULL DEFAULT 'retail', -- 'retail', 'contractor', 'wholesale'
      min_quantity REAL NOT NULL DEFAULT 1,
      rate_per_unit REAL NOT NULL,
      max_ai_discount_pct REAL NOT NULL DEFAULT 5.0, -- Max % discount AI can grant autonomously
      effective_from DATE DEFAULT CURRENT_DATE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- 4. Inventory / Warehouse Stock
    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      available_units REAL NOT NULL DEFAULT 0,
      unit_type TEXT NOT NULL DEFAULT 'BAG', -- 'BAG', 'ROLL', 'SFT', 'UNIT'
      warehouse_location TEXT NOT NULL DEFAULT 'Hyderabad Central Warehouse',
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- 5. Field Technicians Fleet (Doorstep Van Installation)
    CREATE TABLE IF NOT EXISTS technicians (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      vehicle_no TEXT,
      zone TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 6. CRM Leads Pipeline (Enhanced with 3 Pillars, Field Fleet & Payments)
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,
      pillar TEXT DEFAULT 'doorstep_service', -- 'turnkey', 'doorstep_service', 'supply_only'
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      city TEXT DEFAULT 'Hyderabad',
      locality TEXT,
      requirement_summary TEXT,
      stage TEXT NOT NULL DEFAULT 'NEW', -- Legacy stage
      pipeline_stage TEXT NOT NULL DEFAULT 'NEW_INQUIRY', -- Pillar specific stage
      estimated_value REAL DEFAULT 0,
      notes TEXT,
      -- Doorstep Field Ops
      technician_id TEXT,
      technician_name TEXT,
      technician_phone TEXT,
      visit_date TEXT,
      visit_slot TEXT, -- 'Morning (9 AM - 1 PM)', 'Afternoon (1 PM - 5 PM)', 'Evening (5 PM - 8 PM)'
      area_zone TEXT,
      -- Payment & Collections Ledger
      payment_status TEXT DEFAULT 'UNPAID', -- 'UNPAID', 'PARTIAL_ADVANCE', 'PAID_FULL'
      advance_amount REAL DEFAULT 0,
      balance_amount REAL DEFAULT 0,
      payment_mode TEXT, -- 'UPI', 'CASH_TECHNICIAN', 'BANK_NEFT', 'CHEQUE'
      payment_ref TEXT, -- UTR or receipt number
      -- Logistics & Transport (Supply Only)
      dispatch_transporter TEXT, -- 'V-Trans', 'DTDC', 'Professional Couriers', 'Private Travels'
      lr_number TEXT, -- Lorry Receipt / Bilty / Tracking No
      dispatch_date TEXT,
      -- Owner Intervention
      human_takeover INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    -- 7. Lead Activity & Audit Trail
    CREATE TABLE IF NOT EXISTS lead_activities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      activity_type TEXT NOT NULL, -- 'STAGE_CHANGE', 'VAN_ASSIGNED', 'PAYMENT_LOGGED', 'WHATSAPP_SENT', 'NOTE_ADDED'
      description TEXT NOT NULL,
      performed_by TEXT DEFAULT 'SYSTEM',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    );

    -- 8. Omnichannel Conversations (Web Chat, WhatsApp, Voice)
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      lead_id TEXT,
      website_id TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'web_chat', -- 'web_chat', 'whatsapp', 'phone_call'
      session_id TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]', -- JSON array of {role, content, timestamp, tool_calls}
      summary TEXT,
      human_takeover INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    -- 9. Formal Quotations
    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      quote_number TEXT NOT NULL UNIQUE, -- 'GCM-QT-2026-XXXX'
      lead_id TEXT NOT NULL,
      website_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      dimensions_text TEXT,
      subtotal REAL NOT NULL,
      discount_pct REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      taxable_amount REAL NOT NULL,
      gst_pct REAL DEFAULT 18.0,
      gst_amount REAL NOT NULL,
      transport_charges REAL DEFAULT 0,
      installation_charges REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'REJECTED'
      pdf_filename TEXT,
      doc_id TEXT, -- e.g. 'EST-202609-045' from gcm.enterprises
      view_url TEXT,
      pdf_url TEXT,
      convert_invoice_url TEXT,
      company_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (website_id) REFERENCES websites(id)
    );

    -- 10. Quotation Line Items
    CREATE TABLE IF NOT EXISTS quote_items (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      product_id TEXT,
      item_name TEXT NOT NULL,
      specification TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      unit_rate REAL NOT NULL,
      amount REAL NOT NULL,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    -- 11. Owner Approvals Queue
    CREATE TABLE IF NOT EXISTS owner_approvals (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      quotation_id TEXT,
      requested_by TEXT DEFAULT 'AI_ORCHESTRATOR',
      reason TEXT NOT NULL,
      requested_discount_pct REAL,
      proposed_rate REAL,
      status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      owner_comments TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
    );
  `);

  // Safe column migrations for existing databases
  const schemaMigrations = [
    // Websites
    { table: 'websites', col: 'business_model', def: 'TEXT DEFAULT "doorstep_service"' },
    // Products
    { table: 'products', col: 'requires_site_visit', def: 'INTEGER DEFAULT 0' },
    { table: 'products', col: 'supply_only', def: 'INTEGER DEFAULT 0' },
    { table: 'products', col: 'turnkey_project', def: 'INTEGER DEFAULT 0' },
    // Conversations
    { table: 'conversations', col: 'human_takeover', def: 'INTEGER DEFAULT 0' },
    // Quotations
    { table: 'quotations', col: 'doc_id', def: 'TEXT' },
    { table: 'quotations', col: 'view_url', def: 'TEXT' },
    { table: 'quotations', col: 'pdf_url', def: 'TEXT' },
    { table: 'quotations', col: 'convert_invoice_url', def: 'TEXT' },
    { table: 'quotations', col: 'company_name', def: 'TEXT' },
    // Leads CRM enhancements
    { table: 'leads', col: 'pillar', def: 'TEXT DEFAULT "doorstep_service"' },
    { table: 'leads', col: 'pipeline_stage', def: 'TEXT DEFAULT "NEW_INQUIRY"' },
    { table: 'leads', col: 'technician_id', def: 'TEXT' },
    { table: 'leads', col: 'technician_name', def: 'TEXT' },
    { table: 'leads', col: 'technician_phone', def: 'TEXT' },
    { table: 'leads', col: 'visit_date', def: 'TEXT' },
    { table: 'leads', col: 'visit_slot', def: 'TEXT' },
    { table: 'leads', col: 'area_zone', def: 'TEXT' },
    { table: 'leads', col: 'payment_status', def: 'TEXT DEFAULT "UNPAID"' },
    { table: 'leads', col: 'advance_amount', def: 'REAL DEFAULT 0' },
    { table: 'leads', col: 'balance_amount', def: 'REAL DEFAULT 0' },
    { table: 'leads', col: 'payment_mode', def: 'TEXT' },
    { table: 'leads', col: 'payment_ref', def: 'TEXT' },
    { table: 'leads', col: 'dispatch_transporter', def: 'TEXT' },
    { table: 'leads', col: 'lr_number', def: 'TEXT' },
    { table: 'leads', col: 'dispatch_date', def: 'TEXT' },
    { table: 'leads', col: 'human_takeover', def: 'INTEGER DEFAULT 0' }
  ];

  for (const mig of schemaMigrations) {
    try {
      db.prepare(`ALTER TABLE ${mig.table} ADD COLUMN ${mig.col} ${mig.def}`).run();
    } catch {
      // Column already exists
    }
  }

  // Seed default technicians if table is empty
  const techCount = db.prepare('SELECT COUNT(*) as count FROM technicians').get() as { count: number };
  if (techCount.count === 0) {
    const insertTech = db.prepare(`
      INSERT INTO technicians (id, name, phone, vehicle_no, zone, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    insertTech.run('TECH-1', 'Raju Sharma (Senior Van Lead)', '+91 99123 99225', 'TS 07 UA 4589', 'West Zone (Gachibowli / Kondapur / Miyapur / Hitec City)');
    insertTech.run('TECH-2', 'Suresh Kumar (Installation Tech)', '+91 99123 99226', 'TS 08 UB 7812', 'North Zone (Kukatpally / Nizampet / Pragathi Nagar / JNTU)');
    insertTech.run('TECH-3', 'Shiva Reddy (Field Supervisor)', '+91 99123 99228', 'TS 09 UC 9931', 'Central Zone (Secunderabad / Begumpet / Somajiguda / Jubilee Hills)');
    insertTech.run('TECH-4', 'Ramesh Goud (Invisible Grill Specialist)', '+91 99123 99229', 'AP 28 TB 1024', 'East/South Zone (Uppal / Dilsukhnagar / LB Nagar / Banjara Hills)');
  }

  // Seed default dataset if websites table is empty
  const websiteCount = db.prepare('SELECT COUNT(*) as count FROM websites').get() as { count: number };
  if (websiteCount.count === 0) {
    seedInitialData();
  } else {
    // Ensure business_model values are set for existing websites
    try {
      db.prepare("UPDATE websites SET business_model = 'turnkey' WHERE id = 'gcm-enterprises'").run();
      db.prepare("UPDATE websites SET business_model = 'doorstep_service' WHERE id IN ('gcmsafetynets', 'gcminvisiblegrills', 'netsdial')").run();
      db.prepare("UPDATE websites SET business_model = 'supply_only' WHERE id IN ('netsocean', 'russea')").run();

      // Backfill pillar column in leads based on website_id
      db.prepare("UPDATE leads SET pillar = 'turnkey' WHERE website_id = 'gcm-enterprises' AND (pillar IS NULL OR pillar = 'doorstep_service')").run();
      db.prepare("UPDATE leads SET pillar = 'supply_only' WHERE website_id IN ('netsocean', 'russea') AND (pillar IS NULL OR pillar = 'doorstep_service')").run();
      db.prepare("UPDATE leads SET pillar = 'doorstep_service' WHERE website_id IN ('gcmsafetynets', 'gcminvisiblegrills', 'netsdial') AND pillar IS NULL").run();
    } catch {}
  }
}

function seedInitialData() {
  console.log('Seeding Chat GCM initial master database with 3 Business Pillars...');

  // 1. Websites by Business Model Pillar
  const insertWebsite = db.prepare(`
    INSERT INTO websites (id, domain, brand_name, business_model, tagline, primary_phone, primary_email, allowed_categories, primary_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Pillar 1: Turnkey Sports & Infrastructure
  insertWebsite.run(
    'gcm-enterprises',
    'gcm.enterprises',
    'GCM Enterprises',
    'turnkey',
    'India\'s Premier Turnkey Sports Infrastructure & Cricket Ground Estimations',
    '+91 99123 99227',
    'info@gcm.enterprises',
    JSON.stringify(['Turnkey Box Cricket', 'Sports Turf Ground', 'Steel Structure Framework', 'Stadium Lighting', 'Industrial Safety Nets']),
    '#4f46e5'
  );

  // Pillar 2: Doorstep Residential & Commercial Installation Services
  insertWebsite.run(
    'gcmsafetynets',
    'gcmsafetynets.in',
    'GCM Safety Nets',
    'doorstep_service',
    'Hyderabad\'s #1 Doorstep Safety Netting & Installation Services',
    '+91 99123 99224',
    'gcmsafetynets@gmail.com',
    JSON.stringify(['Balcony Safety Nets', 'Pigeon Nets', 'Bird Nets', 'Invisible Grills', 'Cloth Drying Hangers', 'Children Safety Nets', 'Duct Safety Nets']),
    '#2563eb'
  );

  insertWebsite.run(
    'gcminvisiblegrills',
    'gcminvisiblegrills.com',
    'GCM Invisible Grills',
    'doorstep_service',
    'High Tensile AISI 316 Marine Grade Balcony Invisible Grills with Doorstep Fitting',
    '+91 99123 99224',
    'sales@gcminvisiblegrills.com',
    JSON.stringify(['Invisible Grills', 'Balcony Invisible Grills', 'Window Invisible Grills']),
    '#0284c7'
  );

  insertWebsite.run(
    'netsdial',
    'netsdial.com',
    'NetsDial',
    'doorstep_service',
    'Fast Doorstep Safety Netting Service Directory',
    '+91 99123 99224',
    'support@netsdial.com',
    JSON.stringify(['Balcony Safety Nets', 'Pigeon Nets', 'Invisible Grills']),
    '#0891b2'
  );

  // Pillar 3: Material Sales & Supply-Only Wholesale
  insertWebsite.run(
    'netsocean',
    'netsocean.com',
    'NetsOcean Netting Solutions',
    'supply_only',
    'Direct Factory Netting Supply, Wholesale Bags & Custom Panels (Supply-Only)',
    '+91 99123 99224',
    'sales@netsocean.com',
    JSON.stringify(['Supply-Only Netting', 'Standard Bags 3300 SFT', 'Custom Cut Panels', 'HDPE Braided Nets', 'Twisted Roof Nets']),
    '#059669'
  );

  insertWebsite.run(
    'russea',
    'russea.in',
    'RUSSEA Netting Brands',
    'supply_only',
    'High-Tenacity Virgin UV Netting Manufacturing (Pan-India Supply)',
    '+91 99123 99224',
    'contact@russea.in',
    JSON.stringify(['RUSSEA Braided Nets', 'HDPE Cricket Nets', 'Wholesale Netting Bags']),
    '#d97706'
  );

  // 2. Master Products Catalog
  const insertProduct = db.prepare(`
    INSERT INTO products (id, brand, category, product_name, material, thickness, mesh_size, color, unit, specification, warranty_years, requires_site_visit, supply_only, turnkey_project)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const products = [
    // Pillar 1 Products (Turnkey)
    {
      id: 'PROD-TURNKEY-COMMERCIAL',
      brand: 'GCM',
      category: 'Turnkey Box Cricket',
      product_name: 'Turnkey Box Cricket Ground Setup (Commercial Standard)',
      material: '40x40 GI Ladder Columns, 25mm Non-Infill Turf, 2.5mm RUSSEA HDPE Netting, 200W Floodlights',
      thickness: '40x40 GI',
      mesh_size: '45mm / 35mm',
      color: 'Dark Green / Galvanized',
      unit: 'SFT',
      specification: 'Complete end-to-end turnkey build as per gcm.enterprises calculator. Structural steel, netting enclosure with camber, civil bed, turf, and electrical lighting.',
      warranty_years: 2,
      requires_site_visit: 1,
      supply_only: 0,
      turnkey_project: 1
    },
    {
      id: 'PROD-TURF-NONINFILL-25',
      brand: 'GCM',
      category: 'Artificial Turf',
      product_name: 'Non-Infill Multi-Sport Artificial Grass Turf 25mm',
      material: 'High-Density Polyethylene with Reinforced Double Backing',
      thickness: '25mm Pile Height',
      mesh_size: 'N/A',
      color: 'Bicolor Olive / Field Green',
      unit: 'SFT',
      specification: 'Manufactured 2m x 25m rolls (540 SFT/roll). Zero rubber infill required, optimal ball bounce.',
      warranty_years: 7,
      requires_site_visit: 1,
      supply_only: 0,
      turnkey_project: 1
    },

    // Pillar 2 Products (Doorstep Services with Installation)
    {
      id: 'PROD-GARWARE-NYLON-30',
      brand: 'GARWARE',
      category: 'Balcony Safety Nets',
      product_name: 'Garware™ High-Tenacity Balcony Safety Net with Installation',
      material: '100% Virgin Nylon 6 High Tenacity',
      thickness: '1.2mm / 15-ply',
      mesh_size: '30mm',
      color: 'White / Translucent',
      unit: 'SFT',
      specification: 'Child safety and pigeon protection. Dynamic impact resistance up to 150 kg with SS 316 anchor hooks. 100 SFT min site visit rate.',
      warranty_years: 5,
      requires_site_visit: 1,
      supply_only: 0,
      turnkey_project: 0
    },
    {
      id: 'PROD-GARWARE-PIGEON-25',
      brand: 'GARWARE',
      category: 'Pigeon Nets',
      product_name: 'Garware™ Invisible Monofilament Bird Netting with Installation',
      material: 'UV Stabilized Monofilament Polyethylene',
      thickness: '0.8mm',
      mesh_size: '25mm',
      color: 'Transparent',
      unit: 'SFT',
      specification: '100% humane, near-invisible from 10 feet. Keeps balconies, AC ducts, and facades pigeon-free. Includes SS 316 fasteners.',
      warranty_years: 3,
      requires_site_visit: 1,
      supply_only: 0,
      turnkey_project: 0
    },
    {
      id: 'PROD-INV-GRILL-SS316',
      brand: 'GCM',
      category: 'Invisible Grills',
      product_name: 'AISI 316 Marine Grade Balcony Invisible Grill with Installation',
      material: 'AISI 316 Stainless Steel Wire with DuPont Nylon Sheath',
      thickness: '2.5mm Wire',
      mesh_size: '2-inch / 3-inch Gap',
      color: 'Silver Metallic',
      unit: 'SFT',
      specification: '400+ kg tensile breaking load per strand. Rust-proof, clear panoramic view with extreme fall protection.',
      warranty_years: 10,
      requires_site_visit: 1,
      supply_only: 0,
      turnkey_project: 0
    },
    {
      id: 'PROD-CLOTH-HANGER-6P',
      brand: 'GCM',
      category: 'Cloth Drying Hangers',
      product_name: 'Ceiling Mounted 6-Pipe Stainless Steel Cloth Drying Hanger with Installation',
      material: 'Heavy-Duty SS 202/304 Tubes with Nylon Pulley Ropes',
      thickness: '6 Pipes x 6ft',
      mesh_size: 'N/A',
      color: 'Polished Silver',
      unit: 'UNIT',
      specification: 'Individual pulley operation. Holds up to 30 kg wet laundry with zero floor space usage. Includes technician installation.',
      warranty_years: 2,
      requires_site_visit: 1,
      supply_only: 0,
      turnkey_project: 0
    },

    // Pillar 3 Products (Material Sales & Supply Only)
    {
      id: 'PROD-NETSOCEAN-HDPE-45',
      brand: 'NETSOCEAN',
      category: 'Supply-Only Netting',
      product_name: 'NetsOcean™ Standard 45mm HDPE Braided Netting Bag (3300 SFT)',
      material: 'Virgin UV Stabilized HDPE Braided',
      thickness: '2.5mm',
      mesh_size: '45mm',
      color: 'Dark Green',
      unit: 'SFT',
      specification: '100ft x 33ft (3,300 SFT/bag) standard ready bag. Factory-direct supply only via courier or V-Trans transport across India.',
      warranty_years: 5,
      requires_site_visit: 0,
      supply_only: 1,
      turnkey_project: 0
    },
    {
      id: 'PROD-NETSOCEAN-HDPE-40',
      brand: 'NETSOCEAN',
      category: 'Supply-Only Netting',
      product_name: 'NetsOcean™ Standard 40mm HDPE Braided Netting Bag (3300 SFT)',
      material: 'Virgin UV Stabilized HDPE Braided',
      thickness: '2.5mm',
      mesh_size: '40mm',
      color: 'Dark Green',
      unit: 'SFT',
      specification: '100ft x 33ft standard bag with smaller 40mm dense mesh. Supply-only factory direct.',
      warranty_years: 5,
      requires_site_visit: 0,
      supply_only: 1,
      turnkey_project: 0
    },
    {
      id: 'PROD-NETSOCEAN-TWISTED-35',
      brand: 'NETSOCEAN',
      category: 'Supply-Only Netting',
      product_name: 'NetsOcean™ Twisted Roof Netting 35mm (Natural Green)',
      material: '1.5mm / 24-Ply UV Stabilized Twisted Polyethylene',
      thickness: '1.5mm',
      mesh_size: '35mm',
      color: 'Natural Green',
      unit: 'SFT',
      specification: 'Overhead roof netting for box cricket setups. Lightweight, weather-resistant, minimum camber sag.',
      warranty_years: 3,
      requires_site_visit: 0,
      supply_only: 1,
      turnkey_project: 0
    }
  ];

  for (const p of products) {
    insertProduct.run(
      p.id,
      p.brand,
      p.category,
      p.product_name,
      p.material,
      p.thickness,
      p.mesh_size,
      p.color,
      p.unit,
      p.specification,
      p.warranty_years,
      p.requires_site_visit,
      p.supply_only,
      p.turnkey_project
    );
  }

  // 3. Approved Pricing Rules Matrix
  const insertPrice = db.prepare(`
    INSERT INTO pricing_rules (id, product_id, customer_type, min_quantity, rate_per_unit, max_ai_discount_pct)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const prices = [
    // Pillar 1: Turnkey Commercial Ground
    { id: 'PR-TURNKEY-COMM', prod: 'PROD-TURNKEY-COMMERCIAL', type: 'retail', minQty: 1, rate: 215.0, maxDisc: 5.0 },
    { id: 'PR-TURF-RET', prod: 'PROD-TURF-NONINFILL-25', type: 'retail', minQty: 1, rate: 85.0, maxDisc: 5.0 },

    // Pillar 2: Installation Services (gcmsafetynets.in)
    { id: 'PR-GAR-BAL-RET', prod: 'PROD-GARWARE-NYLON-30', type: 'retail', minQty: 1, rate: 22.0, maxDisc: 5.0 },
    { id: 'PR-GAR-PIG-RET', prod: 'PROD-GARWARE-PIGEON-25', type: 'retail', minQty: 1, rate: 19.0, maxDisc: 5.0 },
    { id: 'PR-INVG-RET', prod: 'PROD-INV-GRILL-SS316', type: 'retail', minQty: 1, rate: 150.0, maxDisc: 5.0 },
    { id: 'PR-CLOTH-RET', prod: 'PROD-CLOTH-HANGER-6P', type: 'retail', minQty: 1, rate: 2750.0, maxDisc: 5.0 },

    // Pillar 3: Supply-Only (netsocean.com exact slabs)
    { id: 'PR-NETS-45-BAG', prod: 'PROD-NETSOCEAN-HDPE-45', type: 'retail', minQty: 1, rate: 8.0, maxDisc: 5.0 },
    { id: 'PR-NETS-45-VOL', prod: 'PROD-NETSOCEAN-HDPE-45', type: 'wholesale', minQty: 6601, rate: 7.5, maxDisc: 3.0 },
    { id: 'PR-NETS-40-BAG', prod: 'PROD-NETSOCEAN-HDPE-40', type: 'retail', minQty: 1, rate: 8.5, maxDisc: 5.0 },
    { id: 'PR-NETS-40-VOL', prod: 'PROD-NETSOCEAN-HDPE-40', type: 'wholesale', minQty: 6601, rate: 8.0, maxDisc: 3.0 },
    { id: 'PR-NETS-TW35', prod: 'PROD-NETSOCEAN-TWISTED-35', type: 'retail', minQty: 1, rate: 6.0, maxDisc: 5.0 }
  ];

  for (const pr of prices) {
    insertPrice.run(pr.id, pr.prod, pr.type, pr.minQty, pr.rate, pr.maxDisc);
  }

  // 4. Warehouse Inventory
  const insertInventory = db.prepare(`
    INSERT INTO inventory (id, product_id, available_units, unit_type, warehouse_location)
    VALUES (?, ?, ?, ?, ?)
  `);

  insertInventory.run('INV-NETS45', 'PROD-NETSOCEAN-HDPE-45', 120, 'BAG', 'NetsOcean Central Hub, Hyderabad');
  insertInventory.run('INV-NETS40', 'PROD-NETSOCEAN-HDPE-40', 85, 'BAG', 'NetsOcean Central Hub, Hyderabad');
  insertInventory.run('INV-TW35', 'PROD-NETSOCEAN-TWISTED-35', 60, 'BAG', 'NetsOcean Central Hub, Hyderabad');
  insertInventory.run('INV-TURF', 'PROD-TURF-NONINFILL-25', 24, 'ROLL', 'GCM Enterprises Turf Depot');
  insertInventory.run('INV-GAR-BAL', 'PROD-GARWARE-NYLON-30', 95000, 'SFT', 'GCM Safety Nets Hyderabad Van Depots');
  insertInventory.run('INV-GAR-PIG', 'PROD-GARWARE-PIGEON-25', 70000, 'SFT', 'GCM Safety Nets Hyderabad Van Depots');
  insertInventory.run('INV-INVG', 'PROD-INV-GRILL-SS316', 45000, 'SFT', 'GCM Fabrication Unit, Kukatpally');
  insertInventory.run('INV-CLOTH', 'PROD-CLOTH-HANGER-6P', 180, 'UNIT', 'Miyapur Assembly Facility');

  console.log('Chat GCM Master Database successfully initialized and seeded with all 3 pillars!');
}
