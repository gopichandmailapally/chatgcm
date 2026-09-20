import { Router } from 'express';
import { calculateCricketNetting } from '../calculators/cricket-net-calculator.js';
import { calculateTurnkeyBoxCricketBOQ, calculateTurnkeyBoxCricket } from '../calculators/turnkey-box-calculator.js';
import { calculateSafetyNetInstallation, calculateBalconySafety } from '../calculators/balcony-safety-calculator.js';
import { calculateNetsOceanSupply } from '../calculators/netsocean-supply-calculator.js';
import { listAvailableProducts, getApprovedProductPrice } from '../pricing/pricing-engine.js';

export const calculatorRouter = Router();

// ── Pillar 1: Turnkey Sports & Box Cricket (gcm.enterprises) ──────────────
calculatorRouter.post('/turnkey', (req, res) => {
  try {
    const result = calculateTurnkeyBoxCricketBOQ(req.body);
    res.json({ success: true, pillar: 'Pillar 1: Turnkey Sports (gcm.enterprises)', result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── Pillar 2: Services with Installation (gcmsafetynets.in) ───────────────
calculatorRouter.post('/balcony', (req, res) => {
  try {
    const result = calculateSafetyNetInstallation(req.body);
    res.json({ success: true, pillar: 'Pillar 2: Doorstep Services (gcmsafetynets.in)', result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

calculatorRouter.post('/installation', (req, res) => {
  try {
    const result = calculateSafetyNetInstallation(req.body);
    res.json({ success: true, pillar: 'Pillar 2: Doorstep Services (gcmsafetynets.in)', result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── Pillar 3: Material Sales & Supply Only (netsocean.com) ────────────────
calculatorRouter.post('/supply-only', (req, res) => {
  try {
    const result = calculateNetsOceanSupply(req.body);
    res.json({ success: true, pillar: 'Pillar 3: Material Sales Supply Only (netsocean.com)', result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

calculatorRouter.post('/netsocean', (req, res) => {
  try {
    const result = calculateNetsOceanSupply(req.body);
    res.json({ success: true, pillar: 'Pillar 3: Material Sales Supply Only (netsocean.com)', result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Legacy cricket netting dimension calculator
calculatorRouter.post('/cricket', (req, res) => {
  try {
    const result = calculateCricketNetting(req.body);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Products & Pricing
calculatorRouter.get('/products', (req, res) => {
  try {
    const websiteId = req.query.websiteId as string | undefined;
    const category = req.query.category as string | undefined;
    const products = listAvailableProducts(websiteId, category);
    res.json({ success: true, products });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

calculatorRouter.post('/price-quote', (req, res) => {
  try {
    const quote = getApprovedProductPrice(req.body);
    res.json({ success: true, quote });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});
