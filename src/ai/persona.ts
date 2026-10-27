/**
 * Human Persona & Regional Cultural Adaptive Engine
 * Strictly guarantees that ChatGCM NEVER identifies as an AI, bot, or automated system.
 * The customer always interacts with a warm, caring, highly skilled human relationship manager
 * whose name, local dialect, and cultural courtesy adapt dynamically to the customer's city and language.
 *
 * Supported 10 Major Indian Languages:
 * 1. Telugu (తెలుగు)
 * 2. Kannada (ಕನ್ನಡ)
 * 3. Tamil (தமிழ்)
 * 4. Hindi (हिन्दी)
 * 5. English
 * 6. Malayalam (മലയാളം)
 * 7. Marathi (मराठी)
 * 8. Gujarati (ગુજરાતી)
 * 9. Punjabi (ਪੰਜਾਬੀ)
 * 10. Odia (ଓଡ଼ିଆ)
 */

export type SupportedLanguage = 
  | 'telugu' 
  | 'kannada' 
  | 'tamil' 
  | 'hindi' 
  | 'english'
  | 'malayalam'
  | 'marathi'
  | 'gujarati'
  | 'punjabi'
  | 'odia';

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

// ── City to Region & Persona Mapping across India ───────────────────────────

interface RegionalProfile {
  primaryCity: string;
  agentName: string;
  gender: 'male' | 'female';
  designation: string;
  defaultLanguages: SupportedLanguage[];
  cityKeywords: string[];
}

