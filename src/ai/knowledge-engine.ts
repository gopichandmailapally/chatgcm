/**
 * Universal Knowledge Engine & Multi-Website Dynamic Crawler
 * Indexes products, services, rates, technical specifications, and company rules
 * from all GCM websites in /var/www/ (gcmsafetynets.in, gcm.enterprises, netsocean,
 * gcminvisiblegrills.com, gcmnetting, gcmnettingsolutions.com, netsdial, russea)
 * and dynamically discovers any upcoming websites added to the server.
 */

import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/database.js';

export interface ProductSpec {
  id: string;
  name: string;
  category: string;
  material: string;
  thickness: string;
  meshSize: string;
  durabilityYears: number;
  rates: {
    min: number;
    max: number;
    unit: string;
    description: string;
  };
  features: string[];
  recommendedFor: string[];
}

export interface GroundSetupSpec {
  name: string;
  dimensions: string;
  areaSft: number;
  structuralFrame: string;
  turfSpecs: string;
  nettingSpecs: string;
  lightingSpecs: string;
  turnkeyRatePerSft: number;
  estCost: number;
  roiMonthlyRevenue: string;
  timelineDays: number;
}

export interface WebsiteKnowledge {
  websiteId: string;
  brandName: string;
  domain: string;
  primaryPillar: 'turnkey' | 'doorstep_service' | 'supply_only';
  primaryFocus: string;
  serviceCities: string[];
  localities: string[];
  rateCards: any;
  technicalHighlights: string[];
  lastIndexed: string;
}

export class UniversalKnowledgeEngine {
  private static instance: UniversalKnowledgeEngine;
  private websiteKnowledgeMap: Map<string, WebsiteKnowledge> = new Map();
  private unifiedRateCards: any = {};
  private localAreasMap: Map<string, string[]> = new Map();

  private constructor() {
    this.initStaticKnowledge();
    this.crawlServerWebsites();
  }

  public static getInstance(): UniversalKnowledgeEngine {
    if (!UniversalKnowledgeEngine.instance) {
      UniversalKnowledgeEngine.instance = new UniversalKnowledgeEngine();
    }
    return UniversalKnowledgeEngine.instance;
  }

