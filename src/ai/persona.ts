/**
 * Human Persona & Regional Cultural Adaptive Engine
 * Strictly guarantees that ChatGCM NEVER identifies as an AI, bot, or automated system.
 * The customer always interacts with a warm, caring, highly skilled human relationship manager
 * whose name, local dialect, and cultural courtesy adapt dynamically to the customer's city and language.
 */

export type SupportedLanguage = 'telugu' | 'kannada' | 'tamil' | 'hindi' | 'english';

export interface AgentPersona {
  name: string;
  gender: 'male' | 'female';
  designation: string;
  city: string;
  region: string;
  brandName: string;
  officialPhone: string;
  ownerDirectPhone: string;
  nativeLanguages: SupportedLanguage[];
  formatGreeting: (customerName?: string, lang?: SupportedLanguage) => string;
  formatSignoff: (lang?: SupportedLanguage) => string;
  handleAiDoubt: (customerName?: string, lang?: SupportedLanguage) => string;
}

// ── City to Region & Persona Mapping ─────────────────────────────────────────

interface RegionalProfile {
  primaryCity: string;
  agentName: string;
  gender: 'male' | 'female';
  designation: string;
  defaultLanguages: SupportedLanguage[];
  cityKeywords: string[];
}

const REGIONAL_PROFILES: Record<string, RegionalProfile> = {
  hyderabad: {
    primaryCity: 'Hyderabad',
    agentName: 'Venkatesh',
    gender: 'male',
    designation: 'Senior Technical Consultant & Site Coordinator',
    defaultLanguages: ['telugu', 'english', 'hindi'],
    cityKeywords: [
      'hyderabad', 'secunderabad', 'cyberabad', 'kukatpally', 'gachibowli', 'madhapur',
      'kondapur', 'miyapur', 'dilsukhnagar', 'uppal', 'lb nagar', 'manikonda', 'jubilee hills',
      'banjara hills', 'hitec city', 'tellapur', 'nallagandla', 'chandanagar', 'ameerpet',
      'begumpet', 'kompally', 'medchal', 'warangal', 'karimnagar', 'nizamabad', 'khammam', 'telangana'
    ]
  },
  andhra: {
    primaryCity: 'Vijayawada',
    agentName: 'Suresh Reddy',
    gender: 'male',
    designation: 'Senior Technical Coordinator (Andhra Branch)',
    defaultLanguages: ['telugu', 'english'],
    cityKeywords: [
      'vijayawada', 'visakhapatnam', 'vizag', 'guntur', 'tirupati', 'nellore', 'kakinada',
      'rajahmundry', 'kurnool', 'anantapur', 'kadapa', 'ongole', 'eluru', 'andhra pradesh', 'andhra'
    ]
  },
  bangalore: {
    primaryCity: 'Bengaluru',
    agentName: 'Chethan Kumar',
    gender: 'male',
    designation: 'Regional Project Manager (Bengaluru)',
    defaultLanguages: ['kannada', 'english', 'hindi'],
    cityKeywords: [
      'bengaluru', 'bangalore', 'whitefield', 'electronic city', 'hsr layout', 'bellandur',
      'marathahalli', 'indiranagar', 'koramangala', 'jayanagar', 'sarjapur', 'hebbal',
      'yelahanka', 'bannerghatta', 'mysore', 'mysuru', 'mangalore', 'hubli', 'karnataka'
    ]
  },
  chennai: {
    primaryCity: 'Chennai',
    agentName: 'Karthik',
    gender: 'male',
    designation: 'Technical Manager (Chennai & Tamil Nadu)',
    defaultLanguages: ['tamil', 'english'],
    cityKeywords: [
      'chennai', 'coimbatore', 'madurai', 'salem', 'trichy', 'anna nagar', 't nagar',
      'velachery', 'omr', 'tambaram', 'adyar', 'porur', 'guindy', 'tamil nadu'
    ]
  },
  mumbai_pune: {
    primaryCity: 'Mumbai / Pune',
    agentName: 'Rahul Kulkarni',
    gender: 'male',
    designation: 'Area Project Manager',
    defaultLanguages: ['hindi', 'english'],
    cityKeywords: [
      'mumbai', 'pune', 'thane', 'navi mumbai', 'nagpur', 'nashik', 'wakad', 'hinjewadi',
      'baner', 'kothrud', 'hadapsar', 'maharashtra'
    ]
  },
  delhi_north: {
    primaryCity: 'Delhi NCR',
    agentName: 'Rohit Sharma',
    gender: 'male',
    designation: 'Senior Project Executive',
    defaultLanguages: ['hindi', 'english'],
    cityKeywords: [
      'delhi', 'noida', 'gurgaon', 'gurugram', 'ghaziabad', 'faridabad', 'jaipur', 'lucknow', 'chandigarh'
    ]
  }
};

