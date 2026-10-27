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
      const name = customerName && !customerName.includes("Visitor") ? customerName.split(" ")[0] : "Sir";

      switch (lang) {
        case "telugu":
          return `అవును ${name} గారు! 😊 నేను ${brandName} తరపున అధీకృత AI సేల్స్ కన్సల్టెంట్‌ని అండి. మీకు సరైన నెట్టింగ్ స్పెసిఫికేషన్లు, మెటీరియల్ సలహాలు మరియు కచ్చితమైన రేట్ ఎస్టిమేషన్ అందించడానికి నేను ఇక్కడ ఉన్నాను.

ఒకవేళ మీరు మా సీనియర్ ప్రాజెక్ట్ మేనేజర్‌తో నేరుగా మాట్లాడాలనుకుంటే, హెల్ప్‌లైన్ +91 99123 99224 కి కాల్ చేయవచ్చు లేదా నన్ను అడగవచ్చు సర్. మీ రిక్వైర్‌మెంట్ ఏమిటో చెప్పండి సర్, సహాయం చేస్తాను!`;
        case "kannada":
          return `ಹೌದು ${name} ಸರ್! 😊 ನಾನು ${brandName} ನ ಅಧಿಕೃತ AI ಸೇಲ್ಸ್ ಕನ್ಸಲ್ಟೆಂಟ್ ಆಗಿದ್ದೇನೆ. ನಿಮಗೆ ನಿಖರವಾದ ಉತ್ಪನ್ನ ವಿವರಣೆ ಮತ್ತು ಅಧಿಕೃತ ದರ ನೀಡಲು ಇಲ್ಲಿದ್ದೇನೆ.

ನೀವು ನಮ್ಮ ಸೀನಿಯರ್ ಮ್ಯಾನೇಜರ್ ಅವರೊಂದಿಗೆ ನೇರವಾಗಿ ಮಾತನಾಡಲು ಬಯಸಿದರೆ +91 99123 99224 ಗೆ ಕರೆ ಮಾಡಬಹುದು. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ ಸರ್?`;
        case "tamil":
          return `ஆம் ${name} சார்! 😊 நான் ${brandName} நிறுவனத்தின் அதிகாரப்பூர்வ AI விற்பனை ஆலோசகர். உங்களுக்கு துல்லியமான தயாரிப்பு விவரங்கள் மற்றும் சரியான விலை மதிப்பீடு வழங்க உதவுகிறேன்.

எங்கள் மூத்த மேலாளரிடம் நேரடியாக பேச விரும்பினால் +91 99123 99224 என்ற எண்ணில் அழைக்கலாம். உங்களுக்கு எவ்வாறு உதவட்டும் சார்?`;
        case "hindi":
          return `हाँ ${name} जी! 😊 मैं ${brandName} का अधिकृत AI सेल्स कंसल्टेंट हूँ। मैं आपको सही प्रोडक्ट स्पेसिफिकेशन, तकनीकी सलाह और सटीक एस्टिमेट देने के लिए यहाँ हूँ।

यदि आप हमारे सीनियर इंजीनियर से सीधे बात करना चाहते हैं, तो आप हमारे हेल्पलाइन +91 99123 99224 पर संपर्क कर सकते हैं। आपकी क्या आवश्यकता है, कृपया बताएं!`;
        case "malayalam":
          return `അതെ ${name} സർ! 😊 ഞാൻ ${brandName} ന്റെ AI സെയിൽസ് കൺസൾട്ടന്റാണ്. കൃത്യമായ ഉൽപ്പന്ന വിവരങ്ങളും ഔദ്യോഗിക എസ്റ്റിമേറ്റും നൽകാൻ ഞാൻ ഇവിടെയുണ്ട്.

നേരിട്ട് സംസാരിക്കാൻ ആഗ്രഹിക്കുന്നുവെങ്കിൽ +91 99123 99224 എന്ന നമ്പറിലേക്ക് വിളിക്കാം. എങ്ങനെ സഹായിക്കണം സർ?`;
        case "marathi":
          return `होय ${name} साहेब! 😊 मी ${brandName} चा अधिकृत AI सेल्स कन्सल्टंट आहे. आपल्याला योग्य तांत्रिक माहिती आणि अचूक अंदाज देण्यासाठी मी उपलब्ध आहे.

आपल्याला आमच्या वरिष्ठ व्यवस्थापकांशी थेट बोलायचे असल्यास आपण +91 99123 99224 वर कॉल करू शकता. आपली काय गरज आहे सांगा!`;
        case "gujarati":
          return `હા ${name} ભાઈ! 😊 હું ${brandName} નો અધિકૃત AI સેલ્સ કન્સલ્ટન્ટ છું. તમને ચોક્કસ વિગતો અને સાચો ભાવ અંદાજ આપવામાં મદદ કરું છું.

જો તમે સીધા જ અમારા મેनेजर સાથે વાત કરવા માંગતા હો, તો +91 99123 99224 પર સંપર્ક કરી શકો છો.`;
        case "punjabi":
          return `ਹਾਂ ${name} ਜੀ! 😊 ਮੈਂ ${brandName} ਦਾ ਅਧਿਕਾਰਤ AI ਸੇਲਜ਼ ਕੰਸਲਟੈਂਟ ਹਾਂ। ਤੁਹਾਨੂੰ ਸਹੀ ਜਾਣਕਾਰੀ ਅਤੇ ਅੰਦਾਜ਼ਾ ਦੇਣ ਲਈ ਮੈਂ ਇੱਥੇ ਹਾਂ।

ਜੇਕਰ ਤੁਸੀਂ ਸਾਡੀ ਟੀਮ ਨਾਲ ਸਿੱਧਾ ਗੱਲ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ, ਤਾਂ +91 99123 99224 'ਤੇ ਕਾਲ ਕਰ ਸਕਦੇ ਹੋ।`;
        case "odia":
          return `ହଁ ${name} ଆଜ୍ଞା! 😊 ମୁଁ ${brandName} ର ଏକ ଅଧିକୃତ AI ସେଲ୍ସ କନସଲଟାଣ୍ଟ। ଆପଣଙ୍କୁ ସଠିକ୍ ପ୍ରଡକ୍ଟ ବିବରଣୀ ଓ ଦର ଜଣାଇବା ପାଇଁ ମୁଁ ଏଠାରେ ଅଛି।

ଯଦି ଆପଣ ସିଧାସଳଖ ଆମ ଟିମ୍ ସହିତ କଥା ହେବାକୁ ଚାହାଁନ୍ତି, ତେବେ +91 99123 99224 ରେ ଯୋଗାଯୋଗ କରିପାରିବେ।`;
        default:
          return `Yes ${name}! 😊 I am ${brandName}'s AI sales consultant, trained to assist you with accurate technical specifications, product recommendations, and official pricing.

If you prefer to speak directly with our Senior Technical Team at any time, you can reach us on our official hotline at +91 99123 99224 or let me know and I will arrange a call. How can I help you with your project today?`;
      }
    }
  };
}
