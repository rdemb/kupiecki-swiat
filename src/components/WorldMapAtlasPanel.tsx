import { LostLetter } from './LostLetter';
import { landings } from '../economy/westernMarch';
import type { MillMark } from '../economy/mill';
import { CuriosityCabinet } from './CuriosityCabinet';
import { NestingJournal } from './NestingJournal';
import { CareerDesk } from './CareerDesk';
import { fieldLabels } from '../economy/commonField';
import {UplandFair} from './UplandFair';
import {WorldPostcard,type SceneCamera} from './WorldPostcard';
import {ReliefViewer,reliefUrl} from './ReliefViewer';
import {projectAtlas,sheetFor} from '../economy/atlasSheets';
import React from 'react';
import {
  CITIES,
  COMMODITIES,
  CommodityMarketState,
  ContinentId,
  MacroEconomyState,
} from '../economy/economyEngine';
import {
  WORLD_CONTINENTS,
  WORLD_REGIONS,
  WorldRegionNode,
} from '../economy/worldMapData';

import { ActiveTrailEvent } from '../economy/trailEvents';
import { PbrWeatherId, getPbrWeatherParams } from '../world3d/pbrWeather';
import { CameraPresetId, buildActiveRouteList } from '../world3d/cameraPresets';
import type { ActiveCaravan3D } from './World3DCanvas';

interface WorldMapAtlasPanelProps {
  sceneCamera:SceneCamera;
  ferryOpen:boolean;
  onFerryOpen:(open:boolean)=>void;
  onSettlement:(uid:string,mark:MillMark)=>void;
  fairHost:string|null;
  uhd:boolean;
  selectUhd:(enabled:boolean)=>void;
  onWinner:(site:string|null)=>void;
  onNestPost:()=>void;
  onNestSighting:(s:import('../economy/northPassage').NestBook['sighting'])=>void;
  token: string|null;
  towns: {site:string;name:string;approved:number}[];
  selectedRegionId: string;
  selectedContinentId: ContinentId | 'all';
  onSelectContinent: (continentId: ContinentId | 'all') => void;
  onSelectRegion: (regionId: string) => void;
  onQuayView: () => void;
  onField: () => void;
  onFocus3DCameraOnRegion: (regionId: string) => void;
  onFocus3DCameraOnContinent: (continentId: ContinentId) => void;
  onFocus3DCameraOnCaravan: (caravanId: string) => void;
  onOpenCaravanRoutesTab?: () => void;
  onEnterCityInterior?: (cityId: string) => void;
  onTradeInCity: (cityId: string) => void;
  onLaunchQuestForRegion: (questId: string) => void;
  onOpenDuchyTab: () => void;
  activeCaravans: ActiveCaravan3D[];
  trackedCaravanId?: string | null;
  cameraPreset?: CameraPresetId;
  markets: Record<string, CommodityMarketState>;
  macro: MacroEconomyState;
  pbrWeather: PbrWeatherId;
  trailEvents: ActiveTrailEvent[];
  onSelectTrailEvent: (eventId: string) => void;
  onRefreshTrailEvents: () => void;
  cinematicTourActive?: boolean;
  onToggleCinematicTour?: () => void;
  onOpenDisasterModal?: () => void;
}

