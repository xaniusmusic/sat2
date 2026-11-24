import { HardwareItem } from '../types/simulator';

export const HARDWARE_CATALOG: HardwareItem[] = [
  // ================= SATELLITE DISHES =================
  {
    id: 'dish-60cm',
    name: '60cm Compact Steel Offset Dish',
    brand: 'TechniSat',
    category: 'dish',
    price: 65,
    tagline: 'Compact balcony offset reflector for strong regional core footprints.',
    badge: 'STARTER',
    specs: {
      diameterCm: 60,
      gainDbi: 35.4,
      beamwidthDeg: 2.8,
      snrBonusDb: 0.0,
      supportedBands: 'Ku',
      meshDish: false,
    },
  },
  {
    id: 'dish-90cm',
    name: '90cm High-Gain Aluminum Offset Dish',
    brand: 'Gibertini OP90',
    category: 'dish',
    price: 145,
    tagline: 'Precision powder-coated aluminum reflector with high rain-fade margin.',
    badge: 'POPULAR',
    specs: {
      diameterCm: 90,
      gainDbi: 39.6,
      beamwidthDeg: 1.9,
      snrBonusDb: 3.2,
      supportedBands: 'Ku',
      meshDish: false,
    },
  },
  {
    id: 'dish-120cm',
    name: '120cm DX Fiberglass Offset Dish',
    brand: 'Channel Master',
    category: 'dish',
    price: 260,
    tagline: 'Heavy-duty SMC fiberglass parabolic dish built for weak edge footprints.',
    badge: 'PRO DX',
    specs: {
      diameterCm: 120,
      gainDbi: 42.3,
      beamwidthDeg: 1.35,
      snrBonusDb: 5.8,
      supportedBands: 'Ku/C',
      meshDish: false,
    },
  },
  {
    id: 'dish-180cm',
    name: '180cm Prime-Focus C/Ku Mesh Dish',
    brand: 'Jonsa MasterDX',
    category: 'dish',
    price: 460,
    tagline: 'Massive 1.8m prime-focus anodized aluminum mesh dish for extreme fringe & C-band DX.',
    badge: 'EXTREME DX',
    specs: {
      diameterCm: 180,
      gainDbi: 45.9,
      beamwidthDeg: 0.95,
      snrBonusDb: 9.0,
      supportedBands: 'Ku/C',
      meshDish: true,
    },
  },

  // ================= LNB UNITS =================
  {
    id: 'lnb-standard-ku',
    name: 'Universal Single Ku-Band LNB (0.7 dB)',
    brand: 'Inverto Red Extend',
    category: 'lnb',
    price: 25,
    tagline: 'Standard 10.7–12.75 GHz linear H/V polarization Ku-band downconverter.',
    badge: 'BASIC',
    specs: {
      noiseFigureDb: 0.7,
      snrBonusDb: 0.0,
      supportedBands: 'Ku',
    },
  },
  {
    id: 'lnb-black-ultra',
    name: 'High-Gain Ultra Low-Noise PLL LNB (0.2 dB)',
    brand: 'Inverto Black Ultra',
    category: 'lnb',
    price: 58,
    tagline: 'Industry-benchmark phase-locked loop LNB for pulling weak transponders out of noise.',
    badge: 'BEST VALUE',
    specs: {
      noiseFigureDb: 0.2,
      snrBonusDb: 2.6,
      supportedBands: 'Ku',
    },
  },
  {
    id: 'lnb-dual-cku',
    name: 'Pro Dual-Band C/Ku Co-Rotor PLL LNB (0.15 dB)',
    brand: 'Titanium Satellite',
    category: 'lnb',
    price: 115,
    tagline: 'Combined 3.4–4.2 GHz C-Band & 10.7–12.75 GHz Ku-Band gold-plated feedhorn LNB.',
    badge: 'C + Ku BAND',
    specs: {
      noiseFigureDb: 0.15,
      snrBonusDb: 4.1,
      supportedBands: 'Ku/C',
    },
  },

  // ================= MOUNTS & COAXIAL CABLING =================
  {
    id: 'cable-rg6-standard',
    name: 'Galvanized Roof Mast + 25m RG-6 Coax Kit',
    brand: 'Belden SatInstall',
    category: 'mount_cable',
    price: 45,
    tagline: 'Includes heavy-duty deck tripod mast, Az/El bracket, and compression F-connector RG-6 cable.',
    badge: 'REQUIRED',
    specs: {
      cableLossDb: 0.8,
      snrBonusDb: 0.0,
    },
  },
  {
    id: 'cable-rg11-amp',
    name: 'Pro Mast + Low-Loss Copper RG-11 & 18dB Inline Amp',
    brand: 'Kathrein Precision',
    category: 'mount_cable',
    price: 95,
    tagline: 'Zero-loss oxygen-free solid copper coax with weatherproof inline slope-compensated LNA.',
    badge: '+2.2 dB BOOST',
    specs: {
      cableLossDb: 0.1,
      snrBonusDb: 2.2,
    },
  },

  // ================= SATELLITE RECEIVERS (STBs) =================
  {
    id: 'rx-satlink-hd',
    name: 'SatLink HD-200S Digital DVB-S2 Receiver',
    brand: 'SatLink',
    category: 'receiver',
    price: 85,
    tagline: 'Reliable 1080p Full HD FTA satellite receiver with transponder scan & DiSEqC 1.2.',
    badge: 'DVB-S2',
    specs: {
      snrBonusDb: 0.0,
      supportsS2X: false,
      blindScanSpeed: 1,
    },
  },
  {
    id: 'rx-vuplus-4k',
    name: 'Vu+ Ultimo 4K Pro DVB-S2X Enigma2 Receiver',
    brand: 'Vu+ Research',
    category: 'receiver',
    price: 215,
    tagline: 'Flagship Ultra-HD 4K receiver with FBC 8-demodulator tuner, hardware blind-scan & low-threshold lock.',
    badge: '4K DVB-S2X',
    specs: {
      snrBonusDb: 1.8,
      supportsS2X: true,
      blindScanSpeed: 2,
    },
  },
];

export const INITIAL_BUDGET = 1200;
