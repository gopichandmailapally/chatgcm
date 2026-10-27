/**
 * Intelligent Customer Scheduling & Respectful Availability NLP Engine
 * Parses customer time preferences, callback dates, busy signals, and opt-outs
 * across Telugu, Kannada, Tamil, Hindi, and English to ensure clients receive courteous human respect
 * without ever feeling disturbed, irritated, or spammed.
 */

import { SupportedLanguage, detectCustomerLanguage, getAgentPersona } from './persona.js';

export interface ScheduleAnalysisResult {
  hasSchedulingIntent: boolean;
  isBusy: boolean;
  isOptOut: boolean;
  snoozeHours: number;
  snoozeUntil: string | null;
  scheduledCallbackAt: string | null;
  preferredTimeSummary: string | null;
  courteousAckMessage: string | null;
}

export function analyzeCustomerSchedule(
  message: string, 
  customerName?: string, 
  city?: string, 
  websiteId?: string
): ScheduleAnalysisResult {
  const text = message.toLowerCase().trim();
  const now = new Date();
  const lang: SupportedLanguage = detectCustomerLanguage(message);
  const persona = getAgentPersona(city, websiteId);
  const name = customerName && !customerName.includes('Visitor') ? customerName.split(' ')[0] : 'Sir';

  // ── 1. Immediate Opt-Out / Stop Signals (English + Telugu + Tamil + Kannada + Hindi) ──
  const optOutPatterns = [
    /\bnot\s+interested\b/i,
    /\bstop\s*(messaging|messages|calling)?\b/i,
    /\bdon'?t\s+(message|call|contact|bother|disturb)\b/i,
    /\bdo\s+not\s+(message|call|contact)\b/i,
    /\bwrong\s+number\b/i,
    /\bunsubscribe\b/i,
    /\bno\s+need\b/i,
    /\bdelete\s+(my\s+)?(number|contact)\b/i,
    // Telugu
    /\b(vaddu|oddhu|oddu|avasaram\s*ledu|message\s*cheyoddu|call\s*cheyoddu)\b/i,
    /వద్దు|అవసరం\s*లేదు/,
    // Tamil
    /\b(vendaam|vendam|theva\s*illa|call\s*pannatheenga)\b/i,
    /வேண்டாம்/,
    // Kannada
    /\b(beda|bedve\s*beda|call\s*madbedi|bekilla)\b/i,
    /ಬೇಡ/,
    // Hindi
    /\b(nahi\s*chahiye|mat\s*karo|disturb\s*mat\s*karo|call\s*mat\s*karo)\b/i,
    /नहीं\s*चाहिए/,
    // Malayalam
    /\b(venda|vendam|aavashyilla|call\s*cheyyalle)\b/i,
    /വേണ്ട/,
    // Marathi
    /\b(nako|nakoy|garaj\s*nahi|call\s*karu\s*naka)\b/i,
    /नको|गरज\s*नाही/,
    // Gujarati
    /\b(nathi\s*joitu|call\s*na\_karo|disturb\s*na\s*karo)\b/i,
    /નથી\s*જોઈતું/,
    // Punjabi
    /\b(nahi\s*chahida|phone\s*na\s*kareyo|disturb\s*na\s*karo)\b/i,
    /ਨਹੀਂ\s*ਚਾਹੀਦਾ/,
    // Odia
    /\b(darkar\s*nahin|call\s*karantu\s*nahin)\b/i,
    /ଦରକାର\s*ନାହିଁ/
  ];

  for (const pattern of optOutPatterns) {
    if (pattern.test(text)) {
      let ack = '';
      if (lang === 'telugu') {
        ack = `ఖచ్చితంగా ${name} గారు! 🙏\n\nమీ నెంబర్ మా లిస్ట్ నుండి వెంటనే అప్డేట్ చేశాము, మీకు ఇకపై ఎలాంటి మెసేజ్ లు లేదా కాల్స్ రావు సర్. భవిష్యత్తులో మీకు లేదా మీ స్నేహితులకు ఎప్పుడైనా బాల్కనీ నెట్స్, ఇన్విజిబుల్ గ్రిల్స్ లేదా స్పోర్ట్స్ టర్ఫ్ అవసరమైతే GCM Enterprises ఎప్పుడూ మీకు సహాయం చేయడానికి సిద్ధంగా ఉంటుంది.\n\nధన్యవాదాలు, Have a great day! 🙏`;
      } else if (lang === 'tamil') {
        ack = `நிச்சயமாக ${name} சார்! 🙏\n\nஉங்க விருப்பப்படி இனிமேல் எந்த மெசேஜும் வராது சார். எதிர்காலத்தில் உங்களுக்கு சேஃப்டி நெட்ஸ் அல்லது கிரில் தேவைப்பட்டால் எப்போதும் உதவ தயாராக இருக்கிறோம்.\n\nநன்றி சார்! 🙏`;
      } else if (lang === 'kannada') {
        ack = `ಖಂಡಿತ ${name} ಸರ್! 🙏\n\nನಿಮ್ಮ ನಂಬರ್ ಅಪ್ಡೇಟ್ ಮಾಡಿದ್ದೇವೆ, ಇನ್ಮುಂದೆ ಯಾವುದೇ ಮೆಸೇಜ್ ಬರಲ್ಲ ಸರ್. ಭವಿಷ್ಯದಲ್ಲಿ ನೆಟ್ಸ್ ಅಥವಾ ಗ್ರಿಲ್ಸ್ ಬೇಕಾದಾಗ ಸಂಪರ್ಕಿಸಿ.\n\nಧನ್ಯವಾದಗಳು సర్! 🙏`;
      } else if (lang === 'hindi') {
        ack = `बिल्कुल ${name} जी! 🙏\n\nहमने आपका नंबर तुरंत अपडेट कर दिया है, आगे से आपको कोई मैसेज या कॉल नहीं आएगा। भविष्य में कभी भी सेफ्टी नेट्स या स्पोर्ट्स ग्राउंड की जरूरत हो तो ${persona.brandName} हमेशा आपकी सेवा में उपलब्ध है।\n\nआपका दिन शुभ हो! 🙏`;
      } else if (lang === 'malayalam') {
        ack = `തീർച്ചയായും ${name} സർ! 🙏\n\nഞങ്ങൾ താങ്കളുടെ നമ്പർ റെക്കോർഡിൽ നിന്ന് നീക്കം ചെയ്തിട്ടുണ്ട്, ഇനി മെസ്സേജുകൾ വരില്ല. ഭാവിയിൽ സുരക്ഷാ വലകളോ ഗ്രില്ലുകളോ ആവശ്യമുള്ളപ്പോൾ ${persona.brandName} താങ്കളെ സഹായിക്കാൻ ഉണ്ടാകും.\n\nനന്ദി സർ! 🙏`;
      } else if (lang === 'marathi') {
        ack = `नक्कीच ${name} साहेब! 🙏\n\nआम्ही तुमचा नंबर त्वरित अपडेट केला आहे, यापुढे तुम्हाला कोणताही मेसेज येणार नाही. भविष्यात कधीही सेफ्टी नेट्स किंवा अदृश्य ग्रील्सची गरज भासल्यास ${persona.brandName} नेहमी आपल्या सेवेत हजर आहे.\n\nआपला दिवस शुभ जावो! 🙏`;
      } else if (lang === 'gujarati') {
        ack = `ચોક્કસ ${name} ભાઈ! 🙏\n\nઅમે તમારો નંબર અપડેટ કરી દીધો છે, હવે પછી કોઈ મેસેજ આવશે નહીં. ભવિષ્યમાં સેફ્ટી નેટ્સ કે ઇન્વિઝિબલ ગ્રીલની જરૂર હોય ત્યારે ${persona.brandName} હંમેશા મદદ માટે તૈયાર છે.\n\nઆભાર! 🙏`;
      } else if (lang === 'punjabi') {
        ack = `ਬਿਲਕੁਲ ${name} ਜੀ! 🙏\n\nਅਸੀਂ ਤੁਹਾਡਾ ਨੰਬਰ ਅੱਪਡੇਟ ਕਰ ਦਿੱਤਾ ਹੈ, ਹੁਣ ਕੋਈ ਮੈਸੇਜ ਨਹੀਂ ਆਵੇਗਾ। ਭਵਿੱਖ ਵਿੱਚ ਸੇਫਟੀ ਨੈੱਟਾਂ ਦੀ ਲੋੜ ਪੈਣ 'ਤੇ ${persona.brandName} ਹਮੇਸ਼ਾ ਤਿਆਰ ਹੈ।\n\nਧੰਨਵਾਦ ਜੀ! 🙏`;
      } else if (lang === 'odia') {
        ack = `ନିଶ୍ଚୟ ${name} ଆଜ୍ଞା! 🙏\n\nଆମେ ଆପଣଙ୍କ ନମ୍ବର ଅପଡେଟ୍ କରିଦେଇଛୁ, ଆଉ କୌଣସି ମେସେଜ୍ ଯିବ ନାହିଁ। ଭବିଷ୍ୟତରେ ସେଫ୍ଟି ନେଟ୍ସ ଦରକାର ହେଲେ ${persona.brandName} ସର୍ବଦା ଆପଣଙ୍କ ସେବାରେ ଅଛି।\n\nଧନ୍ୟବାଦ! 🙏`;
      } else {
        ack = `Thank you for letting me know, ${name}! 🙏\n\nI have updated our records immediately and will not trouble you with further messages. If you ever need balcony safety netting, invisible grills, or sports infrastructure in the future, our team at GCM Enterprises is always here to assist.\n\nWishing you a wonderful day ahead! 🙏`;
      }

      return {
        hasSchedulingIntent: true,
        isBusy: false,
        isOptOut: true,
        snoozeHours: 87600, // 10 years (indefinite opt-out)
        snoozeUntil: new Date(now.getTime() + 87600 * 3600 * 1000).toISOString(),
        scheduledCallbackAt: null,
        preferredTimeSummary: 'Customer Opted Out (Do Not Contact)',
        courteousAckMessage: ack
      };
    }
  }

  // ── 2. Busy / Temporary Inconvenience Signals (Multilingual) ───────────────
  const busyPatterns = [
    /\b(i\s*am\s*)?(busy|in\s*a?\s*meeting|driving|traveling|travelling|at\s*work)\b/i,
    /\b(call|talk|ping|connect)\s*(me\s*)?(later|afterwards|sometime\s*later)\b/i,
    /\bnot\s+a\s+good\s+time\b/i,
    /\bcan'?t\s+talk\b/i,
    /\bbusy\s+now\b/i,
    // Telugu
    /\b(meeting\s*lo\s*unna|driving\s*lo\s*unna|busy\s*ga\s*unna|tarvata\s*call|repu\s*call|ippudu\s*kudardu)\b/i,
    /బిజీగా|మీటింగ్/,
    // Tamil
    /\b(busy\s*ah\s*irukken|meeting\s*la\s*irukken|apram\s*pesalam|naalaiku\s*pesalam)\b/i,
    // Kannada
    /\b(busy\s*iddini|meeting\s*nalli\s*iddini|aamele\s*call|naale\s*call)\b/i,
    // Hindi
    /\b(busy\s*hoon|meeting\s*me\s*hoon|baad\s*me\s*baat|kal\s*karna|abhi\s*nahi)\b/i
  ];

  let isGeneralBusy = false;
  for (const pattern of busyPatterns) {
    if (pattern.test(text)) {
      isGeneralBusy = true;
      break;
    }
  }

  // ── 3. Specific Date & Time Extraction (Multilingual) ──────────────────────
  let targetCallback: Date | null = null;
  let timeSummary: string | null = null;
  let timeSummaryTelugu: string | null = null;

  // Extract explicit hours (e.g., "4 pm", "4:30 pm", "11 am", "around 5", "5 ki", "5 baje")
  let targetHour = 11; // default to 11 AM if not specified
  let targetMinute = 0;
  const timeMatch = text.match(/(\b\d{1,2})(?::(\d{2}))?\s*(am|pm|ki|baje)?\b/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const modifier = (timeMatch[3] || '').toLowerCase();

    if (modifier === 'pm' && hour < 12) hour += 12;
    if (modifier === 'am' && hour === 12) hour = 0;

    // In Indian context, if someone says "sayantram 5" or "evening 5" or "5 ki" (between 1 and 7), default to PM
    if (modifier === 'ki' || modifier === 'baje' || !modifier) {
      if (hour >= 1 && hour <= 7) {
        hour += 12;
      }
    }

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      targetHour = hour;
      targetMinute = minute;
    }
  }

  // Specific Day / Time Patterns
  const isTomorrow = text.includes('tomorrow') || text.includes('repu') || text.includes('naalaiku') || text.includes('naale') || text.includes('kal') || /రేపు/.test(text);
  const isEvening = text.includes('evening') || text.includes('sayantram') || text.includes('shaam') || text.includes('sanje') || text.includes('maalaiku') || /సాయంత్రం/.test(text);
  const isMorning = text.includes('morning') || text.includes('podunna') || text.includes('subah') || text.includes('beligge') || text.includes('kaalai') || /ఉదయం|పొద్దున్న/.test(text);

  if (isTomorrow) {
    targetCallback = new Date(now);
    targetCallback.setDate(targetCallback.getDate() + 1);
    targetCallback.setHours(targetHour, targetMinute, 0, 0);
    timeSummary = `Tomorrow at ${formatHourString(targetHour, targetMinute)}`;
    timeSummaryTelugu = `రేపు ${formatHourStringTelugu(targetHour, targetMinute)} కి`;
  } else if (isEvening && !isTomorrow) {
    targetCallback = new Date(now);
    targetCallback.setHours(targetHour >= 16 ? targetHour : 18, 0, 0, 0);
    timeSummary = `This evening around ${formatHourString(targetHour >= 16 ? targetHour : 18, 0)}`;
    timeSummaryTelugu = `ఈరోజు సాయంత్రం 6:00 PM కి`;
  } else if (text.includes('after 2 days') || text.includes('2 days') || text.includes('rendu rojula')) {
    targetCallback = new Date(now);
    targetCallback.setDate(targetCallback.getDate() + 2);
    targetCallback.setHours(targetHour, targetMinute, 0, 0);
    timeSummary = `After 2 days at ${formatHourString(targetHour, targetMinute)}`;
    timeSummaryTelugu = `2 రోజుల తర్వాత ${formatHourStringTelugu(targetHour, targetMinute)} కి`;
  } else if (text.includes('after 3 days') || text.includes('3 days') || text.includes('moodu rojula')) {
    targetCallback = new Date(now);
    targetCallback.setDate(targetCallback.getDate() + 3);
    targetCallback.setHours(targetHour, targetMinute, 0, 0);
    timeSummary = `After 3 days at ${formatHourString(targetHour, targetMinute)}`;
    timeSummaryTelugu = `3 రోజుల తర్వాత ${formatHourStringTelugu(targetHour, targetMinute)} కి`;
  } else if (text.includes('next week') || text.includes('vache vaaram')) {
    targetCallback = new Date(now);
    targetCallback.setDate(targetCallback.getDate() + 7);
    targetCallback.setHours(11, 0, 0, 0);
    timeSummary = 'Next week Monday around 11:00 AM';
    timeSummaryTelugu = 'వచ్చే వారం సోమవారం 11:00 AM కి';
  } else if (text.includes('weekend') || text.includes('saturday') || text.includes('sunday') || text.includes('aadivaaram')) {
    targetCallback = getNextWeekendDay(now, text.includes('sunday') || text.includes('aadivaaram') ? 0 : 6);
    targetCallback.setHours(targetHour, targetMinute, 0, 0);
    timeSummary = `This Weekend (${targetCallback.toLocaleDateString('en-US', { weekday: 'long' })}) at ${formatHourString(targetHour, targetMinute)}`;
    timeSummaryTelugu = `ఈ వీకెండ్ (${targetCallback.toLocaleDateString('en-US', { weekday: 'long' })}) ${formatHourStringTelugu(targetHour, targetMinute)} కి`;
  } else {
    // Weekday check
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < days.length; i++) {
      if (text.includes(days[i])) {
        targetCallback = getNextWeekday(now, i);
        targetCallback.setHours(targetHour, targetMinute, 0, 0);
        timeSummary = `On ${days[i].charAt(0).toUpperCase() + days[i].slice(1)} at ${formatHourString(targetHour, targetMinute)}`;
        timeSummaryTelugu = `${days[i].charAt(0).toUpperCase() + days[i].slice(1)} నాడు ${formatHourStringTelugu(targetHour, targetMinute)} కి`;
        break;
      }
    }
  }

  // If specific time/date was detected:
  if (targetCallback) {
    const diffMs = targetCallback.getTime() - now.getTime();
    const snoozeHours = Math.max(1, Math.ceil(diffMs / (3600 * 1000)));

    let ack = '';
    if (lang === 'telugu') {
      ack = `తప్పకుండా ${name} గారు! 🙏\n\nమీరు బిజీగా ఉన్నారు కదా, అస్సలు డిస్టర్బ్ చేయను సర్. నేను ${persona.name} ని, మీరు చెప్పినట్లుగానే **${timeSummaryTelugu || timeSummary}** మీకు స్వయంగా కాల్ చేస్తాను సర్.\n\nTake care, have a wonderful day! 🙏`;
    } else if (lang === 'tamil') {
      ack = `நிச்சயமாக ${name} சார்! 🙏\n\nநான் ${persona.name}. நீங்க சொன்னபடி **${timeSummary}** உங்களுக்கு கால் பண்றேன் சார். தொந்தரவு செய்ய மாட்டேன்.\n\nHave a good day sir! 🙏`;
    } else if (lang === 'kannada') {
      ack = `ಖಂಡಿತ ${name} ಸರ್! 🙏\n\nನಾನು ${persona.name}. ನೀವು ಹೇಳಿದಂತೆ **${timeSummary}** ನಾನೇ ಕರೆ ಮಾಡುತ್ತೇನೆ ಸರ್. ಡಿಸ್ಟರ್ಬ್ ಮಾಡಲ್ಲ.\n\nಧನ್ಯವಾದಗಳು సర్! 🙏`;
    } else if (lang === 'hindi') {
      ack = `बिल्कुल ${name} जी! 🙏\n\nमैं ${persona.name}। आपकी सुविधानुसार मैं आपको **${timeSummary}** पर पर्सनली कॉल करूँगा। अभी आपको बिल्कुल डिस्टर्ब नहीं करूँगा।\n\nआपका दिन शुभ हो! 🙏`;
    } else {
      ack = `Sure ${name} sir! 🙏\n\nI completely understand, please take your time. I will not disturb you at all. I am ${persona.name}, and I have noted down to personally call you **${timeSummary}**.\n\nHave a productive and wonderful day ahead! 🙏`;
    }

    return {
      hasSchedulingIntent: true,
      isBusy: isGeneralBusy,
      isOptOut: false,
      snoozeHours,
      snoozeUntil: targetCallback.toISOString(),
      scheduledCallbackAt: targetCallback.toISOString(),
      preferredTimeSummary: timeSummary,
      courteousAckMessage: ack
    };
  }

  // If customer simply says "busy" without giving a specific time:
  if (isGeneralBusy) {
    const snoozeHours = 6; // Silence follow-ups for 6 hours
    const snoozeDate = new Date(now.getTime() + snoozeHours * 3600 * 1000);

    let ack = '';
    if (lang === 'telugu') {
      ack = `అర్థమైంది ${name} గారు! 🙏\n\nనో ప్రాబ్లెం సర్, మీరు మీ పని చూసుకోండి. మిమ్మల్ని డిస్టర్బ్ చేయకుండా మెసేజ్ లు పాజ్ చేశాను సర్. మీరు ఫ్రీ అయినప్పుడు మెసేజ్ చేయండి సర్, నేను మాట్లాడతాను.\n\n— ${persona.name} (${persona.brandName})`;
    } else if (lang === 'hindi') {
      ack = `समझ गया ${name} जी! 🙏\n\nकोई बात नहीं, आप अपना काम निपटा लीजिए। मैं बिल्कुल डिस्टर्ब नहीं करूँगा। आप जब भी फ्री हों, बस यहाँ एक मैसेज कर दीजिएगा।\n\n— ${persona.name} (${persona.brandName})`;
    } else {
      ack = `Understood completely, ${name} sir! 🙏\n\nNo problem at all — please take your time with your work. I will pause all messages so you are not disturbed.\n\nWhenever you are free, simply drop a quick message here or give a missed call.\n\n— ${persona.name} (${persona.brandName})`;
    }

    return {
      hasSchedulingIntent: true,
      isBusy: true,
      isOptOut: false,
      snoozeHours,
      snoozeUntil: snoozeDate.toISOString(),
      scheduledCallbackAt: null,
      preferredTimeSummary: 'Busy now (Snoozed for 6 hours)',
      courteousAckMessage: ack
    };
  }

  // No special scheduling intent detected
  return {
    hasSchedulingIntent: false,
    isBusy: false,
    isOptOut: false,
    snoozeHours: 0,
    snoozeUntil: null,
    scheduledCallbackAt: null,
    preferredTimeSummary: null,
    courteousAckMessage: null
  };
}

// ── Date Utility Helpers ───────────────────────────────────────────────────────
function formatHourString(hour: number, minute: number): string {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  const minStr = minute > 0 ? `:${minute.toString().padStart(2, '0')}` : ':00';
  return `${displayHour}${minStr} ${ampm}`;
}

function formatHourStringTelugu(hour: number, minute: number): string {
  const timeOfDay = hour < 12 ? 'ఉదయం' : hour < 16 ? 'మధ్యాహ్నం' : 'సాయంత్రం';
  const displayHour = hour % 12 || 12;
  const minStr = minute > 0 ? `:${minute.toString().padStart(2, '0')}` : ':00';
  return `${timeOfDay} ${displayHour}${minStr}`;
}

function getNextWeekday(date: Date, targetDayOfWeek: number): Date {
  const result = new Date(date);
  const currentDay = result.getDay();
  let daysToAdd = targetDayOfWeek - currentDay;
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  result.setDate(result.getDate() + daysToAdd);
  return result;
}

function getNextWeekendDay(date: Date, weekendDayIndex: number): Date {
  return getNextWeekday(date, weekendDayIndex);
}