  /**
   * Initialize comprehensive baseline specifications across all 5 Pillars
   */
  private initStaticKnowledge(): void {
    // 1. Unified Rate Cards (from service-rates.json standard)
    this.unifiedRateCards = {
      safety_nets: {
        'below_100_sft': { min: 1500, max: 1800, unit: 'flat minimum job' },
        '100_250_sft': {
          '1.5mm_30mm': { min: 16, max: 20, desc: 'RUSSEA™ Nylon Monofilament (Translucent)' },
          '2.0mm_40mm': { min: 24, max: 28, desc: 'RUSSEA™ High-Tenacity Braided Nylon' },
          '2.0mm_50mm': { min: 20, max: 24, desc: 'Balcony Pigeon Barrier Net' },
          '2.5mm_40mm': { min: 26, max: 30, desc: 'Heavy Duty Child Safety Net (Impact Tested)' }
        },
        '250_500_sft': {
          '1.5mm_30mm': { min: 14, max: 18, desc: 'Standard Apartment Balcony' },
          '2.0mm_40mm': { min: 20, max: 24, desc: 'High-Rise Balcony Child & Pet Net' },
          '2.5mm_40mm': { min: 22, max: 26, desc: 'Industrial Duct & Staircase Safety' }
        },
        '500_1000_sft': {
          '1.5mm_30mm': { min: 12, max: 16, desc: 'Multiple Balconies / Duplex' },
          '2.0mm_40mm': { min: 18, max: 22, desc: 'Apartment Society Group Booking' }
        },
        'above_1000_sft': {
          'bulk_rate': { min: 10, max: 18, desc: 'Commercial Complex / Society Gated Community' }
        }
      },
      cricket_nets: {
        '1000_5000_sft': { min: 13, max: 18, desc: 'Backyard & School Practice Pitch' },
        '5000_10000_sft': { min: 12, max: 16, desc: 'Commercial Box Cricket Ground' },
        'above_10000_sft': { min: 8, max: 12, desc: 'Full Sports Arena / Multi-Court Setup' }
      },
      invisible_grills: {
        '1.5mm_cable': { '2_inch_gap': { min: 130, max: 150 }, '3_inch_gap': { min: 120, max: 140 } },
        '2.0mm_cable': { '2_inch_gap': { min: 140, max: 160 }, '3_inch_gap': { min: 130, max: 150 } },
        '2.5mm_cable': { '2_inch_gap': { min: 150, max: 170 }, '3_inch_gap': { min: 140, max: 160 } },
        '3.0mm_cable': { '2_inch_gap': { min: 160, max: 180 }, '3_inch_gap': { min: 150, max: 170 } }
      },
      cloth_drying_hangers: {
        'ceiling_pulley_4_pipe': { min: 2000, max: 2500 },
        'ceiling_pulley_5_pipe': { min: 2250, max: 2750 },
        'ceiling_pulley_6_pipe': { min: 2500, max: 3000, desc: 'Most popular residential 6-pipe x 6ft' },
        'ceiling_pulley_7_pipe': { min: 2750, max: 3250 },
        'ceiling_pulley_8_pipe': { min: 3000, max: 3500 },
        'wall_mounted_foldable_6_pipe': { min: 3000, max: 3500 }
      },
      netsocean_wholesale_bags: {
        'hdpe_braided_45mm_100x33ft': { ratePerSft: 8.0, bagTotal: 26400, desc: '1 Bag = 3,300 SFT ready to install' },
        'hdpe_braided_40mm_100x33ft': { ratePerSft: 8.5, bagTotal: 28050, desc: '1 Bag = 3,300 SFT denser mesh' },
        'twisted_natural_green_35mm': { ratePerSft: 6.0, bagTotal: 19800, desc: '1 Bag = 3,300 SFT roof netting' }
      },
      turnkey_box_cricket: {
        'standard_100x50x25': {
          groundArea: 5000,
          totalBudget: '₹ 11,50,000 - ₹ 13,80,000',
          breakdown: {
            civilAndPccPitch: '₹ 1,80,000 (PCC pitch pad 66x10ft + aggregate perimeter)',
            structuralCageGI: '₹ 4,20,000 (40x40 GI columns, truss, anti-rust red oxide + 2-coat enamel)',
            sportsTurf25mm: '₹ 4,42,000 (5,200 SFT non-infill multi-sport turf with PU adhesive & seam tape)',
            enclosureNetting: '₹ 1,25,000 (12,500 SFT RUSSEA 2.5mm braided UV nets with turnbuckles)',
            lightingSetup: '₹ 95,000 (8x 200W/300W LED floodlight fixtures, armored cables & MCB panel)'
          },
          commercialRoi: 'Hourly booking ₹1,000 - ₹1,500/hr. 7 hrs/day = ₹2,50,000 monthly revenue. Payback in 8-10 months.'
        }
      }
    };
  }

