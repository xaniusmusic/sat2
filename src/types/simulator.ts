export type BandType = 'Ku' | 'C' | 'Ku/C';

export interface CityLocation {
  id: string;
  city: string;
  country: string;
  countryCode: string; // ISO-2 lowercase for GitHub iptv-org fetching
  region: 'Europe' | 'MENA' | 'North America' | 'South America' | 'Asia' | 'Oceania' | 'Africa';
  lat: number; // Decimal degrees (+N, -S)
  lon: number; // Decimal degrees (+E, -W)
}

export interface Transponder {
  id: string;
  frequency: number; // MHz, e.g. 11494
  polarization: 'H' | 'V';
  symbolRate: number; // kSym/s, e.g. 22000
  fec: string; // e.g. '2/3', '3/4', '5/6'
  system: 'DVB-S' | 'DVB-S2' | 'DVB-S2X';
  modulation: 'QPSK' | '8PSK' | '16APSK';
  band: 'Ku' | 'C';
  beamName: string;
  defaultChannels: SeedChannel[];
}

export interface SeedChannel {
  name: string;
  category: string;
  language: string;
  countryCode: string;
  streamUrl: string;
  logo?: string;
  resolution: '1080p HD' | '4K UHD' | '720p HD' | '576i SD';
}

export interface BroadcastSatellite {
  id: string;
  name: string;
  orbitalSlot: string; // e.g. "19.2°E"
  longitude: number; // +East, -West (e.g. 19.2, -7.0, -97.0)
  operator: string;
  band: BandType;
  primaryRegions: CityLocation['region'][];
  coverageCenter: { lat: number; lon: number; coreRadiusDeg: number; fringeRadiusDeg: number };
  description: string;
  minSNRForLock: number; // dB, e.g. 7.5
  transponders: Transponder[];
}

export type HardwareCategory = 'dish' | 'lnb' | 'mount_cable' | 'receiver';

export interface HardwareItem {
  id: string;
  name: string;
  brand: string;
  category: HardwareCategory;
  price: number;
  tagline: string;
  specs: {
    diameterCm?: number; // For dishes
    gainDbi?: number; // For dishes
    beamwidthDeg?: number; // Half-power beamwidth
    noiseFigureDb?: number; // For LNBs
    snrBonusDb?: number; // Net SNR boost
    supportedBands?: BandType;
    supportsS2X?: boolean;
    blindScanSpeed?: number;
    cableLossDb?: number;
    meshDish?: boolean;
  };
  badge?: string;
}

export interface InstalledRig {
  purchasedIds: string[];
  activeDishId: string | null;
  activeLnbId: string | null;
  activeMountCableId: string | null;
  activeReceiverId: string | null;
  // Physical DIY installation step completion flags
  mastBolted: boolean;
  dishMounted: boolean;
  lnbAttached: boolean;
  cableRouted: boolean;
  receiverConnected: boolean;
}

export interface DishOrientation {
  azimuth: number; // 0 to 360 deg
  elevation: number; // 0 to 90 deg
  skew: number; // -60 to +60 deg
}

export interface LookAngles {
  azimuth: number;
  elevation: number;
  skew: number;
  distanceKm: number;
  isAboveHorizon: boolean;
  footprintStatus: 'CORE BEAM' | 'PRIMARY BEAM' | 'FRINGE DX' | 'OUT OF FOOTPRINT' | 'BELOW HORIZON';
  footprintBaseEirpDbw: number;
}

export interface SignalMetrics {
  signalStrengthPct: number; // 0 - 100%
  signalQualityPct: number; // 0 - 100%
  snrDb: number; // 0.0 to 18.5 dB
  ber: string; // Bit Error Rate formatted string
  isLocked: boolean;
  lockedSatellite: BroadcastSatellite | null;
  bestCandidateSatellite: BroadcastSatellite | null;
  angularErrorDeg: number;
  skewErrorDeg: number;
  statusMessage: string;
}

export interface ScannedChannel {
  id: string;
  channelNumber: number;
  name: string;
  satelliteId: string;
  satelliteName: string;
  orbitalSlot: string;
  transponderFreq: number;
  polarization: 'H' | 'V';
  symbolRate: number;
  category: string;
  countryCode: string;
  streamUrl: string;
  resolution: string;
  source: 'GitHub IPTV-org Live' | 'DVB-S2 Satellite Mux';
}

export type CameraPreset = 'rooftop' | 'living_room' | 'tv_closeup';

export type WeatherCondition = 'clear' | 'cloudy' | 'rain_fade';
