import React, { useState } from 'react';
import {
  COMMODITIES,
  CommodityId,
  CommodityMarketState,
  MacroEconomyState,
  calculateInventoryEquilibriumPrice,
  calculateStorageDemurrageCost,
} from '../economy/economyEngine';

interface MathEconomyAndUISpecPanelProps {
  markets: Record<CommodityId, CommodityMarketState>;
  macro: MacroEconomyState;
  selectedCommodityId: CommodityId;
  playerGold: number;
  playerBondsGold: number;
  totalUnitsStored: number;
  freeStorageCap: number;
  onBuyMintBonds: (amount: number) => void;
  onRedeemMintBonds: () => void;
  onTriggerMacroShock: (action: 'supply_shock' | 'demand_boom' | 'mint_intervention' | 'dragon_raid') => void;
}

export const MathEconomyAndUISpecPanel: React.FC<MathEconomyAndUISpecPanelProps> = ({
  markets,
  macro,
  selectedCommodityId,
  playerGold,
  playerBondsGold,
  totalUnitsStored,
  freeStorageCap,
  onBuyMintBonds,
  onRedeemMintBonds,
  onTriggerMacroShock,
}) => {
  const [subTab, setSubTab] = useState<'math_model' | 'ui_3d_blueprint'>('math_model');
  const [bondAmount, setBondAmount] = useState<number>(2000);

  const spec = COMMODITIES.find((c) => c.id === selectedCommodityId) ?? COMMODITIES[0];
  const st = markets[selectedCommodityId];
  const pInv = st
    ? calculateInventoryEquilibriumPrice(
        spec.basePrice,
        st.inventory,
        spec.targetInventory,
        spec.elasticityGamma,
        macro.activeEventMultiplier[selectedCommodityId] ?? 1.0,
      )
    : spec.basePrice;

  const currentDemurrage = calculateStorageDemurrageCost(totalUnitsStored, freeStorageCap, macro.storageDemurrageRate);

  return (
    <div className="space-y-4 text-slate-100">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 bg-[#080b10] p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setSubTab('math_model')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              subTab === 'math_model'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            1. Matematyczny Model Gospodarki & Antyinflacja
          </button>
          <button
            type="button"
            onClick={() => setSubTab('ui_3d_blueprint')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              subTab === 'ui_3d_blueprint'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            2. Projekt Techniczny UI (Desktop/Mobile) & Koncepcja 3D
          </button>
        </div>

        <div className="text-xs font-mono-tabular text-slate-400">
          Podaż Pieniądza M(t): <strong className="text-amber-400">{macro.moneySupplyM.toLocaleString('pl-PL')} zł</strong> (Cel M*: {macro.targetMoneySupplyMStar.toLocaleString('pl-PL')} zł)
        </div>
      </div>

      {subTab === 'math_model' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left 7 Cols: Exact Mathematical Equations & Live Calibration */}
          <div className="lg:col-span-7 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-400">
                Równania Mikrostruktury Ceny ({spec.name} · {spec.symbol})
              </h3>
              <span className="text-xs font-mono-tabular text-slate-400">
                γ = {spec.elasticityGamma} · λ = {spec.kyleLambda} · θ = {spec.meanReversionTheta}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
              <div className="bg-[#080b10] border border-slate-800/90 rounded p-2.5 space-y-1">
                <div className="font-semibold text-emerald-400">
                  I. Krzywa Zapasów (Inventory Bonding Curve)
                </div>
                <div className="font-mono-tabular text-[11px] text-amber-200 bg-[#111722] px-2 py-1 rounded">
                  P_inv(t) = P₀ · (S* / S(t))^γ · E_event
                </div>
                <p className="text-[11px] text-slate-400">
                  Gdy zapasy <code className="text-slate-200">S(t) = {st?.inventory}</code> spadają poniżej równowagi <code className="text-slate-200">S* = {spec.targetInventory}</code>, cena fundamentalna rośnie nieliniowo z wykładnikiem elastyczności <code className="text-slate-200">γ = {spec.elasticityGamma}</code>.
                </p>
                <div className="text-[11px] font-mono-tabular text-slate-200 pt-1">
                  Aktualne P_inv: <strong>{pInv.toFixed(2)} zł</strong> (Baza P₀: {spec.basePrice} zł)
                </div>
              </div>

              <div className="bg-[#080b10] border border-slate-800/90 rounded p-2.5 space-y-1">
                <div className="font-semibold text-sky-400">
                  II. Wpływ Wolumenu (Kyle&apos;s Lambda Square-Root Law)
                </div>
                <div className="font-mono-tabular text-[11px] text-amber-200 bg-[#111722] px-2 py-1 rounded">
                  ΔP/P = λ · sgn(Q_net) · √(|Q_net| / V_avg)
                </div>
                <p className="text-[11px] text-slate-400">
                  Każda transakcja generuje poślizg cenowy (slippage) proporcjonalny do pierwiastka kwadratowego z wolumenu netto <code className="text-slate-200">Q_net = V_buy - V_sell</code> względem średniego obrotu.
                </p>
                <div className="text-[11px] font-mono-tabular text-slate-200 pt-1">
                  Przepływ Q_net: <strong>{st?.netOrderFlow ?? 0} szt.</strong> · Obrót 24h: {st?.volume24h ?? 0}
                </div>
              </div>

              <div className="bg-[#080b10] border border-slate-800/90 rounded p-2.5 space-y-1">
                <div className="font-semibold text-amber-400">
                  III. Proces Ornsteina-Uhlenbecka & Dynamiczny Spread
                </div>
                <div className="font-mono-tabular text-[11px] text-amber-200 bg-[#111722] px-2 py-1 rounded">
                  dP_t = θ(P_inv - P_t)dt + σP_t dW_t
                </div>
                <p className="text-[11px] text-slate-400">
                  Po szoku spekulacyjnym cena powraca z prędkością <code className="text-slate-200">θ = {spec.meanReversionTheta}</code> do ceny wynikającej z realnych zapasów w miastach.
                </p>
                <div className="text-[11px] font-mono-tabular text-slate-200 pt-1">
                  Spread L2: <strong>{st?.spreadPct.toFixed(2)}%</strong> (Bid {st?.bidPrice} / Ask {st?.askPrice})
                </div>
              </div>

              <div className="bg-[#080b10] border border-slate-800/90 rounded p-2.5 space-y-1">
                <div className="font-semibold text-rose-400">
                  IV. 5 Stabilizatorów Antyinflacyjnych (Gold Sinks)
                </div>
                <div className="font-mono-tabular text-[11px] text-amber-200 bg-[#111722] px-2 py-1 rounded">
                  τ(t) = τ₀ + κ·max(0,(M-M*)/M*) | C_mag = c₀·I^1.25
                </div>
                <p className="text-[11px] text-slate-400">
                  1) Podatek Tobina palący złoto z obiegu; 2) Progresywny Demurrage magazynowy; 3) Obligacje Mennicy; 4) Koszty eskorty i straty od Rebeliantów; 5) Prowizje Domu Aukcyjnego.
                </p>
                <div className="text-[11px] font-mono-tabular text-slate-200 pt-1">
                  Twój Demurrage: <strong>{currentDemurrage.toFixed(1)} zł/cykl</strong> ({totalUnitsStored}/{freeStorageCap} szt.)
                </div>
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Macro Telemetry, Stress-Test Simulator & Royal Mint Bonds */}
          <div className="lg:col-span-5 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white pb-2 border-b border-slate-800">
                Telemetria Banku Centralnego (Królewska Mennica)
              </h3>
              <div className="grid grid-cols-2 gap-2 mt-2.5 font-mono-tabular">
                <div className="bg-[#080b10] border border-slate-800 rounded p-2">
                  <div className="text-[11px] text-slate-400">Indeks Cen CPI / Inflacja π</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {macro.cpiIndex.toFixed(1)} pkt ({macro.inflationRatePct >= 0 ? '+' : ''}{macro.inflationRatePct.toFixed(1)}%)
                  </div>
                </div>
                <div className="bg-[#080b10] border border-slate-800 rounded p-2">
                  <div className="text-[11px] text-slate-400">Podatek Antyinflacyjny τ(t)</div>
                  <div className="text-sm font-bold text-amber-400 mt-0.5">
                    {macro.dynamicTaxRatePct.toFixed(2)}% (Burn)
                  </div>
                </div>
                <div className="bg-[#080b10] border border-slate-800 rounded p-2">
                  <div className="text-[11px] text-slate-400">Spalone Złoto (Sinks)</div>
                  <div className="text-sm font-bold text-emerald-400 mt-0.5">
                    {macro.totalGoldBurned.toLocaleString('pl-PL')} zł
                  </div>
                </div>
                <div className="bg-[#080b10] border border-slate-800 rounded p-2">
                  <div className="text-[11px] text-slate-400">Rentowność Obligacji APY</div>
                  <div className="text-sm font-bold text-sky-400 mt-0.5">
                    {macro.royalMintBondYieldPct.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Royal Mint Stabilization Bonds (Open Market Operations) */}
            <div className="bg-[#080b10] border border-slate-800 rounded p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-300">
                  Obligacje Antyinflacyjne Królewskiej Mennicy
                </span>
                <span className="font-mono-tabular text-slate-300">
                  Posiadasz: <strong>{Math.round(playerBondsGold)} zł</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={500}
                  step={500}
                  value={bondAmount}
                  onChange={(e) => setBondAmount(Math.max(100, Number(e.target.value) || 500))}
                  aria-label="Kwota zakupu obligacji Królewskiej Mennicy"
                  className="w-28 bg-[#111722] border border-slate-700 rounded px-2 py-1 text-xs font-mono-tabular text-white"
                />
                <button
                  type="button"
                  onClick={() => onBuyMintBonds(bondAmount)}
                  disabled={playerGold < bondAmount}
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 transition-colors"
                >
                  Zablokuj Złoto (+{macro.royalMintBondYieldPct}% APY)
                </button>
                {playerBondsGold > 0 && (
                  <button
                    type="button"
                    onClick={onRedeemMintBonds}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
                  >
                    Wykup + Odsetki
                  </button>
                )}
              </div>
            </div>

            {/* Interactive Macro Stress-Test Controls */}
            <div className="bg-[#080b10] border border-slate-800 rounded p-2.5">
              <div className="text-xs font-semibold text-slate-300 mb-1.5">
                Symulator Szoków Makroekonomicznych (Stress-Test na żywo)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onTriggerMacroShock('supply_shock')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-amber-300 text-left transition-colors"
                >
                  Szok Podażowy (-35% Zapasów)
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerMacroShock('demand_boom')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-rose-300 text-left transition-colors"
                >
                  Szok Inflacyjny (+95k Złota)
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerMacroShock('mint_intervention')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-emerald-300 text-left transition-colors"
                >
                  Interwencja Mennicy (Burn -110k)
                </button>
                <button
                  type="button"
                  onClick={() => onTriggerMacroShock('dragon_raid')}
                  className="px-2.5 py-1.5 text-xs font-medium rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-sky-300 text-left transition-colors"
                >
                  Najazd Smoka (Smocza Łuska)
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Sub-Tab 2: Technical UI Design System (Desktop + Mobile Touch) & 3D World Visual Concept */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
          <div className="lg:col-span-6 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <h3 className="text-sm font-bold text-amber-400">
              Projekt Techniczny Systemu UI (Desktop 1440p & Mobile Touch)
            </h3>
            <div className="space-y-2 text-slate-300">
              <div className="bg-[#080b10] border border-slate-800 rounded p-2.5">
                <div className="font-semibold text-white">
                  1. Architektura „Low-Occlusion Game Shell” (≥85% widoczności świata 3D)
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Centralny viewport WebGL pozostaje całkowicie odsłonięty w trybie eksploracji. Wszystkie moduły handlowe zgrupowano w jednym zwijanym doku dolnym (<code className="text-amber-300">Collapsible Bottom Dock [Klawisz H]</code>). Zastosowano pełnoekranowe powierzchnie <code className="text-amber-300">rgba(12, 17, 24, 0.95)</code> bez obciążającego GPU efektu <code className="text-amber-300">backdrop-filter</code> nad aktywnym płótnem 3D.
                </p>
              </div>

              <div className="bg-[#080b10] border border-slate-800 rounded p-2.5">
                <div className="font-semibold text-white">
                  2. Ergonomia Ekranów Dotykowych (Mobile-First Touch & Thumb Zone)
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Wszystkie przyciski transakcyjne (KUP / SPRZEDAJ / LICYTUJ / WYŚLIJ KARAWANĘ) posiadają strefę dotyku <code className="text-emerald-300">min-height: 44px</code> zgodnie z wytycznymi WCAG AA. Zamiast ręcznego wpisywania cyfr na klawiaturze ekranowej zastosowano szybkie selektory wolumenu (<code className="text-emerald-300">5 · 15 · 30 · 50 · MAX</code>) oraz responsywne przełączanie kolumn <code className="text-emerald-300">grid-cols-1 lg:grid-cols-12</code>.
                </p>
              </div>

              <div className="bg-[#080b10] border border-slate-800 rounded p-2.5">
                <div className="font-semibold text-white">
                  3. Typografia Quant-Fantasy & Dyscyplina Tabular Numerals
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Zestawienie klasycznego kroju heraldycznego <code className="text-amber-300">Cinzel</code> (nagłówki miast i gildii), czytelnego kroju interfejsu <code className="text-amber-300">Plus Jakarta Sans</code> oraz kroju <code className="text-amber-300">JetBrains Mono (tabular-nums)</code> dla arkusza zleceń L2, świec OHLC i kalkulatora arbitrażu — eliminujące drgania kolumn przy aktualizacjach WebSocket co 4.5s.
                </p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <h3 className="text-sm font-bold text-sky-400">
              Koncepcja Wizualna Świata 3D: „Kupiecki Świat: Odrodzenie”
            </h3>
            <div className="space-y-2 text-slate-300">
              <div className="bg-[#080b10] border border-slate-800 rounded p-2.5">
                <div className="font-semibold text-white">
                  1. Pięć Stolic Frakcyjnych jako Wieloczęściowe Monumenty PBR (THREE.Group)
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Każde z 5 miast oryginalnego Kupieckiego Świata posiada własną sylwetkę architektoniczną i materiał PBR: <strong>Królewska Przystań (Ludzie)</strong> – kamienna cytadela z pozłacaną iglicą mennicy; <strong>Srebrny Gaj (Elfy)</strong> – smukłe sanktuarium ze szmaragdowym dachem; <strong>Żelazna Kuźnia (Krasnoludy)</strong> – bazaltowy bastion z miedzianymi piecami; <strong>Krwawy Szczyt (Orkowie)</strong> – obsydianowa twierdza strzeżona przez krążącego w 3D Smoka; <strong>Złota Zatoka (Gobliny)</strong> – port alchemików z kryształowym маяkiem.
                </p>
              </div>

              <div className="bg-[#080b10] border border-slate-800 rounded p-2.5">
                <div className="font-semibold text-white">
                  2. Żywe Szlaki Handlowe (Catmull-Rom 3D Splines) i Fizyczne Karawany
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Wysłanie karawany arbitrażowej w interfejsie natychmiast materializuje wieloczęściowy wóz kupiecki 3D z latarnią, który fizycznie pokonuje zakrzywiony szlak między miastami w czasie rzeczywistym.
                </p>
              </div>

              <div className="bg-[#080b10] border border-slate-800 rounded p-2.5">
                <div className="font-semibold text-white">
                  3. Oświetlenie Studyjne ACES Filmic & Kontrast Ciepło/Chłód
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Zastosowano mapę refleksów środowiskowych <code className="text-sky-300">RoomEnvironment + PMREMGenerator</code>, ciepłe złote światło kierunkowe słońca (<code className="text-sky-300">#FFEED6</code>) skontrastowane z chłodnym światłem nieba <code className="text-sky-300">HemisphereLight (#93C5FD)</code> oraz mgłą wykładniczą <code className="text-sky-300">FogExp2</code> stapiającą górski horyzont i lasy (<code className="text-sky-300">THREE.InstancedMesh</code>).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
