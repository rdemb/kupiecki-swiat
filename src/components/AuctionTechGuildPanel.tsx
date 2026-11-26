import React, { useState } from 'react';
import {
  CITIES,
  COMMODITIES,
  CommodityId,
  CommodityMarketState,
  SEASONS,
  calculateCaravanQuote,
} from '../economy/economyEngine';
import type { ActiveWorldDisaster } from '../economy/worldDisasters';
import {
  AuctionItem,
  ChatMessage,
  GuildInfo,
  LeaderboardEntry,
  TECH_TREE,
  TechNode,
} from '../economy/gameData';
import { ActiveCaravan3D } from './World3DCanvas';
import { GuildTreasuryRankingChart } from './GuildTreasuryRankingChart';

// --- 1. CARAVAN ARBITRAGE & FEAR EXPEDITIONS VIEW ---
interface CaravanRoutesViewProps {
  markets: Record<CommodityId, CommodityMarketState>;
  activeSeason?: 'wiosna' | 'lato' | 'jesien' | 'zima';
  activeDisaster?: ActiveWorldDisaster | null;
  selectedCityId: string;
  onSelectCity: (id: string) => void;
  playerGold: number;
  activeCaravans: ActiveCaravan3D[];
  logisticsTechBonus: number;
  combatEscortBonus: number;
  onDispatchCaravan: (params: {
    originCityId: string;
    destinationCityId: string;
    commodityId: CommodityId;
    quantity: number;
    escortLevel: number;
    totalUpfrontCost: number;
    expectedProfit: number;
    grossRevenue: number;
    ambushRiskPct: number;
    durationSeconds: number;
  }) => void;
  onLaunchFearExpedition: (cost: number, dungeonName: string) => void;
}

