/**
 * Lead Management & Universal CRM Pipeline Service
 * Unified across all 9 GCM Platforms:
 * 1. gcmsafetynets.in (Hyderabad Doorstep)
 * 2. gcmnetting.com (Bangalore Doorstep)
 * 3. gcmnettingsolutions.com (Chennai Doorstep)
 * 4. gcm.enterprises (Pan-India Turnkey Sports & Box Cricket)
 * 5. gcminvisiblegrills.com (Invisible Grills)
 * 6. netsdial.com (Marketplace Directory)
 * 7. ushaleads.in (Lead Generation Engine)
 * 8. russea.in (Branded Manufacturing / Dealerships)
 * 9. netsocean.com (Wholesale Material Supply)
 */

import { db } from '../db/database.js';
import crypto from 'node:crypto';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp-client.js';

export interface CreateLeadInput {
  websiteId: string;
  pillar?: 'turnkey' | 'doorstep_service' | 'supply_only';
  customerName: string;
  phone: string;
  email?: string;
  city?: string;
  locality?: string;
  requirementSummary?: string;
  estimatedValue?: number;
  areaZone?: string;
  channel?: string;
  sourceUrl?: string;
  ipAddress?: string;
  notes?: string;
}

export interface IngestLeadInput {
  websiteId?: string;
  domain?: string;
  customerName?: string;
  name?: string;
  phone: string;
  email?: string;
  city?: string;
  locality?: string;
  area?: string;
  service?: string;
  requirementSummary?: string;
  estimatedValue?: number;
  areaZone?: string;
  channel?: 'web_form' | 'phone_call' | 'missed_call' | 'whatsapp' | 'email' | 'ushaleads' | 'direct';
  sourceUrl?: string;
  ipAddress?: string;
  notes?: string;
  message?: string;
  autoWelcome?: boolean;
}

