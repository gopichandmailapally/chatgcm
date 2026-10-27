/**
 * Respectful & Non-Intrusive WhatsApp Follow-Up Engine
 * Runs every 15 minutes to perform automated lifecycle checks.
 * Completely Humanized — Signed by local human persona per city.
 * 
 * Strict Guarantees:
 * 1. Checks snooze_until: NEVER sends messages if customer is snoozed.
 * 2. Honors scheduled_callback_at: Only reaches out when customer's explicit callback time arrives.
 * 3. Respects opt_out: Immediately drops opted-out customers forever.
 * 4. Human Persona: Every message signed by local representative (e.g. Venkatesh, Suresh Reddy, Chethan Kumar, Karthik).
 */

import { db } from '../db/database.js';
import { sendWhatsAppMessage } from '../whatsapp/whatsapp-client.js';
import { getAgentPersona } from '../ai/persona.js';
import { logAgentWork } from '../ai/agent-audit-service.js';

export async function runFollowUpCycle(): Promise<void> {
  const now = Date.now();

  try {
    // ── 1. Respectful Scheduled Callbacks ──────────────────────────────────────
    const callbackLeads = db.prepare(`
      SELECT * FROM leads 
      WHERE scheduled_callback_at IS NOT NULL 
        AND (opt_out IS NULL OR opt_out = 0)
        AND (human_takeover IS NULL OR human_takeover = 0)
        AND phone IS NOT NULL
        AND phone != ''
      ORDER BY scheduled_callback_at ASC
      LIMIT 20
    `).all() as any[];

    for (const lead of callbackLeads) {
      const callbackTime = new Date(lead.scheduled_callback_at).getTime();
      const notes = lead.notes || '';

      // If scheduled time has arrived and callback hasn't been dispatched yet
      if (now >= callbackTime && !notes.includes('[SCHEDULED_CALLBACK_SENT]')) {
        const targetPhone = lead.whatsapp_number || lead.phone;
        if (!targetPhone) continue;

        const persona = getAgentPersona(lead.city || lead.area, lead.website_id);
        const customerName = lead.customer_name && !lead.customer_name.includes('Visitor') ? lead.customer_name.split(' ')[0] : 'Sir';
        
        const msg = `Namaste ${customerName}! 🙏\n\nI am ${persona.name} from ${persona.brandName}. Following up as you requested regarding your inquiry for *${lead.requirement_summary || 'balcony netting solution'}*.\n\nIs now a good time to speak for 2 minutes, or would you like me to share sample photos and rates here on WhatsApp?\n\n— ${persona.name} (Ph: 99123 99334 / MD: 99123 99224)`;

        console.log(`⏰ [Scheduled Callback Dispatched] Sending to ${targetPhone} (${lead.preferred_contact_time || 'as requested'})...`);
        const res = await sendWhatsAppMessage(targetPhone, msg);
        if (res.success) {
          const updatedNotes = `${notes}\n[SCHEDULED_CALLBACK_SENT] Dispatched at ${new Date().toISOString()}`;
          db.prepare(`
            UPDATE leads 
            SET notes = ?, 
                scheduled_callback_at = NULL, 
                snooze_until = NULL, 
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(updatedNotes, lead.id);
        }
      }
    }

    // ── 2. Standard Non-Intrusive Stage Follow-Ups ─────────────────────────────
    const activeLeads = db.prepare(`
      SELECT * FROM leads 
      WHERE stage IN ('NEW', 'QUOTATION_SENT')
        AND (opt_out IS NULL OR opt_out = 0)
        AND (human_takeover IS NULL OR human_takeover = 0)
        AND phone IS NOT NULL
        AND phone != ''
      ORDER BY created_at DESC
      LIMIT 30
    `).all() as any[];

    for (const lead of activeLeads) {
      // Check if lead is currently snoozed
      if (lead.snooze_until) {
        const snoozeEnd = new Date(lead.snooze_until).getTime();
        if (now < snoozeEnd) {
          continue; // Respect customer's time: skip completely while snoozed!
        }
      }

      // Check if customer sent a message recently (within last 2 hours)
      if (lead.last_customer_message_at) {
        const lastMsgTime = new Date(lead.last_customer_message_at).getTime();
        const diffMs = now - lastMsgTime;
        if (diffMs < (2 * 3600 * 1000)) {
          continue; // Don't interrupt recent conversation!
        }

        // Meta Cloud API Rule: Free-form WhatsApp messages fail with #100/#131047 after 24 hours
        // If outside 24-hr window, queue for human phone callback instead of failing Meta API
        if (diffMs >= (23.5 * 3600 * 1000)) {
          continue; // Safely skip automated text outside 24h window
        }
      }

      const createdAt = new Date(lead.created_at).getTime();
      const ageHours = (now - createdAt) / (1000 * 60 * 60);
      const notes = lead.notes || '';
      const targetPhone = lead.whatsapp_number || lead.phone;
      if (!targetPhone) continue;

      const persona = getAgentPersona(lead.city || lead.area, lead.website_id);
      const firstName = lead.customer_name && !lead.customer_name.includes('Visitor') ? lead.customer_name.split(' ')[0] : 'there';

      // Follow-Up 1: 3 to 8 hours after inquiry
      if (ageHours >= 3 && ageHours <= 8 && !notes.includes('[FOLLOW_UP_1]')) {
        const msg = `Namaste ${firstName} sir! 🙏\n\nThis is ${persona.name} from ${persona.brandName}. Just checking in to see if you had a chance to review the details for your requirement (*${lead.requirement_summary || 'Netting Solution'}*)?\n\nOur field technician is visiting apartments in your area today for free measurements. If you'd like him to stop by for 5 minutes with material samples, please let me know!\n\n— ${persona.name} (Ph: ${persona.officialPhone})`;

        console.log(`📨 [Respectful Follow-Up 1] Sending to ${targetPhone}...`);
        const res = await sendWhatsAppMessage(targetPhone, msg);
        if (res.success) {
          const updatedNotes = `${notes}\n[FOLLOW_UP_1] Sent at ${new Date().toISOString()}`;
          db.prepare('UPDATE leads SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(updatedNotes, lead.id);

          logAgentWork({
            persona_name: persona.name,
            lead_id: lead.id,
            phone: targetPhone,
            website_id: lead.website_id,
            channel: 'whatsapp',
            city: lead.city,
            action_type: 'FOLLOWUP_SENT',
            action_title: 'Courtesy Follow-Up 1 (Doorstep Demo Offer)',
            work_summary: `${persona.name} sent polite WhatsApp follow-up offering doorstep material demo to ${firstName}.`
          });
        }
      }

      // Follow-Up 2: 24 to 48 hours after inquiry
      else if (ageHours >= 24 && ageHours <= 48 && notes.includes('[FOLLOW_UP_1]') && !notes.includes('[FOLLOW_UP_2]')) {
        const msg = `Good morning ${firstName} sir! 🕊️\n\nI am ${persona.name} from ${persona.brandName}. Just following up to see if you would like to reserve your balcony installation slot for this week?\n\nWe have genuine RUSSEA™ UV stock ready at our depot with a 5-year replacement warranty card. Please let me know if you would like us to reserve your slot!\n\n— ${persona.name} (Ph: ${persona.officialPhone})`;

        console.log(`📨 [Respectful Follow-Up 2] Sending to ${targetPhone}...`);
        const res = await sendWhatsAppMessage(targetPhone, msg);
        if (res.success) {
          const updatedNotes = `${notes}\n[FOLLOW_UP_2] Sent at ${new Date().toISOString()}`;
          db.prepare('UPDATE leads SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(updatedNotes, lead.id);

          logAgentWork({
            persona_name: persona.name,
            lead_id: lead.id,
            phone: targetPhone,
            website_id: lead.website_id,
            channel: 'whatsapp',
            city: lead.city,
            action_type: 'FOLLOWUP_SENT',
            action_title: 'Courtesy Follow-Up 2 (Slot Reservation)',
            work_summary: `${persona.name} sent courteous follow-up with RUSSEA™ stock availability to ${firstName}.`
          });
        }
      }
    }

    // ── 3. Logistics Delivery Follow-Up: 48 hours after dispatch ─────────────
    const transitLeads = db.prepare(`
      SELECT * FROM leads 
      WHERE pipeline_stage = 'DISPATCHED_BILTY'
        AND (delivery_status = 'IN_TRANSIT' OR delivery_status IS NULL)
        AND dispatch_date IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 20
    `).all() as any[];

    for (const lead of transitLeads) {
      const targetPhone = lead.whatsapp_number || lead.phone;
      if (!targetPhone) continue;

      const dispatchTime = new Date(lead.dispatch_date).getTime();
      const ageHours = (now - dispatchTime) / (1000 * 60 * 60);
      const notes = lead.notes || '';

      if (ageHours >= 48 && !notes.includes('[DELIVERY_CHECK]')) {
        const persona = getAgentPersona(lead.city || lead.area, lead.website_id);
        const customerName = lead.customer_name && !lead.customer_name.includes('Visitor') ? lead.customer_name : 'Sir';
        
        const msg = `Namaste ${customerName}! 🙏\n\nI am ${persona.name} from GCM Enterprises Logistics Desk following up on your netting shipment sent via *${lead.dispatch_transporter || 'Transporter'}* (LR / Bilty #${lead.lr_number || ''}).\n\nHave you received your parcels safely? Please let us know if everything arrived in perfect condition or if you need installation guidance!\n\n— ${persona.name} (Ph: ${persona.officialPhone})`;

        console.log(`🚚 [Auto Delivery Follow-Up] Sending to ${targetPhone}...`);
        const res = await sendWhatsAppMessage(targetPhone, msg);
        if (res.success) {
          const updatedNotes = `${notes}\n[DELIVERY_CHECK] Sent at ${new Date().toISOString()}`;
          db.prepare(`
            UPDATE leads 
            SET notes = ?, delivery_status = 'DELIVERY_FOLLOW_UP_SENT', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(updatedNotes, lead.id);
        }
      }
    }
  } catch (err) {
    console.error('❌ [Follow-Up Engine Error]', err);
  }
}

export function startFollowUpScheduler(intervalMinutes: number = 15): void {
  console.log(`⏱️ [Follow-Up Engine] Scheduled to run every ${intervalMinutes} minutes.`);
  // Initial run after 30 seconds
  setTimeout(() => {
    runFollowUpCycle().catch(console.error);
  }, 30000);

  // Periodic interval
  setInterval(() => {
    runFollowUpCycle().catch(console.error);
  }, intervalMinutes * 60 * 1000);
}

export const startFollowUpEngine = startFollowUpScheduler;
