/**
 * NetsOcean Supply-Only & Wholesale Netting Calculation Engine
 * Source of Truth: /opt/netsocean/src/lib/pricing.ts
 * Covers Material Sales, Standard Bags (100ft x 33ft = 3300 SFT), Custom Cut Panels,
 * Twisted Roof Netting, Split-Mesh Pricing, 5% GST, and PAN-India Courier/Transport Dispatch.
 */

export type OrderType = 'STANDARD' | 'CUSTOM';
export type NetType = 'HDPE_BRAIDED' | 'TWISTED_24PLY';
export type MeshSize = '45mm' | '40mm' | '35mm' | '30mm';

export interface PanelSelection {
  top: boolean;
  front: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
}

export interface Dimensions {
  length: number;
  width: number;
  height: number;
}

export interface NetsOceanSupplyInput {
  orderType?: OrderType; // Default 'STANDARD' for bags, 'CUSTOM' for specific panels
  lengthFt: number;
  widthFt: number;
  heightFt?: number;
  panels?: Partial<PanelSelection>;
  sidesNetType?: NetType; // Default 'HDPE_BRAIDED'
  sidesMeshSize?: MeshSize; // Default '45mm'
  topNetType?: NetType; // Default 'HDPE_BRAIDED' or 'TWISTED_24PLY'
  topMeshSize?: MeshSize; // Default '45mm' or '35mm'
  gstRate?: number; // Default 5%
}

export interface PricingSlab {
  from: number;
  to: number | null;
  rate: number;
}

export const NETSOCEAN_PRICING_SLABS: Record<string, PricingSlab[]> = {
  STANDARD_HDPE_45mm: [
    { from: 0, to: 3300, rate: 8.0 },
    { from: 3301, to: 6600, rate: 7.75 },
    { from: 6601, to: 9900, rate: 7.5 },
    { from: 9901, to: null, rate: 7.25 }
  ],
  STANDARD_HDPE_40mm: [
    { from: 0, to: 3300, rate: 8.5 },
    { from: 3301, to: 6600, rate: 8.25 },
    { from: 6601, to: 9900, rate: 8.0 },
    { from: 9901, to: null, rate: 7.75 }
  ],
  CUSTOM_HDPE_45mm: [
    { from: 0, to: 3300, rate: 9.0 },
    { from: 3301, to: 6600, rate: 8.75 },
    { from: 6601, to: 9900, rate: 8.5 },
    { from: 9901, to: null, rate: 8.25 }
  ],
  CUSTOM_HDPE_40mm: [
    { from: 0, to: 3300, rate: 9.5 },
    { from: 3301, to: 6600, rate: 9.25 },
    { from: 6601, to: 9900, rate: 9.0 },
    { from: 9901, to: null, rate: 8.75 }
  ],
  CUSTOM_TWISTED_35mm: [
    { from: 0, to: 5000, rate: 6.0 },
    { from: 5001, to: 10000, rate: 5.75 },
    { from: 10001, to: null, rate: 5.5 }
  ],
  CUSTOM_TWISTED_30mm: [
    { from: 0, to: 5000, rate: 6.5 },
    { from: 5001, to: 10000, rate: 6.25 },
    { from: 10001, to: null, rate: 6.0 }
  ],
  STANDARD_TWISTED_35mm: [
    { from: 0, to: 5000, rate: 6.0 },
    { from: 5001, to: 10000, rate: 5.75 },
    { from: 10001, to: null, rate: 5.5 }
  ],
  STANDARD_TWISTED_30mm: [
    { from: 0, to: 5000, rate: 6.5 },
    { from: 5001, to: 10000, rate: 6.25 },
    { from: 10001, to: null, rate: 6.0 }
  ]
};

export const STANDARD_BAG_SFT = 3300; // 100ft x 33ft

export function getExtraDimension(value: number): number {
  if (value <= 0) return 0;
  if (value <= 50) return 1;
  return 2;
}

