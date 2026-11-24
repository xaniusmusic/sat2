import { HARDWARE_CATALOG } from '../data/hardwareCatalog';
import { BROADCAST_SATELLITES } from '../data/locationsAndSatellites';
import {
  BroadcastSatellite,
  CityLocation,
  DishOrientation,
  InstalledRig,
  LookAngles,
  SignalMetrics,
  WeatherCondition,
} from '../types/simulator';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6378.14;
const GEO_ORBIT_RADIUS_KM = 42164.14; // 35786 km altitude + 6378.14 km Earth radius
const GEO_RATIO = EARTH_RADIUS_KM / GEO_ORBIT_RADIUS_KM; // ~0.151269

/**
 * Calculates real-world geostationary look angles (Azimuth, Elevation, LNB Skew, Slant Range)
 * from any Earth latitude/longitude to a geostationary satellite at orbital longitude.
 */
export function calculateLookAngles(
  city: CityLocation,
  satellite: BroadcastSatellite
): LookAngles {
  const latRad = city.lat * DEG2RAD;
  const deltaLonRad = (satellite.longitude - city.lon) * DEG2RAD;

  // Cos of central angle gamma between observer and sub-satellite point
  const cosGamma = Math.cos(latRad) * Math.cos(deltaLonRad);
  const sinGamma = Math.sqrt(Math.max(0, 1 - cosGamma * cosGamma));

  // True Elevation Angle (El)
  const elRad = Math.atan2(cosGamma - GEO_RATIO, sinGamma);
  const elevation = Number((elRad * RAD2DEG).toFixed(1));

  // True Compass Azimuth (Az: 0° = North, 90° = East, 180° = South, 270° = West)
  // Using atan2(-sin(deltaLon), -sin(lat)*cos(deltaLon)) mapped to [0, 360)
  const azRad = Math.atan2(
    Math.sin(deltaLonRad),
    -Math.sin(latRad) * Math.cos(deltaLonRad)
  );
  let azimuth = (azRad * RAD2DEG + 360) % 360;
  azimuth = Number(azimuth.toFixed(1));

  // LNB Polarization Skew Angle (Tilt in degrees)
  const skewRad = -Math.atan2(Math.sin(deltaLonRad), Math.tan(latRad));
  let skew = Number((skewRad * RAD2DEG).toFixed(1));
  if (skew > 90) skew -= 180;
  if (skew < -90) skew += 180;
  skew = Number(Math.max(-60, Math.min(60, skew)).toFixed(1));

  // Slant range distance in km
  const distanceKm = Math.round(
    Math.sqrt(
      EARTH_RADIUS_KM * EARTH_RADIUS_KM +
        GEO_ORBIT_RADIUS_KM * GEO_ORBIT_RADIUS_KM -
        2 * EARTH_RADIUS_KM * GEO_ORBIT_RADIUS_KM * cosGamma
    )
  );

  const isAboveHorizon = elevation >= 2.0;

  // Calculate great-circle angular distance from satellite footprint center
  const dLat = city.lat - satellite.coverageCenter.lat;
  const dLon = (city.lon - satellite.coverageCenter.lon) * Math.cos(city.lat * DEG2RAD);
  const angularFootprintDist = Math.sqrt(dLat * dLat + dLon * dLon);

  let footprintStatus: LookAngles['footprintStatus'] = 'CORE BEAM';
  let footprintBaseEirpDbw = 53.0; // Strong core beam

  if (!isAboveHorizon) {
    footprintStatus = 'BELOW HORIZON';
    footprintBaseEirpDbw = 0;
  } else if (angularFootprintDist <= satellite.coverageCenter.coreRadiusDeg) {
    footprintStatus = 'CORE BEAM';
    footprintBaseEirpDbw = 53.5;
  } else if (
    angularFootprintDist <=
    (satellite.coverageCenter.coreRadiusDeg + satellite.coverageCenter.fringeRadiusDeg) * 0.55
  ) {
    footprintStatus = 'PRIMARY BEAM';
    footprintBaseEirpDbw = 49.5;
  } else if (angularFootprintDist <= satellite.coverageCenter.fringeRadiusDeg) {
    footprintStatus = 'FRINGE DX';
    footprintBaseEirpDbw = 44.5;
  } else {
    // Still geometrically above horizon: can be caught as extreme fringe DX with a huge dish or strong widebeam
    footprintStatus = 'FRINGE DX';
    footprintBaseEirpDbw = 41.5;
  }

  return {
    azimuth,
    elevation,
    skew,
    distanceKm,
    isAboveHorizon,
    footprintStatus,
    footprintBaseEirpDbw,
  };
}

/**
 * Shortest angular difference on a 360-degree circle
 */