  /**
   * Crawls all /var/www/ directories to dynamically index real configurations and content
   */
  public crawlServerWebsites(): void {
    const baseWww = '/var/www';
    if (!fs.existsSync(baseWww)) return;

    try {
      // 1. Read service-rates.json if present
      const ratesFile = path.join(baseWww, 'gcmsafetynets.in/config/service-rates.json');
      if (fs.existsSync(ratesFile)) {
        const content = JSON.parse(fs.readFileSync(ratesFile, 'utf8'));
        if (content.safety_nets) {
          this.unifiedRateCards.safety_nets_dynamic = content.safety_nets;
        }
        if (content.cricket_nets) {
          this.unifiedRateCards.cricket_nets_dynamic = content.cricket_nets;
        }
        if (content.invisible_grills) {
          this.unifiedRateCards.invisible_grills_dynamic = content.invisible_grills;
        }
        if (content.cloth_hangers) {
          this.unifiedRateCards.cloth_hangers_dynamic = content.cloth_hangers;
        }
      }

      // 2. Read Hyderabad & Telangana master areas (_data.php)
      const dataPhpPath = path.join(baseWww, 'gcm.enterprises/_data.php');
      if (fs.existsSync(dataPhpPath)) {
        const phpContent = fs.readFileSync(dataPhpPath, 'utf8');
        const areaMatches = phpContent.matchAll(/'([a-z0-9-]+)'\s*=>\s*\[\s*'label'\s*=>\s*'([^']+)'/gi);
        const hydAreas: string[] = [];
        for (const match of areaMatches) {
          hydAreas.push(match[2]);
        }
        if (hydAreas.length > 0) {
          this.localAreasMap.set('hyderabad', hydAreas);
        }
      }

      // 3. Fallback / supplementary areas for other major cities
      this.localAreasMap.set('bangalore', [
        'Whitefield', 'Electronic City', 'Bellandur', 'Marathahalli', 'HSR Layout',
        'Koramangala', 'Indiranagar', 'Jayanagar', 'Banashankari', 'Hebbal',
        'Yelahanka', 'Sarjapur Road', 'Bannerghatta Road', 'JP Nagar', 'BTM Layout',
        'Malleshwaram', 'Rajajinagar', 'Thanisandra', 'KR Puram', 'Mahadevapura'
      ]);

      this.localAreasMap.set('chennai', [
        'Velachery', 'OMR (Old Mahabalipuram Road)', 'ECR (East Coast Road)', 'Anna Nagar',
        'T. Nagar', 'Adyar', 'Besant Nagar', 'Sholinganallur', 'Porur', 'Tambaram',
        'Chromepet', 'Guindy', 'Mylapore', 'Nungambakkam', 'Kilpauk', 'Perambur', 'Medavakkam'
      ]);

      this.localAreasMap.set('andhra_pradesh', [
        'Vijayawada', 'Visakhapatnam (Vizag)', 'Guntur', 'Rajahmundry',
        'Tirupati', 'Kurnool', 'Nellore', 'Kakinada', 'Anantapur'
      ]);

      // 4. Index all 9 GCM Brand Portals
      this.indexBrandPortal('gcmsafetynets', {
        brandName: 'GCM Safety Nets',
        domain: 'gcmsafetynets.in',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'Balcony & Pigeon Safety Nets with Doorstep Installation in Hyderabad',
        serviceCities: ['Hyderabad', 'Secunderabad', 'Cyberabad', 'Warangal', 'Karimnagar'],
        localities: this.localAreasMap.get('hyderabad') || [],
        rateCards: this.unifiedRateCards.safety_nets,
        technicalHighlights: [
          '100% Virgin High-Tenacity RUSSEA™ Polypropylene & Nylon monofilament nets',
          'Grade 5 UV stabilization with 5 to 8+ years outdoor lifespan',
          'SS 316 marine-grade rust-proof hooks and anchor fasteners',
          'Free doorstep laser site measurement and physical material demo van',
          '5-year written service and replacement warranty'
        ],
        lastIndexed: new Date().toISOString()
      });

      this.indexBrandPortal('gcm-enterprises', {
        brandName: 'GCM Enterprises',
        domain: 'gcm.enterprises',
        primaryPillar: 'turnkey',
        primaryFocus: 'Turnkey Box Cricket & Sports Ground Construction, Turf & Civil Infrastructure',
        serviceCities: ['Pan-India (Hyderabad, Bangalore, Chennai, Vijayawada, Pune, Mumbai)'],
        localities: ['All Commercial & Industrial Hubs across India'],
        rateCards: this.unifiedRateCards.turnkey_box_cricket,
        technicalHighlights: [
          'Complete turn-key execution: Civil base, PCC pitch, GI steel cage fabrication',
          'Non-infill multi-sport FIFA grade turf 25mm to 50mm with PU adhesive',
          'High-lux 200W-400W LED stadium floodlight poles with zero shadow design',
          'Overhead cambered wire rope rigging with drum-tight turnbuckles',
          'Proven commercial ROI: typical break-even in 8 to 12 months'
        ],
        lastIndexed: new Date().toISOString()
      });

      this.indexBrandPortal('netsocean', {
        brandName: 'NetsOcean Wholesale Supply',
        domain: 'netsocean.com',
        primaryPillar: 'supply_only',
        primaryFocus: 'Factory-Direct Wholesale Netting Bundles & Sports Turf Rolls (Pan-India Dispatch)',
        serviceCities: ['All India (Direct transport via V-Trans, Navata, Kranti, DTDC)'],
        localities: ['Immediate warehouse dispatch to any city/pincode in India'],
        rateCards: this.unifiedRateCards.netsocean_wholesale_bags,
        technicalHighlights: [
          'Pre-stitched ready bags 100ft x 33ft = 3,300 SFT ready to deploy',
          '2.5mm 45mm and 40mm HDPE braided weather-proof twine',
          'High burst strength of 180 kg+ per strand',
          'Same-day bilty generation with 48-hour delivery tracking',
          'Wholesale volume discounts for contractors and sports academy owners'
        ],
        lastIndexed: new Date().toISOString()
      });

      this.indexBrandPortal('gcminvisiblegrills', {
        brandName: 'GCM Invisible Grills',
        domain: 'gcminvisiblegrills.com',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'AISI 316 Marine Grade Stainless Steel Invisible Balcony Grills',
        serviceCities: ['Hyderabad', 'Bangalore', 'Chennai', 'Vijayawada'],
        localities: this.localAreasMap.get('hyderabad') || [],
        rateCards: this.unifiedRateCards.invisible_grills,
        technicalHighlights: [
          'AISI 316 Marine Grade high-tensile stainless steel wire rope (450+ kg breaking load)',
          'DuPont transparent nylon anti-scratch coating prevents hand abrasion',
          'Heavy-duty aluminum H-tracks with powder coating',
          'Interval spacing: 2-inch (maximum child & cat safety) or 3-inch (unobstructed view)',
          '100% rust-proof with 10-year replacement guarantee'
        ],
        lastIndexed: new Date().toISOString()
      });

      this.indexBrandPortal('gcmnetting', {
        brandName: 'GCM Netting (Bangalore)',
        domain: 'gcmnetting.com',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'Apartment Balcony Safety Nets & Pigeon Control in Bangalore & Karnataka',
        serviceCities: ['Bangalore', 'Mysore', 'Hosur'],
        localities: this.localAreasMap.get('bangalore') || [],
        rateCards: this.unifiedRateCards.safety_nets,
        technicalHighlights: [
          'Same-day doorstep measurement across Bangalore IT corridors (Whitefield, Bellandur, E-City)',
          'RUSSEA™ nylon pigeon nets with zero apartment aesthetic compromise',
          'SS 316 rust-proof anchor hooks suitable for Bangalore weather',
          '5-year written warranty card issued after installation'
        ],
        lastIndexed: new Date().toISOString()
      });

      this.indexBrandPortal('gcmnettingsolutions', {
        brandName: 'GCM Netting Solutions (Chennai)',
        domain: 'gcmnettingsolutions.com',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'Coastal Marine-Grade Balcony & Industrial Netting in Chennai & Tamil Nadu',
        serviceCities: ['Chennai', 'Kanchipuram', 'Chengalpattu', 'Coimbatore'],
        localities: this.localAreasMap.get('chennai') || [],
        rateCards: this.unifiedRateCards.safety_nets,
        technicalHighlights: [
          'High salt-mist coastal resistance for Chennai shoreline (OMR, ECR, Marina, Adyar)',
          'High-density UV stabilized monofilament nets',
          'SS 316 marine-grade hardware guaranteed against rust in coastal air',
          'Same-day free inspection and sample presentation'
        ],
        lastIndexed: new Date().toISOString()
      });

      this.indexBrandPortal('netsdial', {
        brandName: 'NetsDial Netting Directory',
        domain: 'netsdial.com',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'Unified Netting Service Directory across Telangana, Andhra Pradesh & South India',
        serviceCities: ['Hyderabad', 'Vijayawada', 'Vizag', 'Guntur', 'Bangalore', 'Chennai'],
        localities: ['Over 150+ verified service zones across South India'],
        rateCards: this.unifiedRateCards.safety_nets,
        technicalHighlights: [
          'Connects local home-owners with verified certified GCM technician vans',
          'Guaranteed standardized company pricing with zero contractor markups',
          'Direct customer support and warranty tracking'
        ],
        lastIndexed: new Date().toISOString()
      });

      this.indexBrandPortal('ushaleads', {
        brandName: 'Usha Leads Inbound Hub',
        domain: 'ushaleads.in',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'Direct Inbound Customer Inquiries for Residential Balcony & Bird Proofing',
        serviceCities: ['Hyderabad', 'Secunderabad', 'Telangana'],
        localities: this.localAreasMap.get('hyderabad') || [],
        rateCards: this.unifiedRateCards.safety_nets,
        technicalHighlights: [
          'Fast-track 15-minute technician dispatch',
          'Genuine RUSSEA™ nylon materials with laser measurement'
        ],
        lastIndexed: new Date().toISOString()
      });

      this.indexBrandPortal('russea', {
        brandName: 'RUSSEA™ Branded Commercial Nets',
        domain: 'russea.in',
        primaryPillar: 'supply_only',
        primaryFocus: 'ISO 9001 Certified High-Tenacity Commercial Sports & Industrial Netting',
        serviceCities: ['Pan-India & Export'],
        localities: ['Factory direct dispatch to all ports, logistics hubs and cities'],
        rateCards: this.unifiedRateCards.netsocean_wholesale_bags,
        technicalHighlights: [
          'ISO 9001:2015 quality certified commercial grade netting',
          'Heavy gauge 2.5mm and 3.0mm braided twine with virgin polymers',
          'Tested to withstand international football, cricket, and golf impacts'
        ],
        lastIndexed: new Date().toISOString()
      });
      // 10. NettingTeam (Hyderabad Focused 183 Localities)
      this.indexBrandPortal('nettingteam', {
        brandName: 'NettingTeam (Hyderabad)',
        domain: 'nettingteam.com',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'Hyper-Local Safety Netting & Installation across all 183 Localities of Greater Hyderabad & Secunderabad',
        serviceCities: ['Hyderabad', 'Secunderabad', 'Cyberabad'],
        localities: this.localAreasMap.get('hyderabad') || [],
        rateCards: this.unifiedRateCards.safety_nets,
        technicalHighlights: [
          'Dedicated Greater Hyderabad coverage across West, Central, North, East, and South Zones',
          'Fast mobile doorstep van dispatch with on-site technician demo',
          'SS 316 marine-grade hardware and virgin HDPE UV-stabilized netting',
          'Official contact phone: +91 99123 99334'
        ],
        lastIndexed: new Date().toISOString()
      });

      // 11. GCM Safety Nets (National Portal)
      this.indexBrandPortal('gcmsafetynets-com', {
        brandName: 'GCM Safety Nets (National)',
        domain: 'gcmsafetynets.com',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'National Premier Balcony, Pigeon & Industrial Safety Netting Network across Metro Cities',
        serviceCities: ['Hyderabad', 'Bangalore', 'Chennai', 'Vijayawada', 'Visakhapatnam', 'Pune', 'Mumbai'],
        localities: ['All Metro Urban Localities & Key Residential High-rises'],
        rateCards: this.unifiedRateCards.safety_nets,
        technicalHighlights: [
          'Pan-India installation network with verified local technician teams',
          'Complete 3-year to 5-year warranty with stamped invoice',
          'Standardised transparent square-foot pricing'
        ],
        lastIndexed: new Date().toISOString()
      });

      // 12. Zenxa Architectural & Industrial Protection
      this.indexBrandPortal('zenxa', {
        brandName: 'Zenxa Architectural & Industrial Protection',
        domain: 'zenxa.in',
        primaryPillar: 'doorstep_service',
        primaryFocus: 'Architectural Cable Systems, Industrial Netting & Heavy Sports Enclosures',
        serviceCities: ['Pan-India'],
        localities: ['Industrial Parks, SEZs, Commercial Atriums, Stadiums'],
        rateCards: this.unifiedRateCards.safety_nets,
        technicalHighlights: [
          'Architectural tensile wire rope safety systems',
          'Industrial heavy-duty fall arrest & debris catchment',
          'Structural engineering compliant installation'
        ],
        lastIndexed: new Date().toISOString()
      });

      // 5. Automatically check for any other directories in /var/www/
      const serverDirs = fs.readdirSync(baseWww);
      for (const dirName of serverDirs) {
        if (!dirName.startsWith('.') && !this.websiteKnowledgeMap.has(dirName)) {
          const dirPath = path.join(baseWww, dirName);
          try {
            if (fs.statSync(dirPath).isDirectory()) {
              this.indexGenericServerDirectory(dirName, dirPath);
            }
          } catch {}
        }
      }

      console.log(`🧠 [Universal Knowledge Engine] Successfully indexed ${this.websiteKnowledgeMap.size} websites with unified rate cards and specifications!`);
    } catch (err) {
      console.error('⚠️ [Universal Knowledge Engine Error]', err);
    }
  }

