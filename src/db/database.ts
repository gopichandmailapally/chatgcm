import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_DIR = process.env.DB_DIR || (fs.existsSync('/var/www/chatgcm.in/data') ? '/var/www/chatgcm.in/data' : path.join(process.cwd(), 'data'));
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
      brand TEXT NOT NULL, -- 'RUSSEA', 'GCM', 'NETSOCEAN'
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
      state TEXT NOT NULL DEFAULT '{}',
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
      decided_by_device_id TEXT,
      decided_by_user TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      decided_at DATETIME,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL
    );

    -- 12. AI Universal Knowledge Cache
    CREATE TABLE IF NOT EXISTS ai_knowledge_cache (
      id TEXT PRIMARY KEY,
      website_id TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      rates_json TEXT,
      specifications_json TEXT,
      source_file TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 13. Agent Work Tracing & Performance Audit Log
    CREATE TABLE IF NOT EXISTS agent_work_logs (
      id TEXT PRIMARY KEY,
      persona_name TEXT NOT NULL,
      lead_id TEXT,
      phone TEXT,
      website_id TEXT,
      channel TEXT,
      city TEXT,
      action_type TEXT NOT NULL,
      action_title TEXT NOT NULL,
      work_summary TEXT NOT NULL,
      details_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_agent_work_logs_persona ON agent_work_logs(persona_name);
    CREATE INDEX IF NOT EXISTS idx_agent_work_logs_created ON agent_work_logs(created_at DESC);

    -- 14. Webhook Ingestion Idempotency & Deduplication Engine
    CREATE TABLE IF NOT EXISTS webhook_idempotency (
      wamid TEXT PRIMARY KEY,
      sender_phone TEXT,
      msg_hash TEXT,
      status TEXT DEFAULT 'PROCESSED', -- 'RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED'
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_webhook_idempotency_time ON webhook_idempotency(received_at DESC);

    -- 15. Real-Time Message Delivery Status Receipts
    CREATE TABLE IF NOT EXISTS message_receipts (
      id TEXT PRIMARY KEY,
      wamid TEXT NOT NULL,
      recipient_phone TEXT NOT NULL,
      status TEXT NOT NULL, -- 'sent', 'delivered', 'read', 'failed'
      error_code TEXT,
      error_message TEXT,
      timestamp TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_receipts_wamid ON message_receipts(wamid);
    CREATE INDEX IF NOT EXISTS idx_receipts_phone ON message_receipts(recipient_phone);

    -- 16. Meta Cloud API Business Connections (Multi-Tenant WABAs)
    CREATE TABLE IF NOT EXISTS whatsapp_connections (
      id TEXT PRIMARY KEY,
      phone_number TEXT NOT NULL,
      display_name TEXT NOT NULL,
      phone_number_id TEXT NOT NULL,
      waba_id TEXT NOT NULL,
      access_token TEXT,
      webhook_verify_token TEXT DEFAULT 'gcm_whatsapp_verify_2026',
      quality_rating TEXT DEFAULT 'GREEN',
      status TEXT DEFAULT 'CONNECTED', -- 'CONNECTED', 'PENDING', 'DISCONNECTED'
      is_default INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 17. Multi-Agent Shared Inbox Team
    CREATE TABLE IF NOT EXISTS team_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'SALES_AGENT', -- 'ADMIN', 'SALES_AGENT', 'SUPPORT', 'FIELD_MANAGER'
      phone TEXT,
      avatar TEXT,
      status TEXT DEFAULT 'ONLINE', -- 'ONLINE', 'AWAY', 'OFFLINE'
      active_chats_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 18. Business Knowledge Base & RAG Documents
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      file_type TEXT NOT NULL, -- 'pdf', 'csv', 'txt', 'catalog', 'price_list'
      file_size INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      summary TEXT,
      chunks_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'INDEXED', -- 'INDEXED', 'PROCESSING', 'FAILED'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 19. RAG Knowledge Chunks for Vector/Text Similarity
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT,
      title TEXT,
      content TEXT NOT NULL,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES knowledge_documents(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_doc ON knowledge_chunks(document_id);

    -- 20. Custom AI System Prompts & Instructions
    CREATE TABLE IF NOT EXISTS ai_system_configs (
      id TEXT PRIMARY KEY,
      business_name TEXT DEFAULT 'GCM Enterprises',
      system_instruction TEXT NOT NULL,
      persona_tone TEXT DEFAULT 'Professional, courteous, and authoritative',
      fallback_reply TEXT,
      enable_auto_quotes INTEGER DEFAULT 1,
      enable_human_escalation INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 21. Tenant-Specific Pricing Overrides
    CREATE TABLE IF NOT EXISTS pricing_overrides (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      override_rate REAL NOT NULL,
      gst_pct REAL DEFAULT NULL,
      effective_from DATE DEFAULT CURRENT_DATE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pricing_overrides_tenant ON pricing_overrides(tenant_id);

    -- 22. Historical Pricing Audit Log
    CREATE TABLE IF NOT EXISTS price_history (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'ALL',
      field_changed TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT NOT NULL,
      effective_from DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_price_history_prod ON price_history(product_id);
    CREATE INDEX IF NOT EXISTS idx_price_history_created ON price_history(created_at DESC);

    -- 23. Administrative & RBAC Users Table
    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'SALES_AGENT', -- 'SUPER_ADMIN', 'TENANT_ADMIN', 'SALES_MANAGER', 'SALES_AGENT', 'AUDITOR'
      tenant_id TEXT, -- NULL for SUPER_ADMIN, otherwise restricted to specific website/tenant
      display_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

    -- 24. Administrative API Tokens Table
    CREATE TABLE IF NOT EXISTS admin_api_tokens (
      id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      user_id TEXT,
      role TEXT NOT NULL DEFAULT 'SUPER_ADMIN',
      tenant_id TEXT,
      name TEXT NOT NULL,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_admin_api_tokens_hash ON admin_api_tokens(token_hash);

    -- 25. Enrolled Authorized Owner Devices (Phase 9 — 4 Dedicated Devices)
    CREATE TABLE IF NOT EXISTS authorized_devices (
      device_id TEXT PRIMARY KEY,
      device_name TEXT NOT NULL,
      device_type TEXT NOT NULL, -- 'laptop', 'mobile', 'desktop'
      owner_name TEXT NOT NULL,
      fingerprint_hash TEXT,
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_active_at DATETIME,
      is_active INTEGER DEFAULT 1
    );

    -- 26. Device Push Notification Subscriptions (Phase 10 — PWA Web Push)
    CREATE TABLE IF NOT EXISTS device_push_subscriptions (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      keys_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES authorized_devices(device_id) ON DELETE CASCADE
    );
  `);

  // Safe column migrations for existing databases
  const schemaMigrations = [
    // Websites
    { table: 'websites', col: 'business_model', def: 'TEXT DEFAULT "doorstep_service"' },
    // Products E-Commerce Catalog
    { table: 'products', col: 'sku', def: 'TEXT' },
    { table: 'products', col: 'price', def: 'REAL DEFAULT 0' },
    { table: 'products', col: 'gst_pct', def: 'REAL DEFAULT 18' },
    { table: 'products', col: 'stock_status', def: 'TEXT DEFAULT "IN_STOCK"' },
    { table: 'products', col: 'image_url', def: 'TEXT' },
    { table: 'products', col: 'payment_link', def: 'TEXT' },
    { table: 'products', col: 'requires_site_visit', def: 'INTEGER DEFAULT 0' },
    { table: 'products', col: 'supply_only', def: 'INTEGER DEFAULT 0' },
    { table: 'products', col: 'turnkey_project', def: 'INTEGER DEFAULT 0' },
    // Conversations Shared Inbox
    { table: 'conversations', col: 'state', def: 'TEXT DEFAULT "{}"' },
    { table: 'conversations', col: 'internal_notes', def: 'TEXT DEFAULT "[]"' },
    { table: 'conversations', col: 'human_takeover', def: 'INTEGER DEFAULT 0' },

    { table: 'conversations', col: 'priority', def: 'TEXT DEFAULT "P2"' },
    { table: 'conversations', col: 'assigned_agent', def: 'TEXT DEFAULT "AI Sales Brain"' },
    { table: 'conversations', col: 'tags', def: 'TEXT DEFAULT "[]"' },
    { table: 'conversations', col: 'last_receipt_status', def: 'TEXT DEFAULT "sent"' },
    { table: 'conversations', col: 'snooze_until', def: 'DATETIME' },
    { table: 'conversations', col: 'scheduled_callback_at', def: 'DATETIME' },
    { table: 'conversations', col: 'opt_out', def: 'INTEGER DEFAULT 0' },
    // Quotations
    { table: 'quotations', col: 'updated_at', def: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    { table: 'quotations', col: 'doc_id', def: 'TEXT' },
    { table: 'quotations', col: 'view_url', def: 'TEXT' },
    { table: 'quotations', col: 'pdf_url', def: 'TEXT' },
    { table: 'quotations', col: 'convert_invoice_url', def: 'TEXT' },
    { table: 'quotations', col: 'company_name', def: 'TEXT' },
    // Leads CRM enhancements
    { table: 'leads', col: 'pillar', def: 'TEXT DEFAULT "doorstep_service"' },
    { table: 'leads', col: 'pipeline_stage', def: 'TEXT DEFAULT "NEW_INQUIRY"' },
    { table: 'leads', col: 'priority', def: 'TEXT DEFAULT "P2"' },
    { table: 'leads', col: 'assigned_agent', def: 'TEXT DEFAULT "AI Sales Brain"' },
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
    { table: 'leads', col: 'human_takeover', def: 'INTEGER DEFAULT 0' },
    // Customer Respect & Intelligent Scheduling
    { table: 'leads', col: 'snooze_until', def: 'DATETIME' },
    { table: 'leads', col: 'scheduled_callback_at', def: 'DATETIME' },
    { table: 'leads', col: 'preferred_contact_time', def: 'TEXT' },
    { table: 'leads', col: 'opt_out', def: 'INTEGER DEFAULT 0' },
    { table: 'leads', col: 'last_customer_message_at', def: 'DATETIME' },
    // Owner Approvals & Payment Verification (Phases 9, 12, 15)
    { table: 'owner_approvals', col: 'decided_by_device_id', def: 'TEXT' },
    { table: 'owner_approvals', col: 'decided_by_user', def: 'TEXT' },
    { table: 'leads', col: 'auto_follow_up_paused', def: 'INTEGER DEFAULT 0' },
    { table: 'leads', col: 'payment_verification_status', def: 'TEXT DEFAULT "NONE"' }
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

  // Ensure all 11+ websites are registered in multi-tenant registry
  ensureAll11WebsitesRegistered();

  // Ensure 4 authorized owner devices are enrolled (Phase 9)
  ensureAuthorizedOwnerDevices();

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

// Ensure schema and migrations are initialized on first load
try {
  initDatabase();
} catch (e: any) {
  // Ignored if already initialized
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
    '+91 99123 99224',
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
      id: 'PROD-RUSSEA-NYLON-30',
      brand: 'RUSSEA',
      category: 'Balcony Safety Nets',
      product_name: 'RUSSEA™ High-Tenacity Balcony Safety Net with Installation',
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
      id: 'PROD-RUSSEA-PIGEON-25',
      brand: 'RUSSEA',
      category: 'Pigeon Nets',
      product_name: 'RUSSEA™ Invisible Monofilament Bird Netting with Installation',
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
      product_name: 'GCM™ High-Tensile AISI 316 Marine Stainless Steel Invisible Grill',
      material: 'AISI 316 Stainless Steel with Transparent DuPont Nylon Sheath',
      thickness: '2.5mm / 3.0mm',
      mesh_size: '2-inch / 3-inch gap',
      color: 'Clear / Metallic',
      unit: 'SFT',
      specification: 'Unobstructed view, 450+ kg tensile load, child fall safety, rust-proof with 10-year warranty.',
      warranty_years: 10,
      requires_site_visit: 1,
      supply_only: 0,
      turnkey_project: 0
    },
    {
      id: 'PROD-CLOTH-HANGER-6P',
      brand: 'GCM',
      category: 'Cloth Drying Hangers',
      product_name: 'GCM™ Ceiling Mounted Pulley Cloth Drying Hanger (6 Pipes)',
      material: 'Pure SS 304 Stainless Steel Pipes with Nylon Pulley Grid',
      thickness: '0.5mm pipe wall, 6ft length',
      mesh_size: '6-pipe system',
      color: 'Silver Chrome',
      unit: 'UNIT',
      specification: 'Space-saving balcony ceiling drying hanger with independent nylon pull cords.',
      warranty_years: 2,
      requires_site_visit: 1,
      supply_only: 0,
      turnkey_project: 0
    },

    // Pillar 3 Products (Supply-Only / Wholesale Bundles - netsocean.com exact catalog)
    {
      id: 'PROD-NETSOCEAN-HDPE-45',
      brand: 'NETSOCEAN',
      category: 'Wholesale Netting Bundles',
      product_name: 'NetsOcean™ 2.5mm HDPE Braided 45mm Mesh Net (100x33 ft Bag)',
      material: 'High-Density Polyethylene (HDPE) Braided UV-Treated',
      thickness: '2.5mm / 45-ply',
      mesh_size: '45mm (1.75 inch)',
      color: 'Dark Green',
      unit: 'BAG',
      specification: 'Pre-cut standard wholesale bag: 100 ft length x 33 ft height (3,300 SFT). Zero middleman distributor rates.',
      warranty_years: 5,
      requires_site_visit: 0,
      supply_only: 1,
      turnkey_project: 0
    },
    {
      id: 'PROD-NETSOCEAN-HDPE-40',
      brand: 'NETSOCEAN',
      category: 'Wholesale Netting Bundles',
      product_name: 'NetsOcean™ 2.5mm HDPE Braided 40mm Mesh Net (100x33 ft Bag)',
      material: 'High-Density Polyethylene (HDPE) Braided UV-Treated',
      thickness: '2.5mm / 45-ply',
      mesh_size: '40mm (1.5 inch)',
      color: 'Dark Green',
      unit: 'BAG',
      specification: 'Pre-cut standard wholesale bag: 100 ft length x 33 ft height (3,300 SFT). Heavy cricket boundary and practice cages.',
      warranty_years: 5,
      requires_site_visit: 0,
      supply_only: 1,
      turnkey_project: 0
    },
    {
      id: 'PROD-NETSOCEAN-TWISTED-35',
      brand: 'NETSOCEAN',
      category: 'Wholesale Netting Bundles',
      product_name: 'NetsOcean™ 1.5mm Twisted HDPE 35mm Mesh Overhead Net (100x33 ft Bag)',
      material: 'Twisted HDPE with Dual UV Inhibitor',
      thickness: '1.5mm / 24-ply',
      mesh_size: '35mm',
      color: 'Black / Dark Green',
      unit: 'BAG',
      specification: 'Lightweight high-durability overhead cage net for top roof netting. 3,300 SFT per bundle.',
      warranty_years: 5,
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

  // 3. Pricing Rules
  const insertPrice = db.prepare(`
    INSERT INTO pricing_rules (id, product_id, customer_type, min_quantity, rate_per_unit, max_discount_pct)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const prices = [
    // Pillar 1: Turnkey Commercial Ground
    { id: 'PR-TURNKEY-COMM', prod: 'PROD-TURNKEY-COMMERCIAL', type: 'retail', minQty: 1, rate: 215.0, maxDisc: 5.0 },
    { id: 'PR-TURF-RET', prod: 'PROD-TURF-NONINFILL-25', type: 'retail', minQty: 1, rate: 85.0, maxDisc: 5.0 },

    // Pillar 2: Installation Services (gcmsafetynets.in)
    { id: 'PR-RUS-BAL-RET', prod: 'PROD-RUSSEA-NYLON-30', type: 'retail', minQty: 1, rate: 22.0, maxDisc: 5.0 },
    { id: 'PR-RUS-PIG-RET', prod: 'PROD-RUSSEA-PIGEON-25', type: 'retail', minQty: 1, rate: 19.0, maxDisc: 5.0 },
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
  insertInventory.run('INV-RUS-BAL', 'PROD-RUSSEA-NYLON-30', 95000, 'SFT', 'GCM Safety Nets Hyderabad Van Depots');
  insertInventory.run('INV-RUS-PIG', 'PROD-RUSSEA-PIGEON-25', 70000, 'SFT', 'GCM Safety Nets Hyderabad Van Depots');
  insertInventory.run('INV-INVG', 'PROD-INV-GRILL-SS316', 45000, 'SFT', 'GCM Fabrication Unit, Kukatpally');
  insertInventory.run('INV-CLOTH', 'PROD-CLOTH-HANGER-6P', 180, 'UNIT', 'Miyapur Assembly Facility');

  // Seed B2B SaaS foundational records (Meta Connections, Team Agents, Knowledge Docs, RAG Chunks, AI Config)
  seedB2BSaaSDefaults();

  console.log('Chat GCM Master Database successfully initialized and seeded with all B2B SaaS modules!');
}

export function seedB2BSaaSDefaults() {
  try {
    // 1. WhatsApp Connections
    const connCount = (db.prepare('SELECT COUNT(*) as count FROM whatsapp_connections').get() as any)?.count || 0;
    if (connCount === 0) {
      db.prepare(`
        INSERT INTO whatsapp_connections (id, phone_number, display_name, phone_number_id, waba_id, access_token, webhook_verify_token, quality_rating, status, is_default)
        VALUES ('CONN-GCM-MAIN', '+91 99123 99334', 'GCM Enterprises Corporate', '1007978297920797', '1105310275391818', 'Configured in .env', 'gcm_whatsapp_verify_2026', 'GREEN', 'CONNECTED', 1)
      `).run();
    }

    // 2. Team Agents
    const agentCount = (db.prepare('SELECT COUNT(*) as count FROM team_agents').get() as any)?.count || 0;
    if (agentCount === 0) {
      const insertAgent = db.prepare(`
        INSERT INTO team_agents (id, name, email, role, phone, avatar, status, active_chats_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertAgent.run('AGT-GOPICHAND', 'Gopichand Mailapally', 'gopichand@gcm.enterprises', 'ADMIN', '9912399224', '👑', 'ONLINE', 12);
      insertAgent.run('AGT-VENKATESH', 'Venkatesh (Sales Lead)', 'venkatesh@gcmsafetynets.in', 'SALES_AGENT', '9912399334', '👨‍💼', 'ONLINE', 18);
      insertAgent.run('AGT-RAMESH', 'Ramesh (Technical Lead)', 'ramesh@netsocean.com', 'SALES_AGENT', '9848012345', '👷', 'ONLINE', 9);
      insertAgent.run('AGT-SUNITA', 'Sunita (Support & Triage)', 'support@gcm.enterprises', 'SUPPORT', '9966499144', '👩‍💼', 'ONLINE', 5);
    }

    // 3. Knowledge Documents & Chunks
    const docCount = (db.prepare('SELECT COUNT(*) as count FROM knowledge_documents').get() as any)?.count || 0;
    if (docCount === 0) {
      const insertDoc = db.prepare(`
        INSERT INTO knowledge_documents (id, filename, original_name, file_type, file_size, file_path, summary, chunks_count, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertChunk = db.prepare(`
        INSERT INTO knowledge_chunks (id, document_id, title, content, category)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertDoc.run('DOC-SPEC-01', 'RUSSEA_Technical_Nets_Specs_2026.pdf', 'RUSSEA™ Technical Netting Specification Guide.pdf', 'pdf', 245760, '/data/docs/russea_specs.pdf', '100% Virgin UV Stabilized Braided Netting Specs with 5-8 year warranty standards', 2, 'INDEXED');
      insertChunk.run('CHK-01', 'DOC-SPEC-01', 'RUSSEA™ Polymer & Breaking Strength', 'RUSSEA™ braided sports nets are produced from 100% Virgin Grade High-Density Polyethylene (HDPE) with built-in UV masterbatch inhibitors. Breaking strength exceeds 110 kgf for 2.5mm cricket netting and 90 kgf for 2.0mm pigeon safety netting.', 'SPECIFICATION');
      insertChunk.run('CHK-02', 'DOC-SPEC-01', 'Warranty Terms & Replacement Policy', 'All genuine RUSSEA™ installations come with a registered 5-year to 8-year replacement warranty card covering UV embrittlement, tensile tearing, and manufacturing defects. Replaced on-site within 48 hours.', 'WARRANTY');

      insertDoc.run('DOC-RATE-02', 'GCM_Master_Rate_Card_2026.csv', 'GCM Pan-India Master Rate Card 2026.csv', 'csv', 48120, '/data/docs/rate_card.csv', 'Official rate cards for residential installation, wholesale bags, and turnkey sports arenas', 2, 'INDEXED');
      insertChunk.run('CHK-03', 'DOC-RATE-02', 'Balcony Safety Net Rates (Hyderabad/Regional)', 'Residential Balcony Netting: ₹ 18 to ₹ 24 / SFT fully installed with SS 316 anchors. Minimum site visit trip order value: 100 SFT. Free doorstep measurement demo with technician vehicle.', 'PRICING');
      insertChunk.run('CHK-04', 'DOC-RATE-02', 'Wholesale Netting Slabs (NetsOcean)', 'NetsOcean Wholesale Supply: Standard 100ft x 33ft bags (3300 SFT). HDPE 45mm mesh starts at ₹ 8.0/SFT (₹ 26,400/bag). Volume discount applied for orders > 6,600 SFT.', 'PRICING');

      insertDoc.run('DOC-BOQ-03', 'Turnkey_Box_Cricket_Arena_Standard_BOQ.pdf', 'Turnkey Box Cricket Arena Master BOQ.pdf', 'pdf', 524288, '/data/docs/box_cricket_boq.pdf', 'Engineered civil footings, MS truss columns, non-infill turf, and LED floodlight specifications', 1, 'INDEXED');
      insertChunk.run('CHK-05', 'DOC-BOQ-03', 'Turnkey Box Cricket Specifications', 'Complete turnkey execution: 100ft x 50ft x 25ft height. Includes 16 RCC concrete footings (4ft deep), 3" NB class-B MS columns, perimeter horizontal tie pipes, top anti-sag camber netting, and 25mm FIFA-grade turf.', 'TURNKEY');
    }

    // 4. AI System Configuration
    const cfgCount = (db.prepare('SELECT COUNT(*) as count FROM ai_system_configs').get() as any)?.count || 0;
    if (cfgCount === 0) {
      db.prepare(`
        INSERT INTO ai_system_configs (id, business_name, system_instruction, persona_tone, fallback_reply, enable_auto_quotes, enable_human_escalation)
        VALUES ('CFG-MASTER', 'GCM Enterprises', 'You are the executive sales and technical consultation AI for GCM Enterprises and its 9 specialized netting brands (RUSSEA™, NetsOcean, GCM Safety Nets, GCM Turnkey). Answer customer questions instantly, calculate exact BOQs and prices, provide official warranty terms, and provide direct corporate bank settlement credentials (SBI & ICICI) with 0% gateway commission. If customer asks for owner or human assistance, notify Gopichand and offer prompt callback.', 'Authoritative, courteous, technical, and swift', 'Namaste! Our senior sales engineer is checking your exact specifications and will reply with an estimate in a moment.', 1, 1)
      `).run();
    }

    // 5. Update products with SKUs, prices and stock status where empty
    try {
      db.prepare(`
        UPDATE products 
        SET sku = 'SKU-' || REPLACE(id, 'PROD-', ''),
            price = CASE 
              WHEN id = 'PROD-TURNKEY-COMMERCIAL' THEN 215.0
              WHEN id = 'PROD-TURF-NONINFILL-25' THEN 85.0
              WHEN id = 'PROD-RUSSEA-NYLON-30' THEN 22.0
              WHEN id = 'PROD-RUSSEA-PIGEON-25' THEN 19.0
              WHEN id = 'PROD-INV-GRILL-SS316' THEN 150.0
              WHEN id = 'PROD-CLOTH-HANGER-6P' THEN 2750.0
              WHEN id = 'PROD-NETSOCEAN-HDPE-45' THEN 8.0
              WHEN id = 'PROD-NETSOCEAN-HDPE-40' THEN 8.5
              WHEN id = 'PROD-NETSOCEAN-TWISTED-35' THEN 6.0
              ELSE 25.0
            END,
            gst_pct = 18.0,
            stock_status = 'IN_STOCK'
        WHERE sku IS NULL OR price IS NULL OR price = 0
      `).run();
    } catch {}

  } catch (err) {
    console.error('❌ [B2B Seed Error]', err);
  }
}


// ── Idempotency & Webhook Deduplication Helpers ──────────────────────────────
export function recordIdempotency(wamid: string, senderPhone?: string, msgHash?: string): boolean {
  if (!wamid) return true;
  try {
    const existing = db.prepare('SELECT wamid, status FROM webhook_idempotency WHERE wamid = ?').get(wamid) as any;
    if (existing) {
      console.log(`⚡ [Idempotency] Duplicate webhook event ignored: ${wamid} (status: ${existing.status})`);
      return false; // Already recorded, drop duplicate execution
    }
    db.prepare(`
      INSERT INTO webhook_idempotency (wamid, sender_phone, msg_hash, status)
      VALUES (?, ?, ?, 'PROCESSING')
    `).run(wamid, senderPhone || null, msgHash || null);
    return true; // Newly recorded, proceed with processing
  } catch (err) {
    console.error('❌ [Idempotency] Database check error:', err);
    return true; // Fail-open to avoid dropping genuine messages
  }
}

export function updateIdempotencyStatus(wamid: string, status: 'PROCESSING' | 'PROCESSED' | 'FAILED') {
  if (!wamid) return;
  try {
    db.prepare('UPDATE webhook_idempotency SET status = ? WHERE wamid = ?').run(status, wamid);
  } catch (err) {
    console.error('❌ [Idempotency] Status update error:', err);
  }
}

// ── Message Delivery Receipts & Tracking Helpers ────────────────────────────
export function recordMessageReceipt(
  wamid: string,
  recipientPhone: string,
  status: string,
  errorCode?: string,
  errorMessage?: string,
  metaTimestamp?: string
) {
  if (!wamid || !recipientPhone) return;
  try {
    const id = 'RCP-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
    db.prepare(`
      INSERT INTO message_receipts (id, wamid, recipient_phone, status, error_code, error_message, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      wamid,
      recipientPhone,
      status,
      errorCode || null,
      errorMessage || null,
      metaTimestamp || new Date().toISOString()
    );

    // Update conversation message status if matching thread exists
    const cleanPhone = recipientPhone.replace(/\D/g, '').slice(-10);
    const conv = db.prepare(`
      SELECT id, messages FROM conversations 
      WHERE session_id LIKE ? OR session_id LIKE ? 
      ORDER BY updated_at DESC LIMIT 1
    `).get(`%${cleanPhone}%`, `%${recipientPhone}%`) as any;

    if (conv) {
      try {
        let msgs = JSON.parse(conv.messages || '[]');
        let updated = false;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].wamid === wamid || (!msgs[i].wamid && (msgs[i].role === 'assistant' || msgs[i].role === 'human_agent') && !msgs[i].receipt)) {
            msgs[i].receipt = status;
            if (errorCode) msgs[i].errorCode = errorCode;
            updated = true;
            break;
          }
        }
        if (updated) {
          db.prepare('UPDATE conversations SET messages = ?, last_receipt_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(JSON.stringify(msgs), status, conv.id);
        } else {
          db.prepare('UPDATE conversations SET last_receipt_status = ? WHERE id = ?').run(status, conv.id);
        }
      } catch {}
    }
  } catch (err) {
    console.error('❌ [Receipt] Database write error:', err);
  }
}

export function getMessageReceiptsByPhone(phone: string): any[] {
  try {
    const clean = phone.replace(/\D/g, '').slice(-10);
    return db.prepare(`
      SELECT * FROM message_receipts 
      WHERE recipient_phone LIKE ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all(`%${clean}%`);
  } catch {
    return [];
  }
}

// ── Universal Multi-Tenant 11 Websites Sync ─────────────────────────────────
export function ensureAll11WebsitesRegistered() {
  const insertOrReplace = db.prepare(`
    INSERT INTO websites (id, domain, brand_name, business_model, tagline, primary_phone, primary_email, allowed_categories, primary_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain,
      brand_name = excluded.brand_name,
      business_model = excluded.business_model,
      tagline = excluded.tagline,
      primary_phone = excluded.primary_phone,
      primary_email = excluded.primary_email,
      allowed_categories = excluded.allowed_categories,
      primary_color = excluded.primary_color
  `);

  const ALL_WEBSITES = [
    // 1. GCM Enterprises (Turnkey Sports & Infrastructure)
    [
      'gcm-enterprises',
      'gcm.enterprises',
      'GCM Enterprises',
      'turnkey',
      "India's Premier Turnkey Sports Infrastructure & Cricket Ground Estimations",
      '+91 99123 99224',
      'info@gcm.enterprises',
      JSON.stringify(['Turnkey Box Cricket', 'Sports Turf Ground', 'Steel Structure Framework', 'Stadium Lighting', 'Industrial Safety Nets']),
      '#4f46e5'
    ],
    // 2. GCM Safety Nets (Hyderabad)
    [
      'gcmsafetynets',
      'gcmsafetynets.in',
      'GCM Safety Nets',
      'doorstep_service',
      "Hyderabad's #1 Doorstep Safety Netting & Installation Services",
      '+91 99123 99224',
      'gcmsafetynets@gmail.com',
      JSON.stringify(['Balcony Safety Nets', 'Pigeon Nets', 'Bird Nets', 'Invisible Grills', 'Cloth Drying Hangers', 'Children Safety Nets', 'Duct Safety Nets']),
      '#2563eb'
    ],
    // 3. NetsOcean Netting Solutions (Wholesale Supply)
    [
      'netsocean',
      'netsocean.com',
      'NetsOcean Netting Solutions',
      'supply_only',
      'Direct Factory Netting Supply, Wholesale Bags & Custom Panels (Supply-Only)',
      '+91 99123 99224',
      'sales@netsocean.com',
      JSON.stringify(['Supply-Only Netting', 'Standard Bags 3300 SFT', 'Custom Cut Panels', 'HDPE Braided Nets', 'Twisted Roof Nets']),
      '#059669'
    ],
    // 4. GCM Invisible Grills
    [
      'gcminvisiblegrills',
      'gcminvisiblegrills.com',
      'GCM Invisible Grills',
      'doorstep_service',
      'High Tensile AISI 316 Marine Grade Balcony Invisible Grills with Doorstep Fitting',
      '+91 99123 99224',
      'sales@gcminvisiblegrills.com',
      JSON.stringify(['Invisible Grills', 'Balcony Invisible Grills', 'Window Invisible Grills']),
      '#0284c7'
    ],
    // 5. GCM Netting (Bangalore)
    [
      'gcmnetting',
      'gcmnetting.com',
      'GCM Netting (Bangalore)',
      'doorstep_service',
      'Professional Balcony & Industrial Netting Installation across Bangalore & Karnataka',
      '+91 99123 99224',
      'bangalore@gcmnetting.com',
      JSON.stringify(['Balcony Safety Nets', 'Pigeon Nets', 'Bird Nets', 'Invisible Grills', 'Industrial Netting']),
      '#2563eb'
    ],
    // 6. GCM Netting Solutions (Chennai)
    [
      'gcmnettingsolutions',
      'gcmnettingsolutions.com',
      'GCM Netting Solutions (Chennai)',
      'doorstep_service',
      'Top-Rated Pigeon & Balcony Safety Netting Services across Chennai & Tamil Nadu',
      '+91 99123 99224',
      'chennai@gcmnettingsolutions.com',
      JSON.stringify(['Balcony Safety Nets', 'Pigeon Nets', 'Bird Nets', 'Invisible Grills', 'Sports Nets']),
      '#2563eb'
    ],
    // 7. NetsDial
    [
      'netsdial',
      'netsdial.com',
      'NetsDial',
      'doorstep_service',
      'Fast Doorstep Safety Netting Service Directory',
      '+91 99123 99224',
      'support@netsdial.com',
      JSON.stringify(['Balcony Safety Nets', 'Pigeon Nets', 'Invisible Grills']),
      '#0891b2'
    ],
    // 8. Usha Leads
    [
      'ushaleads',
      'ushaleads.in',
      'Usha Leads Generation Engine',
      'doorstep_service',
      'Verified High-Intent Netting & Installation Inquiries',
      '+91 99123 99224',
      'leads@ushaleads.in',
      JSON.stringify(['Direct Inbound Leads', 'Field Van Dispatch', 'Doorstep Inquiries']),
      '#f59e0b'
    ],
    // 9. RUSSEA Branded Nets
    [
      'russea',
      'russea.in',
      'RUSSEA Netting Brands',
      'supply_only',
      'High-Tenacity Virgin UV Netting Manufacturing (Pan-India Supply)',
      '+91 99123 99224',
      'contact@russea.in',
      JSON.stringify(['RUSSEA Braided Nets', 'HDPE Cricket Nets', 'Wholesale Netting Bags']),
      '#d97706'
    ],
    // 10. NettingTeam (Hyderabad Focused 183 Localities)
    [
      'nettingteam',
      'nettingteam.com',
      'NettingTeam (Hyderabad)',
      'doorstep_service',
      "Greater Hyderabad's Dedicated Safety Netting Team — Serving All 183 Localities",
      '+91 99123 99334',
      'contact@nettingteam.com',
      JSON.stringify(['Balcony Safety Nets', 'Pigeon Nets', 'Bird Nets', 'Invisible Grills', 'Cloth Drying Hangers', 'Children Safety Nets', 'Duct Safety Nets']),
      '#e84520'
    ],
    // 11. GCM Safety Nets (National Portal)
    [
      'gcmsafetynets-com',
      'gcmsafetynets.com',
      'GCM Safety Nets (National)',
      'doorstep_service',
      "India's Premier Balcony, Pigeon & Industrial Safety Netting Network",
      '+91 99123 99224',
      'info@gcmsafetynets.com',
      JSON.stringify(['Balcony Safety Nets', 'Pigeon Nets', 'Invisible Grills', 'Construction Safety Nets', 'Industrial Nets']),
      '#1d4ed8'
    ],
    // 12. Zenxa Architectural & Industrial Safety
    [
      'zenxa',
      'zenxa.in',
      'Zenxa Architectural & Industrial Protection',
      'doorstep_service',
      'Architectural Cable Systems, Industrial Netting & Heavy Sports Enclosures',
      '+91 99123 99224',
      'contact@zenxa.in',
      JSON.stringify(['Architectural Cable Systems', 'Industrial Safety Nets', 'Debris Nets', 'Sports Enclosures']),
      '#0f766e'
    ]
  ];

  for (const w of ALL_WEBSITES) {
    try {
      insertOrReplace.run(...w);
    } catch (e: any) {
      console.warn('[WebsiteSync Warning]', e.message);
    }
  }
}

// ── Enrolled Authorized Owner Devices (Phase 9 — 4 Dedicated Devices) ───────
export function ensureAuthorizedOwnerDevices() {
  const insertOrIgnore = db.prepare(`
    INSERT INTO authorized_devices (device_id, device_name, device_type, owner_name, is_active)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(device_id) DO UPDATE SET
      device_name = excluded.device_name,
      device_type = excluded.device_type,
      owner_name = excluded.owner_name,
      is_active = 1
  `);

  const FOUR_OWNER_DEVICES = [
    ['owner_win_laptop', 'Windows Laptop (Director Station)', 'laptop', 'Owner / MD'],
    ['owner_macbook_air', 'MacBook Air (Owner Mobile Station)', 'laptop', 'Owner / MD'],
    ['owner_pixel_phone', 'Google Pixel Phone (Primary Mobile)', 'mobile', 'Owner / MD'],
    ['owner_redmi_turbo5', 'Redmi Turbo 5 Phone (Secondary Mobile)', 'mobile', 'Owner / MD']
  ];

  for (const d of FOUR_OWNER_DEVICES) {
    try {
      insertOrIgnore.run(...d);
    } catch (e: any) {
      console.warn('[DeviceSync Warning]', e.message);
    }
  }
}