export function shortestAngleDiff(a: number, b: number): number {
  let diff = ((a - b + 180) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Calculates real-time RF Signal Strength, SNR (dB), BER, and Transponder Lock
 */
export function calculateSignalMetrics(
  city: CityLocation,
  orientation: DishOrientation,
  rig: InstalledRig,
  weather: WeatherCondition
): SignalMetrics {
  // 1. Check physical installation completeness
  const dishItem = HARDWARE_CATALOG.find((h) => h.id === rig.activeDishId);
  const lnbItem = HARDWARE_CATALOG.find((h) => h.id === rig.activeLnbId);
  const cableItem = HARDWARE_CATALOG.find((h) => h.id === rig.activeMountCableId);
  const rxItem = HARDWARE_CATALOG.find((h) => h.id === rig.activeReceiverId);

  if (!rig.mastBolted || !rig.dishMounted || !dishItem) {
    return {
      signalStrengthPct: 0,
      signalQualityPct: 0,
      snrDb: 0,
      ber: '1.0E-01 (OPEN)',
      isLocked: false,
      lockedSatellite: null,
      bestCandidateSatellite: null,
      angularErrorDeg: 99,
      skewErrorDeg: 0,
      statusMessage: 'NO DISH MOUNTED — Install Mast & Parabolic Dish in Hardware Drawer',
    };
  }

  if (!rig.lnbAttached || !lnbItem) {
    return {
      signalStrengthPct: 4,
      signalQualityPct: 0,
      snrDb: 0,
      ber: '1.0E-01 (NO LNB)',
      isLocked: false,
      lockedSatellite: null,
      bestCandidateSatellite: null,
      angularErrorDeg: 99,
      skewErrorDeg: 0,
      statusMessage: 'NO LNB DETECTED — Attach Ku/C-Band LNB to Feedhorn Arm',
    };
  }

  if (!rig.cableRouted || !cableItem) {
    return {
      signalStrengthPct: 0,
      signalQualityPct: 0,
      snrDb: 0,
      ber: '1.0E-01 (NO COAX)',
      isLocked: false,
      lockedSatellite: null,
      bestCandidateSatellite: null,
      angularErrorDeg: 99,
      skewErrorDeg: 0,
      statusMessage: 'LNB POWER OFF — Route RG-6 Coaxial Cable from Dish to Receiver',
    };
  }

  if (!rig.receiverConnected || !rxItem) {
    return {
      signalStrengthPct: 12,
      signalQualityPct: 0,
      snrDb: 0,
      ber: '1.0E-01 (STB OFF)',
      isLocked: false,
      lockedSatellite: null,
      bestCandidateSatellite: null,
      angularErrorDeg: 99,
      skewErrorDeg: 0,
      statusMessage: 'RECEIVER DISCONNECTED — Connect DVB-S2 Receiver to Samsung TV',
    };
  }

  // 2. Evaluate all visible satellites above the local horizon
  const beamwidth = dishItem.specs.beamwidthDeg ?? 2.2;
  const hardwareSnrBonus =
    (dishItem.specs.snrBonusDb ?? 0) +
    (lnbItem.specs.snrBonusDb ?? 0) +
    (cableItem.specs.snrBonusDb ?? 0) +
    (rxItem.specs.snrBonusDb ?? 0);

  const weatherLossDb =
    weather === 'clear' ? 0 : weather === 'cloudy' ? 1.2 : 3.8;

  let bestSat: BroadcastSatellite | null = null;
  let bestSnrDb = 0;
  let bestStrengthPct = 18; // Base LNB thermal noise floor when powered (18%)
  let bestAngularError = 180;
  let bestSkewError = 0;

  for (const sat of BROADCAST_SATELLITES) {
    const look = calculateLookAngles(city, sat);
    if (!look.isAboveHorizon) continue;

    const dAz = shortestAngleDiff(orientation.azimuth, look.azimuth);
    const dEl = orientation.elevation - look.elevation;
    // True sky angular separation accounting for elevation cosine foreshortening
    const elCos = Math.max(0.25, Math.cos(look.elevation * DEG2RAD));
    const angularError = Math.sqrt((dAz * elCos) ** 2 + dEl ** 2);
    const skewError = Math.abs(orientation.skew - look.skew);

    if (angularError < bestAngularError) {
      bestAngularError = angularError;
      bestSkewError = skewError;
      bestSat = sat;
    }

    // Calculate peak achievable SNR for this satellite & hardware rig at exact boresight
    // Core beam (~53.5 dBW) yields ~11.5 dB base on a 60cm dish; Fringe (~44.5 dBW) yields ~6.0 dB base on 60cm (needs 90cm+ dish or low-noise LNB!)
    const footprintFactor = (look.footprintBaseEirpDbw - 41.0) * 0.65;
    const AtmosphericElPenalty = look.elevation < 12 ? (12 - look.elevation) * 0.18 : 0;
    const peakSnr = Math.max(
      2.0,
      4.5 + footprintFactor + hardwareSnrBonus - weatherLossDb - AtmosphericElPenalty
    );

    // Parabolic antenna main lobe + first sidelobe Gaussian/Sinc approximation
    // Wider capture skirt so users can feel the signal rise within ~6 degrees
    const captureHalfWidth = Math.max(2.0, beamwidth * 1.35);
    const mainLobeFactor = Math.exp(-Math.pow(angularError / captureHalfWidth, 2) * 1.65);
    // Subtle sidelobe ring around 4.5-6 degrees so sat-finder beeper warns you're close
    const sideLobeFactor =
      angularError > captureHalfWidth && angularError < captureHalfWidth * 3.2
        ? 0.18 * Math.exp(-Math.pow((angularError - captureHalfWidth * 1.8) / 2.2, 2))
        : 0;

    // Cross-polarization LNB skew loss (up to 3.5 dB penalty if skew is off by 45+ deg)
    const skewPenaltyDb = Math.min(3.8, (skewError / 22) ** 1.5);

    const currentSatSnr = Math.max(
      0,
      peakSnr * Math.max(mainLobeFactor, sideLobeFactor) - skewPenaltyDb * mainLobeFactor
    );

    const currentStrength = Math.min(
      99,
      Math.round(
        18 +
          Math.max(mainLobeFactor, sideLobeFactor * 1.6) *
            Math.min(81, 45 + footprintFactor * 3.5 + hardwareSnrBonus * 2.2)
      )
    );

    if (currentSatSnr > bestSnrDb) {
      bestSnrDb = currentSatSnr;
      bestStrengthPct = Math.max(bestStrengthPct, currentStrength);
      bestSat = sat;
      bestAngularError = angularError;
      bestSkewError = skewError;
    }
  }

  const snrRounded = Number(Math.min(19.5, bestSnrDb).toFixed(1));
  const minLockSnr = bestSat ? bestSat.minSNRForLock : 7.2;
  const isLocked = bestSat !== null && snrRounded >= minLockSnr && bestAngularError <= 2.6;

  const signalQualityPct = Math.min(
    100,
    Math.max(0, Math.round((snrRounded / 16.0) * 100))
  );

  // Bit Error Rate (BER) string formatting
  let ber = '1.0E-02';
  if (snrRounded >= 14.0) ber = '0.0E+00 (QEF)';
  else if (snrRounded >= 11.0) ber = '1.2E-07';
  else if (snrRounded >= minLockSnr) ber = '4.8E-05';
  else if (snrRounded >= 4.0) ber = '3.5E-03';

  let statusMessage = 'NO TRANSPONDER LOCK — Adjust Azimuth & Elevation toward target satellite';
  if (isLocked && bestSat) {
    statusMessage = `LOCKED: ${bestSat.name} (${bestSat.orbitalSlot}) — SNR ${snrRounded} dB`;
  } else if (bestSat && bestAngularError < 6.5) {
    statusMessage = `NEAR BEAM: ${bestSat.name} (${bestSat.orbitalSlot}) within ${bestAngularError.toFixed(1)}° — Fine-tune gimbal!`;
  }

  return {
    signalStrengthPct: bestStrengthPct,
    signalQualityPct,
    snrDb: snrRounded,
    ber,
    isLocked,
    lockedSatellite: isLocked ? bestSat : null,
    bestCandidateSatellite: bestSat,
    angularErrorDeg: Number(bestAngularError.toFixed(2)),
    skewErrorDeg: Number(bestSkewError.toFixed(1)),
    statusMessage,
  };
}

/**
 * Procedural Web Audio API Sat-Finder Tone Synthesizer
 * Produces variable-pitch pulsed audio feedback like a real inline RF Sat-Finder meter
 */
class SatFinderAudioEngine {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private enabled = false;
  private pulseTimer: number | null = null;
  private currentStrength = 0;
  private currentLocked = false;

  public setEnabled(enable: boolean) {
    this.enabled = enable;
    if (enable) {
      this.initContext();
    } else {
      this.stopSound();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.osc && this.ctx) {
      this.osc = this.ctx.createOscillator();
      this.gain = this.ctx.createGain();
      this.osc.type = 'triangle';
      this.osc.frequency.value = 440;
      this.gain.gain.value = 0;
      this.osc.connect(this.gain);
      this.gain.connect(this.ctx.destination);
      this.osc.start();
    }
    if (!this.pulseTimer) {
      let phase = false;
      this.pulseTimer = window.setInterval(() => {
        if (!this.enabled || !this.ctx || !this.gain || !this.osc) return;
        phase = !phase;
        const now = this.ctx.currentTime;
        // Pitch rises from 380 Hz (noise floor) to 1480 Hz (strong lock)
        const targetFreq = 360 + (this.currentStrength / 100) * 1120;
        this.osc.frequency.setTargetAtTime(targetFreq, now, 0.03);

        if (this.currentLocked) {
          // Steady rapid lock tone
          this.gain.gain.setTargetAtTime(phase ? 0.06 : 0.025, now, 0.02);
        } else if (this.currentStrength > 22) {
          // Pulsing finder beep
          this.gain.gain.setTargetAtTime(phase ? 0.045 : 0.0, now, 0.015);
        } else {
          // Faint background tick
          this.gain.gain.setTargetAtTime(0, now, 0.02);
        }
      }, 140);
    }
  }

  public updateMetrics(strengthPct: number, isLocked: boolean) {
    this.currentStrength = strengthPct;
    this.currentLocked = isLocked;
  }

  private stopSound() {
    if (this.gain && this.ctx) {
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
  }
}

export const satFinderBeeper = new SatFinderAudioEngine();