  private indexBrandPortal(id: string, data: Omit<WebsiteKnowledge, 'websiteId'>): void {
    this.websiteKnowledgeMap.set(id, { websiteId: id, ...data });
  }

  private indexGenericServerDirectory(dirName: string, dirPath: string): void {
    // Dynamic indexer for newly added websites
    const brandName = dirName.replace(/[-_.]/g, ' ').toUpperCase();
    this.websiteKnowledgeMap.set(dirName, {
      websiteId: dirName,
      brandName: brandName,
      domain: dirName.includes('.') ? dirName : `${dirName}.com`,
      primaryPillar: dirName.includes('turnkey') || dirName.includes('sports') ? 'turnkey' : (dirName.includes('wholesale') || dirName.includes('supply') ? 'supply_only' : 'doorstep_service'),
      primaryFocus: `Specialized GCM Enterprise division for ${brandName}`,
      serviceCities: ['Pan-India (Hyderabad, Bangalore, Chennai, Vijayawada)'],
      localities: ['All regional territories'],
      rateCards: this.unifiedRateCards,
      technicalHighlights: [
        'Backed by GCM Group 10+ years engineering excellence',
        'Direct factory pricing with zero intermediary commissions',
        'Official State Bank of India corporate invoicing'
      ],
      lastIndexed: new Date().toISOString()
    });
  }

