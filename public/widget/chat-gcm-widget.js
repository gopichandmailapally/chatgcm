/**
 * Chat GCM - Omnichannel Embeddable Website Widget
 * Usage: <script src="https://chatgcm.in/widget/chat-gcm-widget.js" data-website-id="gcmsafetynets" data-position="left" async></script>
 */

(function() {
  // Prevent duplicate initialization
  if (window.__gcm_chat_widget_loaded) return;
  window.__gcm_chat_widget_loaded = true;

  // Determine API base & attributes from script tag
  const currentScript = document.currentScript || (function() {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.includes("chat-gcm-widget.js")) return scripts[i];
    }
    return scripts[scripts.length - 1];
  })();

  const websiteId = currentScript?.getAttribute("data-website-id") || "gcm-enterprises";
  const position = currentScript?.getAttribute("data-position") || "left";
  const isLeft = position === "left";
  const apiBase = currentScript?.getAttribute("data-api-url") || "https://chatgcm.in";

  // Multi-tenant configuration
  const TENANTS = {
    "gcmsafetynets": {
      name: "GCM Safety Nets AI",
      badge: "Safety & Pigeon Nets",
      welcome: "👋 Hello! I am the <strong>GCM Safety Nets AI Assistant</strong>.<br><br>I can provide instant square foot estimates for balcony safety nets, pigeon protection nets, or invisible grills.",
      chips: [
        { label: "🏢 Balcony Net 15 x 6", prompt: "balcony net 15 x 6" },
        { label: "🕊️ Pigeon Net Estimate", prompt: "pigeon protection net for balcony" },
        { label: "✨ Invisible Grills Price", prompt: "316-L invisible grills price per sft" },
        { label: "📅 Book Free Site Visit", prompt: "I want to book a free doorstep inspection" }
      ]
    },
    "netsocean": {
      name: "NetsOcean AI Brain",
      badge: "Cricket Ground BOQ",
      welcome: "👋 Hello! I am the <strong>NetsOcean AI Sales Brain</strong>.<br><br>I calculate exact netting SFT with 8% roof camber allowance, turnkey box cricket BOQ, or wholesale rate tiers.",
      chips: [
        { label: "🏏 100 x 50 x 25 Box Cricket", prompt: "100 x 50 x 25 cricket net" },
        { label: "🏗️ Turnkey Box Setup", prompt: "turnkey box cricket setup 100x50" },
        { label: "📐 Pitch Net 60 x 12 x 10", prompt: "cricket pitch net 60 x 12 x 10" },
        { label: "📦 2.5mm RUSSEA Rate", prompt: "2.5mm 40mm net stock and price" }
      ]
    },
    "gcminvisiblegrills": {
      name: "GCM Invisible Grills AI",
      badge: "316-L SS Grills",
      welcome: "👋 Hello! I am the <strong>GCM Invisible Grills AI</strong>.<br><br>Get instant pricing for AISI 316 marine-grade stainless steel invisible grills, balcony safety, and window installations.",
      chips: [
        { label: "✨ 316-L SS Rate/SFT", prompt: "invisible grill price per sft" },
        { label: "🏢 Balcony 12 x 5 Estimate", prompt: "balcony invisible grill 12 x 5" },
        { label: "🛡️ Child Safety Specs", prompt: "tell me about invisible grill tensile strength and warranty" },
        { label: "📅 Free Site Measurement", prompt: "book free site measurement for invisible grills" }
      ]
    },
    "russea": {
      name: "RUSSEA™ Netting AI",
      badge: "Technical Textiles",
      welcome: "👋 Welcome to <strong>RUSSEA™ Technical Netting</strong>.<br><br>Inquire about factory-direct 100% Virgin HDPE braided nets, BCCI-spec sports netting, and bulk wholesale pricing.",
      chips: [
        { label: "🧵 2.5mm Braided Net Rate", prompt: "2.5mm braided net wholesale rate" },
        { label: "🏏 BCCI Pitch Specs", prompt: "BCCI specification practice nets" },
        { label: "🚜 Agriculture Shade Nets", prompt: "agriculture and shade nets pricing" },
        { label: "📑 Wholesale Catalog", prompt: "send wholesale product catalog" }
      ]
    },
    "gcm-enterprises": {
      name: "Chat GCM Sales Brain",
      badge: "Turnkey BOQ & ERP",
      welcome: "👋 Hello! I am the <strong>GCM AI Sales Brain</strong>.<br><br>I can calculate exact SFT for cricket pitches, generate turnkey ground estimates, or check approved factory rates with zero wait time.",
      chips: [
        { label: "🏏 100 x 50 Cricket Net", prompt: "100 x 50 x 25 cricket net" },
        { label: "🏗️ Turnkey Box Cricket", prompt: "turnkey box cricket setup 100x50" },
        { label: "🏢 Balcony Safety Net", prompt: "balcony net 15 x 6" },
        { label: "📦 Stock & Price", prompt: "2.5mm 40mm net stock" }
      ]
    }
  };

  const currentTenant = TENANTS[websiteId] || TENANTS["gcm-enterprises"];

  // Generate or restore session ID
  let sessionId = localStorage.getItem("gcm_chat_session_" + websiteId);
  if (!sessionId) {
    sessionId = "SESS-" + Math.random().toString(36).substring(2, 9).toUpperCase();
    localStorage.setItem("gcm_chat_session_" + websiteId, sessionId);
  }

  // Inject Styles
  const style = document.createElement("style");
  style.id = "chat-gcm-styles";
  style.textContent = `
    .gcm-widget-btn {
      position: fixed;
      bottom: 24px;
      ${isLeft ? "left: 24px;" : "right: 24px;"}
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #1e3a8a, #2563eb);
      box-shadow: 0 8px 25px rgba(37, 99, 235, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 999999;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2.5px solid rgba(255, 255, 255, 0.35);
    }
    .gcm-widget-btn:hover {
      transform: scale(1.08) translateY(-3px);
      box-shadow: 0 12px 32px rgba(37, 99, 235, 0.6);
    }
    .gcm-widget-btn svg {
      width: 32px;
      height: 32px;
      fill: #ffffff;
    }
    .gcm-widget-pulse {
      position: absolute;
      top: -2px;
      ${isLeft ? "right: -2px;" : "left: -2px;"}
      width: 14px;
      height: 14px;
      background: #10b981;
      border: 2px solid white;
      border-radius: 50%;
      animation: gcmPulse 2s infinite;
    }
    @keyframes gcmPulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    /* Modal Container */
    .gcm-chat-modal {
      position: fixed;
      bottom: 96px;
      ${isLeft ? "left: 24px;" : "right: 24px;"}
      width: 390px;
      height: 600px;
      max-height: calc(100vh - 120px);
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(0,0,0,0.08);
      display: none;
      flex-direction: column;
      z-index: 999999;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      animation: gcmSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes gcmSlideUp {
      from { opacity: 0; transform: translateY(18px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    .gcm-chat-header {
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: white;
      padding: 16px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .gcm-header-info h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.2px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .gcm-header-status {
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 4px;
    }
    .gcm-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
    }
    .gcm-close-btn {
      background: rgba(255, 255, 255, 0.12);
      border: none;
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      transition: background 0.2s;
    }
    .gcm-close-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* Messages Body */
    .gcm-chat-body {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .gcm-msg {
      max-width: 88%;
      padding: 11px 15px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    .gcm-msg.assistant {
      align-self: flex-start;
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 2px 6px rgba(0,0,0,0.04), 0 0 0 1px #e2e8f0;
      border-bottom-left-radius: 4px;
    }
    .gcm-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      border-bottom-right-radius: 4px;
    }

    /* Quick Chips */
    .gcm-quick-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 10px;
    }
    .gcm-chip {
      background: #eef2ff;
      color: #3730a3;
      font-size: 11.5px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 16px;
      cursor: pointer;
      border: 1px solid #c7d2fe;
      transition: all 0.2s;
    }
    .gcm-chip:hover {
      background: #e0e7ff;
      border-color: #818cf8;
      transform: translateY(-1px);
    }

    /* Interactive Cards */
    .gcm-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 12px 14px;
      margin-top: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.04);
    }
    .gcm-card-title {
      font-weight: 700;
      font-size: 13px;
      color: #0f172a;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 6px;
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }
    .gcm-card-row {
      display: flex;
      justify-content: space-between;
      font-size: 12.5px;
      margin-bottom: 5px;
      color: #475569;
    }
    .gcm-card-row.bold {
      font-weight: 700;
      color: #0f172a;
      border-top: 1px dashed #cbd5e1;
      padding-top: 6px;
      margin-top: 6px;
    }
    .gcm-card-badge {
      display: inline-block;
      padding: 2px 7px;
      font-size: 10.5px;
      font-weight: 700;
      border-radius: 6px;
      background: #dcfce7;
      color: #166534;
    }

    /* Footer Input */
    .gcm-chat-footer {
      padding: 10px 12px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .gcm-chat-input {
      flex: 1;
      border: 1.5px solid #cbd5e1;
      border-radius: 22px;
      padding: 9px 15px;
      font-size: 13.5px;
      outline: none;
      transition: border-color 0.2s;
    }
    .gcm-chat-input:focus {
      border-color: #2563eb;
    }
    .gcm-send-btn {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #2563eb;
      border: none;
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .gcm-send-btn:hover {
      background: #1d4ed8;
    }

    /* Mobile adjustments */
    @media (max-width: 480px) {
      .gcm-widget-btn {
        bottom: 20px;
        ${isLeft ? "left: 16px;" : "right: 16px;"}
        width: 56px;
        height: 56px;
      }
      .gcm-chat-modal {
        width: calc(100vw - 32px);
        left: 16px !important;
        right: 16px !important;
        bottom: 84px;
        height: 76vh;
      }
    }
  `;
  document.head.appendChild(style);

  // Inject Widget DOM
  const container = document.createElement("div");
  container.id = "chat-gcm-container";

  // Build Quick Chips HTML
  const chipsHtml = currentTenant.chips.map(c => 
    `<button type="button" class="gcm-chip" onclick="window.gcmSendChip('${c.prompt.replace(/'/g, "\\'")}')">${c.label}</button>`
  ).join("");

  container.innerHTML = `
    <!-- Launcher -->
    <div class="gcm-widget-btn" id="gcm-toggle-btn" title="Chat with ${currentTenant.name}">
      <span class="gcm-widget-pulse"></span>
      <svg viewBox="0 0 24 24">
        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5z"/>
      </svg>
    </div>

    <!-- Modal -->
    <div class="gcm-chat-modal" id="gcm-modal">
      <div class="gcm-chat-header">
        <div class="gcm-header-info">
          <h4>🤖 ${currentTenant.name} <span style="font-size:10px;background:#2563eb;padding:2px 6px;border-radius:4px;font-weight:600;">${currentTenant.badge}</span></h4>
          <div class="gcm-header-status">
            <span class="gcm-status-dot"></span> Online • Instant Calculation & Quotes
          </div>
        </div>
        <button type="button" class="gcm-close-btn" id="gcm-close-modal" aria-label="Close">&times;</button>
      </div>

      <div class="gcm-chat-body" id="gcm-chat-messages">
        <!-- Initial Message -->
        <div class="gcm-msg assistant">
          ${currentTenant.welcome}
          <div class="gcm-quick-chips">
            ${chipsHtml}
          </div>
        </div>
      </div>

      <form class="gcm-chat-footer" id="gcm-chat-form">
        <input type="text" class="gcm-chat-input" id="gcm-input" placeholder="Type dimensions, ask price, or get quote..." autocomplete="off">
        <button type="submit" class="gcm-send-btn" aria-label="Send">
          <svg viewBox="0 0 24 24" style="width:17px;height:17px;fill:white;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(container);

  // Widget Logic
  const toggleBtn = document.getElementById("gcm-toggle-btn");
  const modal = document.getElementById("gcm-modal");
  const closeBtn = document.getElementById("gcm-close-modal");
  const form = document.getElementById("gcm-chat-form");
  const input = document.getElementById("gcm-input");
  const messagesContainer = document.getElementById("gcm-chat-messages");

  toggleBtn.addEventListener("click", () => {
    const isHidden = modal.style.display === "none" || !modal.style.display;
    modal.style.display = isHidden ? "flex" : "none";
    if (isHidden) {
      setTimeout(() => input.focus(), 100);
    }
  });

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  window.gcmSendChip = function(text) {
    if (input) {
      input.value = text;
      form.dispatchEvent(new Event("submit"));
    }
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    // Append User Message
    appendMessage("user", message);
    input.value = "";

    // Add Typing Indicator
    const typingElem = document.createElement("div");
    typingElem.className = "gcm-msg assistant";
    typingElem.id = "gcm-typing";
    typingElem.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;">🤖 Computing approved rates...</span>';
    messagesContainer.appendChild(typingElem);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      const res = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteId,
          sessionId,
          message
        })
      });

      const data = await res.json();
      const typing = document.getElementById("gcm-typing");
      if (typing) typing.remove();

      if (data.success) {
        appendMessage("assistant", data.reply, data.cardType, data.cardData);
      } else {
        appendMessage("assistant", "⚠️ " + (data.error || "Unable to compute quote. Please try again."));
      }
    } catch (err) {
      const typing = document.getElementById("gcm-typing");
      if (typing) typing.remove();
      appendMessage("assistant", "⚠️ Network connection error. Please verify the Chat GCM API is active.");
    }
  });

  function appendMessage(role, text, cardType, cardData) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `gcm-msg ${role}`;

    // Convert markdown to HTML formatting
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:#2563eb;text-decoration:underline;font-weight:600;">$1</a>')
      .replace(/\n/g, "<br>");

    msgDiv.innerHTML = formatted;

    // Render Cards if present
    if (cardType === "calculation" && cardData) {
      const card = document.createElement("div");
      card.className = "gcm-card";
      card.innerHTML = `
        <div class="gcm-card-title">
          <span>📐 Court Calculation</span>
          <span class="gcm-card-badge">Verified Math</span>
        </div>
        <div class="gcm-card-row"><span>Side Netting:</span> <strong>${cardData.sideNettingSft ? cardData.sideNettingSft.toLocaleString() : 0} SFT</strong></div>
        <div class="gcm-card-row"><span>Roof Netting (8% Camber):</span> <strong>${cardData.roofNettingSft ? cardData.roofNettingSft.toLocaleString() : 0} SFT</strong></div>
        <div class="gcm-card-row"><span>Tension Wire Rope:</span> <strong>${cardData.borderWireRft || 0} RFT</strong></div>
        <div class="gcm-card-row bold"><span>Total Net Required:</span> <span>${cardData.totalNettingSft ? cardData.totalNettingSft.toLocaleString() : 0} SFT</span></div>
      `;
      msgDiv.appendChild(card);
    } else if (cardType === "turnkey_boq" && cardData) {
      const card = document.createElement("div");
      card.className = "gcm-card";
      card.innerHTML = `
        <div class="gcm-card-title">
          <span>🏗️ Turnkey Box Cricket BOQ</span>
          <span class="gcm-card-badge">Engineered BOQ</span>
        </div>
        <div class="gcm-card-row"><span>Ground Footprint:</span> <strong>${cardData.courtDimensions ? cardData.courtDimensions.groundAreaSft.toLocaleString() : 0} SFT</strong></div>
        <div class="gcm-card-row"><span>Total Netting:</span> <strong>${cardData.netting ? cardData.netting.totalNetSft.toLocaleString() : 0} SFT</strong></div>
        <div class="gcm-card-row"><span>Structural Steel:</span> <strong>${cardData.structuralSteel ? cardData.structuralSteel.columnCount : 0} Ladder Columns</strong></div>
        <div class="gcm-card-row"><span>Multi-Sport Turf:</span> <strong>${cardData.turfSystem ? cardData.turfSystem.rollsRequired : 0} Rolls (25mm)</strong></div>
        <div class="gcm-card-row"><span>Floodlights:</span> <strong>${cardData.lightingSystem ? cardData.lightingSystem.fixtureCount : 0} Units (200W)</strong></div>
        <div class="gcm-card-row bold"><span>Budget Estimate:</span> <span style="color:#2563eb;">₹${cardData.estimatedTotalProjectCost ? cardData.estimatedTotalProjectCost.toLocaleString("en-IN") : 0}</span></div>
      `;
      msgDiv.appendChild(card);
    } else if (cardType === "quotation" && cardData && cardData.financials) {
      const card = document.createElement("div");
      card.className = "gcm-card";
      const docLabel = cardData.officialDocId || cardData.quoteNumber || "QUOTE";
      card.innerHTML = `
        <div class="gcm-card-title">
          <span>📋 Quote #${docLabel}</span>
          <span class="gcm-card-badge">GCM ERP Registered</span>
        </div>
        <div class="gcm-card-row"><span>Subtotal:</span> <span>₹${cardData.financials.subtotal.toLocaleString("en-IN")}</span></div>
        <div class="gcm-card-row"><span>Discount:</span> <span style="color:#16a34a;">-₹${cardData.financials.discountAmount.toLocaleString("en-IN")}</span></div>
        <div class="gcm-card-row"><span>GST (18%):</span> <span>₹${cardData.financials.gstAmount.toLocaleString("en-IN")}</span></div>
        <div class="gcm-card-row bold"><span>Grand Total:</span> <span style="color:#2563eb;">₹${cardData.financials.grandTotal.toLocaleString("en-IN")}</span></div>
        ${cardData.officialViewUrl ? `<div style="margin-top:8px;text-align:center;"><a href="${cardData.officialViewUrl}" target="_blank" style="display:inline-block;background:#2563eb;color:white;padding:5px 12px;border-radius:6px;font-size:11.5px;text-decoration:none;font-weight:600;">📄 View Official Stamped Quote</a></div>` : ""}
      `;
      msgDiv.appendChild(card);
    }

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
})();