export const WorldMapAtlasPanel: React.FC<WorldMapAtlasPanelProps> = ({
  sceneCamera,uhd,selectUhd,fairHost,onWinner,ferryOpen, onFerryOpen, token, towns, selectedRegionId, onNestSighting, onNestPost, onSettlement,
  selectedContinentId,
  onSelectContinent,
  onSelectRegion,
  onField, onQuayView, onFocus3DCameraOnRegion,
  onFocus3DCameraOnContinent,
  onFocus3DCameraOnCaravan,
  onOpenCaravanRoutesTab,
  onEnterCityInterior,
  onTradeInCity,
  onLaunchQuestForRegion,
  onOpenDuchyTab,
  activeCaravans,
  trackedCaravanId = null,
  cameraPreset = 'world',
  markets,
  macro,
  pbrWeather,
  trailEvents,
  onSelectTrailEvent,
  onRefreshTrailEvents,
  cinematicTourActive = false,
  onToggleCinematicTour,
  onOpenDisasterModal,
}) => {
  const activeRegion: WorldRegionNode =
    WORLD_REGIONS.find((r) => r.id === selectedRegionId) ?? WORLD_REGIONS[0];

  const activeContinent =
    WORLD_CONTINENTS.find((c) => c.id === activeRegion.continentId) ?? WORLD_CONTINENTS[0];

  const [largeAtlas,setLargeAtlas]=React.useState(false);
  const sheet=sheetFor(selectedContinentId);
  const [selectedShow,setSelectedShow]=React.useState(0);
  const [showRoute,setShowRoute]=React.useState<string[]>([]);
  const uplands=selectedContinentId==='wzgorza_jarmarczne';
  const western=selectedContinentId==='zachodnie_rozlewiska';
  const southern=selectedContinentId==='poludniowe_trakty';
  const routePoints=showRoute.map(id=>WORLD_REGIONS.find(r=>r.id===id)?.atlasPercent.join(',')).join(' ');
  const northern=selectedContinentId==='morze_wylin';
  const farCoast=selectedContinentId==='kresy_nadziei';
  const eastern=selectedContinentId==='nowa_nadzieja' || farCoast || northern || southern || western || uplands;
  const visibleRegions = WORLD_REGIONS.filter((r) =>
    selectedContinentId === 'all' ? r.continentId!=='nowa_nadzieja' && r.continentId!=='kresy_nadziei' && r.continentId!=='morze_wylin' && r.continentId!=='poludniowe_trakty' && r.continentId!=='zachodnie_rozlewiska' && r.continentId!=='wzgorza_jarmarczne' : r.continentId === selectedContinentId,
  );

  const visibleTrailEvents = trailEvents.filter((ev) =>
    selectedContinentId === 'all' ? ev.continentId!=='nowa_nadzieja' && ev.continentId!=='kresy_nadziei' && ev.continentId!=='morze_wylin' && ev.continentId!=='poludniowe_trakty' && ev.continentId!=='zachodnie_rozlewiska' && ev.continentId!=='wzgorza_jarmarczne' : ev.continentId === selectedContinentId,
  );

  const visibleRoutes = buildActiveRouteList(activeCaravans, selectedContinentId);

  const weatherInfo = getPbrWeatherParams(pbrWeather);

  const featuredComm = activeRegion.featuredCommodity
    ? COMMODITIES.find((c) => c.id === activeRegion.featuredCommodity)
    : null;
  const featuredPrice = featuredComm ? markets[featuredComm.id]?.currentPrice : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 text-slate-100">
      {/* Left 8 Cols: Interactive 6-Continent Satellite World Atlas */}
      <div className="lg:col-span-8 bg-[#0c1118] border border-slate-800 rounded-lg p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-amber-400">
              Atlas Starego Lądu i Nowej Nadziei ({WORLD_REGIONS.length} Regionów · {CITIES.length} Stolic Handlowych)
            </h3>
            <p className="text-[11px] text-slate-400">
              Wybierz kontynent lub kliknij dowolny region, aby przelecieć kamerą 3D, handlować zamorsko lub wysłać Rycerza.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => onSelectContinent('all')}
              className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer whitespace-nowrap ${
                selectedContinentId === 'all'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-[#111722] text-slate-300 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              Stary Ląd ({WORLD_REGIONS.filter(r=>r.continentId!=='nowa_nadzieja' && r.continentId!=='kresy_nadziei' && r.continentId!=='morze_wylin' && r.continentId!=='poludniowe_trakty' && r.continentId!=='zachodnie_rozlewiska' && r.continentId!=='wzgorza_jarmarczne').length})
            </button>
            <button className="atlas-expand" aria-pressed={uhd} onClick={()=>selectUhd(!uhd)}>Scena 3D · {uhd?'4K UHD':'Auto'}</button>
            <button className="atlas-expand" onClick={()=>setLargeAtlas(true)}>Otwórz atlas 4K</button>
            <WorldPostcard camera={sceneCamera} place={cameraPreset==='world'?'Mapa świata':WORLD_REGIONS.find(r=>r.id===selectedRegionId)?.name??'Atlas'}/>
            {largeAtlas && <ReliefViewer initial={sheet} close={()=>setLargeAtlas(false)} visit={id=>{
              const reg=WORLD_REGIONS.find(r=>r.id===id)!;
              onSelectContinent(reg.continentId);onSelectRegion(id);onFocus3DCameraOnRegion(id);
            }}/>}
            {WORLD_CONTINENTS.map((cont) => {
              const count = WORLD_REGIONS.filter((r) => r.continentId === cont.id).length;
              return (
                <button
                  key={cont.id}
                  type="button"
                  data-testid={`continent-filter-${cont.id}`}
                  onClick={() => onSelectContinent(cont.id)}
                  className={`px-1.5 py-0.5 rounded text-[10.5px] font-semibold cursor-pointer whitespace-nowrap ${
                    selectedContinentId === cont.id
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-[#111722] text-slate-300 border border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {cont.shortName.split(' (')[0]} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* High-Altitude Photorealistic 6-Continent Satellite Map */}
        <div className="relative w-full h-[236px] xl:h-[248px] rounded-lg overflow-hidden border border-amber-500/35 bg-[#040a14] shadow-inner">
          <img
            src={reliefUrl(sheet)}
            alt={uplands?'Mapa Wzgórz Trzech Jarmarków':western?'Zachodnie Rozlewiska · mapa brodu':southern?'Południowe Trakty · mapa gospód':northern?'Morze Wylin · mapa wysp i warsztatów':eastern?'Mapa rzeźby terenu Nowej Nadziei':'Stary Ląd i jego szlaki'}
            referrerPolicy="no-referrer"
            className="w-full h-full object-fill"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25 pointer-events-none" />

          {western && ferryOpen && <svg aria-label="Czynna przeprawa nad brodem" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none"><polyline points={landings.map(id=>WORLD_REGIONS.find(r=>r.id===id)!.atlasPercent.join(',')).join(' ')} stroke="#ffe393" strokeDasharray="1 .6" strokeWidth="1" fill="none"/></svg>}
          {southern && showRoute.length>0 && <svg aria-label="Ślad objazdu wystawy" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
            <polyline points={routePoints} fill="none" stroke="#27180e" strokeWidth="1.4" />
            <polyline points={routePoints} fill="none" stroke="#ffd586" strokeWidth=".65" strokeDasharray="1.5 .7" />
          </svg>}
          {/* SVG Intercontinental Trade Lanes (Land Caravans + Trans-Oceanic Galleon Routes across 6 Continents) */}
          {!eastern && <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            {visibleRoutes.map(route=>{
              const origin=WORLD_REGIONS.find(r=>r.id===route.originCityId || r.linkedCityId===route.originCityId);
              const destination=WORLD_REGIONS.find(r=>r.id===route.destinationCityId || r.linkedCityId===route.destinationCityId);
              if(!origin || !destination)return null;
              const [x1,y1]=projectAtlas(sheet,origin.position2D),[x2,y2]=projectAtlas(sheet,destination.position2D);
              return <line key={route.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke={route.kind==='player'?'#f5d38c':'#b0d7d9'} strokeWidth=".3" strokeDasharray="1 .7"/>;
            })}
          </svg>}

          {/* Interactive Clickable Region Pins */}
          {visibleRegions.map((reg) => {
            const isSelected = reg.id === activeRegion.id;
            const isCap = reg.type === 'capital';
            return (
              <button
                key={reg.id}
                type="button"
                onClick={() => onSelectRegion(reg.id)}
                style={{
                  translate: reg.id===landings[0]?'-100% -50%':reg.id===landings[1]?'0 -50%':undefined,
                  left: `${projectAtlas(sheet,reg.position2D)[0]}%`,
                  top: `${projectAtlas(sheet,reg.position2D)[1]}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] font-bold shadow-lg transition-transform cursor-pointer ${
                  isSelected
                    ? 'scale-110 z-20 bg-amber-400 text-slate-950 border-white'
                    : isCap
                      ? 'z-10 bg-[#080d15]/92 text-white border-amber-400/75 hover:scale-105'
                      : 'z-10 bg-[#140c16]/88 text-slate-200 border-slate-600/80 hover:scale-105'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: reg.colorHex }}
                />
                <span className="whitespace-nowrap">{reg.name.split(' (')[0]}{reg.id===fairHost && <small className="block">Jarmark</small>}{towns.filter(t=>t.approved && t.site===reg.linkedCityId).map(t=><small className="block" key={t.site}>⚑ {t.name}</small>)}</span>
              </button>
            );
          })}

          {/* Interactive Trail Event Markers (Encounter / Monster Blockade / Mystery) */}
          {visibleTrailEvents.map((ev) => {
            const toneClass =
              ev.severity === 'danger'
                ? 'bg-rose-600/95 text-white border-rose-200 hover:bg-rose-500'
                : ev.severity === 'mystery'
                  ? 'bg-purple-600/95 text-white border-purple-200 hover:bg-purple-500'
                  : 'bg-amber-500/95 text-slate-950 border-amber-100 hover:bg-amber-400';
            return (
              <button
                key={ev.id}
                type="button"
                data-testid={`atlas-trail-event-${ev.templateId}`}
                onClick={() => onSelectTrailEvent(ev.id)}
                title={`${ev.categoryLabel}: ${ev.title}`}
                style={{
                  left: `${projectAtlas(sheet,ev.position2D)[0]}%`,
                  top: `${projectAtlas(sheet,ev.position2D)[1]}%`,
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-extrabold shadow-xl transition-transform hover:scale-110 cursor-pointer ${toneClass}`}
              >
                <span>!</span>
                <span className="whitespace-nowrap">{ev.categoryLabel}</span>
              </button>
            );
          })}

          {/* Interactive Active Caravan Pins on Atlas (Click for Instant 3D Follow) */}
          {!eastern && visibleRoutes
            .filter((route) => route.kind === 'player' || route.id === trackedCaravanId)
            .map((route) => {
              const isTracked = cameraPreset === 'caravan' && trackedCaravanId === route.id;
              return (
                <button
                  key={`pin-${route.id}`}
                  type="button"
                  onClick={() => onFocus3DCameraOnCaravan(route.id)}
                  title={`Zbliż kamerę 3D na karawanę: ${route.originCityName} → ${route.destinationCityName}`}
                  style={{
                    left: `${route.atlasPercent[0]}%`,
                    top: `${route.atlasPercent[1]}%`,
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-30 flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9.5px] font-bold shadow-lg transition-transform hover:scale-110 cursor-pointer ${
                    isTracked
                      ? 'bg-emerald-400 text-slate-950 border-white'
                      : 'bg-sky-500/95 text-slate-950 border-sky-100'
                  }`}
                >
                  <span className="whitespace-nowrap">
                    Karawana{route.progressPct !== null ? ` ${route.progressPct}%` : ''}
                  </span>
                </button>
              );
            })}

          {/* Bottom-Left Season, Caravan Speed & PBR Weather Telemetry Stamp */}
          <div className="absolute bottom-2 left-2 bg-[#070b12]/90 border border-slate-700 rounded px-2.5 py-1 text-[11px] flex flex-wrap items-center gap-2">
            <span className="font-bold text-amber-400">Dzień {macro.worldDayNumber}:</span>
            <span className="text-emerald-300 font-semibold">{macro.activeSeasonName.split(' ')[0]}</span>
            <span className="text-slate-400">·</span>
            <span className="text-sky-300 font-semibold">{weatherInfo.label}</span>
            <span className="text-slate-400">·</span>
            <span className="font-mono-tabular text-amber-300 font-semibold">
              Karawany {(macro.caravanSpeedMultiplier ?? 1).toFixed(2)}x
            </span>
          </div>

          {/* Bottom-Right Cinematic 6-Continent Tour & Active Disaster Shortcut */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            {macro.activeDisaster && onOpenDisasterModal && (
              <button
                type="button"
                onClick={onOpenDisasterModal}
                className="px-2.5 py-1 rounded bg-rose-600/95 hover:bg-rose-500 border border-rose-200 text-white font-bold text-[10px] shadow-lg cursor-pointer"
              >
                KATASTROFA: {macro.activeDisaster.shortLabel}
              </button>
            )}
            {onToggleCinematicTour && (
              <button
                type="button"
                data-testid="atlas-cinematic-tour-btn"
                onClick={onToggleCinematicTour}
                className={`px-2.5 py-1 rounded border text-[10px] font-bold shadow-lg cursor-pointer ${
                  cinematicTourActive
                    ? 'bg-amber-400 text-slate-950 border-white'
                    : 'bg-[#070b12]/92 hover:bg-slate-800 text-amber-300 border-amber-500/50'
                }`}
              >
                {cinematicTourActive ? 'Zakończ Przelot 3D' : 'Kino 3D · przelot przez świat'}
              </button>
            )}
          </div>
        </div>

        {/* Interactive Active Caravan Routes List with Instant 3D CameraPresets Zoom */}
        <div
          data-testid="atlas-active-routes-panel"
          className="bg-[#080b10] border border-slate-800 rounded-lg p-2.5 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xs font-bold text-amber-400">
                Aktywne Szlaki Karawan w Locie ({visibleRoutes.length})
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Kliknij „Zbliż 3D”, aby natychmiast śledzić karawanę w ruchu
              </span>
            </div>
            {onOpenCaravanRoutesTab && (
              <button
                type="button"
                onClick={onOpenCaravanRoutesTab}
                className="px-2 py-1 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-amber-300 cursor-pointer shrink-0"
              >
                Wyślij własną karawanę
              </button>
            )}
          </div>

          {visibleRoutes.length === 0 ? (
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 py-1">
              <span>Brak aktywnych szlaków lądowych na wybranym kontynencie.</span>
              <button
                type="button"
                onClick={() => onSelectContinent('all')}
                className="px-2 py-1 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-amber-300 font-semibold cursor-pointer shrink-0"
              >
                Pokaż wszystkie szlaki
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[118px] overflow-y-auto pr-1">
              {visibleRoutes.map((route) => {
                const isTracked = cameraPreset === 'caravan' && trackedCaravanId === route.id;
                const isPlayer = route.kind === 'player';
                return (
                  <div
                    key={route.id}
                    data-testid={`atlas-route-item-${route.id}`}
                    className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border transition-colors ${
                      isTracked
                        ? 'bg-amber-500/15 border-amber-400'
                        : isPlayer
                          ? 'bg-[#0e1520] border-emerald-500/40'
                          : 'bg-[#0c1118] border-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-white truncate">
                        <span
                          className={
                            isPlayer
                              ? 'text-emerald-400 font-bold shrink-0'
                              : 'text-sky-400 font-semibold shrink-0'
                          }
                        >
                          {isPlayer ? 'Twoja' : 'Konwój'}
                        </span>
                        <span className="truncate">
                          {route.originCityName} → {route.destinationCityName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span className="truncate">{route.cargoLabel}</span>
                        {route.progressPct !== null ? (
                          <span className="font-mono-tabular text-emerald-300 shrink-0">
                            {route.progressPct}%
                            {route.expectedProfit !== null
                              ? ` · +${route.expectedProfit.toLocaleString('pl-PL')} zł`
                              : ''}
                          </span>
                        ) : (
                          <span className="text-slate-500 shrink-0">W trasie 3D</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      data-testid={`atlas-zoom-caravan-${route.id}`}
                      onClick={() => onFocus3DCameraOnCaravan(route.id)}
                      className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                        isTracked
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      {isTracked ? 'Śledzisz 3D' : 'Zbliż 3D'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Trail Events Quick-Action Strip */}
        <div className="bg-[#080b10] border border-slate-800 rounded-lg px-2.5 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-bold text-amber-400 shrink-0">
              Zdarzenia na Szlaku ({visibleTrailEvents.length}):
            </span>
            {visibleTrailEvents.length === 0 ? (
              <span className="text-[11px] text-slate-400">
                Brak aktywnych zdarzeń w tym regionie.
              </span>
            ) : (
              visibleTrailEvents.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onSelectTrailEvent(ev.id)}
                  className={`px-2 py-1 rounded border text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    ev.severity === 'danger'
                      ? 'bg-rose-950/70 border-rose-500/60 text-rose-200 hover:bg-rose-900/80'
                      : ev.severity === 'mystery'
                        ? 'bg-purple-950/70 border-purple-500/60 text-purple-200 hover:bg-purple-900/80'
                        : 'bg-amber-950/60 border-amber-500/60 text-amber-200 hover:bg-amber-900/70'
                  }`}
                >
                  ! {ev.title.length > 30 ? `${ev.title.slice(0, 30)}…` : ev.title}
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={onRefreshTrailEvents}
            className="px-2.5 py-1 rounded bg-[#111722] hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-sky-300 cursor-pointer shrink-0"
          >
            Nowe Zdarzenia
          </button>
        </div>
      </div>

      {/* Right 4 Cols: Selected Region & Continent Dossier + Instant 3D Flight Actions */}
      <div className="lg:col-span-4 bg-[#0c1118] border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between space-y-3">
        <div className="space-y-2.5">
          {/* Active Continent Strip */}
          <div className="flex items-center justify-between gap-2 text-[11px] bg-[#080b10] border border-slate-800 rounded px-2.5 py-1.5">
            <span className="font-bold" style={{ color: activeContinent.colorHex }}>
              {activeContinent.shortName}
            </span>
            <span className="text-slate-400 truncate">{activeContinent.climate}</span>
          </div>

          <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
            <div>
              <div className="text-[11px] font-bold" style={{ color: activeRegion.colorHex }}>
                {activeRegion.typeLabel} · {activeRegion.biome}
              </div>
              <h4 className="text-base font-bold text-white mt-0.5">{activeRegion.name}</h4>
              <div className="text-xs text-slate-400">{activeRegion.subtitle}</div>
            </div>
            <div className="text-right font-mono-tabular shrink-0">
              <div className="text-[10px] text-slate-400">WYSOKOŚĆ</div>
              <div className="text-xs font-bold text-amber-300">{activeRegion.altitudeMeters} m</div>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">{activeRegion.loreDescription}</p>

          {/* Tactical Telemetry Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#080b10] border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400">ZAGROŻENIE</div>
              <div className="text-xs font-bold text-rose-300 mt-0.5">{activeRegion.dangerLabel}</div>
            </div>
            <div className="bg-[#080b10] border border-slate-800 rounded p-2">
              <div className="text-[10px] text-slate-400">GŁÓWNY SUROWIEC</div>
              <div className="text-xs font-bold text-emerald-300 mt-0.5">
                {featuredComm ? featuredComm.name : 'Zasoby Księstwa'}
                {featuredPrice ? ` (${Math.round(featuredPrice)} zł)` : ''}
              </div>
            </div>
          </div>

          {/* Quick Region Selector List */}
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-slate-400">
              Regiony ({visibleRegions.length}):
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-[88px] overflow-y-auto pr-1">
              {visibleRegions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectRegion(r.id)}
                  className={`px-2 py-1 rounded text-left text-[11px] truncate border cursor-pointer ${
                    r.id === activeRegion.id
                      ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold'
                      : 'bg-[#080b10] border-slate-800 text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Instant 3D Exploration & Gameplay Actions */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onFocus3DCameraOnRegion(activeRegion.id)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Zbliż 3D na Region
            </button>
            <button
              type="button"
              onClick={() => onFocus3DCameraOnContinent(activeRegion.continentId)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-[#152030] hover:bg-slate-700 border border-amber-500/40 text-amber-300 font-bold text-xs cursor-pointer"
            >
              Panorama Kontynentu
            </button>
          </div>

          {uplands && <UplandFair key={token??'guest'} site={activeRegion.id} go={onSelectRegion} token={token} onWinner={onWinner} onSettlement={onSettlement}/>}
          {western && <LostLetter key={token??'guest'} token={token} site={activeRegion.id} go={onSelectRegion} onOpen={onFerryOpen} onSettlement={onSettlement}/>}
          {southern && <CuriosityCabinet selected={selectedShow} onSelected={setSelectedShow} key={(token??'guest')+activeRegion.id} token={token} site={activeRegion.id} go={onSelectRegion} onRoute={setShowRoute}/>}
          {(northern || activeRegion.id==='lawica_krabow' || activeRegion.id==='przyladek_dwoch_szyj') &&
            <NestingJournal onPost={onNestPost} onSighting={onNestSighting} key={(token??'guest')+activeRegion.id} token={token} site={activeRegion.id} choose={onSelectRegion}/>}
          {activeRegion.type==='workshop' && <CareerDesk key={(token??'guest')+activeRegion.id} token={token} site={activeRegion.id} choose={onSelectRegion}/>}
          {activeRegion.linkedCityId === 'srebrny_gaj' && <button type="button" onClick={onField} className="w-full rounded border border-emerald-700/70 py-2 text-emerald-200">Wspólne pole{macro.fieldStage && ' · ' + fieldLabels[macro.fieldStage]}</button>}
          {CITIES.some(c => c.id===activeRegion.linkedCityId && c.isCoastalPort && c.id!=='oaza_alkharim') &&
            <button type="button" onClick={onQuayView} className="w-full rounded border border-amber-700/70 py-2 text-amber-200">Widok z nabrzeża</button>}
          {activeRegion.linkedCityId && onEnterCityInterior && (
            <button
              type="button"
              data-testid="atlas-enter-city-btn"
              onClick={() => onEnterCityInterior(activeRegion.linkedCityId!)}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
            >
              Wejdź do Miasta (Wnętrze & Arena): {CITIES.find((c) => c.id === activeRegion.linkedCityId)?.name}
            </button>
          )}

          {activeRegion.linkedCityId && (
            <button
              type="button"
              onClick={() => onTradeInCity(activeRegion.linkedCityId!)}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
            >
              Otwórz Giełdę Miasta: {CITIES.find((c) => c.id === activeRegion.linkedCityId)?.name}
            </button>
          )}

          {activeRegion.linkedQuestId && (
            <button
              type="button"
              onClick={() => onLaunchQuestForRegion(activeRegion.linkedQuestId!)}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
            >
              Wyślij Rycerza na Wyprawę do tego Miejsca
            </button>
          )}

          {(activeRegion.type === 'port' || activeRegion.type === 'sanctuary') && (
            <button
              type="button"
              onClick={onOpenDuchyTab}
              className="w-full min-h-[38px] px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer"
            >
              Zarządzaj {activeRegion.type === 'port' ? 'Stocznią i Flotą' : 'Wieżą Magów i Zaklęciami'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