export function createOrUpdateLead(input: CreateLeadInput) {
  const cleanPhone = (input.phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new Error('Valid 10-digit phone number is required.');
  }

  // Determine pillar based on websiteId or input
  let pillar = input.pillar;
  if (!pillar) {
    if (input.websiteId === 'gcm-enterprises') pillar = 'turnkey';
    else if (input.websiteId === 'netsocean' || input.websiteId === 'russea') pillar = 'supply_only';
    else pillar = 'doorstep_service';
  }

  const existingLead = db.prepare('SELECT * FROM leads WHERE phone = ?').get(cleanPhone) as any;

  if (existingLead) {
    db.prepare(`
      UPDATE leads 
      SET customer_name = COALESCE(?, customer_name),
          email = COALESCE(?, email),
          city = COALESCE(?, city),
          locality = COALESCE(?, locality),
          requirement_summary = COALESCE(?, requirement_summary),
          estimated_value = CASE WHEN ? > 0 THEN ? ELSE estimated_value END,
          pillar = COALESCE(?, pillar),
          channel = COALESCE(?, channel),
          source_url = COALESCE(?, source_url),
          ip_address = COALESCE(?, ip_address),
          notes = COALESCE(?, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      input.customerName || null,
      input.email || null,
      input.city || null,
      input.locality || null,
      input.requirementSummary || null,
      input.estimatedValue || 0,
      input.estimatedValue || 0,
      pillar,
      input.channel || null,
      input.sourceUrl || null,
      input.ipAddress || null,
      input.notes || null,
      existingLead.id
    );

    logLeadActivity(existingLead.id, 'LEAD_UPDATED', `Lead updated via ${input.websiteId} (${input.channel || 'web_form'})`, 'SYSTEM');
    return db.prepare('SELECT * FROM leads WHERE id = ?').get(existingLead.id);
  }

  const id = 'LEAD-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const initialStage = pillar === 'turnkey' ? 'INQUIRY' : pillar === 'supply_only' ? 'NET_INQUIRY' : 'NEW_INQUIRY';

  db.prepare(`
    INSERT INTO leads (
      id, website_id, pillar, customer_name, phone, email, city, locality, 
      requirement_summary, stage, pipeline_stage, estimated_value, area_zone, balance_amount,
      channel, source_url, ip_address, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.websiteId,
    pillar,
    input.customerName || 'Inbound Customer',
    cleanPhone,
    input.email || null,
    input.city || 'Hyderabad',
    input.locality || null,
    input.requirementSummary || null,
    initialStage,
    input.estimatedValue || 0,
    input.areaZone || null,
    input.estimatedValue || 0,
    input.channel || 'web_form',
    input.sourceUrl || null,
    input.ipAddress || null,
    input.notes || null
  );

  logLeadActivity(id, 'LEAD_CREATED', `Lead created for ${pillar} pipeline via ${input.websiteId} (${input.channel || 'web_form'})`, 'SYSTEM');

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
}

export async function ingestLead(input: IngestLeadInput) {
  // Infer Website ID
  let websiteId = input.websiteId;
  const dom = (input.domain || input.sourceUrl || '').toLowerCase();
  if (!websiteId) {
    if (dom.includes('gcmnetting.com') || dom.includes('bangalore') || dom.includes('bengaluru')) {
      websiteId = 'gcmnetting';
    } else if (dom.includes('gcmnettingsolutions.com') || dom.includes('chennai') || dom.includes('tambaram')) {
      websiteId = 'gcmnettingsolutions';
    } else if (dom.includes('gcm.enterprises') || dom.includes('turnkey') || dom.includes('cricket')) {
      websiteId = 'gcm-enterprises';
    } else if (dom.includes('gcminvisiblegrills.com') || dom.includes('invisible')) {
      websiteId = 'gcminvisiblegrills';
    } else if (dom.includes('netsdial.com')) {
      websiteId = 'netsdial';
    } else if (dom.includes('ushaleads.in')) {
      websiteId = 'ushaleads';
    } else if (dom.includes('russea.in')) {
      websiteId = 'russea';
    } else if (dom.includes('netsocean.com')) {
      websiteId = 'netsocean';
    } else {
      websiteId = 'gcmsafetynets';
    }
  }

  // Infer City
  let city = input.city;
  if (!city) {
    if (websiteId === 'gcmnetting') city = 'Bangalore';
    else if (websiteId === 'gcmnettingsolutions') city = 'Chennai';
    else if (websiteId === 'gcmsafetynets') city = 'Hyderabad';
    else if (websiteId === 'gcm-enterprises' || websiteId === 'netsocean' || websiteId === 'russea') city = 'Pan-India';
    else city = 'Hyderabad';
  }

  // Requirement summary
  const summary = input.requirementSummary || input.service || (input.notes ? input.notes.slice(0, 80) : 'Safety Netting Inbound Inquiry');

  const lead = createOrUpdateLead({
    websiteId,
    customerName: input.customerName || input.name || 'Valued Customer',
    phone: input.phone,
    email: input.email,
    city,
    locality: input.locality || input.area,
    requirementSummary: summary,
    estimatedValue: input.estimatedValue || 0,
    areaZone: input.areaZone,
    channel: input.channel || 'web_form',
    sourceUrl: input.sourceUrl || input.domain,
    ipAddress: input.ipAddress,
    notes: input.notes || input.message
  }) as any;

  // Send Automatic WhatsApp Welcome if requested
  if (input.autoWelcome !== false) {
    sendLeadAutoWelcome(lead).catch(e => console.error('[AutoWelcome Error]', e.message));
  }

  return lead;
}

export async function sendLeadAutoWelcome(lead: any) {
  try {
    const targetPhone = lead.whatsapp_number || lead.phone;
    if (!targetPhone) return;

    const brand = db.prepare('SELECT * FROM websites WHERE id = ?').get(lead.website_id) as any;
    const brandName = brand ? brand.brand_name : 'GCM Safety Nets';
    const city = lead.city || 'your city';
    const req = lead.requirement_summary || 'Safety Nets & Netting Solutions';

    let msg = `Hello ${lead.customer_name || 'Customer'}! 👋\n\n`;
    msg += `Thank you for contacting *${brandName}*.\n`;
    msg += `We have received your requirement for *${req}* in *${city}*.\n\n`;

    if (lead.pillar === 'turnkey') {
      msg += `🏏 *Turnkey Sports & Box Cricket Project Team:*\n`;
      msg += `Our technical directors are reviewing your ground dimensions to prepare your initial 3D layout & 15-line BOQ estimate.\n\n`;
      msg += `📞 Executive Project Line: +91 99123 99227\n🌐 Website: https://gcm.enterprises`;
    } else if (lead.pillar === 'supply_only') {
      msg += `📦 *Factory-Direct Netting Supply (Pan-India):*\n`;
      msg += `Our wholesale dispatch desk will connect with you with the product specifications & transport details.\n\n`;
      msg += `📞 Wholesale Desk: +91 99123 99224\n🌐 Catalog: https://netsocean.com`;
    } else {
      msg += `🏠 *Doorstep Installation & Same-Day Service:*\n`;
      msg += `Our local area team provides *Free Site Measurement & Inspection* with high-tenacity 5-year warranty netting.\n\n`;
      msg += `Would you like our technician to visit your site today for free measurement?\n\n`;
      msg += `📞 Direct Helpline: +91 99123 99224`;
    }

    const waRes = await sendWhatsAppMessage(targetPhone, msg);
    if (waRes && waRes.isNotWhatsApp) {
      db.prepare(`
        UPDATE leads 
        SET whatsapp_status = 'NO_WHATSAPP', human_takeover = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(lead.id);
      logLeadActivity(lead.id, 'NO_WHATSAPP_DETECTED', `WhatsApp delivery failed: ${targetPhone} does not have a WhatsApp account. Owner call required to collect WhatsApp number.`, 'SYSTEM');
    } else if (waRes && waRes.success) {
      db.prepare(`
        UPDATE leads 
        SET whatsapp_status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(lead.id);
      logLeadActivity(lead.id, 'WHATSAPP_SENT', `Auto-welcome message dispatched to ${targetPhone}`, 'SYSTEM');
    }
  } catch (err: any) {
    console.error('[sendLeadAutoWelcome Error]', err.message);
  }
}

export function updateLeadStage(leadId: string, stage: string, notes?: string) {
  return updatePipelineStage(leadId, stage, notes);
}

export function updatePipelineStage(leadId: string, newStage: string, notes?: string, performedBy = 'USER') {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  db.prepare(`
    UPDATE leads 
    SET pipeline_stage = ?, stage = ?, notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(newStage, newStage, notes || null, leadId);

  logLeadActivity(leadId, 'STAGE_CHANGE', `Moved stage from ${lead.pipeline_stage} to ${newStage}${notes ? ` (${notes})` : ''}`, performedBy);

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
}

export function assignTechnician(
  leadId: string,
  technicianId: string,
  technicianName: string,
  technicianPhone: string,
  visitDate: string,
  visitSlot: string,
  areaZone?: string,
  performedBy = 'USER'
) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  db.prepare(`
    UPDATE leads 
    SET technician_id = ?,
        technician_name = ?,
        technician_phone = ?,
        visit_date = ?,
        visit_slot = ?,
        area_zone = COALESCE(?, area_zone),
        pipeline_stage = 'VAN_SCHEDULED',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(technicianId, technicianName, technicianPhone, visitDate, visitSlot, areaZone || null, leadId);

  logLeadActivity(
    leadId,
    'VAN_ASSIGNED',
    `Assigned field van: ${technicianName} (${technicianPhone}) on ${visitDate} [Slot: ${visitSlot}]`,
    performedBy
  );

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
}

export function recordPayment(
  leadId: string,
  amount: number,
  mode: 'UPI' | 'CASH_TECHNICIAN' | 'BANK_NEFT' | 'CHEQUE',
  ref?: string,
  isAdvance = true,
  performedBy = 'USER'
) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  const totalVal = Number(lead.estimated_value || 0);
  const prevAdvance = Number(lead.advance_amount || 0);
  const newAdvance = isAdvance ? prevAdvance + amount : prevAdvance;
  const newBalance = Math.max(0, totalVal - newAdvance);

  let status = 'UNPAID';
  if (newBalance <= 0 && (totalVal > 0 || amount > 0)) {
    status = 'PAID_FULL';
  } else if (newAdvance > 0) {
    status = 'PARTIAL_ADVANCE';
  }

  db.prepare(`
    UPDATE leads 
    SET payment_status = ?,
        advance_amount = ?,
        balance_amount = ?,
        payment_mode = ?,
        payment_ref = COALESCE(?, payment_ref),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, newAdvance, newBalance, mode, ref || null, leadId);

  logLeadActivity(
    leadId,
    'PAYMENT_LOGGED',
    `Recorded payment of ₹${amount.toLocaleString('en-IN')} via ${mode}${ref ? ` (Ref: ${ref})` : ''}. Status: ${status}. Balance Due: ₹${newBalance.toLocaleString('en-IN')}`,
    performedBy
  );

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
}

export function recordDispatch(
  leadId: string,
  transporter: string,
  lrNumber: string,
  dispatchDate: string,
  performedBy = 'USER'
) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  db.prepare(`
    UPDATE leads 
    SET dispatch_transporter = ?,
        lr_number = ?,
        dispatch_date = ?,
        pipeline_stage = 'DISPATCHED_BILTY',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(transporter, lrNumber, dispatchDate, leadId);

  logLeadActivity(
    leadId,
    'DISPATCH_LOGGED',
    `Dispatched via ${transporter} | LR/Bilty #: ${lrNumber} on ${dispatchDate}`,
    performedBy
  );

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
}

export function toggleHumanTakeover(leadId: string, takeoverStatus: boolean, performedBy = 'USER') {
  const flag = takeoverStatus ? 1 : 0;
  db.prepare('UPDATE leads SET human_takeover = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(flag, leadId);

  logLeadActivity(
    leadId,
    'TAKEOVER_TOGGLED',
    takeoverStatus ? 'Human Takeover Activated (AI Auto-Pilot Paused)' : 'Human Takeover Deactivated (AI Auto-Pilot Resumed)',
    performedBy
  );

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId);
}

export function logLeadActivity(leadId: string, type: string, description: string, performedBy = 'SYSTEM') {
  try {
    const actId = 'ACT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    db.prepare(`
      INSERT INTO lead_activities (id, lead_id, activity_type, description, performed_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(actId, leadId, type, description, performedBy);
  } catch (err) {
    console.error('Error logging lead activity:', err);
  }
}

export function getLeadActivities(leadId: string) {
  return db.prepare(`
    SELECT * FROM lead_activities 
    WHERE lead_id = ? 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all(leadId);
}

export function listLeads(filters?: { stage?: string; websiteId?: string; limit?: number }) {
  let query = 'SELECT l.*, w.brand_name FROM leads l LEFT JOIN websites w ON l.website_id = w.id WHERE 1=1';
  const params: any[] = [];

  if (filters?.stage) {
    query += ' AND (l.pipeline_stage = ? OR l.stage = ?)';
    params.push(filters.stage, filters.stage);
  }
  if (filters?.websiteId) {
    query += ' AND l.website_id = ?';
    params.push(filters.websiteId);
  }

  query += ' ORDER BY l.updated_at DESC LIMIT ?';
  params.push(filters?.limit || 100);

  return db.prepare(query).all(...params);
}

export function listLeadsByPillar(
  pillar?: string, 
  stage?: string, 
  search?: string, 
  zone?: string, 
  websiteId?: string, 
  city?: string, 
  limit = 100
) {
  let query = 'SELECT l.*, w.brand_name FROM leads l LEFT JOIN websites w ON l.website_id = w.id WHERE 1=1';
  const params: any[] = [];

  if (pillar && pillar !== 'all') {
    query += ' AND l.pillar = ?';
    params.push(pillar);
  }
  if (websiteId && websiteId !== 'all') {
    query += ' AND l.website_id = ?';
    params.push(websiteId);
  }
  if (city && city !== 'all') {
    query += ' AND l.city = ?';
    params.push(city);
  }
  if (stage && stage !== 'all') {
    query += ' AND (l.pipeline_stage = ? OR l.stage = ?)';
    params.push(stage, stage);
  }
  if (zone && zone !== 'all') {
    query += ' AND l.area_zone LIKE ?';
    params.push(`%${zone}%`);
  }
  if (search) {
    query += ' AND (l.customer_name LIKE ? OR l.phone LIKE ? OR l.city LIKE ? OR l.requirement_summary LIKE ? OR l.locality LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY l.updated_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params);
}

export function listTechnicians() {
  return db.prepare('SELECT * FROM technicians WHERE is_active = 1 ORDER BY zone, name').all();
}

export function getCRMAnalytics() {
  // 1. Totals by Pillar
  const pillarStats = db.prepare(`
    SELECT 
      pillar, 
      COUNT(*) as count, 
      COALESCE(SUM(estimated_value), 0) as total_pipeline_value,
      COALESCE(SUM(advance_amount), 0) as total_advance_collected,
      COALESCE(SUM(balance_amount), 0) as total_balance_due
    FROM leads 
    GROUP BY pillar
  `).all() as any[];

  // 2. Today's Scheduled Field Visits
  const todayStr = new Date().toISOString().slice(0, 10);
  const visitsToday = db.prepare(`
    SELECT COUNT(*) as count 
    FROM leads 
    WHERE visit_date = ? AND pipeline_stage = 'VAN_SCHEDULED'
  `).get(todayStr) as any;

  // 3. Human Takeover Alerts Count
  const takeoverAlerts = db.prepare(`
    SELECT COUNT(*) as count 
    FROM leads 
    WHERE human_takeover = 1 OR estimated_value >= 500000
  `).get() as any;

  // 4. Overall Pipeline Summary
  const overall = db.prepare(`
    SELECT 
      COUNT(*) as total_leads,
      COALESCE(SUM(estimated_value), 0) as total_pipeline_value,
      COALESCE(SUM(advance_amount), 0) as total_advance_collected,
      COALESCE(SUM(balance_amount), 0) as total_balance_due
    FROM leads
  `).get() as any;

  // 5. Missing WhatsApp Alerts
  const noWhatsApp = db.prepare(`
    SELECT COUNT(*) as count FROM leads WHERE whatsapp_status = 'NO_WHATSAPP'
  `).get() as any;

  return {
    overall,
    pillarStats,
    visitsTodayCount: visitsToday ? visitsToday.count : 0,
    takeoverAlertsCount: takeoverAlerts ? takeoverAlerts.count : 0,
    noWhatsAppCount: noWhatsApp ? noWhatsApp.count : 0,
    techniciansCount: (db.prepare('SELECT COUNT(*) as count FROM technicians WHERE is_active = 1').get() as any).count
  };
}

// ── 1-Tap Quick Call Lead Creator (Phone Call Handoff) ───────────────────────
export interface QuickCallLeadInput {
  phone: string;
  customerName?: string;
  websiteId?: string;
  city?: string;
  locality?: string;
  service?: string;
  requirementSummary?: string;
  estimatedValue?: number;
  notes?: string;
  performedBy?: string;
}

export async function createQuickCallLead(input: QuickCallLeadInput) {
  const cleanPhone = (input.phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new Error('Valid 10-digit customer phone number is required.');
  }

  // Infer Website ID and Pillar
  let websiteId = input.websiteId || 'gcmsafetynets';
  let pillar: 'turnkey' | 'doorstep_service' | 'supply_only' = 'doorstep_service';

  if (websiteId === 'gcm-enterprises') pillar = 'turnkey';
  else if (websiteId === 'netsocean' || websiteId === 'russea') pillar = 'supply_only';
  else pillar = 'doorstep_service';

  let city = input.city;
  if (!city) {
    if (websiteId === 'gcmnetting') city = 'Bangalore';
    else if (websiteId === 'gcmnettingsolutions') city = 'Chennai';
    else if (websiteId === 'gcmsafetynets') city = 'Hyderabad';
    else city = 'Hyderabad';
  }

  const reqSummary = input.requirementSummary || input.service || 'Inbound Phone Inquiry (Direct Call)';
  const customerName = input.customerName?.trim() || 'Valued Client';

  // Create or retrieve lead
  const lead = createOrUpdateLead({
    websiteId,
    pillar,
    customerName,
    phone: cleanPhone,
    city,
    locality: input.locality,
    requirementSummary: reqSummary,
    estimatedValue: input.estimatedValue || 0,
    channel: 'phone_call',
    notes: input.notes ? `[Call Note]: ${input.notes}` : 'Lead received via direct phone call handoff'
  }) as any;

  logLeadActivity(
    lead.id,
    'PHONE_CALL_HANDOFF',
    `Owner handed off phone inquiry to AI Auto-Pilot. Customer: ${customerName} (${cleanPhone})`,
    input.performedBy || 'OWNER'
  );

  // Personalized WhatsApp Greeting for Phone Call
  const brand = db.prepare('SELECT * FROM websites WHERE id = ?').get(websiteId) as any;
  const brandName = brand ? brand.brand_name : 'GCM Safety Nets';

  let msg = `Namaste ${customerName}! 🙏\n\n`;
  msg += `Thank you for speaking with our Managing Director Mr. Gopichand on the call.\n`;
  msg += `As discussed, I am your dedicated AI project coordinator from *${brandName}* (*${city}*).\n\n`;
  msg += `📌 *Your Requirement:* ${reqSummary}\n\n`;

  if (pillar === 'turnkey') {
    msg += `🏏 Our sports civil engineering directors have received your project details and are preparing the 3D layout & customized quote.\n\n`;
    msg += `Would you like us to share photos/videos of our completed turf & box cricket installations across India?`;
  } else if (pillar === 'supply_only') {
    msg += `📦 Our wholesale warehouse desk is preparing factory-direct pricing for your required netting specifications.\n\n`;
    msg += `Please confirm if you require material supply only or along with installation accessories.`;
  } else {
    msg += `🚐 Would you like our certified field technician to visit your site in *${city}* today for *Free Measurement & Sample Inspection*?\n\n`;
    msg += `Please reply with your preferred time slot or address!`;
  }

  try {
    const waRes = await sendWhatsAppMessage(cleanPhone, msg);
    if (waRes && waRes.isNotWhatsApp) {
      db.prepare(`
        UPDATE leads 
        SET whatsapp_status = 'NO_WHATSAPP', human_takeover = 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(lead.id);
      logLeadActivity(lead.id, 'NO_WHATSAPP_DETECTED', `Phone ${cleanPhone} does not have WhatsApp. Alert generated for owner.`, 'SYSTEM');
    } else if (waRes && waRes.success) {
      db.prepare(`
        UPDATE leads 
        SET whatsapp_status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(lead.id);
      logLeadActivity(lead.id, 'WHATSAPP_SENT', `Personalized phone-handoff WhatsApp greeting sent to ${cleanPhone}`, 'SYSTEM');
    }
  } catch (waErr: any) {
    console.error('[QuickCall WhatsApp Error]', waErr.message);
  }

  return db.prepare('SELECT l.*, w.brand_name FROM leads l LEFT JOIN websites w ON l.website_id = w.id WHERE l.id = ?').get(lead.id);
}

// ── Update Customer's WhatsApp Number (When calling number has no WA) ─────────
export async function updateLeadWhatsAppNumber(leadId: string, newWhatsAppPhone: string, performedBy = 'OWNER') {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(leadId) as any;
  if (!lead) throw new Error(`Lead not found: ${leadId}`);

  const cleanPhone = (newWhatsAppPhone || '').replace(/[^0-9]/g, '').slice(-10);
  if (!cleanPhone || cleanPhone.length !== 10) {
    throw new Error('Valid 10-digit WhatsApp number is required.');
  }

  db.prepare(`
    UPDATE leads 
    SET whatsapp_number = ?,
        whatsapp_status = 'ACTIVE',
        human_takeover = 0,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(cleanPhone, leadId);

  logLeadActivity(
    leadId,
    'WHATSAPP_NUMBER_UPDATED',
    `WhatsApp number updated to +91 ${cleanPhone} by ${performedBy}. AI Auto-Pilot resumed.`,
    performedBy
  );

  const updatedLead = db.prepare('SELECT l.*, w.brand_name FROM leads l LEFT JOIN websites w ON l.website_id = w.id WHERE l.id = ?').get(leadId) as any;

  // Immediately dispatch welcome message to this new WhatsApp number
  sendLeadAutoWelcome(updatedLead).catch(e => console.error('[Updated WA Welcome Error]', e.message));

  return updatedLead;
}

// ── Dispatch Turnkey / Custom Quotation with Official Bank Details & UPI ───────
export interface DispatchQuotationInput {
  leadId: string;
  quoteNumber?: string;
  projectName?: string;
  grandTotal: number;
  taxableAmount?: number;
  gstPct?: number;
  gstAmount?: number;
  viewUrl?: string;
  docId?: string;
  includeBankDetails?: boolean;
  includeUpi?: boolean;
  customNotes?: string;
  performedBy?: string;
}

export async function dispatchQuotationToLead(input: DispatchQuotationInput) {
  const lead = db.prepare('SELECT l.*, w.brand_name FROM leads l LEFT JOIN websites w ON l.website_id = w.id WHERE l.id = ?').get(input.leadId) as any;
  if (!lead) throw new Error(`Lead not found: ${input.leadId}`);

  const grandTotal = Number(input.grandTotal || 0);
  if (grandTotal <= 0) {
    throw new Error('Valid quotation total amount is required.');
  }

  const quoteNumber = input.quoteNumber || input.docId || `GCM-QT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const quoteId = 'QT-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const taxableAmount = input.taxableAmount || Math.round((grandTotal / 1.18) * 100) / 100;
  const gstAmount = input.gstAmount || Math.round((grandTotal - taxableAmount) * 100) / 100;
  const viewUrl = input.viewUrl || (input.docId ? `https://gcm.enterprises/admin/view.php?id=${encodeURIComponent(input.docId)}` : `https://gcm.enterprises/admin/view.php?id=${encodeURIComponent(quoteNumber)}`);
  const projectName = input.projectName || lead.requirement_summary || 'Netting Installation & Supply';

  // 1. Record quotation in SQLite
  db.prepare(`
    INSERT INTO quotations (
      id, quote_number, lead_id, website_id, project_name, dimensions_text,
      subtotal, taxable_amount, gst_pct, gst_amount, grand_total, status, doc_id, view_url, company_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SENT', ?, ?, 'GCM ENTERPRISES')
  `).run(
    quoteId,
    quoteNumber,
    lead.id,
    lead.website_id,
    projectName,
    lead.requirement_summary || 'Standard Project Scope',
    taxableAmount,
    taxableAmount,
    input.gstPct || 18.0,
    gstAmount,
    grandTotal,
    input.docId || quoteNumber,
    viewUrl
  );

  // 2. Update Lead Stage and Amounts
  db.prepare(`
    UPDATE leads 
    SET pipeline_stage = 'QUOTATION_SENT',
        stage = 'QUOTATION_SENT',
        estimated_value = ?,
        balance_amount = CASE WHEN advance_amount > 0 THEN (? - advance_amount) ELSE ? END,
        notes = COALESCE(notes || '\n', '') || '[QUOTATION_DISPATCHED]: ' || ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(grandTotal, grandTotal, grandTotal, `Quote #${quoteNumber} for ₹${grandTotal.toLocaleString('en-IN')}`, lead.id);

  // 3. Compose WhatsApp Message
  const targetPhone = lead.whatsapp_number || lead.phone;
  let msg = `Namaste ${lead.customer_name || 'Client'}! 🙏\n\n`;
  msg += `📄 *Official Quotation Prepared for Your Requirement*\n`;
  msg += `• *Project / Scope:* ${projectName}\n`;
  msg += `• *Quote / Estimation #:* ${quoteNumber}\n`;
  msg += `• *Grand Total:* *₹${grandTotal.toLocaleString('en-IN')}* (Inclusive of GST)\n\n`;

  msg += `👉 *View & Download Official Stamped PDF:*\n${viewUrl}\n\n`;

  if (input.includeBankDetails !== false) {
    msg += `🏦 *Official Company Bank Transfer Details:*\n`;
    msg += `• Account Name: *GCM ENTERPRISES*\n`;
    msg += `• Bank: *STATE BANK OF INDIA*\n`;
    msg += `• Current Account No: *44979437825*\n`;
    msg += `• IFSC Code: *SBIN0021462*\n`;
    msg += `• Branch: *Greenpark Colony, Hyderabad*\n\n`;
  }

  if (input.includeUpi !== false) {
    msg += `📲 *Instant UPI Payment:*\n`;
    msg += `• UPI ID: *9912399224@sbi*\n`;
    msg += `• PhonePe / Google Pay / Paytm: *9912399224*\n\n`;
  }

  msg += `💬 Reply *CONFIRM* to schedule installation / dispatch date, or reply with any queries! Our team is at your service.`;

  // 4. Send WhatsApp
  const waRes = await sendWhatsAppMessage(targetPhone, msg);
  let waStatus = 'SENT';
  if (waRes && waRes.isNotWhatsApp) {
    waStatus = 'FAILED_NO_WHATSAPP';
    db.prepare(`UPDATE leads SET whatsapp_status = 'NO_WHATSAPP', human_takeover = 1 WHERE id = ?`).run(lead.id);
  }

  logLeadActivity(
    lead.id,
    'QUOTATION_DISPATCHED',
    `Quotation #${quoteNumber} (₹${grandTotal.toLocaleString('en-IN')}) dispatched to ${targetPhone} via WhatsApp. Status: ${waStatus}`,
    input.performedBy || 'OWNER'
  );

  return {
    success: true,
    quoteId,
    quoteNumber,
    viewUrl,
    grandTotal,
    waStatus
  };
}

// ── Dispatch Shipment & Log Bilty Tracking ────────────────────────────────────
export interface DispatchShipmentInput {
  leadId: string;
  transporter: string;
  lrNumber: string;
  dispatchDate?: string;
  expectedDeliveryDate?: string;
  parcelsCount?: string;
  notes?: string;
  performedBy?: string;
}

export async function dispatchShipment(input: DispatchShipmentInput) {
  const lead = db.prepare('SELECT l.*, w.brand_name FROM leads l LEFT JOIN websites w ON l.website_id = w.id WHERE l.id = ?').get(input.leadId) as any;
  if (!lead) throw new Error(`Lead not found: ${input.leadId}`);

  if (!input.transporter || !input.lrNumber) {
    throw new Error('Transporter name and LR / Bilty number are required.');
  }

  const dispatchDate = input.dispatchDate || new Date().toISOString().slice(0, 10);
  const expectedDate = input.expectedDeliveryDate || 'Within 2-3 Business Days';
  const parcels = input.parcelsCount || '1 Bundle / Parcel';

  db.prepare(`
    UPDATE leads 
    SET dispatch_transporter = ?,
        lr_number = ?,
        dispatch_date = ?,
        expected_delivery_date = ?,
        parcels_count = ?,
        delivery_status = 'IN_TRANSIT',
        pipeline_stage = 'DISPATCHED_BILTY',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    input.transporter,
    input.lrNumber,
    dispatchDate,
    expectedDate,
    parcels,
    lead.id
  );

  // Send WhatsApp Notification to Customer
  const targetPhone = lead.whatsapp_number || lead.phone;
  let msg = `Namaste ${lead.customer_name || 'Client'}! 🚚\n\n`;
  msg += `📦 *Your GCM Netting Shipment is Dispatched!*\n\n`;
  msg += `Your netting materials have been securely packed and handed over to the logistics partner:\n\n`;
  msg += `• 🚚 *Transporter:* ${input.transporter}\n`;
  msg += `• 📄 *LR / Bilty Number:* *${input.lrNumber}*\n`;
  msg += `• 📦 *Total Parcels:* ${parcels}\n`;
  msg += `• 📅 *Dispatch Date:* ${dispatchDate}\n`;
  msg += `• ⏳ *Expected Arrival:* ${expectedDate}\n`;
  msg += `• 📍 *Destination:* ${lead.city || 'Your Location'}\n\n`;
  msg += `Please keep LR #${input.lrNumber} handy to receive your consignment at your local transporter hub or doorstep delivery.\n\n`;
  msg += `If you need any logistics assistance or consignment tracking help, simply reply to this WhatsApp chat!`;

  const waRes = await sendWhatsAppMessage(targetPhone, msg);
  if (waRes && waRes.isNotWhatsApp) {
    db.prepare(`UPDATE leads SET whatsapp_status = 'NO_WHATSAPP', human_takeover = 1 WHERE id = ?`).run(lead.id);
  }

  logLeadActivity(
    lead.id,
    'SHIPMENT_DISPATCHED',
    `Dispatched via ${input.transporter} | LR/Bilty #${input.lrNumber} | Parcels: ${parcels}. Notification sent to WhatsApp.`,
    input.performedBy || 'ADMIN'
  );

  return db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id);
}

// ── Get All Leads With Missing WhatsApp Number (Owner Alert Desk) ─────────────
export function getNoWhatsAppAlerts() {
  return db.prepare(`
    SELECT l.*, w.brand_name 
    FROM leads l 
    LEFT JOIN websites w ON l.website_id = w.id 
    WHERE l.whatsapp_status = 'NO_WHATSAPP' 
    ORDER BY l.updated_at DESC
  `).all();
}

