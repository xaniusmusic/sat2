import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Cpu,
  Disc,
  DollarSign,
  Hammer,
  Radio,
  ShoppingBag,
  Sparkles,
  Tv,
  Wrench,
  X,
} from 'lucide-react';
import { HARDWARE_CATALOG } from '../data/hardwareCatalog';
import { HardwareCategory, HardwareItem, InstalledRig } from '../types/simulator';

interface HardwareStoreDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  budget: number;
  rig: InstalledRig;
  onPurchaseAndEquip: (item: HardwareItem) => void;
  onToggleInstallStep: (
    step: 'mastBolted' | 'dishMounted' | 'lnbAttached' | 'cableRouted' | 'receiverConnected'
  ) => void;
  onQuickInstallAll: () => void;
}

export const HardwareStoreDrawer: React.FC<HardwareStoreDrawerProps> = ({
  isOpen,
  onClose,
  budget,
  rig,
  onPurchaseAndEquip,
  onToggleInstallStep,
  onQuickInstallAll,
}) => {
  const [activeTab, setActiveTab] = useState<'assembly' | HardwareCategory>('assembly');

  if (!isOpen) return null;

  const activeDish = HARDWARE_CATALOG.find((h) => h.id === rig.activeDishId);
  const activeLnb = HARDWARE_CATALOG.find((h) => h.id === rig.activeLnbId);
  const activeCable = HARDWARE_CATALOG.find((h) => h.id === rig.activeMountCableId);
  const activeRx = HARDWARE_CATALOG.find((h) => h.id === rig.activeReceiverId);

  const completedStepsCount = [
    rig.mastBolted,
    rig.dishMounted,
    rig.lnbAttached,
    rig.cableRouted,
    rig.receiverConnected,
  ].filter(Boolean).length;

  const isFullyInstalled = completedStepsCount === 5;

  const categories: { id: 'assembly' | HardwareCategory; label: string; icon: React.ReactNode }[] =
    [
      { id: 'assembly', label: `DIY Rig Assembly (${completedStepsCount}/5)`, icon: <Wrench className="w-4 h-4" /> },
      { id: 'dish', label: 'Parabolic Dishes', icon: <Disc className="w-4 h-4" /> },
      { id: 'lnb', label: 'Ku/C LNBs', icon: <Radio className="w-4 h-4" /> },
      { id: 'mount_cable', label: 'Mast & Coax', icon: <Hammer className="w-4 h-4" /> },
      { id: 'receiver', label: 'DVB-S2 Receivers', icon: <Cpu className="w-4 h-4" /> },
    ];

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Left Slide-Over Drawer */}
      <div className="relative z-50 w-full max-w-xl bg-[#0B0F17]/95 border-r border-slate-700/70 shadow-2xl flex flex-col h-full text-slate-100 backdrop-blur-xl">
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#131B2E]/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00F0FF]/15 border border-[#00F0FF]/40 flex items-center justify-center text-[#00F0FF]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-wide text-white flex items-center gap-2">
                SATELLITE HARDWARE STORE & DIY RIG
              </h2>
              <p className="text-xs text-slate-400">
                Purchase parabolic dishes, low-noise LNBs, RG-6 coax, and DVB-S2 receivers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="font-mono-tech text-sm font-bold text-emerald-300">${budget}</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
              title="Close Store"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-2.5 bg-[#0E1525] border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition ${
                activeTab === cat.id
                  ? 'bg-[#00F0FF]/20 text-[#00F0FF] border border-[#00F0FF]/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeTab === 'assembly' ? (
            <>
              {/* Quick Assemble Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#131B2E] to-[#0F243C] border border-[#00F0FF]/40 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-mono-tech uppercase tracking-wider text-[#00F0FF] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>DIY Installation Status: {completedStepsCount} / 5 Completed</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    {isFullyInstalled
                      ? 'All satellite components are physically mounted and wired to the Samsung 65" QLED TV!'
                      : 'Mount each purchased component below in sequence, or use Instant Auto-Install.'}
                  </p>
                </div>
                {!isFullyInstalled && (
                  <button
                    onClick={onQuickInstallAll}
                    className="px-3.5 py-2 rounded-lg bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-slate-950 font-display font-bold text-xs whitespace-nowrap transition shadow-md cursor-pointer"
                  >
                    Auto-Mount All (5/5)
                  </button>
                )}
              </div>

              {/* 5-Step Interactive Physical Installation Checklist */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono-tech uppercase tracking-wider text-slate-400">
                  Step-by-Step Physical Installation Checklist
                </h3>

                {/* Step 1: Roof Mast */}
                <div
                  className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                    rig.mastBolted
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-[#131B2E]/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {rig.mastBolted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">
                        1. Bolt Galvanized Roof Mast & Az/El Tripod
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Equipped: <span className="text-[#00F0FF]">{activeCable?.name ?? 'None'}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleInstallStep('mastBolted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono-tech font-semibold transition cursor-pointer ${
                      rig.mastBolted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-[#00F0FF] text-slate-950 hover:bg-[#00F0FF]/90'
                    }`}
                  >
                    {rig.mastBolted ? 'MOUNTED ✓' : 'BOLT MAST'}
                  </button>
                </div>

                {/* Step 2: Parabolic Dish */}
                <div
                  className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                    rig.dishMounted
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-[#131B2E]/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {rig.dishMounted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">
                        2. Mount Parabolic Reflector Dish onto Gimbal
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Equipped:{' '}
                        <span className="text-[#00F0FF]">
                          {activeDish?.name ?? 'None'} ({activeDish?.specs.gainDbi} dBi)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('dish')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                    >
                      Upgrade
                    </button>
                    <button
                      onClick={() => onToggleInstallStep('dishMounted')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono-tech font-semibold transition cursor-pointer ${
                        rig.dishMounted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-[#00F0FF] text-slate-950 hover:bg-[#00F0FF]/90'
                      }`}
                    >
                      {rig.dishMounted ? 'MOUNTED ✓' : 'MOUNT DISH'}
                    </button>
                  </div>
                </div>

                {/* Step 3: LNB Unit */}
                <div
                  className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                    rig.lnbAttached
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-[#131B2E]/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {rig.lnbAttached ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">
                        3. Clamp LNB Downconverter into Feedhorn Collar
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Equipped:{' '}
                        <span className="text-[#00F0FF]">
                          {activeLnb?.name ?? 'None'} (NF: {activeLnb?.specs.noiseFigureDb} dB)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('lnb')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                    >
                      Upgrade
                    </button>
                    <button
                      onClick={() => onToggleInstallStep('lnbAttached')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono-tech font-semibold transition cursor-pointer ${
                        rig.lnbAttached
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-[#00F0FF] text-slate-950 hover:bg-[#00F0FF]/90'
                      }`}
                    >
                      {rig.lnbAttached ? 'ATTACHED ✓' : 'ATTACH LNB'}
                    </button>
                  </div>
                </div>

                {/* Step 4: Coax Cable Routing */}
                <div
                  className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                    rig.cableRouted
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-[#131B2E]/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {rig.cableRouted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">
                        4. Route RG-6 Coaxial Cable from LNB to Living Room
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Feeds 13V/18V DC LNB power & 22kHz tone from indoor receiver
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleInstallStep('cableRouted')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono-tech font-semibold transition cursor-pointer ${
                      rig.cableRouted
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-[#00F0FF] text-slate-950 hover:bg-[#00F0FF]/90'
                    }`}
                  >
                    {rig.cableRouted ? 'WIRED ✓' : 'ROUTE COAX'}
                  </button>
                </div>

                {/* Step 5: DVB-S2 Receiver + Samsung TV */}
                <div
                  className={`p-4 rounded-xl border transition flex items-center justify-between gap-4 ${
                    rig.receiverConnected
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-[#131B2E]/80 border-slate-700/70'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {rig.receiverConnected ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-sm font-semibold text-white">
                        5. Connect DVB-S2 Receiver to Samsung 65" Neo QLED TV
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Equipped: <span className="text-[#00F0FF]">{activeRx?.name ?? 'None'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('receiver')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                    >
                      Upgrade
                    </button>
                    <button
                      onClick={() => onToggleInstallStep('receiverConnected')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono-tech font-semibold transition cursor-pointer ${
                        rig.receiverConnected
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-[#00F0FF] text-slate-950 hover:bg-[#00F0FF]/90'
                      }`}
                    >
                      {rig.receiverConnected ? 'CONNECTED ✓' : 'CONNECT STB'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Samsung TV Centerpiece Hardware Card */}
              <div className="p-4 rounded-xl bg-[#131B2E]/60 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-400/30 flex items-center justify-center text-blue-400">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      Samsung 65" QN90D Neo QLED 4K TV + Walnut Console Stand
                    </div>
                    <div className="text-xs text-slate-400">
                      Installed in Living Room • HDMI 2.1 eARC • Integrated HLS IPTV Stream Engine
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-mono-tech">
                  INSTALLED
                </span>
              </div>
            </>
          ) : (
            /* Hardware Category Store Items */
            <div className="space-y-3.5">
              {HARDWARE_CATALOG.filter((item) => item.category === activeTab).map((item) => {
                const isPurchased = rig.purchasedIds.includes(item.id);
                const isEquipped =
                  rig.activeDishId === item.id ||
                  rig.activeLnbId === item.id ||
                  rig.activeMountCableId === item.id ||
                  rig.activeReceiverId === item.id;
                const canAfford = budget >= item.price;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition ${
                      isEquipped
                        ? 'bg-[#131B2E] border-[#00F0FF] shadow-lg shadow-[#00F0FF]/10'
                        : 'bg-[#131B2E]/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono-tech uppercase text-[#00F0FF]">
                            {item.brand}
                          </span>
                          {item.badge && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-tech font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <h4 className="font-display text-base font-bold text-white mt-0.5">
                          {item.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1">{item.tagline}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-mono-tech text-base font-bold text-emerald-400">
                          ${item.price}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {isPurchased ? 'In Inventory' : 'Store Stock'}
                        </div>
                      </div>
                    </div>

                    {/* Technical RF Specs Badges */}
                    <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tech">
                        {item.specs.diameterCm && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            Ø {item.specs.diameterCm}cm
                          </span>
                        )}
                        {item.specs.gainDbi && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[#00F0FF]">
                            Gain: {item.specs.gainDbi} dBi
                          </span>
                        )}
                        {item.specs.beamwidthDeg && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            Beam: {item.specs.beamwidthDeg}°
                          </span>
                        )}
                        {item.specs.noiseFigureDb !== undefined && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[#00F0FF]">
                            NF: {item.specs.noiseFigureDb} dB
                          </span>
                        )}
                        {item.specs.snrBonusDb !== undefined && item.specs.snrBonusDb > 0 && (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            +{item.specs.snrBonusDb} dB SNR Boost
                          </span>
                        )}
                        {item.specs.supportedBands && (
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                            {item.specs.supportedBands} Band
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => onPurchaseAndEquip(item)}
                        disabled={!isPurchased && !canAfford}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-bold transition cursor-pointer ${
                          isEquipped
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isPurchased
                            ? 'bg-[#00F0FF] text-slate-950 hover:bg-[#00F0FF]/90'
                            : canAfford
                            ? 'bg-[#00F0FF] text-slate-950 hover:bg-[#00F0FF]/90'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isEquipped
                          ? 'EQUIPPED & MOUNTED ✓'
                          : isPurchased
                          ? 'EQUIP & MOUNT IN 3D'
                          : canAfford
                          ? `BUY & MOUNT ($${item.price})`
                          : 'INSUFFICIENT FUNDS'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
