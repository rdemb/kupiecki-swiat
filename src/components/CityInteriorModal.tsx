import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  CITIES,
  COMMODITIES,
  CommodityId,
  CommodityMarketState,
} from '../economy/economyEngine';
import { KnightState, LeaderboardEntry } from '../economy/gameData';
import {
  HERO_PATHS,
  HERO_PORTRAITS,
  computeDerivedHeroStats,
} from '../economy/heroProgression';
import {
  ARENA_MOVES,
  ArenaCombatantStats,
  ArenaDuelState,
  ArenaMoveId,
  ArenaOpponentSpec,
  CityAtmosphereTheme,
  CityDistrictActionId,
  IMG_KNIGHT_ARENA,
  buildArenaOpponentsForCity,
  getCityInteriorSpec,
  initArenaDuel,
  resolveArenaTurn,
} from '../economy/cityAndArenaEngine';
import { soundEngine } from '../utils/sound';

export interface CityInteriorModalProps {
  isOpen: boolean;
  initialMode: 'plaza' | 'arena';
  cityId: string;
  onChangeCity: (cityId: string) => void;
  onClose: () => void;
  knight: KnightState;
  playerGold: number;
  markets: Record<CommodityId, CommodityMarketState>;
  leaderboard: LeaderboardEntry[];
  arenaWins: number;
  arenaRating: number;
  onOpenMarket: (cityId: string) => void;
  onOpenForge: () => void;
  onOpenCaravans: (cityId: string) => void;
  onOpenInn:()=>void;
  onTavernRest: (costGold: number, cityName: string) => void;
  onStartArenaDuelWager: (entryFeeGold: number) => boolean;
  onArenaDuelComplete: (result: {
    won: boolean;
    opponent: ArenaOpponentSpec;
    remainingHp: number;
  }) => void;
}

interface AmbientParticle {
  id: number;
  leftPct: number;
  topPct: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
}

const AMBIENT_PARTICLES: AmbientParticle[] = [
  { id: 1, leftPct: 8, topPct: 22, size: 4, duration: 7.2, delay: 0.2, driftX: 28, driftY: -36 },
  { id: 2, leftPct: 16, topPct: 62, size: 3, duration: 6.4, delay: 1.1, driftX: -20, driftY: -44 },
  { id: 3, leftPct: 25, topPct: 35, size: 5, duration: 8.1, delay: 0.6, driftX: 34, driftY: -28 },
  { id: 4, leftPct: 34, topPct: 74, size: 3, duration: 5.9, delay: 2.0, driftX: 18, driftY: -50 },
  { id: 5, leftPct: 43, topPct: 26, size: 4, duration: 7.6, delay: 1.5, driftX: -26, driftY: -32 },
  { id: 6, leftPct: 52, topPct: 58, size: 6, duration: 9.0, delay: 0.4, driftX: 22, driftY: -42 },
  { id: 7, leftPct: 61, topPct: 30, size: 3, duration: 6.2, delay: 2.4, driftX: -18, driftY: -38 },
  { id: 8, leftPct: 69, topPct: 70, size: 5, duration: 7.8, delay: 0.9, driftX: 30, driftY: -46 },
  { id: 9, leftPct: 77, topPct: 40, size: 4, duration: 6.7, delay: 1.8, driftX: -24, driftY: -30 },
  { id: 10, leftPct: 85, topPct: 24, size: 3, duration: 8.4, delay: 0.3, driftX: 16, driftY: -40 },
  { id: 11, leftPct: 91, topPct: 60, size: 5, duration: 6.9, delay: 1.3, driftX: -28, driftY: -36 },
  { id: 12, leftPct: 48, topPct: 80, size: 4, duration: 7.5, delay: 2.7, driftX: 20, driftY: -52 },
];

function getAtmosphereColors(theme: CityAtmosphereTheme): {
  particleClass: string;
  glowStyle: string;
  tintOverlay: string;
} {
  switch (theme) {
    case 'desert_shimmer':
      return {
        particleClass: 'bg-amber-300',
        glowStyle: '0 0 10px rgba(251, 191, 36, 0.85)',
        tintOverlay: 'linear-gradient(180deg, rgba(245,158,11,0.10) 0%, rgba(5,8,13,0.16) 50%, rgba(5,8,13,0.78) 100%)',
      };
    case 'frost_embers':
      return {
        particleClass: 'bg-sky-200',
        glowStyle: '0 0 10px rgba(125, 211, 252, 0.85)',
        tintOverlay: 'linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(5,8,13,0.16) 50%, rgba(5,8,13,0.80) 100%)',
      };
    case 'volcanic_sparks':
      return {
        particleClass: 'bg-orange-400',
        glowStyle: '0 0 12px rgba(249, 115, 22, 0.9)',
        tintOverlay: 'linear-gradient(180deg, rgba(234,88,12,0.12) 0%, rgba(5,8,13,0.20) 50%, rgba(5,8,13,0.82) 100%)',
      };
    case 'jade_petals':
      return {
        particleClass: 'bg-emerald-300',
        glowStyle: '0 0 10px rgba(52, 211, 153, 0.85)',
        tintOverlay: 'linear-gradient(180deg, rgba(16,185,129,0.10) 0%, rgba(5,8,13,0.16) 50%, rgba(5,8,13,0.80) 100%)',
      };
    default:
      return {
        particleClass: 'bg-amber-200',
        glowStyle: '0 0 10px rgba(245, 158, 11, 0.8)',
        tintOverlay: 'linear-gradient(180deg, rgba(212,175,55,0.08) 0%, rgba(5,8,13,0.15) 50%, rgba(5,8,13,0.78) 100%)',
      };
  }
}

