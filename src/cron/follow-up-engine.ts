/**
 * Autonomous WhatsApp Follow-Up Engine
 * Re-engages leads at calibrated intervals (2h, 24h) to maximize conversion without manual effort.
 */

import { db } from '../db/database.js';
import { sendWhatsAppMessage, isWhatsAppConfigured } from '../whatsapp/whatsapp-client.js';

export function startFollowUpScheduler(intervalMinutes: number = 15): void {
  console.log(`⏱️ [Follow-Up Engine] Scheduled to run every ${intervalMinutes} minutes.`);

  // Run initial check after 10 seconds
  setTimeout(runFollowUpCycle, 10000);

  // Then interval recurring
  setInterval(runFollowUpCycle, intervalMinutes * 60 * 1000);
}

export async function runFollowUpCycle(): Promise<void> {
  if (!isWhatsAppConfigured()) {
    return; // Silent wait until WhatsApp credentials are provided
  }

  try {
    // Find active leads in NEW or QUOTATION_SENT stage
    const activeLeads = db.prepare(`
      SELECT * FROM leads 
      WHERE stage IN ('NEW', 'QUOTATION_SENT')
        AND phone IS NOT NULL
        AND phone != ''
      ORDER BY created_at DESC
      LIMIT 20
    `).all() as any[];

    const now = Date.now();

    for (const lead of activeLeads) {
      const createdAt = new Date(lead.created_at).getTime();
      const ageHours = (now - createdAt) / (1000 * 60 * 60);
      const notes = lead.notes || '';

      const targetPhone = lead.whatsapp_number || lead.phone;
      if (!targetPhone) continue;

      // ── Step 1 Follow-Up: 2 to 6 hours after inquiry ───────────────────
      if (ageHours >= 2 && ageHours <= 8 && !notes.includes('[FOLLOW_UP_1]')) {
        const msg = `Hi ${lead.customer_name || 'there'}! 👋 

This is the **GCM Sales Brain**. Did you get a chance to review the details and quote for your requirement (*${lead.requirement_summary || 'Netting Solution'}*)?

Let me know if you would like me to adjust dimensions, apply volume discounts, or answer any technical questions!`;

        console.log(`📨 [Auto Follow-Up 1] Sending to ${targetPhone}...`);
        const res = await sendWhatsAppMessage(targetPhone, msg);
        if (res.success) {
          const updatedNotes = `${notes}\n[FOLLOW_UP_1] Sent at ${new Date().toISOString()}`;
          db.prepare('UPDATE leads SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(updatedNotes, lead.id);
        }
      }

      // ── Step 2 Follow-Up: 24 to 36 hours after inquiry ─────────────────
      else if (ageHours >= 24 && ageHours <= 48 && notes.includes('[FOLLOW_UP_1]') && !notes.includes('[FOLLOW_UP_2]')) {
        const msg = `Good morning ${lead.customer_name || 'Sir'}! 🏏

Our Hyderabad warehouse currently has approved ready stock for immediate dispatch. If your order is confirmed today, our dispatch team can pack and ship it by 4 PM!

Would you like to finalize this today?`;

        console.log(`📨 [Auto Follow-Up 2] Sending to ${targetPhone}...`);
        const res = await sendWhatsAppMessage(targetPhone, msg);
        if (res.success) {
          const updatedNotes = `${notes}\n[FOLLOW_UP_2] Sent at ${new Date().toISOString()}`;
          db.prepare('UPDATE leads SET notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(updatedNotes, lead.id);
        }
      }
    }

    // ── Step 3 Logistics Delivery Follow-Up: 48 hours after dispatch ─────────
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
        const msg = `Namaste ${lead.customer_name || 'Sir'}! 🙏\n\nThis is GCM Enterprises Logistics Desk following up on your netting shipment sent via *${lead.dispatch_transporter || 'Transporter'}* (LR / Bilty #${lead.lr_number || ''}).\n\nHave you received your parcels safely? Please let us know if everything arrived in perfect condition or if you need installation guidance!`;

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