export function getRateFromSlabs(sft: number, slabs: PricingSlab[]): number {
  for (const slab of slabs) {
    if (sft >= slab.from && (slab.to === null || sft <= slab.to)) {
      return slab.rate;
    }
  }
  return slabs[slabs.length - 1]?.rate ?? 8.0;
}

export interface CustomPiece {
  panel: string;
  label: string;
  sizeL: number;
  sizeW: number;
  quantity: number;
  sft: number;
}

export interface NetsOceanSupplyResult {
  orderType: OrderType;
  productName: string;
  specification: string;
  recommendedDimensions: {
    lengthFt: number;
    widthFt: number;
    heightFt: number;
  };
  totalSft: number;
  standardBagsCount?: number;
  extraSft?: number;
  pieces?: CustomPiece[];
  splitPricing: boolean;
  topDetails?: {
    sft: number;
    mesh: string;
    ratePerSft: number;
    amount: number;
  };
  sidesDetails?: {
    sft: number;
    mesh: string;
    ratePerSft: number;
    amount: number;
  };
  ratePerSft: number;
  subtotal: number;
  gstPct: number;
  gstAmount: number;
  totalWithGst: number;
  dispatchInfo: {
    deliveryMode: string;
    packaging: string;
    transitTime: string;
  };
}