  public getKnowledgeForWebsite(websiteId: string): WebsiteKnowledge | undefined {
    return this.websiteKnowledgeMap.get(websiteId) || this.websiteKnowledgeMap.get('gcmsafetynets');
  }

  public getAllWebsitesKnowledge(): WebsiteKnowledge[] {
    return Array.from(this.websiteKnowledgeMap.values());
  }

  public getRateCards(): any {
    return this.unifiedRateCards;
  }

  public getLocalAreas(city: string = 'hyderabad'): string[] {
    const key = city.toLowerCase().replace(/[^a-z]/g, '');
    return this.localAreasMap.get(key) || this.localAreasMap.get('hyderabad') || [];
  }

  public isAreaCovered(areaQuery: string, city: string = 'hyderabad'): boolean {
    const areas = this.getLocalAreas(city);
    const q = areaQuery.toLowerCase().trim();
    return areas.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()));
  }

  public getCompanyFinancialDetails(): any {
    return {
      bankName: 'State Bank of India (SBI)',
      accountName: 'GCM ENTERPRISES',
      currentAccountNo: '44979437825',
      ifscCode: 'SBIN0021462',
      branch: 'Greenpark Colony',
      officialUpiId: 'gcmenterprises@ybl',
      managingDirector: 'Mr. Gopichand Mailapally',
      executiveDirectLine: '+91 99123 99224',
      officialWhatsAppLine: '+91 99123 99334',
      maxAutonomousDiscountPct: 4.0
    };
  }
}

export const knowledgeEngine = UniversalKnowledgeEngine.getInstance();