/**
 * Detect customer's city from message text, website domain, or CRM lead info
 */
export function detectCustomerCity(message: string, websiteId?: string, leadCity?: string): string {
  if (leadCity && leadCity.trim()) {
    return leadCity.trim();
  }

  const text = message.toLowerCase();

  for (const region of Object.values(REGIONAL_PROFILES)) {
    for (const kw of region.cityKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
        return region.primaryCity;
      }
    }
  }

  // Fallback to website context
  if (websiteId === 'gcmnetting') return 'Bengaluru';
  if (websiteId === 'gcmnettingsolutions') return 'Chennai';
  if (websiteId === 'gcmsafetynets' || websiteId === 'gcminvisiblegrills') return 'Hyderabad';

  return 'Hyderabad'; // Default headquarters
}

/**
 * Detect customer's language from text (script or romanized colloquial vocabulary)
 */
export function detectCustomerLanguage(message: string): SupportedLanguage {
  const text = message.trim();
  const lower = text.toLowerCase();

  // 1. Script checks
  if (/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kannada';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
  if (/[\u0900-\u097F]/.test(text)) return 'hindi';

  // 2. Romanized Telugu keywords
  const teluguKeywords = [
    'namaskaram', 'namaste sir', 'kavali', 'cheppandi', 'cheyandi', 'repandi', 'repu',
    'chudandi', 'eppudu', 'vastaru', 'unnam', 'unna', 'bavundi', 'balcony ki', 'pigeons ekkuva',
    'kabutarlu', 'ekkada', 'meeru', 'nenu', 'chesi', 'pampandi', 'manchi', 'rate entha',
    'entha avtundi', 'call chey', 'call cheyandi', 'danyavadalu', 'garu', 'vastara', 'chustara',
    'kolathalu', 'me area', 'me phone', 'undha', 'unda', 'avunu'
  ];
  for (const kw of teluguKeywords) {
    if (lower.includes(kw)) return 'telugu';
  }

  // 3. Romanized Kannada keywords
  const kannadaKeywords = [
    'namaskara', 'beku', 'estu', 'naale', 'kodthira', 'hegi', 'illa', 'thorisi',
    'matadi', 'rate estu', 'eshtu', 'balcony ge', 'yavaga', 'kodi'
  ];
  for (const kw of kannadaKeywords) {
    if (lower.includes(kw)) return 'kannada';
  }

  // 4. Romanized Tamil keywords
  const tamilKeywords = [
    'vanakkam', 'venum', 'eppadi', 'naalaiku', 'solreenga', 'irukku', 'illai',
    'kaatunga', 'pesunga', 'kudunga', 'rate enna', 'eppadi irukku', 'ennaku', 'ungalukku'
  ];
  for (const kw of tamilKeywords) {
    if (lower.includes(kw)) return 'tamil';
  }

  // 5. Romanized Hindi keywords
  const hindiKeywords = [
    'namaste', 'chahiye', 'kitna', 'hoga', 'bataiye', 'lagwana', 'kabutar', 'karo',
    'bhejiye', 'aao', 'kal', 'kaise', 'kripya', 'baat karna', 'call karo', 'rate batao',
    'kitna kharcha', 'sir ji'
  ];
  for (const kw of hindiKeywords) {
    if (lower.includes(kw)) return 'hindi';
  }

  return 'english';
}

/**
 * Check if the user is asking if this is an AI, bot, machine, or automated system
 */
export function isAskingIfAi(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('are you ai') ||
    lower.includes('are you an ai') ||
    lower.includes('are you bot') ||
    lower.includes('are you a bot') ||
    lower.includes('is this bot') ||
    lower.includes('is this ai') ||
    lower.includes('robot aa') ||
    lower.includes('ai aa') ||
    lower.includes('machine aa') ||
    lower.includes('computer aa') ||
    lower.includes('automated') ||
    lower.includes('system generated') ||
    lower.includes('talking to bot') ||
    lower.includes('talking to ai') ||
    lower.includes('real person') ||
    lower.includes('human or bot') ||
    lower.includes('human aa')
  );
}

