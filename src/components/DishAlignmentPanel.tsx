import React, { useState } from 'react';
import {
  ChevronDown,
  Compass,
  Crosshair,
  Lock,
  Radio,
  RotateCcw,
  Satellite,
  Tv,
  Unlock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BROADCAST_SATELLITES } from '../data/locationsAndSatellites';
import {
  BroadcastSatellite,
  CityLocation,
  DishOrientation,
  SignalMetrics,
} from '../types/simulator';
import { calculateLookAngles } from '../utils/rfPhysics';

interface DishAlignmentPanelProps {
  city: CityLocation;
  orientation: DishOrientation;
  onChangeOrientation: (next: DishOrientation) => void;
  signalMetrics: SignalMetrics;
  selectedTargetSat: BroadcastSatellite;
  onSelectTargetSat: (sat: BroadcastSatellite) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onOpenTvOsd: () => void;
}

function getCardinalLabel(az: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(az / 45) % 8];
}

export const DishAlignmentPanel: React.FC<DishAlignmentPanelProps> = ({
  city,
  orientation,
  onChangeOrientation,
  signalMetrics,
  selectedTargetSat,
  onSelectTargetSat,
  audioEnabled,
  onToggleAudio,
  onOpenTvOsd,
}) => {
  const [stepSize, setStepSize] = useState<number>(1.0);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const targetLook = calculateLookAngles(city, selectedTargetSat);

  const adjustAzimuth = (delta: number) => {
    const nextAz = Number(((orientation.azimuth + delta + 360) % 360).toFixed(1));
    onChangeOrientation({ ...orientation, azimuth: nextAz });
  };

  const adjustElevation = (delta: number) => {
    const nextEl = Number(Math.max(0, Math.min(90, orientation.elevation + delta)).toFixed(1));
    onChangeOrientation({ ...orientation, elevation: nextEl });
  };

  const adjustSkew = (delta: number) => {
    const nextSkew = Number(Math.max(-60, Math.min(60, orientation.skew + delta)).toFixed(1));
    onChangeOrientation({ ...orientation, skew: nextSkew });
  };

  // Slew close to target satellite (within ~1.6 degrees) so the user can experience fine-peaking the signal!
  const handleSlewNearTarget = () => {
    if (!targetLook.isAboveHorizon) return;
    const offsetAz = Number(((targetLook.azimuth + 1.3 + 360) % 360).toFixed(1));
    const offsetEl = Number(Math.max(0, Math.min(90, targetLook.elevation - 0.9)).toFixed(1));
    onChangeOrientation({
      azimuth: offsetAz,
      elevation: offsetEl,
      skew: Number((targetLook.skew + 3.0).toFixed(1)),
    });
  };

  // Exact boresight alignment
  const handleExactLockAlign = () => {
    if (!targetLook.isAboveHorizon) return;
    onChangeOrientation({
      azimuth: targetLook.azimuth,
      elevation: targetLook.elevation,
      skew: targetLook.skew,
    });
  };

  return (
    <div className="fixed right-4 top-20 z-30 w-88 max-w-[calc(100vw-2rem)] bg-[#0B0F17]/90 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl text-slate-100 overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="px-4 py-3 bg-[#131B2E]/90 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#00F0FF]" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-white">
            DISH GIMBAL & RF SAT-FINDER
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Sat-Finder Audio Beeper Toggle */}
          <button
            onClick={onToggleAudio}
            className={`px-2 py-1 rounded-md text-[11px] font-mono-tech flex items-center gap-1 border transition cursor-pointer ${
              audioEnabled
                ? 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF]/50'
                : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
            title="Toggle Variable-Pitch RF Sat-Finder Audio Tone"
          >
            {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{audioEnabled ? 'TONE ON' : 'TONE'}</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded-md bg-slate-800/70 hover:bg-slate-700 text-slate-300"
            title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 space-y-4 max-h-[calc(100vh-7.5rem)] overflow-y-auto">
          {/* 1. REAL-TIME DIGITAL RF SAT-FINDER METER */}
          <div
            className={`p-3.5 rounded-xl border transition ${
              signalMetrics.isLocked
                ? 'bg-emerald-950/30 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                : signalMetrics.snrDb >= 3.5
                ? 'bg-amber-950/25 border-amber-500/50'
                : 'bg-[#131B2E]/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                {signalMetrics.isLocked ? (
                  <Lock className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-rose-400" />
                )}
                <span
                  className={`font-mono-tech text-xs font-bold ${
                    signalMetrics.isLocked
                      ? 'text-emerald-300'
                      : signalMetrics.snrDb >= 3.5
                      ? 'text-amber-300'
                      : 'text-rose-400'
                  }`}
                >
                  {signalMetrics.isLocked
                    ? `LOCKED • ${signalMetrics.lockedSatellite?.orbitalSlot}`
                    : signalMetrics.snrDb >= 3.5
                    ? 'CARRIER DETECTED (PEAK GIMBAL)'
                    : 'NO TRANSPONDER LOCK'}
                </span>
              </div>
              <span className="font-mono-tech text-sm font-bold text-[#00F0FF]">
                {signalMetrics.snrDb.toFixed(1)} dB
              </span>
            </div>

            {/* Signal Strength Bar */}
            <div className="space-y-1 mb-2.5">
              <div className="flex justify-between text-[11px] font-mono-tech">
                <span className="text-slate-400">SIGNAL LEVEL (IF AGC)</span>
                <span className="text-slate-200 font-semibold">
                  {signalMetrics.signalStrengthPct}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-150 bg-gradient-to-r from-sky-500 to-[#00F0FF]"
                  style={{ width: `${signalMetrics.signalStrengthPct}%` }}
                />
              </div>
            </div>

            {/* Signal Quality (SNR) Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono-tech">
                <span className="text-slate-400">SIGNAL QUALITY (MER/SNR)</span>
                <span
                  className={`font-semibold ${
                    signalMetrics.isLocked ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {signalMetrics.signalQualityPct}% • BER {signalMetrics.ber}
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    signalMetrics.isLocked
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-300'
                      : signalMetrics.snrDb >= 3.5
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${signalMetrics.signalQualityPct}%` }}
                />
              </div>
            </div>

            {/* Status Diagnostic Line */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono-tech text-slate-300">
              {signalMetrics.statusMessage}
            </div>

            {/* Quick CTA when locked */}
            {signalMetrics.isLocked && (
              <button
                onClick={onOpenTvOsd}
                className="mt-2.5 w-full py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer"
              >
                <Tv className="w-4 h-4" />
                <span>OPEN SAMSUNG TV & SCAN CHANNELS</span>
              </button>
            )}
          </div>

          {/* 2. TARGET SATELLITE LOOK-ANGLE CALCULATOR */}
          <div className="p-3.5 rounded-xl bg-[#131B2E]/75 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Target Broadcast Satellite</span>
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono-tech font-bold ${
                  !targetLook.isAboveHorizon
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : targetLook.footprintStatus === 'CORE BEAM'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                {targetLook.footprintStatus}
              </span>
            </div>

            {/* Satellite Dropdown */}
            <select
              value={selectedTargetSat.id}
              onChange={(e) => {
                const found = BROADCAST_SATELLITES.find((s) => s.id === e.target.value);
                if (found) onSelectTargetSat(found);
              }}
              className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs font-mono-tech text-white focus:outline-none focus:border-[#00F0FF]"
            >
              {BROADCAST_SATELLITES.map((sat) => {
                const lk = calculateLookAngles(city, sat);
                return (
                  <option key={sat.id} value={sat.id}>
                    {lk.isAboveHorizon ? '🟢' : '🔴'} {sat.orbitalSlot} — {sat.name} (
                    {lk.isAboveHorizon ? `El ${lk.elevation}°` : 'Below Horizon'})
                  </option>
                );
              })}
            </select>

            {/* Calculated True Geodesic Look Angles for Selected City */}
            {targetLook.isAboveHorizon ? (
              <>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-[#0B0F17]/80 border border-slate-800 text-center">
                    <div className="text-[10px] font-mono-tech text-slate-400">TARGET AZ</div>
                    <div className="text-xs font-mono-tech font-bold text-[#00F0FF] mt-0.5">
                      {targetLook.azimuth}°
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0B0F17]/80 border border-slate-800 text-center">
                    <div className="text-[10px] font-mono-tech text-slate-400">TARGET EL</div>
                    <div className="text-xs font-mono-tech font-bold text-[#00F0FF] mt-0.5">
                      {targetLook.elevation}°
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0B0F17]/80 border border-slate-800 text-center">
                    <div className="text-[10px] font-mono-tech text-slate-400">LNB SKEW</div>
                    <div className="text-xs font-mono-tech font-bold text-[#00F0FF] mt-0.5">
                      {targetLook.skew > 0 ? `+${targetLook.skew}°` : `${targetLook.skew}°`}
                    </div>
                  </div>
                </div>

                {/* Assisted Slew / Exact Peak Helper Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={handleSlewNearTarget}
                    className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-mono-tech flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="Point dish within ~1.5° of target so you can manually fine-tune the peak"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#00F0FF]" />
                    <span>Point Near (~1.5°)</span>
                  </button>
                  <button
                    onClick={handleExactLockAlign}
                    className="py-1.5 px-2.5 rounded-lg bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00F0FF] border border-[#00F0FF]/40 text-[11px] font-mono-tech font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="Auto-align dish to exact calculated Azimuth, Elevation & LNB Skew"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>Auto-Lock Target</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-500/40 text-[11px] text-rose-300 font-mono-tech">
                {selectedTargetSat.name} ({selectedTargetSat.orbitalSlot}) is at {targetLook.elevation}°
                elevation (blocked by Earth curvature from {city.city}). Choose a visible 🟢
                satellite above!
              </div>
            )}
          </div>

          {/* 3. MANUAL 3-AXIS GIMBAL CONTROLS (AZIMUTH, ELEVATION, LNB SKEW) */}
          <div className="p-3.5 rounded-xl bg-[#131B2E]/75 border border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono-tech uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Manual Dish Gimbal</span>
              </span>

              {/* Coarse (1.0°) vs Fine (0.1°) Step Resolution */}
              <div className="flex items-center rounded-lg bg-[#0B0F17] p-0.5 border border-slate-800 text-[10px] font-mono-tech">
                <button
                  onClick={() => setStepSize(1.0)}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    stepSize === 1.0
                      ? 'bg-[#00F0FF] text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  COARSE 1.0°
                </button>
                <button
                  onClick={() => setStepSize(0.1)}
                  className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                    stepSize === 0.1
                      ? 'bg-[#00F0FF] text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  FINE 0.1°
                </button>
              </div>
            </div>

            {/* AZIMUTH CONTROL (0 - 360°) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono-tech">
                <span className="text-slate-300">
                  AZIMUTH ({getCardinalLabel(orientation.azimuth)})
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustAzimuth(-stepSize)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-16 text-center font-bold text-[#00F0FF]">
                    {orientation.azimuth.toFixed(1)}°
                  </span>
                  <button
                    onClick={() => adjustAzimuth(stepSize)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={360}
                step={stepSize}
                value={orientation.azimuth}
                onChange={(e) =>
                  onChangeOrientation({
                    ...orientation,
                    azimuth: Number(parseFloat(e.target.value).toFixed(1)),
                  })
                }
                className="w-full accent-[#00F0FF] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* ELEVATION CONTROL (0 - 90°) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono-tech">
                <span className="text-slate-300">ELEVATION (TILT)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustElevation(-stepSize)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-16 text-center font-bold text-[#00F0FF]">
                    {orientation.elevation.toFixed(1)}°
                  </span>
                  <button
                    onClick={() => adjustElevation(stepSize)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={90}
                step={stepSize}
                value={orientation.elevation}
                onChange={(e) =>
                  onChangeOrientation({
                    ...orientation,
                    elevation: Number(parseFloat(e.target.value).toFixed(1)),
                  })
                }
                className="w-full accent-[#00F0FF] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* LNB POLARIZATION SKEW CONTROL (-60° to +60°) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono-tech">
                <span className="text-slate-300">LNB SKEW (POLARITY)</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => adjustSkew(-stepSize)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-16 text-center font-bold text-[#00F0FF]">
                    {orientation.skew > 0
                      ? `+${orientation.skew.toFixed(1)}°`
                      : `${orientation.skew.toFixed(1)}°`}
                  </span>
                  <button
                    onClick={() => adjustSkew(stepSize)}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
              <input
                type="range"
                min={-60}
                max={60}
                step={stepSize}
                value={orientation.skew}
                onChange={(e) =>
                  onChangeOrientation({
                    ...orientation,
                    skew: Number(parseFloat(e.target.value).toFixed(1)),
                  })
                }
                className="w-full accent-[#00F0FF] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