export const CaravanRoutesView: React.FC<CaravanRoutesViewProps> = ({
  markets,
  activeSeason = 'lato',
  activeDisaster = null,
  selectedCityId,
  onSelectCity,
  playerGold,
  activeCaravans,
  logisticsTechBonus,
  combatEscortBonus,
  onDispatchCaravan,
  onLaunchFearExpedition,
}) => {
  const currentOriginCity = CITIES.find((c) => c.id === selectedCityId) ?? CITIES[0];
  const defaultSpecialty = currentOriginCity.specialty;
  const defaultDemandCity =
    CITIES.find((c) => c.demandCommodity === defaultSpecialty && c.id !== selectedCityId)?.id ??
    'zelazna_kuznia';

  const [destCityId, setDestCityId] = useState<string>(defaultDemandCity);
  const [commodityId, setCommodityId] = useState<CommodityId>(defaultSpecialty);
  const [quantity, setQuantity] = useState<number>(25);
  const [escortLevel, setEscortLevel] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleSelectOriginCity = (newCityId: string) => {
    onSelectCity(newCityId);
    const cityObj = CITIES.find((c) => c.id === newCityId);
    if (cityObj) {
      setCommodityId(cityObj.specialty);
      const bestDest = CITIES.find(
        (c) => c.demandCommodity === cityObj.specialty && c.id !== newCityId,
      );
      if (bestDest) setDestCityId(bestDest.id);
    }
  };

  const effectiveDestId =
    destCityId === selectedCityId
      ? CITIES.find((c) => c.id !== selectedCityId)?.id ?? 'zelazna_kuznia'
      : destCityId;

  const market = markets[commodityId];
  const cityPrices = market?.cityPrices ?? {};

  const quote = calculateCaravanQuote({
    originCityId: selectedCityId,
    destinationCityId: effectiveDestId,
    commodityId,
    quantity,
    escortLevel,
    cityPrices,
    logisticsTechBonus,
    season: activeSeason,
    activeDisaster,
  });

  const adjustedRiskPct = Number(
    Math.max(0.5, quote.effectiveAmbushRiskPct * (1 - Math.min(0.85, combatEscortBonus))).toFixed(1),
  );
  const totalUpfrontCost = Number((quote.cargoPurchaseCost + quote.transportFee).toFixed(2));

  const handleSend = () => {
    setErrorMsg('');
    if (totalUpfrontCost > playerGold) {
      setErrorMsg(`Brak złota na zakup ładunku i eskorty (wymagane ${Math.round(totalUpfrontCost)} zł).`);
      return;
    }
    onDispatchCaravan({
      originCityId: selectedCityId,
      destinationCityId: effectiveDestId,
      commodityId,
      quantity,
      escortLevel,
      totalUpfrontCost,
      expectedProfit: quote.expectedNetProfit,
      grossRevenue: quote.grossRevenue,
      ambushRiskPct: adjustedRiskPct,
      durationSeconds: quote.durationSeconds,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-slate-100">
      {/* Left 4 Cols: 5 Cities Selector & Specialty Overview */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
          <span className="text-xs font-semibold text-amber-400">Miasta Księstwa (Kliknij Punkt Startu)</span>
          <span className="text-[11px] text-slate-400">{CITIES.length} Stolic</span>
        </div>
        <div className="space-y-1.5 max-h-[330px] overflow-y-auto pr-1">
          {CITIES.map((city) => {
            const isSelected = city.id === selectedCityId;
            const specComm = COMMODITIES.find((c) => c.id === city.specialty);
            const demComm = COMMODITIES.find((c) => c.id === city.demandCommodity);
            return (
              <button
                key={city.id}
                type="button"
                onClick={() => handleSelectOriginCity(city.id)}
                className={`w-full text-left p-2.5 rounded-md border transition-colors ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 text-white'
                    : 'bg-[#111722] border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{city.name}</span>
                  <span className="text-[11px] text-amber-300">{city.raceLabel} · {city.altitudeMeters}m</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Nadwyżka: <strong className="text-emerald-400">{specComm?.name}</strong> · Popyt: <strong className="text-amber-300">{demComm?.name}</strong>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center 5 Cols: Caravan Route & Physics Dispatcher */}
      <div className="lg:col-span-5 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3">
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-white pb-1.5 border-b border-slate-800">
            Dyspozytornia Szlaków Kupieckich 3D (Fizyka Trasy i Pory Roku)
          </h3>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label htmlFor="dest-city-select" className="block text-slate-400 mb-1">
                Miasto Docelowe
              </label>
              <select
                id="dest-city-select"
                value={effectiveDestId}
                onChange={(e) => setDestCityId(e.target.value)}
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-2 text-xs text-white"
              >
                {CITIES.filter((c) => c.id !== selectedCityId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.altitudeMeters}m n.p.m.)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="caravan-comm-select" className="block text-slate-400 mb-1">
                Ładunek Handlowy
              </label>
              <select
                id="caravan-comm-select"
                value={commodityId}
                onChange={(e) => setCommodityId(e.target.value as CommodityId)}
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-2 text-xs text-white"
              >
                {COMMODITIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.unitWeightKg} kg/szt.)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label htmlFor="caravan-qty-input" className="block text-slate-400 mb-1">
                Liczba Jednostek Towaru
              </label>
              <input
                id="caravan-qty-input"
                type="number"
                min={5}
                max={200}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 5))}
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono-tabular text-white"
              />
            </div>

            <div>
              <label htmlFor="caravan-escort-select" className="block text-slate-400 mb-1">
                Eskorta Zbrojna (Przeciw Rebeliantom)
              </label>
              <select
                id="caravan-escort-select"
                value={escortLevel}
                onChange={(e) => setEscortLevel(Number(e.target.value))}
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value={0}>Brak Eskorty (Wysokie Ryzyko)</option>
                <option value={1}>Straż Kupiecka (-55% ryzyka)</option>
                <option value={2}>Rycerze i Magowie (-85% ryzyka)</option>
                <option value={3}>Pogromcy Smoków (-98% ryzyka)</option>
              </select>
            </div>
          </div>

          {/* World Physics & Route Calculation */}
          <div className="bg-[#080b10] border border-slate-800 rounded p-2.5 font-mono-tabular text-xs space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Cena zakupu → Cena sprzedaży:</span>
              <span className="text-white">
                {quote.buyUnit.toFixed(1)} zł → {quote.sellUnit.toFixed(1)} zł / szt.
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Fizyka trasy (Masa / Przewyższenie):</span>
              <span className="text-sky-300">
                {quote.totalWeightKg} kg · +{quote.altitudeClimb}m pod górę
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Prędkość sezonowa ({SEASONS[activeSeason].shortName}):</span>
              <span className={quote.caravanSpeedMultiplier < 0.85 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                {quote.caravanSpeedMultiplier.toFixed(2)}x · Czas: {quote.durationSeconds}s
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Koszt towaru + Przewóz i eskorta:</span>
              <span className="text-slate-200">
                {Math.round(quote.cargoPurchaseCost)} zł + {quote.transportFee} zł
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Zagrożenie Rebeliantami na szlaku:</span>
              <span className={adjustedRiskPct < 5 ? 'text-emerald-400' : 'text-amber-400'}>
                {adjustedRiskPct}% · Czas: {quote.durationSeconds}s
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-800 font-bold">
              <span>Spodziewany Zysk Kupiecki Netto:</span>
              <span className={quote.expectedNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {quote.expectedNetProfit >= 0 ? '+' : ''}
                {Math.round(quote.expectedNetProfit)} zł
              </span>
            </div>
          </div>

          {errorMsg && (
            <div role="alert" className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 rounded px-2.5 py-1.5">
              {errorMsg}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSend}
          className="min-h-[44px] w-full py-2.5 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
        >
          Wyślij Karawanę 3D na Szlak ({Math.round(totalUpfrontCost)} zł)
        </button>
      </div>

      {/* Right 3 Cols: Active 3D Caravans & Miejsca Strachu Expeditions */}
      <div className="lg:col-span-3 bg-[#0c1118] border border-slate-800 rounded-lg p-3 flex flex-col justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold text-amber-400 pb-1.5 border-b border-slate-800">
            Aktywne Karawany w Świecie 3D ({activeCaravans.length})
          </h4>
          {activeCaravans.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">
              Brak własnych karawan w trasie. Wyślij karawanę, aby zobaczyć ją na mapie 3D.
            </p>
          ) : (
            <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
              {activeCaravans.map((c) => {
                const orig = CITIES.find((ct) => ct.id === c.originCityId)?.name ?? c.originCityId;
                const dest = CITIES.find((ct) => ct.id === c.destinationCityId)?.name ?? c.destinationCityId;
                const pct = Math.min(100, Math.round(c.progress * 100));
                return (
                  <div key={c.id} className="bg-[#080b10] border border-slate-800 rounded p-2 text-xs">
                    <div className="flex justify-between font-medium text-white">
                      <span className="truncate">{orig} → {dest}</span>
                      <span className="font-mono-tabular text-amber-400">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1 overflow-hidden">
                      <div
                        className="bg-amber-400 h-full transition-transform origin-left"
                        style={{ transform: `scaleX(${pct / 100})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Classic Kupiecki Świat Feature: Wyprawy w Miejsca Strachu */}
        <div className="bg-[#080b10] border border-slate-800 rounded p-2.5 space-y-2">
          <div className="text-xs font-bold text-rose-400">
            Miejsca Strachu (Smocze Pieczary & Rebelianci)
          </div>
          <p className="text-[11px] text-slate-400">
            Wyślij najemnych Rycerzy i Magów, aby oczyścić szlaki z Rebeliantów i zdobyć Smocze Łuski lub Mithril.
          </p>
          <button
            type="button"
            onClick={() => onLaunchFearExpedition(1800, 'Smocze Pieczary Krwawego Szczytu')}
            disabled={playerGold < 1800}
            className="min-h-[40px] w-full py-1.5 px-3 rounded bg-rose-600/90 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold text-xs transition-colors"
          >
            Wyprawa na Smoka (1800 zł)
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 2. LIVE MULTI-USER AUCTION HOUSE VIEW ---
interface AuctionHouseViewProps {
  auctions: AuctionItem[];
  playerGold: number;
  playerInventory: Record<CommodityId, number>;
  onBidAuction: (auction: AuctionItem, bidAmount: number, isBuyout: boolean) => void;
  onCreateAuction: (params: {
    itemName: string;
    commodityId: CommodityId;
    quantity: number;
    auctionType: 'english' | 'dutch';
    startPrice: number;
    buyoutPrice: number;
  }) => void;
}

export const AuctionHouseView: React.FC<AuctionHouseViewProps> = ({
  auctions,
  playerGold,
  playerInventory,
  onBidAuction,
  onCreateAuction,
}) => {
  const [newCommId, setNewCommId] = useState<CommodityId>('mithril');
  const [newQty, setNewQty] = useState<number>(5);
  const [newType, setNewType] = useState<'english' | 'dutch'>('english');
  const [newStartPrice, setNewStartPrice] = useState<number>(2800);
  const [newBuyoutPrice, setNewBuyoutPrice] = useState<number>(4200);
  const [createError, setCreateError] = useState<string>('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const available = playerInventory[newCommId] ?? 0;
    if (newQty <= 0 || newQty > available) {
      setCreateError(`Brak wystarczającej liczby surowca w magazynie (posiadasz ${available} szt.).`);
      return;
    }
    if (newStartPrice < 100 || newBuyoutPrice < newStartPrice) {
      setCreateError('Cena Kup Teraz musi być większa lub równa cenie wywoławczej.');
      return;
    }
    const commSpec = COMMODITIES.find((c) => c.id === newCommId) ?? COMMODITIES[0];
    onCreateAuction({
      itemName: `Pakiet Kupiecki: ${commSpec.name} (${newQty} szt.)`,
      commodityId: newCommId,
      quantity: newQty,
      auctionType: newType,
      startPrice: newStartPrice,
      buyoutPrice: newBuyoutPrice,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-slate-100">
      {/* Left 8 Cols: Active Live Auctions Grid */}
      <div className="lg:col-span-8 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-amber-400">
              Dom Aukcyjny Księstwa (Aukcje Angielskie & Zegarowe Holenderskie)
            </h3>
            <p className="text-[11px] text-slate-400">
              Ochrona Anti-Sniping (+15s) · Depozyt spalany antyinflacyjnie (4% prowizji Mennicy)
            </p>
          </div>
          <span className="text-xs font-mono-tabular text-slate-300">
            Aktywne aukcje: {auctions.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
          {auctions.map((auc) => {
            const minNextBid = Math.round(auc.currentBid * 1.05);
            const comm = COMMODITIES.find((c) => c.id === auc.commodityId);
            return (
              <div
                key={auc.id}
                className="bg-[#080b10] border border-slate-800 rounded-lg p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {auc.sellerName} <strong className="text-amber-400">{auc.sellerGuild}</strong>
                    </span>
                    <span>
                      {auc.auctionType === 'dutch' ? 'Aukcja Holenderska (Zegar)' : `Oferty: ${auc.bidsCount}`}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white mt-0.5">{auc.itemName}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Surowiec: <strong className="text-slate-200">{comm?.name} ({auc.quantity} szt.)</strong> · Ranga: {auc.rarity}
                  </div>
                </div>

                <div className="bg-[#111722] rounded p-2 font-mono-tabular text-xs flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400">Aktualna Oferta</div>
                    <div className="font-bold text-amber-400">{auc.currentBid} zł</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400">Kup Teraz (Buyout)</div>
                    <div className="font-bold text-emerald-400">{auc.buyoutPrice} zł</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {auc.auctionType === 'english' && (
                    <button
                      type="button"
                      disabled={playerGold < minNextBid}
                      onClick={() => onBidAuction(auc, minNextBid, false)}
                      className="min-h-[40px] py-1.5 px-2.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 font-semibold text-xs transition-colors"
                    >
                      Podbij ({minNextBid} zł)
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={playerGold < auc.buyoutPrice}
                    onClick={() => onBidAuction(auc, auc.buyoutPrice, true)}
                    className={`min-h-[40px] py-1.5 px-2.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold text-xs transition-colors ${
                      auc.auctionType === 'dutch' ? 'col-span-2' : ''
                    }`}
                  >
                    Kup Teraz ({auc.buyoutPrice} zł)
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 4 Cols: Create Player Auction Form */}
      <form
        onSubmit={handleCreateSubmit}
        className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-2.5 text-xs"
      >
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-white pb-1.5 border-b border-slate-800">
            Wystaw Surowce na Aukcję
          </h4>

          <div>
            <label htmlFor="auc-comm-select" className="block text-slate-400 mb-1">
              Wybierz Towar z Magazynu
            </label>
            <select
              id="auc-comm-select"
              value={newCommId}
              onChange={(e) => setNewCommId(e.target.value as CommodityId)}
              className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 text-white"
            >
              {COMMODITIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (W magazynie: {playerInventory[c.id] ?? 0} szt.)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="auc-qty-input" className="block text-slate-400 mb-1">
                Ilość (szt.)
              </label>
              <input
                id="auc-qty-input"
                type="number"
                min={1}
                value={newQty}
                onChange={(e) => setNewQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 font-mono-tabular text-white"
              />
            </div>

            <div>
              <label htmlFor="auc-type-select" className="block text-slate-400 mb-1">
                Mechanizm Aukcji
              </label>
              <select
                id="auc-type-select"
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'english' | 'dutch')}
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 text-white"
              >
                <option value="english">Angielska (W górę)</option>
                <option value="dutch">Holenderska (Zegar)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="auc-start-input" className="block text-slate-400 mb-1">
                Cena Wywoławcza (zł)
              </label>
              <input
                id="auc-start-input"
                type="number"
                min={100}
                value={newStartPrice}
                onChange={(e) => setNewStartPrice(Math.max(100, Number(e.target.value) || 100))}
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 font-mono-tabular text-white"
              />
            </div>
            <div>
              <label htmlFor="auc-buyout-input" className="block text-slate-400 mb-1">
                Cena Kup Teraz (zł)
              </label>
              <input
                id="auc-buyout-input"
                type="number"
                min={100}
                value={newBuyoutPrice}
                onChange={(e) => setNewBuyoutPrice(Math.max(100, Number(e.target.value) || 100))}
                className="w-full bg-[#111722] border border-slate-700 rounded px-2.5 py-1.5 font-mono-tabular text-white"
              />
            </div>
          </div>

          {createError && (
            <div role="alert" className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800 rounded px-2.5 py-1.5">
              {createError}
            </div>
          )}
        </div>

        <button
          type="submit"
          className="min-h-[44px] w-full py-2 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
        >
          Opublikuj Aukcję na Rynku Live
        </button>
      </form>
    </div>
  );
};

// --- 3. SPECIALIZATION TECH TREE VIEW ---
interface TechTreeViewProps {
  unlockedTechIds: string[];
  playerGold: number;
  playerInventory: Record<CommodityId, number>;
  onUnlockTech: (node: TechNode) => void;
}

export const TechTreeView: React.FC<TechTreeViewProps> = ({
  unlockedTechIds,
  playerGold,
  playerInventory,
  onUnlockTech,
}) => {
  const branches: ('handel' | 'produkcja' | 'wojna_fantasy')[] = [
    'handel',
    'produkcja',
    'wojna_fantasy',
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-slate-100">
      {branches.map((branchKey) => {
        const nodes = TECH_TREE.filter((n) => n.branch === branchKey);
        const branchTitle = nodes[0]?.branchLabel ?? branchKey;
        return (
          <div key={branchKey} className="bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 space-y-2.5">
            <h3 className="text-xs font-bold text-amber-400 pb-2 border-b border-slate-800">
              {branchTitle}
            </h3>
            <div className="space-y-2.5">
              {nodes.map((node) => {
                const isUnlocked = unlockedTechIds.includes(node.id);
                const prereqMet = !node.prerequisiteId || unlockedTechIds.includes(node.prerequisiteId);
                const hasComm =
                  !node.requiredCommodity ||
                  (playerInventory[node.requiredCommodity.id] ?? 0) >= node.requiredCommodity.qty;
                const canAfford = playerGold >= node.costGold && hasComm && prereqMet && !isUnlocked;

                const reqCommSpec = node.requiredCommodity
                  ? COMMODITIES.find((c) => c.id === node.requiredCommodity?.id)
                  : null;

                return (
                  <div
                    key={node.id}
                    className={`p-3 rounded-lg border transition-colors ${
                      isUnlocked
                        ? 'bg-emerald-950/30 border-emerald-500/60'
                        : prereqMet
                          ? 'bg-[#080b10] border-slate-800'
                          : 'bg-[#080b10]/50 border-slate-800/50 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        Poziom {node.tier}: {node.name}
                      </span>
                      <span className="text-[11px] font-mono-tabular text-amber-300">
                        {isUnlocked ? 'Aktywne' : `${node.costGold} zł`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{node.description}</p>
                    <div className="text-[11px] text-emerald-400 font-medium mt-1">
                      Efekt: {node.effectSummary}
                    </div>
                    {reqCommSpec && node.requiredCommodity && (
                      <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
                        Wymagany surowiec: {reqCommSpec.name} ({node.requiredCommodity.qty} szt.)
                      </div>
                    )}

                    {!isUnlocked && (
                      <button
                        type="button"
                        disabled={!canAfford}
                        onClick={() => onUnlockTech(node)}
                        className="mt-2 min-h-[38px] w-full py-1.5 px-3 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs transition-colors"
                      >
                        {prereqMet ? `Odblokuj Technologię (${node.costGold} zł)` : 'Wymagany poprzedni poziom'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- 4. GUILDS, REAL-TIME CHAT & LEADERBOARD VIEW ---
interface GuildChatAndRankingsViewProps {
  guilds: GuildInfo[];
  playerGuildId: string;
  onOpenGuild:()=>void;
  onJoinGuild: (guildId: string) => void;
  onDonateGuild: (guildId: string, amount: number) => void;
  chatMessages: ChatMessage[];
  onSendChatMessage: (channel: 'globalny' | 'handel' | 'gildia', text: string) => void;
  onChronicle: (uid:string)=>void;
  leaderboard: LeaderboardEntry[];
  playerGold: number;
}

export const GuildChatAndRankingsView: React.FC<GuildChatAndRankingsViewProps> = ({
  guilds,
  playerGuildId,
  onOpenGuild, onJoinGuild,
  onDonateGuild,
  chatMessages,
  onSendChatMessage,
  leaderboard, onChronicle,
  playerGold,
}) => {
  const [activeChannel, setActiveChannel] = useState<'globalny' | 'handel' | 'gildia'>('globalny');
  const [chatInput, setChatInput] = useState<string>('');

  const filteredMessages = chatMessages.filter((m) => m.channel === activeChannel);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChatMessage(activeChannel, chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="space-y-3 text-slate-100">
      <button className="rounded border border-amber-700 px-3 py-2 text-amber-200" onClick={onOpenGuild}>Stół gildii · rozmowa i przyjęcia</button>
      {/* Live D3 Guild Treasury Ranking Bar Chart */}
      <GuildTreasuryRankingChart guilds={guilds} playerGuildId={playerGuildId} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left 4 Cols: Real-Time WebSocket Multi-Channel Chat */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3 flex flex-col justify-between gap-2">
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-400">Czat Kupiecki Live (WebSocket)</span>
            <div className="flex items-center gap-1">
              {(['globalny', 'handel'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setActiveChannel(ch)}
                  className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                    activeChannel === ch
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#111722] text-slate-400 hover:text-white'
                  }`}
                >
                  #{ch}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 mt-2 h-52 overflow-y-auto pr-1">
            {filteredMessages.map((msg) => (
              <div key={msg.id} className="bg-[#080b10] border border-slate-800/80 rounded p-2 text-xs">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>
                    <strong className="text-amber-400">{msg.guildTag}</strong>{' '}
                    <strong className="text-white">{msg.sender}</strong> · {msg.senderTitle}
                  </span>
                  <span className="font-mono-tabular">{msg.timestamp}</span>
                </div>
                <p className="text-slate-200 mt-0.5 break-words">{msg.text}</p>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleChatSubmit} className="flex items-center gap-1.5 pt-1">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={`Napisz na kanale #${activeChannel}...`}
            aria-label="Wiadomość czatu"
            className="flex-1 bg-[#111722] border border-slate-700 rounded px-2.5 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
          />
          <button
            type="submit"
            className="min-h-[38px] px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Wyślij
          </button>
        </form>
      </div>

      {/* Center 4 Cols: Merchant Guilds & Cooperative Treasury */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-bold text-amber-400">Gildie Kupieckie & Skarbiec</span>
          <span className="text-[11px] text-slate-400">Rabat Podatkowy</span>
        </div>

        <div className="space-y-2">
          {guilds.map((g) => {
            const isMember = g.id === playerGuildId;
            return (
              <div
                key={g.id}
                className={`p-2.5 rounded-lg border ${
                  isMember ? 'bg-amber-500/10 border-amber-500/60' : 'bg-[#080b10] border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">
                    [{g.tag}] {g.name} (Poz. {g.level})
                  </span>
                  <span className="text-xs font-mono-tabular text-emerald-400">
                    -{g.taxRebatePct}% podatku
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">{g.specialty}</div>
                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-800/80 text-xs">
                  <span className="font-mono-tabular text-[11px] text-slate-300">
                    Skarbiec: <strong>{g.treasuryGold.toLocaleString('pl-PL')} zł</strong>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {!isMember ? (
                      <button
                        type="button"
                        onClick={() => onJoinGuild(g.id)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold"
                      >
                        Dołącz
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          data-testid={`guild-donate-1000-${g.id}`}
                          disabled={playerGold < 1000}
                          onClick={() => onDonateGuild(g.id, 1000)}
                          className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-bold transition-colors"
                        >
                          Wpłać 1 000 zł
                        </button>
                        <button
                          type="button"
                          data-testid={`guild-donate-5000-${g.id}`}
                          disabled={playerGold < 5000}
                          onClick={() => onDonateGuild(g.id, 5000)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors"
                        >
                          +5 000 zł
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right 4 Cols: Top Lords & Knights Leaderboard */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-xs font-bold text-amber-400">Ranking Kupców i Rycerzy Księstwa</span>
          <span className="text-[11px] text-slate-400">Majątek / Rycerz</span>
        </div>

        <div className="space-y-1.5 max-h-[285px] overflow-y-auto">
          {leaderboard.map((row) => (
            <div
              key={row.historyUid || row.name}
              className={`p-2 rounded border flex items-center justify-between text-xs ${
                row.isPlayer
                  ? 'bg-amber-500/15 border-amber-400 text-white'
                  : 'bg-[#080b10] border-slate-800 text-slate-300'
              }`}
            >
              <div>
                <div className="font-semibold text-white">
                  #{row.rank} {row.guildTag} {row.historyUid ? <button className="underline decoration-amber-600" title="Otwórz kronikę kupca" onClick={()=>onChronicle(row.historyUid!)}>{row.name}</button> : row.name}
                </div>
                <div className="text-[11px] text-slate-400">
                  {row.race} · {row.specialty}
                </div>
              </div>
              <div className="text-right font-mono-tabular">
                <div className="font-bold text-amber-400">
                  {Math.round(row.netWorth).toLocaleString('pl-PL')} zł
                </div>
                <div className="text-[10px] text-emerald-400">
                  Rycerz Poz. {row.knightLevel} · Bestie: {row.monstersDefeated}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
};