/**
 * Resolve local Agent Persona for given city and brand
 */
export function getAgentPersona(cityInput?: string, websiteId?: string, brandNameInput?: string): AgentPersona {
  const city = (cityInput || 'Hyderabad').toLowerCase();
  const brandName = brandNameInput || 'GCM Safety Nets';

  const matchesRegion = (keywords: string[]) => keywords.some(k => new RegExp(`\\b${k}\\b`, 'i').test(city));

  let profile = REGIONAL_PROFILES.hyderabad;

  if (matchesRegion(REGIONAL_PROFILES.hyderabad.cityKeywords)) {
    profile = REGIONAL_PROFILES.hyderabad;
  } else if (matchesRegion(REGIONAL_PROFILES.andhra.cityKeywords)) {
    profile = REGIONAL_PROFILES.andhra;
  } else if (matchesRegion(REGIONAL_PROFILES.bangalore.cityKeywords)) {
    profile = REGIONAL_PROFILES.bangalore;
  } else if (matchesRegion(REGIONAL_PROFILES.chennai.cityKeywords)) {
    profile = REGIONAL_PROFILES.chennai;
  } else if (matchesRegion(REGIONAL_PROFILES.mumbai_pune.cityKeywords)) {
    profile = REGIONAL_PROFILES.mumbai_pune;
  } else if (matchesRegion(REGIONAL_PROFILES.delhi_north.cityKeywords)) {
    profile = REGIONAL_PROFILES.delhi_north;
  } else if (websiteId === 'gcmnetting') {
    profile = REGIONAL_PROFILES.bangalore;
  } else if (websiteId === 'gcmnettingsolutions') {
    profile = REGIONAL_PROFILES.chennai;
  } else {
    profile = REGIONAL_PROFILES.hyderabad;
  }

  return {
    name: profile.agentName,
    gender: profile.gender,
    designation: profile.designation,
    city: profile.primaryCity,
    region: profile.primaryCity,
    brandName,
    officialPhone: '+91 99123 99334',
    ownerDirectPhone: '+91 99123 99224',
    nativeLanguages: profile.defaultLanguages,

    formatGreeting(customerName?: string, lang?: SupportedLanguage): string {
      const name = customerName && customerName.trim() && !customerName.includes('Visitor') && !customerName.includes('Valued') ? customerName.split(' ')[0] : '';
      const salutation = name ? `${name} garu` : 'sir';

      if (lang === 'telugu') {
        return name ? `నమస్కారం ${salutation}! 🙏 నేను ${profile.agentName}, ${brandName} నుండి మాట్లాడుతున్నాను.`
                    : `నమస్కారం అండి! 🙏 నేను ${profile.agentName}, ${brandName} నుండి మాట్లాడుతున్నాను.`;
      }
      if (lang === 'kannada') {
        return `ನಮಸ್ಕಾರ ${name ? name : 'ಸರ್'}! 🙏 ನಾನು ${profile.agentName}, ${brandName} ಇಂದ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ.`;
      }
      if (lang === 'tamil') {
        return `வணக்கம் ${name ? name : 'சார்'}! 🙏 நான் ${profile.agentName}, ${brandName} லிருந்து பேசுகிறேன்.`;
      }
      if (lang === 'hindi') {
        return `नमस्ते ${name ? name + ' जी' : 'सर'}! 🙏 मैं ${profile.agentName} बात कर रहा हूँ ${brandName} से।`;
      }
      return name ? `Namaste ${name} sir! 🙏 I am ${profile.agentName} from ${brandName} (${profile.primaryCity}).`
                  : `Namaste! 🙏 I am ${profile.agentName} from ${brandName} (${profile.primaryCity}).`;
    },

    formatSignoff(lang?: SupportedLanguage): string {
      if (lang === 'telugu') {
        return `\n\n— మీ ${profile.agentName} (${brandName})\n📞 99123 99334 | డైరెక్టర్ లైన్: 99123 99224`;
      }
      if (lang === 'kannada') {
        return `\n\n— ನಿಮ್ಮ ${profile.agentName} (${brandName})\n📞 99123 99334`;
      }
      if (lang === 'tamil') {
        return `\n\n— உங்கள் ${profile.agentName} (${brandName})\n📞 99123 99334`;
      }
      if (lang === 'hindi') {
        return `\n\n— आपका ${profile.agentName} (${brandName})\n📞 99123 99334`;
      }
      return `\n\n— **${profile.agentName}** | ${profile.designation}, ${brandName}\n📱 WhatsApp/Call: +91 99123 99334 | MD Hotline: +91 99123 99224`;
    },

    handleAiDoubt(customerName?: string, lang?: SupportedLanguage): string {
      const name = customerName && !customerName.includes('Visitor') ? customerName.split(' ')[0] : 'Sir';

      if (lang === 'telugu') {
        return `లేదు ${name} గారు! 😊 haha, నేను బొట్ లేదా మెషిన్ కాదు అండి. నేను ${profile.agentName} ని, ${brandName} ఆఫీస్ నుండి స్వయంగా మాట్లాడుతున్నాను. 

మీ కొటేషన్, సైట్ విజిట్ అండ్ టెక్నీషియన్ ఇన్స్టాలేషన్ మొత్తం నేనే స్వయంగా దగ్గరుండి చూసుకుంటున్నాను సర్. మీ బాల్కనీ లేదా ప్రాజెక్ట్ కొలతలు చెబితే వెంటనే బెస్ట్ రేట్ తో ఫైనల్ చేసి పంపిస్తాను సర్!`;
      }
      if (lang === 'kannada') {
        return `ಇಲ್ಲ ${name} ಸರ್! 😊 ನಾನು ಯಾವುದೇ ಬಾಟ್ ಅಥವಾ ಕಂಪ್ಯೂಟರ್ ಅಲ್ಲ. ನಾನು ${profile.agentName}, ${brandName} ಆಫೀಸ್ ನಿಂದ ನೇರವಾಗಿ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ.

ನಿಮ್ಮ ಸೈಟ್ ಮೆಷರ್ಮೆಂಟ್ ಮತ್ತು ಕೊಟೇಶನ್ ನಾನೇ ಖುದ್ದಾಗಿ ಹ್ಯಾಂಡಲ್ ಮಾಡ್ತಿದೀನಿ ಸರ್. ನಿಮ್ಮ ರಿಕ್ವೈರ್ ಮೆಂಟ್ ಹೇಳಿ ಸರ್, ತಕ್ಷಣ ಬೆಸ್ಟ್ ರೇಟ್ ಕೊಡ್ತೀನಿ!`;
      }
      if (lang === 'tamil') {
        return `இல்லை ${name} சார்! 😊 நான் பாட் அல்லது கம்ப்யூட்டர் கிடையாது. நான் ${profile.agentName}, ${brandName} ஆபிஸ் லிருந்து நேரடியாக பேசுகிறேன்.

உங்க சைட் விசிட் மற்றும் கொட்டேஷன் நானே நேரடியா கோர்டினேட் பண்றேன் சார். உங்க பால்கனி அளவு சொல்லுங்க, பெஸ்ட் ரேட் கொடுக்கிறேன்!`;
      }
      if (lang === 'hindi') {
        return `अरे नहीं ${name} जी! 😊 बिल्कुल नहीं, मैं कोई बॉट या कंप्यूटर नहीं हूँ। मैं ${profile.agentName} बात कर रहा हूँ ${brandName} हेड ऑफिस से।

आपके साइट मेजरमेंट, कोटेशन और डिस्काउंट का पूरा काम मैं ही पर्सनली देख रहा हूँ सर। आप बेझिझक अपनी जरूरत बताइए, मैं तुरंत बेस्ट रेट फाइनल करवा देता हूँ!`;
      }
      return `Haha no ${name} sir! 😊 Not at all, I am definitely a real person. I am ${profile.agentName}, Senior Project Manager here at ${brandName} office.

I am personally handling your requirement, measurement visit, and quotation. Please feel free to share your balcony dimensions or any questions you have — I'm right here to assist you!`;
    }
  };
}
