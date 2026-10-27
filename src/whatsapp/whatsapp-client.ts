/**
 * Meta WhatsApp Cloud API Client
 * Handles bidirectional messaging, interactive buttons, document sending, and read receipts.
 */

export interface WhatsAppButton {
  id: string;
  title: string;
}

export function isWhatsAppConfigured(): boolean {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return Boolean(token && phoneId && token !== 'YOUR_META_ACCESS_TOKEN' && phoneId !== 'YOUR_PHONE_NUMBER_ID');
}

/**
 * Format phone number to international format without + or spaces (e.g. 919912399224)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/\D/g, '');
  // Strip leading international prefix 00 or single 0
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  // Standard 10-digit Indian mobile starting with 6, 7, 8, or 9
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    cleaned = '91' + cleaned;
  }
  return cleaned;
}

function detectNoWhatsApp(data: any): boolean {
  if (!data) return false;
  const str = JSON.stringify(data).toLowerCase();
  const code = data?.error?.code || data?.error?.error_subcode;
  if (code === 131026 || code === 131005) return true;
  if (
    str.includes('not a valid whatsapp') ||
    str.includes('undeliverable') ||
    str.includes('recipient phone number not in allowed list')
  ) {
    return true;
  }
  return false;
}

/**
 * Send a plain text or markdown message to a customer via WhatsApp Cloud API
 */
export async function sendWhatsAppMessage(toPhone: string, message: string): Promise<any> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.warn('[WhatsApp] Credentials missing. Message not sent. Destination:', toPhone);
    return { success: false, reason: 'WHATSAPP_NOT_CONFIGURED' };
  }

  const recipient = formatPhoneNumber(toPhone);
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

  // Meta Cloud API v21.0 requirement: preview_url must ONLY be true if body contains a valid HTTP/HTTPS URL
  const hasValidUrl = /https?:\/\/[^\s]+/.test(message);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'text',
    text: {
      preview_url: hasValidUrl,
      body: message
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[WhatsApp API Error]', data);
      const isNotWhatsApp = detectNoWhatsApp(data);
      return { success: false, error: data, isNotWhatsApp };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[WhatsApp Network Error]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send an interactive quick-reply button message
 */
export async function sendWhatsAppInteractiveButtons(
  toPhone: string,
  bodyText: string,
  buttons: WhatsAppButton[],
  headerText?: string
): Promise<any> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) return { success: false, reason: 'WHATSAPP_NOT_CONFIGURED' };

  const recipient = formatPhoneNumber(toPhone);
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

  // Maximum 3 reply buttons allowed by Meta WhatsApp API
  const formattedButtons = buttons.slice(0, 3).map((btn) => ({
    type: 'reply',
    reply: {
      id: btn.id,
      title: btn.title.substring(0, 20) // max 20 chars
    }
  }));

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: { buttons: formattedButtons }
    }
  };

  if (headerText) {
    payload.interactive.header = {
      type: 'text',
      text: headerText.substring(0, 60)
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[WhatsApp Interactive Error]', data);
      const isNotWhatsApp = detectNoWhatsApp(data);
      return { success: false, error: data, isNotWhatsApp };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error('[WhatsApp Interactive Error]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Send an official PDF document directly into WhatsApp chat
 */
export async function sendWhatsAppDocument(
  toPhone: string,
  pdfUrl: string,
  filename: string,
  caption?: string
): Promise<any> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) return { success: false, reason: 'WHATSAPP_NOT_CONFIGURED' };

  const recipient = formatPhoneNumber(toPhone);
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'document',
    document: {
      link: pdfUrl,
      filename: filename,
      caption: caption || 'Here is your official quotation from GCM Enterprises.'
    }
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[WhatsApp Document Error]', data);
      const isNotWhatsApp = detectNoWhatsApp(data);
      return { success: false, error: data, isNotWhatsApp };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error('[WhatsApp Document Error]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Mark message as read
 */
export async function markWhatsAppAsRead(messageId: string): Promise<void> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;

  try {
    await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    });
  } catch {
    // Ignore read receipt errors
  }
}

/**
 * Send an approved Meta WhatsApp HSM Template message (for 24-hour window re-engagement or broadcasts)
 */
export async function sendWhatsAppTemplate(
  toPhone: string,
  templateName: string,
  languageCode: string = 'en',
  components: any[] = []
): Promise<any> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) return { success: false, reason: 'WHATSAPP_NOT_CONFIGURED' };

  const recipient = formatPhoneNumber(toPhone);
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;

  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      }
    }
  };

  if (components && components.length > 0) {
    payload.template.components = components;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[WhatsApp Template Error]', data);
      const isNotWhatsApp = detectNoWhatsApp(data);
      return { success: false, error: data, isNotWhatsApp };
    }
    return { success: true, data };
  } catch (err: any) {
    console.error('[WhatsApp Template Error]', err);
    return { success: false, error: err.message };
  }
}

