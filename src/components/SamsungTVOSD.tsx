import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  Activity,
  Antenna,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  Info,
  ListVideo,
  Lock,
  Play,
  Power,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Sliders,
  Sparkles,
  Tv,
  Unlock,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import { VERIFIED_HLS_STREAMS } from '../data/locationsAndSatellites';
import {
  BroadcastSatellite,
  CityLocation,
  ScannedChannel,
  SignalMetrics,
  Transponder,
} from '../types/simulator';

interface SamsungTVOSDProps {
  isOpen: boolean;
  onClose: () => void;
  city: CityLocation;
  signalMetrics: SignalMetrics;
  selectedTargetSat: BroadcastSatellite;
  scannedChannels: ScannedChannel[];
  activeChannel: ScannedChannel | null;
  onSelectChannel: (ch: ScannedChannel) => void;
  isScanning: boolean;
  scanProgress: number;
  currentScanTp: Transponder | null;
  onStartScan: (specificTp?: Transponder) => void;
  onAutoAlignAndLock: () => void;
}

export const SamsungTVOSD: React.FC<SamsungTVOSDProps> = ({
  isOpen,
  onClose,
  city,
  signalMetrics,
  selectedTargetSat,
  scannedChannels,
  activeChannel,
  onSelectChannel,
  isScanning,
  scanProgress,
  currentScanTp,
  onStartScan,
  onAutoAlignAndLock,
}) => {
  const [osdTab, setOsdTab] = useState<'live_tv' | 'scanner' | 'antenna_setup'>('scanner');
  const [lnbType, setLnbType] = useState('Universal Ku (9750/10600 MHz)');
  const [lnbPower, setLnbPower] = useState('13V / 18V Auto');
  const [diseqcPort, setDiseqcPort] = useState('DiSEqC 1.0 — Port A');
  const [selectedTpId, setSelectedTpId] = useState<string>('ALL');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showInfoBanner, setShowInfoBanner] = useState<boolean>(true);
  const [streamStatus, setStreamStatus] = useState<'loading' | 'playing' | 'backup_mux'>('loading');
  const [channelSearch, setChannelSearch] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Switch automatically to Live TV tab once channels are scanned and user picks one
  useEffect(() => {
    if (activeChannel && !isScanning && scannedChannels.length > 0) {
      setOsdTab('live_tv');
    }
  }, [activeChannel?.id]);

  // Attach HLS.js live stream whenever activeChannel changes
  useEffect(() => {
    if (!isOpen || !activeChannel || !videoRef.current) return;

    const video = videoRef.current;
    setStreamStatus('loading');

    const loadStreamUrl = (url: string, isBackup = false) => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          manifestLoadingTimeOut: 6000,
          levelLoadingTimeOut: 6000,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStreamStatus(isBackup ? 'backup_mux' : 'playing');
          video.play().catch(() => {
            video.muted = true;
            setIsMuted(true);
            video.play().catch(() => {});
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            if (!isBackup) {
              // Seamless fallback to verified DVB-S2 satellite stream if community GitHub stream is offline/CORS-blocked
              loadStreamUrl(VERIFIED_HLS_STREAMS.dwEnglish, true);
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url;
        video.addEventListener('loadedmetadata', () => {
          setStreamStatus(isBackup ? 'backup_mux' : 'playing');
          video.play().catch(() => {});
        });
        video.addEventListener('error', () => {
          if (!isBackup) loadStreamUrl(VERIFIED_HLS_STREAMS.dwEnglish, true);
        });
      }
    };

    loadStreamUrl(activeChannel.streamUrl, false);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, activeChannel?.id, activeChannel?.streamUrl]);

  if (!isOpen) return null;

  const activeSat = signalMetrics.lockedSatellite ?? selectedTargetSat;

  const handleChannelStep = (dir: 1 | -1) => {
    if (scannedChannels.length === 0) return;
    const currentIdx = activeChannel
      ? scannedChannels.findIndex((c) => c.id === activeChannel.id)
      : 0;
    const nextIdx = (currentIdx + dir + scannedChannels.length) % scannedChannels.length;
    onSelectChannel(scannedChannels[nextIdx]);
    setOsdTab('live_tv');
    setShowInfoBanner(true);
  };

  const filteredChannels = scannedChannels.filter(
    (ch) =>
      ch.name.toLowerCase().includes(channelSearch.toLowerCase()) ||
      ch.category.toLowerCase().includes(channelSearch.toLowerCase()) ||
      ch.orbitalSlot.toLowerCase().includes(channelSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-6xl flex flex-col lg:flex-row gap-4 items-stretch">
        {/* ================= MAIN SAMSUNG 65" NEO QLED TV FRAME ================= */}
        <div className="flex-1 flex flex-col bg-[#080C14] border-4 border-slate-700/90 rounded-2xl shadow-[0_0_70px_rgba(0,240,255,0.18)] overflow-hidden">
          {/* Top Samsung TV Status Bezel */}
          <div className="px-5 py-2.5 bg-[#0F172A] border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded bg-[#00F0FF]/15 border border-[#00F0FF]/40 font-mono-tech text-xs font-bold text-[#00F0FF]">
                HDMI 1 • DVB-S2X STB
              </span>
              <span className="text-xs font-display font-semibold text-slate-300">
                Samsung 65&quot; QN90D Neo QLED 4K Smart TV
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono-tech flex items-center gap-1.5 ${
                  signalMetrics.isLocked
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                }`}
              >
                {signalMetrics.isLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      LOCKED: {signalMetrics.lockedSatellite?.name} (
                      {signalMetrics.lockedSatellite?.orbitalSlot}) • {signalMetrics.snrDb} dB
                    </span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>NO SIGNAL LOCK ({signalMetrics.snrDb} dB)</span>
                  </>
                )}
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Exit TV Close-Up back to 3D Room"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* DVB-S2 Receiver OSD Navigation Bar */}
          <div className="px-5 py-2.5 bg-[#11192C] border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOsdTab('scanner')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  osdTab === 'scanner'
                    ? 'bg-[#00F0FF] text-slate-950 shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                <span>1. Frequency & Blind Scanner</span>
              </button>

              <button
                onClick={() => setOsdTab('antenna_setup')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  osdTab === 'antenna_setup'
                    ? 'bg-[#00F0FF] text-slate-950 shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>2. Receiver & LNB Config</span>
              </button>

              <button
                onClick={() => setOsdTab('live_tv')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  osdTab === 'live_tv'
                    ? 'bg-emerald-400 text-slate-950 shadow-sm'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>3. Live IPTV Broadcast ({scannedChannels.length} Channels)</span>
              </button>
            </div>

            <div className="text-xs font-mono-tech text-slate-400 flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>
                Footprint Location: <strong className="text-white">{city.city}, {city.country}</strong>
              </span>
            </div>
          </div>

          {/* TV Screen Display Viewport */}
          <div className="relative flex-1 min-h-[450px] bg-[#070B12] flex flex-col justify-between overflow-hidden">
            {/* ================= TAB 1: TRANSPONDER & BLIND FREQUENCY SCANNER ================= */}
            {osdTab === 'scanner' && (
              <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto">
                {/* Left Column: Transponder Scan Controls */}
                <div className="md:col-span-6 space-y-4">
                  <div className="p-4 rounded-xl bg-[#131B2E]/90 border border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                        <Radio className="w-4 h-4 text-[#00F0FF]" />
                        <span>DVB-S2 / S2X TRANSPONDER SCANNER</span>
                      </h3>
                      <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono-tech">
                        GitHub iptv-org M3U
                      </span>
                    </div>

                    {!signalMetrics.isLocked ? (
                      <div className="p-3.5 rounded-xl bg-rose-950/35 border border-rose-500/50 space-y-2.5">
                        <div className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                          <Unlock className="w-4 h-4" />
                          <span>ROOFTOP DISH NOT LOCKED ONTO SATELLITE</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          To scan frequencies, your rooftop dish must be aligned with a visible
                          broadcast satellite ({selectedTargetSat.name} at{' '}
                          {selectedTargetSat.orbitalSlot}). You can align it manually on the rooftop
                          or click Auto-Align below:
                        </p>
                        <button
                          onClick={onAutoAlignAndLock}
                          className="w-full py-2 px-3 rounded-lg bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-slate-950 font-display font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>
                            Auto-Align Dish to {selectedTargetSat.name} ({selectedTargetSat.orbitalSlot})
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-mono-tech font-bold text-emerald-300">
                            ● LOCKED: {activeSat.name} ({activeSat.orbitalSlot})
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Carrier SNR: {signalMetrics.snrDb} dB • Quality:{' '}
                            {signalMetrics.signalQualityPct}% • Ready to Demux PAT/PMT
                          </div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      </div>
                    )}

                    {/* Scan Mode / Transponder Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-mono-tech text-slate-400">
                        SELECT SCAN MODE OR SPECIFIC TRANSPONDER FREQUENCY
                      </label>
                      <select
                        value={selectedTpId}
                        onChange={(e) => setSelectedTpId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 text-xs font-mono-tech text-white"
                      >
                        <option value="ALL">
                          ★ FULL SATELLITE BLIND SCAN (All {activeSat.transponders.length}{' '}
                          Transponders + GitHub IPTV Mux)
                        </option>
                        {activeSat.transponders.map((tp) => (
                          <option key={tp.id} value={tp.id}>
                            TP {tp.frequency} MHz {tp.polarization} • SR {tp.symbolRate} • FEC{' '}
                            {tp.fec} ({tp.system} {tp.modulation})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Start Scan Button */}
                    <button
                      onClick={() => {
                        const specificTp =
                          selectedTpId === 'ALL'
                            ? undefined
                            : activeSat.transponders.find((t) => t.id === selectedTpId);
                        onStartScan(specificTp);
                      }}
                      disabled={!signalMetrics.isLocked || isScanning}
                      className={`w-full py-2.5 px-4 rounded-xl font-display font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
                        !signalMetrics.isLocked
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          : isScanning
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : 'bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-slate-950 shadow-lg shadow-[#00F0FF]/20'
                      }`}
                    >
                      <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>
                        {isScanning
                          ? `SCANNING TRANSPONDERS (${scanProgress}%)...`
                          : `START DVB-S2 FREQUENCY SCAN ON ${activeSat.orbitalSlot}`}
                      </span>
                    </button>

                    {/* Live Progress Bar During Scan */}
                    {(isScanning || scanProgress > 0) && (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-xs font-mono-tech">
                          <span className="text-[#00F0FF]">
                            {currentScanTp
                              ? `Demuxing ${currentScanTp.frequency} MHz ${currentScanTp.polarization} (SR ${currentScanTp.symbolRate})...`
                              : 'Scan Complete'}
                          </span>
                          <span className="text-emerald-400 font-bold">{scanProgress}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-[#00F0FF] to-emerald-400 transition-all duration-300"
                            style={{ width: `${scanProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Transponder Frequency Table for Current Satellite */}
                  <div className="p-4 rounded-xl bg-[#131B2E]/60 border border-slate-800 space-y-2">
                    <div className="text-xs font-mono-tech uppercase text-slate-400">
                      {activeSat.name} ({activeSat.orbitalSlot}) Active Transponder Table
                    </div>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {activeSat.transponders.map((tp) => (
                        <div
                          key={tp.id}
                          className="p-2 rounded-lg bg-[#0B0F17]/80 border border-slate-800/80 flex items-center justify-between text-xs font-mono-tech"
                        >
                          <div>
                            <span className="text-[#00F0FF] font-bold">
                              {tp.frequency} {tp.polarization}
                            </span>{' '}
                            <span className="text-slate-300">SR {tp.symbolRate}</span>{' '}
                            <span className="text-slate-500">
                              {tp.system} {tp.modulation}
                            </span>
                          </div>
                          <span className="text-[11px] text-emerald-400">{tp.beamName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Discovered Channels List */}
                <div className="md:col-span-6 flex flex-col p-4 rounded-xl bg-[#131B2E]/90 border border-slate-700/80">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <ListVideo className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-display text-sm font-bold text-white">
                        DISCOVERED SATELLITE IPTV CHANNELS ({scannedChannels.length})
                      </h3>
                    </div>
                    <input
                      type="text"
                      placeholder="Filter channels..."
                      value={channelSearch}
                      onChange={(e) => setChannelSearch(e.target.value)}
                      className="px-2.5 py-1 rounded-md bg-[#0B0F17] border border-slate-700 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
                    />
                  </div>

                  {scannedChannels.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
                      <SatelliteDishPlaceholder />
                      <p className="text-sm font-semibold text-slate-300 mt-3">
                        No Satellite Channels Stored in Receiver Memory
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs">
                        Lock your rooftop dish onto a broadcast satellite and click{' '}
                        <strong className="text-[#00F0FF]">START DVB-S2 FREQUENCY SCAN</strong> to
                        populate live channels from GitHub IPTV lists!
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-1.5 max-h-80 overflow-y-auto pr-1">
                      {filteredChannels.map((ch) => {
                        const isSelected = activeChannel?.id === ch.id;
                        return (
                          <button
                            key={ch.id}
                            onClick={() => {
                              onSelectChannel(ch);
                              setOsdTab('live_tv');
                            }}
                            className={`w-full p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-2 cursor-pointer ${
                              isSelected
                                ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-white'
                                : 'bg-[#0B0F17]/80 border-slate-800/90 hover:border-slate-600 text-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono-tech text-[11px] text-[#00F0FF] font-bold">
                                  CH {String(ch.channelNumber).padStart(2, '0')}
                                </span>
                                <span className="font-semibold text-xs truncate">{ch.name}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[10px] font-mono-tech text-slate-400">
                                <span>{ch.orbitalSlot}</span>
                                <span>•</span>
                                <span>
                                  {ch.transponderFreq} MHz {ch.polarization}
                                </span>
                                <span>•</span>
                                <span className="text-emerald-400">{ch.source}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-2 py-0.5 rounded bg-slate-800/90 text-[10px] font-mono-tech text-amber-300">
                                {ch.resolution}
                              </span>
                              <Play className="w-4 h-4 text-[#00F0FF]" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================= TAB 2: RECEIVER & LNB ANTENNA CONFIGURATION ================= */}
            {osdTab === 'antenna_setup' && (
              <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto">
                <div className="p-5 rounded-xl bg-[#131B2E]/90 border border-slate-700/80 space-y-4">
                  <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#00F0FF]" />
                    <span>LNB & TUNER HARDWARE PARAMETERS</span>
                  </h3>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-mono-tech text-slate-400 mb-1">
                        SATELLITE ORBITAL SELECTION
                      </label>
                      <div className="px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-800 font-mono-tech text-[#00F0FF] font-bold">
                        {activeSat.name} ({activeSat.orbitalSlot}) — {activeSat.band} Band
                      </div>
                    </div>

                    <div>
                      <label className="block font-mono-tech text-slate-400 mb-1">
                        LNB LOCAL OSCILLATOR (LO) FREQUENCY
                      </label>
                      <select
                        value={lnbType}
                        onChange={(e) => setLnbType(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 font-mono-tech text-white"
                      >
                        <option>Universal Ku (9750/10600 MHz)</option>
                        <option>Standard C-Band (5150 MHz)</option>
                        <option>Dual C/Ku PLL Multi-Band LNB</option>
                        <option>Unicable II / JESS dCSS LNB</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block font-mono-tech text-slate-400 mb-1">
                          LNB POLARITY VOLTAGE
                        </label>
                        <select
                          value={lnbPower}
                          onChange={(e) => setLnbPower(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 font-mono-tech text-white"
                        >
                          <option>13V / 18V Auto</option>
                          <option>13V Vertical Only</option>
                          <option>18V Horizontal Only</option>
                          <option>14V / 19V Long-Coax Boost</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-mono-tech text-slate-400 mb-1">
                          DiSEqC SWITCH PORT
                        </label>
                        <select
                          value={diseqcPort}
                          onChange={(e) => setDiseqcPort(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-[#0B0F17] border border-slate-700 font-mono-tech text-white"
                        >
                          <option>DiSEqC 1.0 — Port A</option>
                          <option>DiSEqC 1.0 — Port B</option>
                          <option>DiSEqC 1.2 Motorized USALS</option>
                          <option>Direct Single LNB Feed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live RF Demodulator Diagnostic Telemetry */}
                <div className="p-5 rounded-xl bg-[#131B2E]/90 border border-slate-700/80 space-y-4">
                  <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>REAL-TIME DVB-S2X DEMODULATOR TELEMETRY</span>
                  </h3>

                  <div className="grid grid-cols-2 gap-3 font-mono-tech">
                    <div className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800">
                      <div className="text-[10px] text-slate-400">CARRIER-TO-NOISE (SNR)</div>
                      <div className="text-lg font-bold text-[#00F0FF] mt-0.5">
                        {signalMetrics.snrDb.toFixed(1)} dB
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800">
                      <div className="text-[10px] text-slate-400">LDPC / BCH BER</div>
                      <div className="text-lg font-bold text-emerald-400 mt-0.5">
                        {signalMetrics.ber}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800">
                      <div className="text-[10px] text-slate-400">OFF-AXIS ERROR</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {signalMetrics.angularErrorDeg}°
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0B0F17] border border-slate-800">
                      <div className="text-[10px] text-slate-400">CROSS-POL SKEW ERR</div>
                      <div className="text-sm font-bold text-white mt-0.5">
                        {signalMetrics.skewErrorDeg}°
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setOsdTab('scanner')}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-slate-950 font-display font-bold text-xs transition cursor-pointer"
                  >
                    SAVE LNB CONFIG & PROCEED TO TRANSPONDER SCAN →
                  </button>
                </div>
              </div>
            )}

            {/* ================= TAB 3: LIVE SAMSUNG TV HLS IPTV VIDEO PLAYER ================= */}
            {osdTab === 'live_tv' && (
              <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                {!signalMetrics.isLocked ? (
                  <div className="text-center p-8 max-w-md space-y-3">
                    <Unlock className="w-12 h-12 text-rose-500 mx-auto" />
                    <h3 className="font-display text-xl font-bold text-white">
                      WEAK OR NO SATELLITE SIGNAL
                    </h3>
                    <p className="text-xs text-slate-400">
                      Check your rooftop dish alignment or coaxial cable connection. Current SNR is{' '}
                      {signalMetrics.snrDb} dB.
                    </p>
                    <button
                      onClick={onAutoAlignAndLock}
                      className="px-4 py-2 rounded-lg bg-[#00F0FF] text-slate-950 font-display font-bold text-xs cursor-pointer"
                    >
                      Auto-Lock Rooftop Dish Now
                    </button>
                  </div>
                ) : !activeChannel ? (
                  <div className="text-center p-8 max-w-md space-y-3">
                    <Tv className="w-12 h-12 text-[#00F0FF] mx-auto" />
                    <h3 className="font-display text-xl font-bold text-white">
                      NO CHANNEL SELECTED
                    </h3>
                    <p className="text-xs text-slate-400">
                      Run a frequency scan in the Scanner tab to discover live IPTV channels on{' '}
                      {activeSat.name}.
                    </p>
                    <button
                      onClick={() => setOsdTab('scanner')}
                      className="px-4 py-2 rounded-lg bg-[#00F0FF] text-slate-950 font-display font-bold text-xs cursor-pointer"
                    >
                      Go to Transponder Scanner
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Live HLS HTML5 Video Element */}
                    <video
                      ref={videoRef}
                      className="w-full h-full max-h-[470px] object-contain bg-black"
                      playsInline
                      autoPlay
                      muted={isMuted}
                      controls={false}
                    />

                    {/* Top-Right Satellite Source Badge */}
                    <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-[#0B0F17]/85 border border-slate-700/80 backdrop-blur-md flex items-center gap-2 text-xs font-mono-tech">
                      <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-200">{activeChannel.orbitalSlot}</span>
                      <span className="text-[#00F0FF] font-bold">{activeChannel.resolution}</span>
                      {streamStatus === 'backup_mux' && (
                        <span className="text-amber-300 text-[10px]">[Verified Sat Mux]</span>
                      )}
                    </div>

                    {/* Authentic Bottom DVB-S2 OSD Channel Info Banner */}
                    {showInfoBanner && (
                      <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-[#0B0F17]/90 border border-[#00F0FF]/50 backdrop-blur-xl shadow-2xl flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-[#00F0FF]/15 border border-[#00F0FF]/40 flex flex-col items-center justify-center font-mono-tech">
                            <span className="text-[10px] text-slate-400">CH</span>
                            <span className="text-base font-bold text-[#00F0FF]">
                              {String(activeChannel.channelNumber).padStart(2, '0')}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-display text-lg font-bold text-white">
                                {activeChannel.name}
                              </h4>
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono-tech">
                                {activeChannel.source}
                              </span>
                            </div>
                            <div className="text-xs font-mono-tech text-slate-300 mt-0.5">
                              {activeChannel.satelliteName} ({activeChannel.orbitalSlot}) • TP{' '}
                              {activeChannel.transponderFreq} MHz {activeChannel.polarization} • SR{' '}
                              {activeChannel.symbolRate} • {activeChannel.category}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 font-mono-tech text-xs">
                          <div className="text-right">
                            <div className="text-[#00F0FF] font-bold">
                              SNR: {signalMetrics.snrDb.toFixed(1)} dB
                            </div>
                            <div className="text-emerald-400">
                              QUAL: {signalMetrics.signalQualityPct}%
                            </div>
                          </div>
                          <button
                            onClick={() => setShowInfoBanner(false)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"
                            title="Hide OSD Banner"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bottom Brushed Metallic Samsung Chin */}
          <div className="py-1.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700 flex items-center justify-center gap-3">
            <span className="font-display text-xs font-bold tracking-[0.35em] text-slate-300">
              SAMSUNG
            </span>
            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-[0_0_8px_#00F0FF]" />
          </div>
        </div>

        {/* ================= VIRTUAL DVB-S2 / SAMSUNG REMOTE CONTROL ================= */}
        <div className="w-full lg:w-64 bg-[#0D1322] border-2 border-slate-700/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#00F0FF]" />
                <span className="font-display text-xs font-bold tracking-wider text-slate-200">
                  STB REMOTE
                </span>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 flex items-center justify-center text-rose-400 cursor-pointer"
                title="Power / Close OSD"
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Channel Rockers & Audio Controls */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => handleChannelStep(1)}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center gap-1 text-xs font-mono-tech text-white transition cursor-pointer"
              >
                <ChevronUp className="w-4 h-4 text-[#00F0FF]" />
                <span>CH +</span>
              </button>

              <button
                onClick={() => {
                  const nextMute = !isMuted;
                  setIsMuted(nextMute);
                  if (videoRef.current) videoRef.current.muted = nextMute;
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center gap-1 text-xs font-mono-tech text-white transition cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                )}
                <span>{isMuted ? 'UNMUTE' : 'MUTE'}</span>
              </button>

              <button
                onClick={() => handleChannelStep(-1)}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center gap-1 text-xs font-mono-tech text-white transition cursor-pointer"
              >
                <ChevronDown className="w-4 h-4 text-[#00F0FF]" />
                <span>CH -</span>
              </button>

              <button
                onClick={() => setShowInfoBanner(!showInfoBanner)}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex flex-col items-center justify-center gap-1 text-xs font-mono-tech text-white transition cursor-pointer"
              >
                <Info className="w-4 h-4 text-amber-400" />
                <span>OSD INFO</span>
              </button>
            </div>

            {/* Quick Channel List on the Remote */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <div className="text-[10px] font-mono-tech uppercase text-slate-400">
                QUICK CHANNEL PRESETS ({scannedChannels.length})
              </div>
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {scannedChannels.length === 0 ? (
                  <div className="text-[11px] text-slate-500 py-4 text-center">
                    Scan satellite transponders to populate channel keys
                  </div>
                ) : (
                  scannedChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => {
                        onSelectChannel(ch);
                        setOsdTab('live_tv');
                        setShowInfoBanner(true);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-mono-tech flex items-center justify-between gap-1.5 transition cursor-pointer ${
                        activeChannel?.id === ch.id
                          ? 'bg-[#00F0FF] text-slate-950 font-bold'
                          : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className="truncate">
                        {ch.channelNumber}. {ch.name}
                      </span>
                      <span className="text-[10px] opacity-75 shrink-0">{ch.orbitalSlot}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-display font-semibold text-slate-300 border border-slate-700 transition cursor-pointer"
          >
            Return to 3D Environment
          </button>
        </div>
      </div>
    </div>
  );
};

function SatelliteDishPlaceholder() {
  return (
    <div className="w-12 h-12 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 flex items-center justify-center text-[#00F0FF]">
      <Antenna className="w-6 h-6" />
    </div>
  );
}