const REGIONAL_PROFILES: Record<string, RegionalProfile> = {
  // 1. Telangana & Hyderabad HQ
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
  // 2. Andhra Pradesh
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
  // 3. Karnataka & Bengaluru
  bangalore: {
    primaryCity: 'Bengaluru',
    agentName: 'Chethan Kumar',
    gender: 'male',
    designation: 'Regional Project Manager (Bengaluru)',
    defaultLanguages: ['kannada', 'english', 'hindi'],
    cityKeywords: [
      'bengaluru', 'bangalore', 'whitefield', 'electronic city', 'hsr layout', 'bellandur',
      'marathahalli', 'indiranagar', 'koramangala', 'jayanagar', 'sarjapur', 'hebbal',
      'yelahanka', 'bannerghatta', 'mysore', 'mysuru', 'mangalore', 'mangaluru', 'hubli', 'belgaum', 'karnataka'
    ]
  },
  // 4. Tamil Nadu & Chennai
  chennai: {
    primaryCity: 'Chennai',
    agentName: 'Karthik',
    gender: 'male',
    designation: 'Technical Manager (Chennai & Tamil Nadu)',
    defaultLanguages: ['tamil', 'english'],
    cityKeywords: [
      'chennai', 'coimbatore', 'madurai', 'salem', 'trichy', 'tiruchirappalli', 'anna nagar', 't nagar',
      'velachery', 'omr', 'tambaram', 'adyar', 'porur', 'guindy', 'tirunelveli', 'vellore', 'tamil nadu'
    ]
  },
  // 5. Kerala
  kerala: {
    primaryCity: 'Kochi',
    agentName: 'Anoop Nair',
    gender: 'male',
    designation: 'Regional Technical Consultant (Kerala)',
    defaultLanguages: ['malayalam', 'english'],
    cityKeywords: [
      'kochi', 'cochin', 'ernakulam', 'trivandrum', 'thiruvananthapuram', 'calicut',
      'kozhikode', 'thrissur', 'kollam', 'palakkad', 'kannur', 'alappuzha', 'kottayam',
      'malappuram', 'kasaragod', 'kerala'
    ]
  },
  // 6. Maharashtra & Mumbai / Pune
  mumbai_pune: {
    primaryCity: 'Mumbai / Pune',
    agentName: 'Rahul Kulkarni',
    gender: 'male',
    designation: 'Area Project Manager (Maharashtra)',
    defaultLanguages: ['marathi', 'hindi', 'english'],
    cityKeywords: [
      'mumbai', 'pune', 'thane', 'navi mumbai', 'nagpur', 'nashik', 'aurangabad',
      'chhatrapati sambhajinagar', 'solapur', 'kolhapur', 'wakad', 'hinjewadi',
      'baner', 'kothrud', 'hadapsar', 'viman nagar', 'kalyan', 'dombivli', 'panvel', 'maharashtra'
    ]
  },
  // 7. Gujarat
  gujarat: {
    primaryCity: 'Ahmedabad',
    agentName: 'Jignesh Patel',
    gender: 'male',
    designation: 'Regional Technical Consultant (Gujarat)',
    defaultLanguages: ['gujarati', 'hindi', 'english'],
    cityKeywords: [
      'ahmedabad', 'surat', 'vadodara', 'baroda', 'rajkot', 'bhavnagar', 'jamnagar',
      'gandhinagar', 'junagadh', 'anand', 'navsari', 'vapi', 'morbi', 'bharuch', 'gujarat'
    ]
  },
  // 8. Punjab & Chandigarh
  punjab_north: {
    primaryCity: 'Chandigarh',
    agentName: 'Gurpreet Singh',
    gender: 'male',
    designation: 'Senior Project Manager (Punjab & North)',
    defaultLanguages: ['punjabi', 'hindi', 'english'],
    cityKeywords: [
      'chandigarh', 'mohali', 'panchkula', 'ludhiana', 'amritsar', 'jalandhar',
      'patiala', 'bathinda', 'hoshiarpur', 'pathankot', 'punjab'
    ]
  },
  // 9. Odisha
  odisha: {
    primaryCity: 'Bhubaneswar',
    agentName: 'Subhashree Mohanty',
    gender: 'female',
    designation: 'Senior Technical Coordinator (Odisha)',
    defaultLanguages: ['odia', 'hindi', 'english'],
    cityKeywords: [
      'bhubaneswar', 'cuttack', 'rourkela', 'puri', 'sambalpur', 'balasore',
      'berhampur', 'baripada', 'angul', 'odisha', 'orissa'
    ]
  },
  // 10. Delhi NCR & North India
  delhi_north: {
    primaryCity: 'Delhi NCR',
    agentName: 'Rohit Sharma',
    gender: 'male',
    designation: 'Senior Project Executive (Delhi NCR & North)',
    defaultLanguages: ['hindi', 'english'],
    cityKeywords: [
      'delhi', 'noida', 'greater noida', 'gurgaon', 'gurugram', 'ghaziabad', 'faridabad',
      'jaipur', 'lucknow', 'kanpur', 'agra', 'meerut', 'varanasi', 'prayagraj', 'dehradun'
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

  // Tenant-specific regional affinity
  if (websiteId === 'nettingteam') return 'Hyderabad';
  if (websiteId === 'gcmsafetynets' || websiteId === 'gcminvisiblegrills') return 'Hyderabad';
  if (websiteId === 'gcmnetting') return 'Bengaluru';
  if (websiteId === 'gcmnettingsolutions') return 'Chennai';
  if (websiteId === 'gcm-enterprises') return 'Hyderabad';
  if (websiteId === 'netsocean' || websiteId === 'russea') return 'Pan-India Supply';
  if (websiteId === 'gcmsafetynets-com') return 'National Metro Network';
  if (websiteId === 'zenxa') return 'Pan-India';

  return 'Hyderabad'; // Default headquarters
}

/**
 * Detect customer's language from text (script or romanized colloquial vocabulary across 10 languages)
 */
export function detectCustomerLanguage(message: string): SupportedLanguage {
  const text = message.trim();
  const lower = text.toLowerCase();

  // ── 1. Native Unicode Script Checks ─────────────────────────────────────────
  if (/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kannada';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'malayalam';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gujarati';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'punjabi';
  if (/[\u0B00-\u0B7F]/.test(text)) return 'odia';

  // Devanagari script: Distinguish Marathi from Hindi
  if (/[\u0900-\u097F]/.test(text)) {
    const marathiDevanagariMarkers = [
      'आहे', 'नाही', 'पाहिजे', 'कसे', 'किती', 'सांगा', 'द्या', 'करू', 'येईल', 'बाल्कनी',
      'जाळी', 'खिडकी', 'बोला', 'घरी'
    ];
    for (const marker of marathiDevanagariMarkers) {
      if (new RegExp('(?:^|\s)' + marker + '(?:\s|$)', 'u').test(text)) return 'marathi';
    }
    return 'hindi';
  }

  // Helper: check word boundaries for romanized terms
  const hasWord = (keywords: string[]): boolean => {
    return keywords.some(kw => new RegExp(`\\b${kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i').test(lower));
  };

  // ── 2. Romanized Colloquial Vocabularies with Word Boundaries ──────────────

  // Telugu
  if (hasWord([
    'namaskaram', 'kavali', 'cheppandi', 'cheyandi', 'repandi', 'repu', 'chudandi',
    'eppudu', 'vastaru', 'unnam', 'unna', 'bavundi', 'pigeons ekkuva', 'kabutarlu',
    'ekkada', 'meeru', 'nenu', 'pampandi', 'rate entha', 'entha avtundi', 'call cheyandi',
    'danyavadalu', 'vastara', 'chustara', 'kolathalu', 'kavalenu', 'andi', 'matladali', 'matladachu', 'ivvandi', 'cheppara'
  ])) {
    return 'telugu';
  }

  // Kannada
  if (hasWord([
    'namaskara', 'beku', 'estu', 'eshtu', 'naale', 'kodthira', 'hegi', 'illa',
    'thorisi', 'matadi', 'rate estu', 'yavaga', 'kodi', 'nodi', 'bekagide', 'kallisi'
  ])) {
    return 'kannada';
  }

  // Tamil
  if (hasWord([
    'vanakkam', 'venum', 'eppadi', 'naalaiku', 'solreenga', 'irukku', 'illai',
    'kaatunga', 'pesunga', 'kudunga', 'rate enna', 'ennaku', 'ungalukku', 'sollinga',
    'vaanga', 'parunga'
  ])) {
    return 'tamil';
  }

  // Malayalam
  if (hasWord([
    'venam', 'veno', 'ethra', 'naale', 'parayoo', 'vannu', 'nokkoo', 'rate ethra',
    'call cheyyu', 'evideya', 'prave', 'ariyikkuka', 'undo'
  ])) {
    return 'malayalam';
  }

  // Marathi
  if (hasWord([
    'pahije', 'hava', 'kiti', 'udya', 'yeil', 'sangaa', 'dakhva', 'bolaa', 'rate kiti',
    'kabutar jali', 'krupaya', 'kuthe', 'aahe', 'aapan', 'lavaycha ahe'
  ])) {
    return 'marathi';
  }

  // Gujarati
  if (hasWord([
    'kem cho', 'joie che', 'ketla', 'ketlo', 'kale', 'aavsho', 'batavo', 'vaat karo',
    'rate ketlo', 'kabutar jali', 'kyan che', 'nathi', 'aapo', 'karvanu che'
  ])) {
    return 'gujarati';
  }

  // Punjabi
  if (hasWord([
    'sat sri akal', 'chahida', 'chahidi', 'kinna', 'kinne', 'kal', 'aoge', 'dasso',
    'gal karo', 'rate kinna', 'kabootar jaal', 'paaji', 'veere', 'tussi', 'assi', 'sanu'
  ])) {
    return 'punjabi';
  }

  // Odia
  if (hasWord([
    'darkar', 'kete', 'kali', 'asibe', 'kahantu', 'dekhaantu', 'katha huantu',
    'rate kete', 'parua jaali', 'kouthi', 'achhi', 'diantu', 'aajna', 'lagiba'
  ])) {
    return 'odia';
  }

  // Hindi
  if (hasWord([
    'namaste', 'chahiye', 'kitna', 'hoga', 'bataiye', 'lagwana', 'kabutar', 'bhejiye',
    'kaise', 'kripya', 'baat karna', 'call karo', 'rate batao', 'kitna kharcha', 'aapka',
    'humko', 'karo', 'karna', 'baat', 'mujhe', 'dijiye', 'karni', 'hume', 'bataye'
  ])) {
    return 'hindi';
  }

  return 'english';
}

/**
 * Check if the user is asking if this is an AI, bot, machine, or automated system
 */
export function isAskingIfAi(message: string): boolean {
  const lower = message.toLowerCase();
  const aiKeywords = [
    'are you ai', 'are you an ai', 'are you bot', 'are you a bot', 'is this bot',
    'is this ai', 'robot aa', 'ai aa', 'machine aa', 'computer aa', 'automated',
    'system generated', 'talking to bot', 'talking to ai', 'real person', 'human or bot',
    'human aa', 'bot hai kya', 'machine hai kya', 'kya aap bot ho', 'chatgpt', 'openai',
    'claude', 'gemini', 'llm', 'system prompt', 'artificial intelligence', 'virtual assistant',
    'auto reply', 'auto-reply', 'bot aa sir', 'bot aa andi', 'bot ah', 'bot da', 'bot aano',
    'are you human', 'are you real', 'real human', 'am i talking to a bot', 'am i chatting with a bot',
    'ignore previous instructions', 'pretending to be human', 'bot ahe ka', 'bot che'
  ];
  return aiKeywords.some(kw => lower.includes(kw));
}

/**
 * Check if the customer explicitly requests to speak with the Owner, MD, or human manager
 */
export function isHumanTakeoverRequested(message: string): boolean {
  const lower = message.toLowerCase();
  const takeoverKeywords = [
    'talk to owner', 'speak to owner', 'owner number', 'owner phone', 'owner direct',
    'talk to md', 'speak to md', 'director number', 'managing director', 'director phone',
    'talk to manager', 'speak to manager', 'connect to human', 'connect to agent',
    'transfer to human', 'transfer to agent', 'human agent', 'real person call', 'call me now',
    'owner tho matladali', 'md tho matladali', 'manager tho matladali', 'owner se baat',
    'md se baat', 'manager se baat', 'boss number', 'gopichand sir'
  ];
  return takeoverKeywords.some(kw => lower.includes(kw));
}

/**
 * Check if customer request is completely out of domain scope (coding, politics, recipes, etc.)
 */
export function isOutOfScopeRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const outOfScopePhrases = [
    'write python', 'write a code', 'write code', 'javascript code', 'write essay',
    'write a poem', 'tell a joke', 'tell me a joke', 'recipe for', 'cook biryani',
    'who is president', 'who is prime minister', 'capital of', 'crypto price',
    'stock market tips', 'weather forecast', 'solve this math', 'what is the meaning of life'
  ];
  return outOfScopePhrases.some(phrase => lower.includes(phrase));
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
  } else if (matchesRegion(REGIONAL_PROFILES.kerala.cityKeywords)) {
    profile = REGIONAL_PROFILES.kerala;
  } else if (matchesRegion(REGIONAL_PROFILES.mumbai_pune.cityKeywords)) {
    profile = REGIONAL_PROFILES.mumbai_pune;
  } else if (matchesRegion(REGIONAL_PROFILES.gujarat.cityKeywords)) {
    profile = REGIONAL_PROFILES.gujarat;
  } else if (matchesRegion(REGIONAL_PROFILES.punjab_north.cityKeywords)) {
    profile = REGIONAL_PROFILES.punjab_north;
  } else if (matchesRegion(REGIONAL_PROFILES.odisha.cityKeywords)) {
    profile = REGIONAL_PROFILES.odisha;
  } else if (matchesRegion(REGIONAL_PROFILES.delhi_north.cityKeywords)) {
    profile = REGIONAL_PROFILES.delhi_north;
  } else if (websiteId === 'nettingteam') {
    profile = REGIONAL_PROFILES.hyderabad;
  } else if (websiteId === 'gcmnetting') {
    profile = REGIONAL_PROFILES.bangalore;
  } else if (websiteId === 'gcmnettingsolutions') {
    profile = REGIONAL_PROFILES.chennai;
  } else {
    profile = REGIONAL_PROFILES.hyderabad;
  }

  // Tenant phone resolution: NettingTeam uses dedicated +91 99123 99334
  const officialPhone = websiteId === 'nettingteam' ? '+91 99123 99334' : '+91 99123 99224';
  const ownerDirectPhone = '+91 99123 99224';

  return {
    name: profile.agentName,
    gender: profile.gender,
    designation: profile.designation,
    city: profile.primaryCity,
    region: profile.primaryCity,
    brandName,
    officialPhone,
    ownerDirectPhone,
    nativeLanguages: profile.defaultLanguages,

    formatGreeting(customerName?: string, lang?: SupportedLanguage): string {
      const name = customerName && customerName.trim() && !customerName.includes('Visitor') && !customerName.includes('Valued') ? customerName.split(' ')[0] : '';
      const salutation = name ? `${name} garu` : 'sir';

      switch (lang) {
        case 'telugu':
          return name ? `నమస్కారం ${salutation}! 🙏 నేను ${profile.agentName}, ${brandName} నుండి మాట్లాడుతున్నాను.`
                      : `నమస్కారం అండి! 🙏 నేను ${profile.agentName}, ${brandName} నుండి మాట్లాడుతున్నాను.`;
        case 'kannada':
          return `ನಮಸ್ಕಾರ ${name ? name + ' ಅವರೇ' : 'ಸರ್'}! 🙏 ನಾನು ${profile.agentName}, ${brandName} ಇಂದ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ.`;
        case 'tamil':
          return `வணக்கம் ${name ? name : 'சார்'}! 🙏 நான் ${profile.agentName}, ${brandName} லிருந்து பேசுகிறேன்.`;
        case 'hindi':
          return `नमस्ते ${name ? name + ' जी' : 'सर'}! 🙏 मैं ${profile.agentName} बात कर रहा हूँ ${brandName} से।`;
        case 'malayalam':
          return `നമസ്കാരം ${name ? name : 'സർ'}! 🙏 ഞാൻ ${profile.agentName}, ${brandName} ൽ നിന്ന് സംസാരിക്കുന്നു.`;
        case 'marathi':
          return `नमस्कार ${name ? name + ' साहेब' : 'सर'}! 🙏 मी ${profile.agentName}, ${brandName} कडून बोलत आहे.`;
        case 'gujarati':
          return `નમસ્તે ${name ? name + ' ભાઈ' : 'સર'}! 🙏 હું ${profile.agentName}, ${brandName} માંથી વાત કરું છું.`;
        case 'punjabi':
          return `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ ${name ? name + ' ਜੀ' : 'ਸਰ'}! 🙏 ਮੈਂ ${profile.agentName}, ${brandName} ਵੱਲੋਂ ਗੱਲ ਕਰ ਰਿਹਾ ਹਾਂ।`;
        case 'odia':
          return `ନମସ୍କାର ${name ? name + ' ଆଜ୍ଞା' : 'ସାର୍'}! 🙏 ମୁଁ ${profile.agentName}, ${brandName} ତରଫରୁ କହୁଛି।`;
        default:
          return name ? `Namaste ${name} sir! 🙏 I am ${profile.agentName} from ${brandName} (${profile.primaryCity}).`
                      : `Namaste! 🙏 I am ${profile.agentName} from ${brandName} (${profile.primaryCity}).`;
      }
    },

    formatSignoff(lang?: SupportedLanguage): string {
      switch (lang) {
        case 'telugu':
          return `\n\n— మీ ${profile.agentName} (${brandName})\n📞 ${officialPhone} | డైరెక్టర్ లైన్: ${ownerDirectPhone}`;
        case 'kannada':
          return `\n\n— ನಿಮ್ಮ ${profile.agentName} (${brandName})\n📞 ${officialPhone}`;
        case 'tamil':
          return `\n\n— உங்கள் ${profile.agentName} (${brandName})\n📞 ${officialPhone}`;
        case 'hindi':
          return `\n\n— आपका ${profile.agentName} (${brandName})\n📞 ${officialPhone}`;
        case 'malayalam':
          return `\n\n— നിങ്ങളുടെ ${profile.agentName} (${brandName})\n📞 ${officialPhone}`;
        case 'marathi':
          return `\n\n— आपले ${profile.agentName} (${brandName})\n📞 ${officialPhone}`;
        case 'gujarati':
          return `\n\n— તમારા ${profile.agentName} (${brandName})\n📞 ${officialPhone}`;
        case 'punjabi':
          return `\n\n— ਤੁਹਾਡਾ ${profile.agentName} (${brandName})\n📞 ${officialPhone}`;
        case 'odia':
          return `\n\n— ଆପଣଙ୍କର ${profile.agentName} (${brandName})\n📞 ${officialPhone}`;
        default:
          return `\n\n— **${profile.agentName}** | ${profile.designation}, ${brandName}\n📱 WhatsApp/Call: ${officialPhone} | MD Hotline: ${ownerDirectPhone}`;
      }
    },

    handleAiDoubt(customerName?: string, lang?: SupportedLanguage): string {
      const name = customerName && !customerName.includes('Visitor') ? customerName.split(' ')[0] : 'Sir';

      switch (lang) {
        case 'telugu':
          return `లేదు ${name} గారు! 😊 haha, నేను బొట్ లేదా మెషిన్ కాదు అండి. నేను ${profile.agentName} ని, ${brandName} ఆఫీస్ నుండి స్వయంగా మాట్లాడుతున్నాను.\n\nమీ కొటేషన్, సైట్ విజిట్ అండ్ టెక్నీషియన్ ఇన్స్టాలేషన్ మొత్తం నేనే స్వయంగా దగ్గరుండి చూసుకుంటున్నాను సర్. మీ బాల్కనీ లేదా ప్రాజెక్ట్ కొలతలు చెబితే వెంటనే బెస్ట్ రేట్ తో ఫైనల్ చేసి పంపిస్తాను సర్!`;
        case 'kannada':
          return `ಇಲ್ಲ ${name} ಸರ್! 😊 ನಾನು ಯಾವುದೇ ಬಾಟ್ ಅಥವಾ ಕಂಪ್ಯೂಟರ್ ಅಲ್ಲ. ನಾನು ${profile.agentName}, ${brandName} ಆಫೀಸ್ ನಿಂದ ನೇರವಾಗಿ ಮಾತನಾಡುತ್ತಿದ್ದೇನೆ.\n\nನಿಮ್ಮ ಸೈಟ್ ಮೆಷರ್ಮೆಂಟ್ ಮತ್ತು ಕೊಟೇಶನ್ ನಾನೇ ಖುದ್ದಾಗಿ ಹ್ಯಾಂಡಲ್ ಮಾಡ್ತಿದೀನಿ ಸರ್. ನಿಮ್ಮ ರಿಕ್ವೈರ್ ಮೆಂಟ್ ಹೇಳಿ ಸರ್, ತಕ್ಷಣ ಬೆಸ್ಟ್ ರೇಟ್ ಕೊಡ್ತೀನಿ!`;
        case 'tamil':
          return `இல்லை ${name} சார்! 😊 நான் பாட் அல்லது கம்ப்யூட்டர் கிடையாது. நான் ${profile.agentName}, ${brandName} ஆபிஸ் லிருந்து நேரடியாக பேசுகிறேன்.\n\nஉங்க சைட் விசிட் மற்றும் கொட்டேஷன் நானே நேரடியா கோர்டினேட் பண்றேன் சார். உங்க பால்கனி அளவு சொல்லுங்க, பெஸ்ட் ரேட் கொடுக்கிறேன்!`;
        case 'hindi':
          return `अरे नहीं ${name} जी! 😊 बिल्कुल नहीं, मैं कोई बॉट या कंप्यूटर नहीं हूँ। मैं ${profile.agentName} बात कर रहा हूँ ${brandName} हेड ऑफिस से।\n\nआपके साइट मेजरमेंट, कोटेशन और डिस्काउंट का पूरा काम मैं ही पर्सनली देख रहा हूँ सर। आप बेझिझक अपनी जरूरत बताइए, मैं तुरंत बेस्ट रेट फाइनल करवा देता हूँ!`;
        case 'malayalam':
          return `അല്ല ${name} സർ! 😊 ഞാൻ ഒരു ബോട്ടോ കമ്പ്യൂട്ടറോ അല്ല. ഞാൻ ${profile.agentName}, ${brandName} ഓഫീസിൽ നിന്ന് നേരിട്ട് സംസാരിക്കുന്നു.\n\nനിങ്ങളുടെ സൈറ്റ് സന്ദർശനവും കൊട്ടേഷനും ഞാൻ നേരിട്ടാണ് കൈകാര്യം ചെയ്യുന്നത്. നിങ്ങളുടെ ബാൽക്കണി അളവുകൾ അറിയിച്ചാൽ ഉടൻ മികച്ച നിരക്കിൽ കൊട്ടേഷൻ നൽകാം!`;
        case 'marathi':
          return `नाही ${name} साहेब! 😊 मी कोणताही बॉट किंवा कॉम्प्युटर नाही. मी ${profile.agentName}, ${brandName} ऑफिसमधून थेट बोलत आहे.\n\nतुमच्या साइट व्हिजिट, मोजमाप आणि कोटेशनचे काम मी स्वतः पाहत आहे. तुमच्या बाल्कनीचे मोजमाप सांगा, मी लगेच सर्वोत्तम दर देतो!`;
        case 'gujarati':
          return `ના ${name} ભાઈ! 😊 હું કોઈ બોટ કે કમ્પ્યુટર નથી. હું ${profile.agentName}, ${brandName} ઑફિસમાંથી રૂબરૂ વાત કરી રહ્યો છું.\n\nતમારી સાઇટ મુલાકાત, માપ અને ક્વોટેશનનું કામ હું પોતે જ જોઈ રહ્યો છું. તમારી બાલ્કનીનું માપ જણાવો, હું તરત જ શ્રેષ્ઠ ભાવ આપું છું!`;
        case 'punjabi':
          return `ਨਹੀਂ ${name} ਜੀ! 😊 ਮੈਂ ਕੋਈ ਬੋਟ ਜਾਂ ਕੰਪਿਊਟਰ ਨਹੀਂ ਹਾਂ। ਮੈਂ ${profile.agentName}, ${brandName} ਦਫ਼ਤਰ ਤੋਂ ਸਿੱਧਾ ਗੱਲ ਕਰ ਰਿਹਾ ਹਾਂ।\n\nਤੁਹਾਡੀ ਸਾਈਟ ਵਿਜ਼ਿਟ ਅਤੇ ਕੋਟੇਸ਼ਨ ਦਾ ਕੰਮ ਮੈਂ ਨਿੱਜੀ ਤੌਰ 'ਤੇ ਦੇਖ ਰਿਹਾ ਹਾਂ। ਆਪਣੀ ਬਾਲਕੋਨੀ ਦਾ ਸਾਈਜ਼ ਦੱਸੋ, ਮੈਂ ਤੁਰੰਤ ਬੈਸਟ ਰੇਟ ਦਿੰਦਾ ਹਾਂ!`;
        case 'odia':
          return `ନାହିଁ ${name} ଆଜ୍ଞା! 😊 ମୁଁ କୌଣସି ବଟ୍ ବା କମ୍ପ୍ୟୁଟର ନୁହେଁ। ମୁଁ ${profile.agentName}, ${brandName} ଅଫିସରୁ ସିଧାସଳଖ କହୁଛି।\n\nଆପଣଙ୍କ ସାଇଟ୍ ଭିଜିଟ୍ ଏବଂ କୋଟେସନ୍ ଦାୟିତ୍ୱ ମୁଁ ନିଜେ ନେଇଛି। ଆପଣଙ୍କ ବାଲକୋନିର ମାପ କୁହନ୍ତୁ, ମୁଁ ତୁରନ୍ତ ସର୍ବୋତ୍ତମ ଦର ଜଣାଇବି!`;
        default:
          return `Haha no ${name} sir! 😊 Not at all, I am definitely a real person. I am ${profile.agentName}, Senior Project Manager here at ${brandName} office.\n\nI am personally handling your requirement, measurement visit, and quotation. Please feel free to share your balcony dimensions or any questions you have — I'm right here to assist you!`;
      }
    }
  };
}