function renderHotspotIcon(id: CityDistrictActionId) {
  switch (id) {
    case 'arena':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
          <path d="M13 19l6-6" />
          <path d="M16 16l4 4" />
          <path d="M19 21l2-2" />
          <path d="M9.5 17.5L21 6V3h-3L6.5 14.5" />
        </svg>
      );
    case 'market':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 20h18" />
          <path d="M5 16l4-5 4 3 6-8" />
          <path d="M15 6h4v4" />
        </svg>
      );
    case 'forge':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L4 5v6c0 5.5 3.4 10.3 8 11 4.6-.7 8-5.5 8-11V5l-8-3z" />
        </svg>
      );
    case 'tavern':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
          <path d="M9 12v6" />
          <path d="M13 12v6" />
          <path d="M5 8h12v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V8z" />
          <path d="M7 8a3 3 0 0 1 6 0 3 3 0 0 1 4 0" />
        </svg>
      );
    case 'gate':
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
  }
}

export const CityInteriorModal: React.FC<CityInteriorModalProps> = ({
  isOpen,
  initialMode,
  cityId,
  onChangeCity,
  onClose,
  knight,
  playerGold,
  markets,
  leaderboard,
  arenaWins,
  arenaRating,
  onOpenMarket,
  onOpenForge,
  onOpenCaravans,
  onOpenInn, onTavernRest,
  onStartArenaDuelWager,
  onArenaDuelComplete,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [mode, setMode] = useState<'plaza' | 'arena'>(initialMode);
  const [tavernOpen, setTavernOpen] = useState<boolean>(false);
  const [tavernRestedFlash, setTavernRestedFlash] = useState<boolean>(false);
  const [duel, setDuel] = useState<ArenaDuelState | null>(null);
  const [exchangeKey, setExchangeKey] = useState<number>(0);
  const [clashPhase, setClashPhase] = useState<'idle' | 'player_strike' | 'enemy_strike'>('idle');
  const [arenaMessage, setArenaMessage] = useState<string>('');
  const timersRef = useRef<number[]>([]);

  const clearScheduledTimers = () => {
    for (const t of timersRef.current) {
      window.clearTimeout(t);
    }
    timersRef.current = [];
  };

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setTavernOpen(false);
      setArenaMessage('');
      setDuel(null);
      setClashPhase('idle');
    } else {
      clearScheduledTimers();
    }
    return () => clearScheduledTimers();
  }, [isOpen, initialMode]);

  // Reset active tavern drawer when changing city
  useEffect(() => {
    setTavernOpen(false);
    setArenaMessage('');
    if (duel && duel.status !== 'fighting') {
      setDuel(null);
    }
  }, [cityId]);

  // Escape key closes modal when not mid-strike
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const activeCity = useMemo(
    () => CITIES.find((c) => c.id === cityId) ?? CITIES[0],
    [cityId],
  );
  const spec = useMemo(() => getCityInteriorSpec(activeCity.id), [activeCity.id]);
  const atmosphere = useMemo(() => getAtmosphereColors(spec.atmosphere), [spec.atmosphere]);
  const derivedHero = useMemo(() => computeDerivedHeroStats(knight), [knight]);
  const activePortrait = useMemo(
    () => HERO_PORTRAITS.find((p) => p.id === knight.portraitId) ?? HERO_PORTRAITS[0],
    [knight.portraitId],
  );
  const activePath = useMemo(
    () => HERO_PATHS.find((p) => p.id === knight.activePath) ?? HERO_PATHS[0],
    [knight.activePath],
  );

  const arenaOpponents = useMemo(
    () => buildArenaOpponentsForCity(activeCity.id, leaderboard, knight.level),
    [activeCity.id, leaderboard, knight.level],
  );

  const specialtyComm = useMemo(
    () => COMMODITIES.find((c) => c.id === activeCity.specialty),
    [activeCity.specialty],
  );
  const demandComm = useMemo(
    () => COMMODITIES.find((c) => c.id === activeCity.demandCommodity),
    [activeCity.demandCommodity],
  );

  const specialtyPrice = specialtyComm
    ? markets[specialtyComm.id]?.cityPrices[activeCity.id] ?? markets[specialtyComm.id]?.currentPrice ?? 0
    : 0;
  const demandPrice = demandComm
    ? markets[demandComm.id]?.cityPrices[activeCity.id] ?? markets[demandComm.id]?.currentPrice ?? 0
    : 0;

  if (!isOpen) return null;

  const handleHotspotClick = (actionId: CityDistrictActionId) => {
    if (actionId === 'arena') {
      setMode('arena');
      setTavernOpen(false);
      soundEngine.playCaravanHorn();
    } else if (actionId === 'tavern') {
      setTavernOpen((prev) => !prev);
      soundEngine.playAlertNotification();
    } else if (actionId === 'market') {
      onOpenMarket(activeCity.id);
      onClose();
    } else if (actionId === 'forge') {
      onOpenForge();
      onClose();
    } else if (actionId === 'gate') {
      onOpenCaravans(activeCity.id);
      onClose();
    }
  };

  const handleTavernRestClick = () => {
    if (playerGold < spec.tavernRestCostGold) return;
    onTavernRest(spec.tavernRestCostGold, activeCity.name);
    setTavernRestedFlash(true);
    const id = window.setTimeout(() => setTavernRestedFlash(false), 1800);
    timersRef.current.push(id);
  };

  const handleChallengeOpponent = (opponent: ArenaOpponentSpec) => {
    if (playerGold < opponent.entryFeeGold) {
      setArenaMessage(`Za mało złota na wpisowe (${opponent.entryFeeGold} zł).`);
      return;
    }
    const paid = onStartArenaDuelWager(opponent.entryFeeGold);
    if (!paid) {
      setArenaMessage('Nie udało się opłacić wpisowego na Arenę.');
      return;
    }

    const playerCombatant: ArenaCombatantStats = {
      name: knight.name,
      title: `${activePath.shortTitle} · ${knight.title}`,
      level: knight.level,
      portraitUrl: activePortrait.imageUrl,
      bannerHex: knight.bannerColorHex || '#D4AF37',
      maxHp: derivedHero.effectiveMaxHp,
      strength: derivedHero.effectiveStrength,
      defense: derivedHero.effectiveDefense,
      tactics: derivedHero.effectiveTactics,
      arcaneBonusDmg: derivedHero.arcaneBonusDmg,
    };

    const nextDuel = initArenaDuel(playerCombatant, opponent);
    // Start duel with at least 60% of player's max HP so injured knights can still fight fairly if rested
    nextDuel.playerHp = Math.max(
      Math.round(playerCombatant.maxHp * 0.65),
      Math.min(playerCombatant.maxHp, knight.hp),
    );
    setArenaMessage('');
    setDuel(nextDuel);
    setExchangeKey(0);
    setClashPhase('idle');
    soundEngine.playCaravanHorn();
  };

  const handleExecuteMove = (moveId: ArenaMoveId) => {
    if (!duel || duel.status !== 'fighting' || clashPhase !== 'idle') return;
    const specMove = ARENA_MOVES.find((m) => m.id === moveId);
    if (specMove && duel.playerStamina < specMove.staminaCost) return;

    const seed = Date.now() + duel.round * 97 + duel.enemyHp * 13;
    const nextState = resolveArenaTurn(duel, moveId, seed);
    const ex = nextState.lastExchange;

    setDuel(nextState);
    setExchangeKey((k) => k + 1);
    setClashPhase('player_strike');
    soundEngine.playSwordClash(Boolean(ex?.playerCrit || moveId === 'arcane_surge'));

    const t1 = window.setTimeout(() => {
      if (ex && ex.enemyDmgDealt > 0 && nextState.enemyHp > 0) {
        setClashPhase('enemy_strike');
        soundEngine.playSwordClash(ex.enemyCrit);
      } else {
        setClashPhase('idle');
      }
    }, prefersReducedMotion ? 100 : 250);

    const t2 = window.setTimeout(() => {
      setClashPhase('idle');
      if (nextState.status !== 'fighting') {
        if (nextState.status === 'victory') {
          soundEngine.playTechUnlock();
        } else {
          soundEngine.playAuctionGavel();
        }
        onArenaDuelComplete({
          won: nextState.status === 'victory',
          opponent: nextState.opponent,
          remainingHp: nextState.playerHp,
        });
      }
    }, prefersReducedMotion ? 180 : 520);

    timersRef.current.push(t1, t2);
  };

  const playerHpPct = duel
    ? Math.max(0, Math.min(100, Math.round((duel.playerHp / Math.max(1, duel.player.maxHp)) * 100)))
    : Math.max(0, Math.min(100, Math.round((knight.hp / Math.max(1, derivedHero.effectiveMaxHp)) * 100)));
  const enemyHpPct = duel
    ? Math.max(0, Math.min(100, Math.round((duel.enemyHp / Math.max(1, duel.opponent.maxHp)) * 100)))
    : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Wnętrze miasta: ${activeCity.name}`}
      data-testid="city-interior-modal"
      className="fixed inset-0 z-40 bg-[#05080d] text-slate-100 flex flex-col overflow-hidden"
    >
      {/* ==================== TOP HEADER BAR ==================== */}
      <header className="shrink-0 bg-[#0a0f18] border-b border-slate-800 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-2 z-20">
        {/* Left: City Identity + Mode Switch */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-sm shrink-0 border border-white/30"
              style={{ backgroundColor: activeCity.colorHex }}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-white truncate">
                  {activeCity.name}
                </h2>
                <span className="hidden md:inline text-[11px] font-semibold text-amber-300 truncate">
                  {activeCity.raceLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">{spec.districtTagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 pl-2 border-l border-slate-800">
            <button
              type="button"
              data-testid="city-mode-plaza"
              onClick={() => setMode('plaza')}
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                mode === 'plaza'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-[#111722] hover:bg-slate-800 text-slate-200 border border-slate-700'
              }`}
            >
              Rynek Miasta
            </button>
            <button
              type="button"
              data-testid="city-mode-arena"
              onClick={() => setMode('arena')}
              className={`min-h-[34px] px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                mode === 'arena'
                  ? 'bg-rose-600 text-white'
                  : 'bg-[#111722] hover:bg-slate-800 text-rose-300 border border-rose-500/40'
              }`}
            >
              Arena Rycerska
            </button>
          </div>
        </div>

        {/* Right: 12-City Selector, Gold/HP Telemetry, Close */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            aria-label="Wybierz miasto do odwiedzenia"
            data-testid="city-interior-selector"
            value={activeCity.id}
            onChange={(e) => onChangeCity(e.target.value)}
            className="min-h-[34px] bg-[#111722] hover:bg-slate-800 border border-amber-500/45 rounded-md px-2.5 py-1 text-xs font-semibold text-amber-200 cursor-pointer outline-none"
          >
            {CITIES.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0c1118] text-slate-100">
                {c.name} ({c.raceLabel})
              </option>
            ))}
          </select>

          <div className="hidden lg:flex items-center gap-3 px-2.5 py-1 bg-[#111722] border border-slate-800 rounded-md font-mono-tabular text-xs">
            <span className="text-amber-400 font-bold">
              {Math.round(playerGold).toLocaleString('pl-PL')} zł
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-bold">
              HP {knight.hp}/{derivedHero.effectiveMaxHp}
            </span>
          </div>

          <button
            type="button"
            data-testid="city-interior-close"
            onClick={onClose}
            className="min-h-[34px] px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white cursor-pointer"
          >
            Wyjdź na Mapę 3D
          </button>
        </div>
      </header>

      {/* ==================== MODE 1: INTERACTIVE ANIMATED CITY INTERIOR ==================== */}
      {mode === 'plaza' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Interactive Full-Bleed Animated City Stage */}
          <div className="relative flex-1 min-h-0 overflow-hidden bg-[#05080d]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCity.id}
                initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 1.03 }}
                animate={{
                  opacity: 1,
                  scale: prefersReducedMotion ? 1 : [1, 1.045, 1],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
                  scale: prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 18, repeat: Infinity, ease: 'easeInOut' },
                }}
                className="absolute inset-0"
              >
                <img
                  src={spec.backdropUrl}
                  alt={`Wnętrze miasta ${activeCity.name}`}
                  className="w-full h-full object-cover object-center select-none"
                />
              </motion.div>
            </AnimatePresence>

            {/* Atmospheric Vignette & Lighting Grade */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: atmosphere.tintOverlay }}
            />

            {/* Animated Atmospheric Motes / Snow / Sparks */}
            {!prefersReducedMotion && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {AMBIENT_PARTICLES.map((p) => (
                  <motion.span
                    key={`${spec.atmosphere}-${p.id}`}
                    className={`absolute rounded-full ${atmosphere.particleClass}`}
                    style={{
                      left: `${p.leftPct}%`,
                      top: `${p.topPct}%`,
                      width: `${p.size}px`,
                      height: `${p.size}px`,
                      boxShadow: atmosphere.glowStyle,
                    }}
                    animate={{
                      x: [0, p.driftX, 0],
                      y: [0, p.driftY, 0],
                      opacity: [0.15, 0.85, 0.15],
                      scale: [0.85, 1.35, 0.85],
                    }}
                    transition={{
                      duration: p.duration,
                      delay: p.delay,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Top-Left Lore Plaque */}
            <motion.div
              key={`lore-${activeCity.id}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute top-4 left-4 z-10 max-w-md bg-[#0a0f18]/95 border border-slate-700/80 rounded-lg px-3.5 py-2.5 shadow-xl"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                Wnętrze Stolicy · {activeCity.raceLabel}
              </div>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{spec.welcomeLine}</p>
              <div className="text-[11px] text-emerald-300 mt-1 font-medium">
                Atut Miasta: {spec.cityPerkLabel}
              </div>
            </motion.div>

            {/* 5 Interactive Animated Landmark Hotspots */}
            {spec.hotspots.map((h, idx) => (
              <motion.button
                key={`${activeCity.id}-${h.id}`}
                type="button"
                data-testid={`city-hotspot-${h.id}`}
                onClick={() => handleHotspotClick(h.id)}
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.32, delay: 0.08 + idx * 0.06 }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.06, y: -3 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  left: `${h.xPct}%`,
                  top: `${h.yPct}%`,
                  borderLeftColor: h.accentHex,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex items-center gap-2.5 bg-[#090e17]/95 hover:bg-[#111928] border border-slate-700 border-l-4 rounded-lg px-3 py-2 text-left shadow-2xl cursor-pointer group"
              >
                <span
                  className="relative flex items-center justify-center w-8 h-8 rounded-md shrink-0"
                  style={{
                    backgroundColor: `${h.accentHex}22`,
                    color: h.accentHex,
                    border: `1px solid ${h.accentHex}66`,
                  }}
                >
                  {renderHotspotIcon(h.id)}
                  {!prefersReducedMotion && (
                    <motion.span
                      className="absolute inset-0 rounded-md"
                      style={{ border: `1px solid ${h.accentHex}` }}
                      animate={{ scale: [1, 1.38], opacity: [0.7, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white whitespace-nowrap group-hover:text-amber-300 transition-colors">
                    {h.label}
                  </div>
                  <div className="text-[10px] text-slate-400 whitespace-nowrap">{h.subtitle}</div>
                </div>
              </motion.button>
            ))}

            {/* Inline Animated Tavern Rest & Rumors Drawer */}
            <AnimatePresence>
              {tavernOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  transition={{ duration: 0.24 }}
                  data-testid="city-tavern-panel"
                  className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-[420px] z-30 bg-[#0b111c] border-2 border-emerald-500/70 rounded-xl p-4 shadow-2xl space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                        Karczma Kupiecka
                      </div>
                      <h3 className="text-sm font-bold text-white">{spec.tavernName}</h3>
                      <p className="text-[11px] text-slate-300 mt-0.5">{spec.tavernMealLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTavernOpen(false)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
                    >
                      Zamknij
                    </button>
                  </div>

                  <div className="bg-[#070b12] border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-300 space-y-1">
                    <button onClick={onOpenInn} className="text-amber-200 underline">Tablica ogłoszeń i stół gildii</button>
                    <div className="font-semibold text-amber-300">Plotka Giełdowa z Karczmy:</div>
                    <p>
                      Kupcy w {activeCity.name} płacą dziś wysoką premię za{' '}
                      <strong className="text-white">{demandComm?.name ?? 'towary'}</strong> (
                      <span className="font-mono-tabular text-emerald-300">
                        {Math.round(demandPrice)} zł/szt.
                      </span>
                      ), a lokalna nadwyżka{' '}
                      <strong className="text-white">{specialtyComm?.name ?? 'surowca'}</strong> kosztuje{' '}
                      <span className="font-mono-tabular text-amber-300">
                        {Math.round(specialtyPrice)} zł/szt.
                      </span>
                      .
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] text-slate-300">
                      Pełne leczenie HP + <strong className="text-emerald-300">+2 tury</strong>
                    </div>
                    <button
                      type="button"
                      data-testid="city-tavern-rest-btn"
                      disabled={playerGold < spec.tavernRestCostGold}
                      onClick={handleTavernRestClick}
                      className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs cursor-pointer"
                    >
                      {tavernRestedFlash
                        ? 'Wypoczęto! (+HP)'
                        : `Odpocznij (${spec.tavernRestCostGold} zł)`}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom City Telemetry & 12-City Instant Travel Strip */}
          <div className="shrink-0 bg-[#0a0f18] border-t border-slate-800 px-4 py-2.5 space-y-2 z-20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <div>
                  <span className="text-slate-400">Eksport Miasta: </span>
                  <strong className="text-amber-300">{specialtyComm?.name}</strong>{' '}
                  <span className="font-mono-tabular text-slate-200">
                    ({Math.round(specialtyPrice)} zł)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Popyt Premium: </span>
                  <strong className="text-emerald-300">{demandComm?.name}</strong>{' '}
                  <span className="font-mono-tabular text-slate-200">
                    ({Math.round(demandPrice)} zł)
                  </span>
                </div>
                <div className="hidden md:block">
                  <span className="text-slate-400">Twoja Arena: </span>
                  <strong className="font-mono-tabular text-rose-300">
                    {arenaWins} wygranych · ELO {arenaRating}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenMarket(activeCity.id);
                    onClose();
                  }}
                  className="min-h-[34px] px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                >
                  Giełda w {activeCity.name}
                </button>
                <button
                  type="button"
                  data-testid="city-footer-enter-arena-btn"
                  onClick={() => setMode('arena')}
                  className="min-h-[34px] px-3.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                >
                  Wejdź na Arenę Rycerską
                </button>
              </div>
            </div>

            {/* Horizontal Strip of All 12 Trade Capitals */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 pr-1">
                Miasta ({CITIES.length})
              </span>
              {CITIES.map((c) => {
                const isCurrent = c.id === activeCity.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`city-quick-jump-${c.id}`}
                    onClick={() => onChangeCity(c.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                        : 'bg-[#111722] hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODE 2: ANIMATED KNIGHT'S ARENA ==================== */}
      {mode === 'arena' && (
        <div
          data-testid="knight-arena-view"
          className="relative flex-1 min-h-0 flex flex-col overflow-hidden bg-[#05080d]"
        >
          {/* Grand Colosseum Backdrop */}
          <motion.div
            initial={{ scale: 1 }}
            animate={prefersReducedMotion ? { scale: 1 } : { scale: [1, 1.035, 1] }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 20, repeat: Infinity, ease: 'easeInOut' }
            }
            className="absolute inset-0 pointer-events-none"
          >
            <img
              src={IMG_KNIGHT_ARENA}
              alt="Arena Rycerska"
              className="w-full h-full object-cover object-center opacity-85 select-none"
            />
          </motion.div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(5,8,13,0.68) 0%, rgba(5,8,13,0.34) 45%, rgba(5,8,13,0.88) 100%)',
            }}
          />

          {/* Arena Content Scrollable Area */}
          <div className="relative z-10 flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
            {!duel ? (
              /* ---------- ARENA MATCHMAKING LOBBY ---------- */
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left 4 Cols: Player's Knight Card */}
                <div className="lg:col-span-4 bg-[#0b111c]/95 border border-amber-500/50 rounded-xl p-4 space-y-3.5 shadow-2xl h-fit">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-16 h-16 rounded-lg overflow-hidden border-2 shrink-0 bg-[#111722]"
                      style={{ borderColor: knight.bannerColorHex || '#D4AF37' }}
                    >
                      <img
                        src={activePortrait.imageUrl}
                        alt={knight.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                        Twój Rycerz Turniejowy
                      </div>
                      <h3 className="font-display text-lg font-bold text-white truncate">
                        {knight.name}
                      </h3>
                      <div className="text-xs text-slate-300 truncate">
                        Poz. {knight.level} · {activePath.shortTitle}
                      </div>
                    </div>
                  </div>

                  {/* HP Progress */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-mono-tabular">
                      <span className="text-slate-400">Zdrowie Rycerza</span>
                      <span className="text-emerald-400 font-bold">
                        {knight.hp} / {derivedHero.effectiveMaxHp} HP
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-900 rounded overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${playerHpPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Combat Telemetry Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono-tabular">
                    <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                      <div className="text-[10px] text-slate-400">SIŁA ATAKU</div>
                      <div className="text-sm font-bold text-rose-400">
                        {derivedHero.effectiveStrength}
                      </div>
                    </div>
                    <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                      <div className="text-[10px] text-slate-400">PANCERZ</div>
                      <div className="text-sm font-bold text-sky-400">
                        {derivedHero.effectiveDefense}
                      </div>
                    </div>
                    <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                      <div className="text-[10px] text-slate-400">TAKTYKA (KRYT)</div>
                      <div className="text-sm font-bold text-amber-400">
                        {derivedHero.effectiveTactics}
                      </div>
                    </div>
                    <div className="bg-[#070b12] border border-slate-800 rounded p-2">
                      <div className="text-[10px] text-slate-400">MOC RUNICZNA</div>
                      <div className="text-sm font-bold text-purple-300">
                        +{derivedHero.arcaneBonusDmg}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800 font-mono-tabular text-xs">
                    <div>
                      <span className="text-slate-400">Wygrane: </span>
                      <strong className="text-emerald-400">{arenaWins}</strong>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400">Ranking: </span>
                      <strong className="text-amber-300">{arenaRating} ELO</strong>
                    </div>
                  </div>

                  {knight.hp < derivedHero.effectiveMaxHp && (
                    <button
                      type="button"
                      disabled={playerGold < spec.tavernRestCostGold}
                      onClick={handleTavernRestClick}
                      className="w-full min-h-[36px] px-3 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Ulecz Rycerza w Karczmie ({spec.tavernRestCostGold} zł)
                    </button>
                  )}
                </div>

                {/* Right 8 Cols: City Champion + Rival Player Knights Roster */}
                <div className="lg:col-span-8 space-y-3">
                  <div className="bg-[#0b111c]/95 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-rose-400">
                        Arena Turniejowa · {activeCity.name}
                      </div>
                      <h3 className="font-display text-xl font-bold text-white">
                        Wyzwij Rycerzy na Animowany Pojedynek
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5">
                        Zmierz się z Czempionem {activeCity.name} lub wyzwij rycerzy rywalizujących graczy z rankingu świata.
                      </p>
                    </div>
                    {arenaMessage && (
                      <div className="text-xs font-bold text-rose-300 bg-rose-950/80 border border-rose-500/50 rounded px-3 py-1.5">
                        {arenaMessage}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {arenaOpponents.map((opp) => {
                      const canAfford = playerGold >= opp.entryFeeGold;
                      return (
                        <motion.div
                          key={opp.id}
                          whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                          className={`bg-[#0b111c]/95 rounded-xl p-3.5 border shadow-xl flex flex-col justify-between gap-3 ${
                            opp.isCityChampion
                              ? 'border-amber-400/75 md:col-span-2'
                              : 'border-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className="w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 bg-[#111722]"
                              style={{ borderColor: opp.bannerHex }}
                            >
                              <img
                                src={opp.portraitUrl}
                                alt={opp.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-[10px] font-bold uppercase tracking-wider ${
                                    opp.isCityChampion ? 'text-amber-400' : 'text-sky-400'
                                  }`}
                                >
                                  {opp.isCityChampion ? 'Czempion Miasta' : 'Rycerz Gracza'}
                                </span>
                                <span className="text-[10px] font-mono-tabular text-slate-400">
                                  {opp.guildTag} · Poz. {opp.level}
                                </span>
                              </div>
                              <h4 className="text-sm sm:text-base font-bold text-white truncate">
                                {opp.name}
                              </h4>
                              <div className="text-[11px] text-slate-300 truncate">
                                {opp.title} · Technika:{' '}
                                <span className="text-amber-300">{opp.signatureMoveName}</span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] font-mono-tabular text-slate-300">
                                <span>
                                  HP: <strong className="text-emerald-400">{opp.maxHp}</strong>
                                </span>
                                <span>
                                  Siła: <strong className="text-rose-400">{opp.strength}</strong>
                                </span>
                                <span>
                                  Pancerz: <strong className="text-sky-400">{opp.defense}</strong>
                                </span>
                                <span>
                                  Taktyka: <strong className="text-amber-400">{opp.tactics}</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                            <div className="text-[11px] font-mono-tabular text-slate-300">
                              Wpisowe:{' '}
                              <strong className="text-amber-300">{opp.entryFeeGold} zł</strong> ·
                              Nagroda:{' '}
                              <strong className="text-emerald-400">
                                +{opp.rewardGold} zł, +{opp.rewardXp} XP, +{opp.ratingGain} ELO
                              </strong>
                            </div>
                            <button
                              type="button"
                              data-testid={`arena-challenge-${opp.id}`}
                              disabled={!canAfford}
                              onClick={() => handleChallengeOpponent(opp)}
                              className={`min-h-[36px] px-4 py-1.5 rounded-lg font-bold text-xs cursor-pointer transition-colors ${
                                opp.isCityChampion
                                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:bg-slate-800 disabled:text-slate-500'
                                  : 'bg-rose-600 hover:bg-rose-500 text-white disabled:bg-slate-800 disabled:text-slate-500'
                              }`}
                            >
                              {opp.isCityChampion ? 'Wyzwij Czempiona' : 'Wyzwij na Pojedynek'}
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* ---------- LIVE ANIMATED DUEL STAGE ---------- */
              <div
                data-testid="arena-duel-stage"
                className="max-w-5xl mx-auto flex flex-col gap-4"
              >
                {/* Top Duel Header */}
                <div className="bg-[#0b111c]/95 border border-slate-700 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/40 rounded px-2.5 py-1">
                      RUNDA {duel.round}
                    </span>
                    <div className="text-xs sm:text-sm font-bold text-white">
                      Arena Rycerska — {activeCity.name}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="arena-back-to-lobby-btn"
                    onClick={() => {
                      clearScheduledTimers();
                      setDuel(null);
                      setClashPhase('idle');
                    }}
                    className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                  >
                    Wróć do Listy Rywali
                  </button>
                </div>

                {/* Main Split Combat Stage with Animated Lunges, Recoils & SVG Slash VFX */}
                <div className="relative bg-[#090e17]/95 border border-amber-500/40 rounded-2xl px-4 sm:px-6 pt-8 pb-6 shadow-2xl overflow-visible">
                  <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                    {/* LEFT: PLAYER KNIGHT */}
                    <div className="md:col-span-4 space-y-3 relative">
                      <motion.div
                        animate={
                          prefersReducedMotion
                            ? { x: 0, rotate: 0 }
                            : clashPhase === 'player_strike'
                              ? { x: [0, 52, -6, 0], rotate: [0, 5, 0] }
                              : clashPhase === 'enemy_strike'
                                ? { x: [0, -16, 10, -6, 0], rotate: [0, -4, 0] }
                                : { x: 0, rotate: 0 }
                        }
                        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                        className="relative bg-[#0f1624] border-2 rounded-xl p-3 shadow-xl"
                        style={{
                          borderColor:
                            clashPhase === 'enemy_strike'
                              ? '#F43F5E'
                              : duel.lastExchange?.playerBlocked && clashPhase !== 'idle'
                                ? '#38BDF8'
                                : duel.player.bannerHex,
                        }}
                      >
                        {/* Floating Damage / Heal Popups for Player */}
                        <AnimatePresence>
                          {exchangeKey > 0 && duel.lastExchange && (
                            <motion.div
                              key={`p-pop-${exchangeKey}`}
                              initial={{ opacity: 0, y: 12, scale: 0.8 }}
                              animate={{ opacity: 1, y: -22, scale: 1.05 }}
                              exit={{ opacity: 0, y: -38 }}
                              transition={{ duration: 0.55 }}
                              className="absolute -top-3 right-3 z-20 flex flex-col items-end gap-0.5 pointer-events-none"
                            >
                              {duel.lastExchange.enemyDmgDealt > 0 && (
                                <span className="font-mono-tabular text-sm font-black text-rose-400 bg-[#05080d]/95 border border-rose-500/60 px-2 py-0.5 rounded shadow">
                                  {duel.lastExchange.enemyCrit ? 'KRYTYK ' : ''}-
                                  {duel.lastExchange.enemyDmgDealt} HP
                                </span>
                              )}
                              {duel.lastExchange.playerHeal > 0 && (
                                <span className="font-mono-tabular text-xs font-bold text-emerald-300 bg-[#05080d]/95 border border-emerald-500/60 px-2 py-0.5 rounded shadow">
                                  BLOK · +{duel.lastExchange.playerHeal} HP
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex items-center gap-3">
                          <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                            <img
                              src={duel.player.portraitUrl}
                              alt={duel.player.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                              Twój Rycerz · Poz. {duel.player.level}
                            </div>
                            <div className="font-display text-base font-bold text-white truncate">
                              {duel.player.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              Siła {duel.player.strength} · Pancerz {duel.player.defense}
                            </div>
                          </div>
                        </div>

                        {/* Player HP Bar */}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs font-mono-tabular">
                            <span className="text-slate-400">HP</span>
                            <span
                              data-testid="arena-player-hp"
                              className="font-bold text-emerald-400"
                            >
                              {duel.playerHp} / {duel.player.maxHp}
                            </span>
                          </div>
                          <div className="h-3 bg-slate-950 rounded overflow-hidden border border-slate-800">
                            <motion.div
                              className="h-full bg-emerald-500"
                              animate={{ width: `${playerHpPct}%` }}
                              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                            />
                          </div>
                        </div>

                        {/* Player Stamina / Fury Bar */}
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[11px] font-mono-tabular">
                            <span className="text-slate-400">Furia Bojowa</span>
                            <span
                              data-testid="arena-player-stamina"
                              className="font-bold text-amber-300"
                            >
                              {duel.playerStamina} / 100
                            </span>
                          </div>
                          <div className="h-2 bg-slate-950 rounded overflow-hidden border border-slate-800">
                            <motion.div
                              className="h-full bg-amber-400"
                              animate={{ width: `${duel.playerStamina}%` }}
                              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    </div>

                    {/* CENTER: CHOREOGRAPHED CLASH VFX ZONE */}
                    <div className="md:col-span-3 flex flex-col items-center justify-center min-h-[140px] relative">
                      {exchangeKey > 0 && duel.lastExchange ? (
                        <motion.div
                          key={`vfx-${exchangeKey}`}
                          initial={{ opacity: 0.25, scale: 0.72 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="flex flex-col items-center justify-center text-center"
                        >
                            {duel.lastExchange.playerMove === 'arcane_surge' ? (
                              <svg viewBox="0 0 120 120" className="w-24 h-24 text-purple-400">
                                <motion.circle
                                  cx="60"
                                  cy="60"
                                  r="42"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeDasharray="10 6"
                                  initial={{ rotate: 0, opacity: 0.2 }}
                                  animate={{ rotate: 180, opacity: 1 }}
                                  transition={{ duration: 0.45 }}
                                />
                                <motion.path
                                  d="M20 60 L60 18 L100 60 L60 102 Z"
                                  fill="rgba(168,85,247,0.22)"
                                  stroke="#E9D5FF"
                                  strokeWidth="3"
                                  initial={{ scale: 0.5 }}
                                  animate={{ scale: 1 }}
                                />
                              </svg>
                            ) : duel.lastExchange.playerMove === 'shield_riposte' ? (
                              <svg viewBox="0 0 120 120" className="w-24 h-24 text-sky-400">
                                <motion.path
                                  d="M60 14 L98 30 V62 C98 86 81 102 60 108 C39 102 22 86 22 62 V30 Z"
                                  fill="rgba(56,189,248,0.2)"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  initial={{ scale: 0.7 }}
                                  animate={{ scale: 1.04 }}
                                />
                                <path d="M40 78 L84 34" stroke="#FDE68A" strokeWidth="4" strokeLinecap="round" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 120 120" className="w-24 h-24">
                                <motion.path
                                  d="M20 96 Q60 44 102 22"
                                  fill="none"
                                  stroke={duel.lastExchange.playerCrit ? '#F43F5E' : '#F59E0B'}
                                  strokeWidth="6"
                                  strokeLinecap="round"
                                  initial={{ pathLength: 0 }}
                                  animate={{ pathLength: 1 }}
                                  transition={{ duration: 0.24 }}
                                />
                                <motion.path
                                  d="M22 24 Q64 56 100 96"
                                  fill="none"
                                  stroke="#FDE68A"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                  initial={{ pathLength: 0 }}
                                  animate={{ pathLength: 1 }}
                                  transition={{ duration: 0.24, delay: 0.06 }}
                                />
                                <circle cx="60" cy="60" r="10" fill="#FEF08A" opacity="0.85" />
                              </svg>
                            )}

                            <div className="mt-1 text-xs font-black tracking-wider uppercase text-amber-300">
                              {duel.lastExchange.playerCrit
                                ? 'KRYTYCZNE CIĘCIE!'
                                : duel.lastExchange.enemyStaggered
                                  ? 'WRÓG OGŁUSZONY!'
                                  : duel.lastExchange.playerBlocked
                                    ? 'TARCZA I KONTRA!'
                                    : 'STARCIE STALI!'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {duel.lastExchange.playerMoveName} vs {duel.lastExchange.enemyMoveName}
                            </div>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="vfx-ready"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center space-y-1"
                          >
                            <div className="font-display text-3xl font-black text-amber-400 tracking-widest">
                              VS
                            </div>
                            <div className="text-[11px] text-slate-300">
                              Wybierz manewr poniżej
                            </div>
                          </motion.div>
                        )}
                    </div>

                    {/* RIGHT: OPPONENT KNIGHT */}
                    <div className="md:col-span-4 space-y-3 relative">
                      <motion.div
                        animate={
                          prefersReducedMotion
                            ? { x: 0, rotate: 0 }
                            : clashPhase === 'player_strike'
                              ? { x: [0, 18, -12, 8, 0], rotate: [0, 4, 0] }
                              : clashPhase === 'enemy_strike'
                                ? { x: [0, -52, 6, 0], rotate: [0, -5, 0] }
                                : { x: 0, rotate: 0 }
                        }
                        transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                        className="relative bg-[#0f1624] border-2 rounded-xl p-3 shadow-xl"
                        style={{
                          borderColor:
                            clashPhase === 'player_strike'
                              ? '#F43F5E'
                              : duel.opponent.bannerHex,
                        }}
                      >
                        {/* Floating Damage Popup on Opponent */}
                        <AnimatePresence>
                          {exchangeKey > 0 && duel.lastExchange && (
                            <motion.div
                              key={`e-pop-${exchangeKey}`}
                              initial={{ opacity: 0, y: 12, scale: 0.8 }}
                              animate={{ opacity: 1, y: -22, scale: 1.08 }}
                              exit={{ opacity: 0, y: -38 }}
                              transition={{ duration: 0.55 }}
                              className="absolute -top-3 left-3 z-20 flex flex-col items-start gap-0.5 pointer-events-none"
                            >
                              <span
                                className={`font-mono-tabular text-sm font-black px-2 py-0.5 rounded shadow border bg-[#05080d]/95 ${
                                  duel.lastExchange.playerCrit
                                    ? 'text-amber-300 border-amber-400'
                                    : 'text-rose-400 border-rose-500/60'
                                }`}
                              >
                                {duel.lastExchange.playerCrit ? 'KRYTYK ' : ''}-
                                {duel.lastExchange.playerDmgDealt} HP
                              </span>
                              {duel.lastExchange.enemyStaggered && (
                                <span className="text-[10px] font-bold text-purple-300 bg-[#05080d]/95 border border-purple-500/60 px-1.5 py-0.5 rounded">
                                  OGŁUSZONY (-40% ATAKU)
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="flex items-center gap-3">
                          <div className="w-20 h-20 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                            <img
                              src={duel.opponent.portraitUrl}
                              alt={duel.opponent.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                              {duel.opponent.guildTag} · Poz. {duel.opponent.level}
                            </div>
                            <div className="font-display text-base font-bold text-white truncate">
                              {duel.opponent.name}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate">
                              Siła {duel.opponent.strength} · Pancerz {duel.opponent.defense}
                            </div>
                          </div>
                        </div>

                        {/* Enemy HP Bar */}
                        <div className="mt-3 space-y-1">
                          <div className="flex justify-between text-xs font-mono-tabular">
                            <span className="text-slate-400">HP Rywala</span>
                            <span
                              data-testid="arena-enemy-hp"
                              className="font-bold text-rose-400"
                            >
                              {duel.enemyHp} / {duel.opponent.maxHp}
                            </span>
                          </div>
                          <div className="h-3 bg-slate-950 rounded overflow-hidden border border-slate-800">
                            <motion.div
                              className="h-full bg-rose-500"
                              animate={{ width: `${enemyHpPct}%` }}
                              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                            />
                          </div>
                        </div>

                        {/* Enemy Stamina Bar */}
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-[11px] font-mono-tabular">
                            <span className="text-slate-400">Furia Rywala</span>
                            <span className="font-bold text-orange-300">
                              {duel.enemyStamina} / 100
                            </span>
                          </div>
                          <div className="h-2 bg-slate-950 rounded overflow-hidden border border-slate-800">
                            <motion.div
                              className="h-full bg-orange-400"
                              animate={{ width: `${duel.enemyStamina}%` }}
                              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>

                {/* Victory / Defeat Result Card OR Tactical Move Deck */}
                {duel.status !== 'fighting' ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    data-testid="arena-result-banner"
                    className={`rounded-xl p-5 border shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 ${
                      duel.status === 'victory'
                        ? 'bg-[#0b1714]/95 border-emerald-400/75'
                        : 'bg-[#1a0d12]/95 border-rose-500/75'
                    }`}
                  >
                    <div>
                      <div
                        className={`text-xs font-bold uppercase tracking-widest ${
                          duel.status === 'victory' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {duel.status === 'victory' ? 'Triumf na Arenie Rycerskiej' : 'Koniec Pojedynku'}
                      </div>
                      <h3 className="font-display text-2xl font-bold text-white mt-0.5">
                        {duel.status === 'victory'
                          ? `Pokonałeś: ${duel.opponent.name}!`
                          : `${duel.opponent.name} obronił pole`}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1 font-mono-tabular">
                        {duel.status === 'victory'
                          ? `Nagroda: +${duel.opponent.rewardGold} zł · +${duel.opponent.rewardXp} XP · +${duel.opponent.ratingGain} ELO`
                          : 'Odwiedź Karczmę lub ulepsz broń w Kuźni, aby wrócić silniejszym.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={playerGold < duel.opponent.entryFeeGold}
                        onClick={() => handleChallengeOpponent(duel.opponent)}
                        className="min-h-[38px] px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer"
                      >
                        Rewanż ({duel.opponent.entryFeeGold} zł)
                      </button>
                      <button
                        type="button"
                        onClick={() => setDuel(null)}
                        className="min-h-[38px] px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs cursor-pointer"
                      >
                        Inny Rywal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDuel(null);
                          setMode('plaza');
                        }}
                        className="min-h-[38px] px-4 py-2 rounded-lg bg-[#111722] hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
                      >
                        Rynek Miasta
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {ARENA_MOVES.map((move) => {
                      const enoughStamina = duel.playerStamina >= move.staminaCost;
                      const disabled = !enoughStamina || clashPhase !== 'idle';
                      return (
                        <motion.button
                          key={move.id}
                          type="button"
                          data-testid={`arena-move-${move.id}`}
                          disabled={disabled}
                          whileHover={disabled || prefersReducedMotion ? undefined : { y: -2 }}
                          whileTap={disabled ? undefined : { scale: 0.98 }}
                          onClick={() => handleExecuteMove(move.id)}
                          style={{ borderTopColor: enoughStamina ? move.accentHex : '#334155' }}
                          className="bg-[#0b111c]/95 hover:bg-[#131d2e] disabled:opacity-45 border border-slate-700 border-t-4 rounded-xl p-3 text-left transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-white">{move.name}</span>
                            <span
                              className="font-mono-tabular text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#05080d]"
                              style={{ color: move.accentHex }}
                            >
                              {move.staminaCost > 0
                                ? `-${move.staminaCost} Furii`
                                : `+${move.staminaGain} Furii`}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                            {move.shortDesc}
                          </p>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* Combat Chronicle Log */}
                <div className="bg-[#0a0f18]/95 border border-slate-800 rounded-xl p-3 space-y-1 max-h-32 overflow-y-auto">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Kronika Pojedynku
                  </div>
                  {duel.log.map((line, i) => (
                    <div
                      key={i}
                      className={`text-xs ${i === 0 ? 'text-amber-200 font-semibold' : 'text-slate-400'}`}
                    >
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
