import { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CloudRain,
  Compass,
  DollarSign,
  Globe,
  MapPin,
  Radio,
  Satellite,
  ShoppingBag,
  Sparkles,
  Sun,
  Tv,
  Wrench,
} from 'lucide-react';
import { DishAlignmentPanel } from './components/DishAlignmentPanel';
import { HardwareStoreDrawer } from './components/HardwareStoreDrawer';
import { SamsungTVOSD } from './components/SamsungTVOSD';
import { Scene3D } from './components/Scene3D';
import { HARDWARE_CATALOG, INITIAL_BUDGET } from './data/hardwareCatalog';
import { BROADCAST_SATELLITES, CITY_LOCATIONS } from './data/locationsAndSatellites';
import {
  BroadcastSatellite,
  CameraPreset,
  CityLocation,
  DishOrientation,
  HardwareItem,
  InstalledRig,
  ScannedChannel,
  Transponder,
  WeatherCondition,
} from './types/simulator';
import { scanSatelliteTransponders } from './utils/iptvFetcher';
import { calculateLookAngles, calculateSignalMetrics, satFinderBeeper } from './utils/rfPhysics';

export function App() {
  // 1. Selected Country & City Location
  const [selectedCity, setSelectedCity] = useState<CityLocation>(CITY_LOCATIONS[0]); // Berlin, Germany default

  // 2. Selected Target Broadcast Satellite
  const [selectedTargetSat, setSelectedTargetSat] = useState<BroadcastSatellite>(
    BROADCAST_SATELLITES[0] // Astra 19.2°E default
  );

  // 3. DIY Installer Budget & Installed Rig State
  const [budget, setBudget] = useState<number>(INITIAL_BUDGET);
  const [rig, setRig] = useState<InstalledRig>({
    purchasedIds: ['dish-90cm', 'lnb-black-ultra', 'cable-rg6-standard', 'rx-vuplus-4k'],
    activeDishId: 'dish-90cm',
    activeLnbId: 'lnb-black-ultra',
    activeMountCableId: 'cable-rg6-standard',
    activeReceiverId: 'rx-vuplus-4k',
    mastBolted: true,
    dishMounted: true,
    lnbAttached: true,
    cableRouted: true,
    receiverConnected: true,
  });

  // 4. Dish Orientation (Azimuth, Elevation, LNB Skew)
  // Start slightly off-target (~1.8 deg) from Astra 19.2°E in Berlin so user immediately sees near-beam carrier & can fine-tune or auto-lock!
  const [orientation, setOrientation] = useState<DishOrientation>(() => {
    const initialLook = calculateLookAngles(CITY_LOCATIONS[0], BROADCAST_SATELLITES[0]);
    return {
      azimuth: Number((initialLook.azimuth - 1.6).toFixed(1)),
      elevation: Number((initialLook.elevation + 1.1).toFixed(1)),
      skew: initialLook.skew,
    };
  });

  // 5. Camera Preset, Weather & UI Drawers
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('rooftop');
  const [weather, setWeather] = useState<WeatherCondition>('clear');
  const [isStoreOpen, setIsStoreOpen] = useState<boolean>(false);
  const [isTvOsdOpen, setIsTvOsdOpen] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);

  // 6. Receiver Scanned IPTV Channels & Scanning State
  const [scannedChannels, setScannedChannels] = useState<ScannedChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<ScannedChannel | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [currentScanTp, setCurrentScanTp] = useState<Transponder | null>(null);
  const [rewardedSatIds, setRewardedSatIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4200);
  };

  // Real-time RF Signal Metrics calculation
  const signalMetrics = useMemo(
    () => calculateSignalMetrics(selectedCity, orientation, rig, weather),
    [selectedCity, orientation, rig, weather]
  );

  // Update Web Audio Sat-Finder Beeper when signal changes
  useEffect(() => {
    satFinderBeeper.updateMetrics(signalMetrics.signalStrengthPct, signalMetrics.isLocked);
  }, [signalMetrics.signalStrengthPct, signalMetrics.isLocked]);

  // Reward player with +$120 DX Installation Bonus the first time they lock onto a new satellite
  useEffect(() => {
    if (
      signalMetrics.isLocked &&
      signalMetrics.lockedSatellite &&
      !rewardedSatIds.includes(signalMetrics.lockedSatellite.id)
    ) {
      const sat = signalMetrics.lockedSatellite;
      setRewardedSatIds((prev) => [...prev, sat.id]);
      setBudget((b) => b + 120);
      showToast(
        `TRANSPONDER LOCKED: ${sat.name} (${sat.orbitalSlot})! Earned +$120 DX Installer Bonus.`
      );
    }
  }, [signalMetrics.isLocked, signalMetrics.lockedSatellite, rewardedSatIds]);

  // Handle changing City from Dropdown: pick best regional satellite above horizon
  const handleSelectCity = (cityId: string) => {
    const nextCity = CITY_LOCATIONS.find((c) => c.id === cityId);
    if (!nextCity) return;
    setSelectedCity(nextCity);

    // Find best visible satellite for this city's region
    const visibleSats = BROADCAST_SATELLITES.filter(
      (s) => calculateLookAngles(nextCity, s).isAboveHorizon
    );
    const regionalSat =
      visibleSats.find((s) => s.primaryRegions.includes(nextCity.region)) ??
      visibleSats[0] ??
      BROADCAST_SATELLITES[0];

    setSelectedTargetSat(regionalSat);
    const look = calculateLookAngles(nextCity, regionalSat);
    showToast(
      `Relocated to ${nextCity.city}, ${nextCity.country} — Target ${regionalSat.orbitalSlot} is at Az ${look.azimuth}°, El ${look.elevation}°`
    );
  };

  // Handle purchasing & equipping hardware
  const handlePurchaseAndEquip = (item: HardwareItem) => {
    const alreadyOwned = rig.purchasedIds.includes(item.id);
    if (!alreadyOwned) {
      if (budget < item.price) return;
      setBudget((b) => b - item.price);
    }

    setRig((prev) => {
      const nextPurchased = alreadyOwned ? prev.purchasedIds : [...prev.purchasedIds, item.id];
      if (item.category === 'dish') {
        return { ...prev, purchasedIds: nextPurchased, activeDishId: item.id, dishMounted: true };
      }
      if (item.category === 'lnb') {
        return { ...prev, purchasedIds: nextPurchased, activeLnbId: item.id, lnbAttached: true };
      }
      if (item.category === 'mount_cable') {
        return {
          ...prev,
          purchasedIds: nextPurchased,
          activeMountCableId: item.id,
          mastBolted: true,
          cableRouted: true,
        };
      }
      if (item.category === 'receiver') {
        return {
          ...prev,
          purchasedIds: nextPurchased,
          activeReceiverId: item.id,
          receiverConnected: true,
        };
      }
      return prev;
    });

    showToast(`Installed ${item.brand} ${item.name} in 3D scene!`);
  };

  // Toggle physical DIY installation step
  const handleToggleInstallStep = (
    step: 'mastBolted' | 'dishMounted' | 'lnbAttached' | 'cableRouted' | 'receiverConnected'
  ) => {
    setRig((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  // One-click install all 5 steps
  const handleQuickInstallAll = () => {
    setRig((prev) => ({
      ...prev,
      mastBolted: true,
      dishMounted: true,
      lnbAttached: true,
      cableRouted: true,
      receiverConnected: true,
    }));
    showToast('All 5 DIY satellite hardware components mounted and wired!');
  };

  // Auto-align rooftop dish to selectedTargetSat
  const handleAutoAlignAndLock = () => {
    const look = calculateLookAngles(selectedCity, selectedTargetSat);
    if (!look.isAboveHorizon) {
      // Find first visible satellite for this city
      const firstVisible = BROADCAST_SATELLITES.find(
        (s) => calculateLookAngles(selectedCity, s).isAboveHorizon
      );
      if (firstVisible) {
        setSelectedTargetSat(firstVisible);
        const vLook = calculateLookAngles(selectedCity, firstVisible);
        setOrientation({
          azimuth: vLook.azimuth,
          elevation: vLook.elevation,
          skew: vLook.skew,
        });
      }
      return;
    }

    // Also make sure all physical parts are mounted
    setRig((prev) => ({
      ...prev,
      mastBolted: true,
      dishMounted: true,
      lnbAttached: true,
      cableRouted: true,
      receiverConnected: true,
    }));

    setOrientation({
      azimuth: look.azimuth,
      elevation: look.elevation,
      skew: look.skew,
    });
  };

  // Run DVB-S2 Transponder Scan & Fetch GitHub IPTV M3U Channels
  const handleStartScan = async (specificTp?: Transponder) => {
    const targetSat = signalMetrics.lockedSatellite;
    if (!targetSat || isScanning) return;

    setIsScanning(true);
    setScanProgress(5);
    setCurrentScanTp(specificTp ?? targetSat.transponders[0]);

    const newlyFound = await scanSatelliteTransponders(
      targetSat,
      selectedCity,
      scannedChannels,
      specificTp,
      (tp, pct) => {
        setCurrentScanTp(tp);
        setScanProgress(pct);
      }
    );

    const combined = [...scannedChannels, ...newlyFound];
    setScannedChannels(combined);
    if (newlyFound.length > 0) {
      setActiveChannel(newlyFound[0]);
    } else if (combined.length > 0 && !activeChannel) {
      setActiveChannel(combined[0]);
    }

    setIsScanning(false);
    setCurrentScanTp(null);
    showToast(
      `Scan Complete on ${targetSat.name} (${targetSat.orbitalSlot}): Added ${newlyFound.length} IPTV channels!`
    );
  };

  const toggleAudioBeeper = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    satFinderBeeper.setEnabled(next);
  };

  // Group cities by region for clean dropdown navigation
  const regions = useMemo(() => {
    const map = new Map<string, CityLocation[]>();
    for (const c of CITY_LOCATIONS) {
      const list = map.get(c.region) ?? [];
      list.push(c);
      map.set(c.region, list);
    }
    return Array.from(map.entries());
  }, []);

  const visibleSatelliteCount = useMemo(
    () =>
      BROADCAST_SATELLITES.filter((s) => calculateLookAngles(selectedCity, s).isAboveHorizon)
        .length,
    [selectedCity]
  );

  const completedInstallSteps = [
    rig.mastBolted,
    rig.dishMounted,
    rig.lnbAttached,
    rig.cableRouted,
    rig.receiverConnected,
  ].filter(Boolean).length;

  const activeDishItem = HARDWARE_CATALOG.find((h) => h.id === rig.activeDishId);

  return (
    <div className="relative w-screen h-screen bg-[#0B0F17] text-[#F1F5F9] overflow-hidden select-none">
      {/* ================= 100% VIEWPORT 3D WEBGL SCENE ================= */}
      <Scene3D
        city={selectedCity}
        orientation={orientation}
        onChangeOrientation={setOrientation}
        rig={rig}
        signalMetrics={signalMetrics}
        cameraPreset={cameraPreset}
        weather={weather}
        activeChannel={activeChannel}
        isScanning={isScanning}
        scanProgress={scanProgress}
        onOpenTvOsd={() => {
          setCameraPreset('tv_closeup');
          setIsTvOsdOpen(true);
        }}
        onOpenHardwareDrawer={() => setIsStoreOpen(true)}
        onSelectSatelliteTarget={setSelectedTargetSat}
        selectedTargetSat={selectedTargetSat}
      />

      {/* ================= TOP GEODESIC & CAMERA TELEMETRY BAR ================= */}
      <header className="fixed top-3 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[#0B0F17]/85 border border-slate-700/75 backdrop-blur-xl shadow-2xl">
        {/* Left: Brand Title & Country/City Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 pr-3 border-r border-slate-800">
            <div className="w-8 h-8 rounded-xl bg-[#00F0FF]/15 border border-[#00F0FF]/50 flex items-center justify-center text-[#00F0FF]">
              <Satellite className="w-4 h-4" />
            </div>
            <div>
              <div className="font-display text-xs font-bold tracking-wider text-white flex items-center gap-1.5">
                <span>ORBITAL-DX</span>
                <span className="px-1.5 py-0.2 rounded bg-[#00F0FF]/20 text-[#00F0FF] text-[10px] font-mono-tech">
                  3D SAT SIM
                </span>
              </div>
              <div className="text-[10px] font-mono-tech text-slate-400">
                {activeDishItem?.specs.diameterCm}cm Dish • {visibleSatelliteCount} Broadcast Sats
                Visible
              </div>
            </div>
          </div>

          {/* Country & City Dropdown Selector */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#00F0FF] shrink-0" />
            <div className="flex flex-col">
              <label className="text-[9px] font-mono-tech uppercase tracking-wider text-slate-400">
                RECEIVER LOCATION (COUNTRY / CITY)
              </label>
              <select
                value={selectedCity.id}
                onChange={(e) => handleSelectCity(e.target.value)}
                className="bg-[#131B2E] border border-slate-700 hover:border-[#00F0FF]/60 rounded-lg px-2.5 py-1 text-xs font-medium text-white focus:outline-none focus:border-[#00F0FF] cursor-pointer"
              >
                {regions.map(([regionName, cities]) => (
                  <optgroup key={regionName} label={`── ${regionName} ──`}>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.country} — {c.city} ({c.lat >= 0 ? `${c.lat.toFixed(1)}°N` : `${Math.abs(c.lat).toFixed(1)}°S`},{' '}
                        {c.lon >= 0 ? `${c.lon.toFixed(1)}°E` : `${Math.abs(c.lon).toFixed(1)}°W`})
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* GPS Coordinate Telemetry Pill */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#131B2E]/90 border border-slate-800 text-xs font-mono-tech">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">GPS:</span>
            <span className="text-slate-200 font-semibold">
              {selectedCity.lat >= 0
                ? `${selectedCity.lat.toFixed(2)}°N`
                : `${Math.abs(selectedCity.lat).toFixed(2)}°S`}
              ,{' '}
              {selectedCity.lon >= 0
                ? `${selectedCity.lon.toFixed(2)}°E`
                : `${Math.abs(selectedCity.lon).toFixed(2)}°W`}
            </span>
          </div>
        </div>

        {/* Center: 3D Camera Preset Switcher */}
        <div className="flex items-center gap-1 bg-[#131B2E] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setIsTvOsdOpen(false);
              setCameraPreset('rooftop');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              cameraPreset === 'rooftop' && !isTvOsdOpen
                ? 'bg-[#00F0FF] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>1. Rooftop Dish</span>
          </button>

          <button
            onClick={() => {
              setIsTvOsdOpen(false);
              setCameraPreset('living_room');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              cameraPreset === 'living_room' && !isTvOsdOpen
                ? 'bg-[#00F0FF] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>2. Living Room</span>
          </button>

          <button
            onClick={() => {
              setCameraPreset('tv_closeup');
              setIsTvOsdOpen(true);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold flex items-center gap-1.5 transition cursor-pointer ${
              cameraPreset === 'tv_closeup' || isTvOsdOpen
                ? 'bg-[#00F0FF] text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>3. Samsung TV & STB</span>
          </button>
        </div>

        {/* Right: Weather Condition Toggle & Installer Budget */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() =>
              setWeather((w) =>
                w === 'clear' ? 'cloudy' : w === 'cloudy' ? 'rain_fade' : 'clear'
              )
            }
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono-tech flex items-center gap-1.5 transition cursor-pointer ${
              weather === 'clear'
                ? 'bg-[#131B2E] border-slate-700 text-amber-300'
                : weather === 'cloudy'
                ? 'bg-slate-800 border-slate-600 text-slate-200'
                : 'bg-sky-950/60 border-sky-500/50 text-sky-300'
            }`}
            title="Simulate Atmospheric Rain Fade attenuation on Ku-Band signal"
          >
            {weather === 'clear' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Clear Sky (0 dB)</span>
              </>
            ) : weather === 'cloudy' ? (
              <>
                <CloudRain className="w-3.5 h-3.5 text-slate-300" />
                <span>Clouds (-1.2 dB)</span>
              </>
            ) : (
              <>
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                <span>Rain Fade (-3.8 dB)</span>
              </>
            )}
          </button>

          <button
            onClick={() => setIsStoreOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 flex items-center gap-1.5 transition cursor-pointer"
            title="Open Hardware Store & DIY Inventory"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono-tech text-xs font-bold text-emerald-300">${budget}</span>
          </button>
        </div>
      </header>

      {/* ================= RIGHT-HAND DISH GIMBAL & RF SAT-FINDER PANEL ================= */}
      <DishAlignmentPanel
        city={selectedCity}
        orientation={orientation}
        onChangeOrientation={setOrientation}
        signalMetrics={signalMetrics}
        selectedTargetSat={selectedTargetSat}
        onSelectTargetSat={setSelectedTargetSat}
        audioEnabled={audioEnabled}
        onToggleAudio={toggleAudioBeeper}
        onOpenTvOsd={() => {
          setCameraPreset('tv_closeup');
          setIsTvOsdOpen(true);
        }}
      />

      {/* ================= FLOATING TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-[#0B0F17]/95 border border-[#00F0FF] text-xs font-mono-tech text-white shadow-2xl flex items-center gap-2.5 backdrop-blur-xl">
          <Sparkles className="w-4 h-4 text-[#00F0FF] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ================= BOTTOM 4-STEP WORKFLOW ACTION DOCK ================= */}
      <footer className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-2xl bg-[#0B0F17]/90 border border-slate-700/80 backdrop-blur-xl shadow-2xl">
        {/* Phase 1: Buy & Install Hardware */}
        <button
          onClick={() => setIsStoreOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-[#131B2E] hover:bg-slate-800 border border-slate-700/80 text-xs font-display font-semibold text-white flex items-center gap-2 transition cursor-pointer"
        >
          <ShoppingBag className="w-4 h-4 text-[#00F0FF]" />
          <span>1. Hardware Store & DIY Rig</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tech ${
              completedInstallSteps === 5
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            {completedInstallSteps}/5
          </span>
        </button>

        {/* Phase 2: Orient Rooftop Dish */}
        <button
          onClick={() => {
            setIsTvOsdOpen(false);
            setCameraPreset('rooftop');
          }}
          className={`px-3.5 py-2 rounded-xl border text-xs font-display font-semibold flex items-center gap-2 transition cursor-pointer ${
            cameraPreset === 'rooftop' && !isTvOsdOpen
              ? 'bg-[#00F0FF]/20 border-[#00F0FF] text-[#00F0FF]'
              : 'bg-[#131B2E] hover:bg-slate-800 border-slate-700/80 text-white'
          }`}
        >
          <Wrench className="w-4 h-4 text-[#00F0FF]" />
          <span>2. Orient Rooftop Dish</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono-tech ${
              signalMetrics.isLocked
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'bg-rose-500/20 text-rose-300'
            }`}
          >
            {signalMetrics.isLocked ? 'LOCKED' : `${signalMetrics.snrDb} dB`}
          </span>
        </button>

        {/* Phase 3: Receiver Setup & Frequency Scan */}
        <button
          onClick={() => {
            setCameraPreset('tv_closeup');
            setIsTvOsdOpen(true);
          }}
          className={`px-3.5 py-2 rounded-xl border text-xs font-display font-semibold flex items-center gap-2 transition cursor-pointer ${
            isTvOsdOpen
              ? 'bg-[#00F0FF] text-slate-950 border-[#00F0FF] font-bold'
              : 'bg-[#131B2E] hover:bg-slate-800 border-slate-700/80 text-white'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>3. Receiver Setup & Scan Frequencies</span>
        </button>

        {/* Phase 4: Watch Samsung TV IPTV Channels */}
        <button
          onClick={() => {
            setCameraPreset('tv_closeup');
            setIsTvOsdOpen(true);
          }}
          className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-xs font-display font-bold text-emerald-300 flex items-center gap-2 transition cursor-pointer"
        >
          <Tv className="w-4 h-4" />
          <span>4. Samsung QLED Live TV ({scannedChannels.length} CH)</span>
        </button>
      </footer>

      {/* ================= SLIDE-OVER HARDWARE STORE & DIY ASSEMBLY DRAWER ================= */}
      <HardwareStoreDrawer
        isOpen={isStoreOpen}
        onClose={() => setIsStoreOpen(false)}
        budget={budget}
        rig={rig}
        onPurchaseAndEquip={handlePurchaseAndEquip}
        onToggleInstallStep={handleToggleInstallStep}
        onQuickInstallAll={handleQuickInstallAll}
      />

      {/* ================= SAMSUNG 65" NEO QLED TV & DVB-S2 RECEIVER OSD MODAL ================= */}
      <SamsungTVOSD
        isOpen={isTvOsdOpen}
        onClose={() => setIsTvOsdOpen(false)}
        city={selectedCity}
        signalMetrics={signalMetrics}
        selectedTargetSat={selectedTargetSat}
        scannedChannels={scannedChannels}
        activeChannel={activeChannel}
        onSelectChannel={setActiveChannel}
        isScanning={isScanning}
        scanProgress={scanProgress}
        currentScanTp={currentScanTp}
        onStartScan={handleStartScan}
        onAutoAlignAndLock={handleAutoAlignAndLock}
      />
    </div>
  );
}
export default App;