export function calculateNetsOceanSupply(input: NetsOceanSupplyInput): NetsOceanSupplyResult {
  const L = Math.max(1, Number(input.lengthFt));
  const W = Math.max(1, Number(input.widthFt));
  const H = Math.max(0, Number(input.heightFt || 0));

  const orderType: OrderType = input.orderType || (H > 0 ? 'CUSTOM' : 'STANDARD');
  const sidesNetType: NetType = input.sidesNetType || 'HDPE_BRAIDED';
  const sidesMeshSize: MeshSize = input.sidesMeshSize || '45mm';
  const topNetType: NetType = input.topNetType || 'HDPE_BRAIDED';
  const topMeshSize: MeshSize = input.topMeshSize || '45mm';
  const gstRate = input.gstRate !== undefined ? input.gstRate : 5;

  const panels: PanelSelection = {
    top: input.panels?.top ?? true,
    front: input.panels?.front ?? (H > 0),
    back: input.panels?.back ?? (H > 0),
    left: input.panels?.left ?? (H > 0),
    right: input.panels?.right ?? (H > 0)
  };

  const recL = L + getExtraDimension(L);
  const recW = W + getExtraDimension(W);
  const recH = H > 0 ? H + getExtraDimension(H) : 0;

  // Calculate SFT
  let topSft = 0;
  let sidesSft = 0;

  if (panels.top) topSft += recL * recW;
  if (panels.front && recH > 0) sidesSft += recL * recH;
  if (panels.back && recH > 0) sidesSft += recL * recH;
  if (panels.left && recH > 0) sidesSft += recW * recH;
  if (panels.right && recH > 0) sidesSft += recW * recH;

  const totalSft = Math.round(topSft + sidesSft);

  // Split pricing check
  const isSplit = panels.top && (topNetType !== sidesNetType || topMeshSize !== sidesMeshSize) && sidesSft > 0;

  let subtotal = 0;
  let topAmount = 0;
  let sidesAmount = 0;
  let topRate = 0;
  let sidesRate = 0;

  if (isSplit) {
    const topKey = `${orderType}_${topNetType === 'HDPE_BRAIDED' ? 'HDPE' : 'TWISTED'}_${topMeshSize}`;
    const topSlabs = NETSOCEAN_PRICING_SLABS[topKey] || NETSOCEAN_PRICING_SLABS.CUSTOM_TWISTED_35mm;
    topRate = getRateFromSlabs(topSft, topSlabs);
    topAmount = Math.round(topSft * topRate);

    const sidesKey = `${orderType}_${sidesNetType === 'HDPE_BRAIDED' ? 'HDPE' : 'TWISTED'}_${sidesMeshSize}`;
    const sidesSlabs = NETSOCEAN_PRICING_SLABS[sidesKey] || NETSOCEAN_PRICING_SLABS.CUSTOM_HDPE_45mm;
    sidesRate = getRateFromSlabs(sidesSft, sidesSlabs);
    sidesAmount = Math.round(sidesSft * sidesRate);

    subtotal = topAmount + sidesAmount;
  } else {
    const key = `${orderType}_${sidesNetType === 'HDPE_BRAIDED' ? 'HDPE' : 'TWISTED'}_${sidesMeshSize}`;
    const slabs = NETSOCEAN_PRICING_SLABS[key] || NETSOCEAN_PRICING_SLABS.STANDARD_HDPE_45mm;
    sidesRate = getRateFromSlabs(totalSft, slabs);
    subtotal = Math.round(totalSft * sidesRate);
  }

  const effectiveRatePerSft = totalSft > 0 ? Math.round((subtotal / totalSft) * 100) / 100 : 0;
  const gstAmount = Math.round(subtotal * (gstRate / 100));
  const totalWithGst = subtotal + gstAmount;

  // Custom pieces breakdown
  const pieces: CustomPiece[] = [];
  if (panels.top) pieces.push({ panel: 'top', label: 'Roof / Overhead Piece', sizeL: recL, sizeW: recW, quantity: 1, sft: recL * recW });
  if (panels.front && recH > 0) pieces.push({ panel: 'front', label: 'Front Boundary Panel', sizeL: recL, sizeW: recH, quantity: 1, sft: recL * recH });
  if (panels.back && recH > 0) pieces.push({ panel: 'back', label: 'Back Boundary Panel', sizeL: recL, sizeW: recH, quantity: 1, sft: recL * recH });
  if (panels.left && recH > 0) pieces.push({ panel: 'left', label: 'Left Boundary Panel', sizeL: recW, sizeW: recH, quantity: 1, sft: recW * recH });
  if (panels.right && recH > 0) pieces.push({ panel: 'right', label: 'Right Boundary Panel', sizeL: recW, sizeW: recH, quantity: 1, sft: recW * recH });

  const bagCount = Math.floor(totalSft / STANDARD_BAG_SFT);
  const extraSft = totalSft % STANDARD_BAG_SFT;

  return {
    orderType,
    productName: `NetsOcean™ Factory Direct Netting Supply (${sidesMeshSize} ${sidesNetType === 'HDPE_BRAIDED' ? 'HDPE Braided' : 'Twisted'})`,
    specification: `Virgin UV Stabilized High-Tenacity Polyethylene, Weatherproof, 5+ Years Durability. Supply-Only, DIY Self-Installation.`,
    recommendedDimensions: { lengthFt: recL, widthFt: recW, heightFt: recH },
    totalSft,
    standardBagsCount: bagCount > 0 ? bagCount : undefined,
    extraSft: bagCount > 0 && extraSft > 0 ? extraSft : undefined,
    pieces: orderType === 'CUSTOM' ? pieces : undefined,
    splitPricing: isSplit,
    topDetails: isSplit ? { sft: topSft, mesh: `${topMeshSize} ${topNetType}`, ratePerSft: topRate, amount: topAmount } : undefined,
    sidesDetails: isSplit ? { sft: sidesSft, mesh: `${sidesMeshSize} ${sidesNetType}`, ratePerSft: sidesRate, amount: sidesAmount } : undefined,
    ratePerSft: effectiveRatePerSft,
    subtotal,
    gstPct: gstRate,
    gstAmount,
    totalWithGst,
    dispatchInfo: {
      deliveryMode: 'PAN-India Express Courier / V-Trans Transport Logistics',
      packaging: 'Heavy-Duty Waterproof Woven HDPE Bags',
      transitTime: 'Dispatched within 24-48 hours. Delivery in 2-4 business days.'
    }
  };
}
