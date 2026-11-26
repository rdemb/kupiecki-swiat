import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CITIES, type CommodityId } from '../economy/economyEngine';
import type { Town } from './ProvinceHall';
import './merchantRoad.css';

export const cinemaFile = (file: string) => (import.meta.env?.BASE_URL ?? '/') + 'cinema/' + file;
export const roadStops = [
  { city: 'krolewska_przystan', name: 'Królewska Przystań', plate: 'rynek', place: 'Plac Złotej Wagi',
    story: 'Kupczyni odstawia odważnik. „Jeden worek mogę ci sprzedać od ręki. Ile zabierzesz na trakt?”',
    commodity: 'zboze', goods: 'Zboże', detail: 'Waga kupiecka i wozy przy bramie miasta' },
  { city: 'srebrny_gaj', name: 'Srebrny Gaj', plate: 'trakt', place: 'Most na królewskim trakcie',
    story: 'Woźnica z tartaku prowadzi konie po mokrym moście. Drewno można kupić tutaj albo zabrać w dalszą drogę karawaną.',
    commodity: 'drewno_elfickie', goods: 'Drewno elfickie', detail: 'Wóz z drewnem na leśnym trakcie nad strumieniem' },
  { city: 'zelazna_kuznia', name: 'Żelazna Kuźnia', plate: 'kuznia', place: 'Warsztat płatnerza',
    story: 'Mistrz obraca żelazo w palenisku. Na skraju kowadła stygnie partia dla kupców, za drzwiami czeka zbrojownia.',
    commodity: 'zelazo', goods: 'Żelazo', detail: 'Kowal z kleszczami przy rozgrzanym żelazie' },
] as const;
export type RoadStop = typeof roadStops[number];
export type RoadPanel = 'world_map' | 'terminal' | 'caravans' | 'knight' | 'profile' | 'duchy_story';

export function quietPictures() {
  const network = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || !!network?.saveData;
}

export function OpeningFilm({ onClose, muted }: { onClose: () => void; muted: boolean }) {
  const [failed, setFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog ref={dialog} className="road-film" aria-label="Pierwszy szlak" onCancel={e => { e.preventDefault(); onClose(); }}>
      <video controls autoPlay playsInline muted={muted} poster={cinemaFile('sakwa.webp')}
        onEnded={onClose} onError={() => setFailed(true)} src={cinemaFile('pierwszy-szlak.mp4')}>
        <track kind="captions" srcLang="pl" label="Polskie opisy dźwięku" src={cinemaFile('pierwszy-szlak.vtt')} />
      </video>
      <button type="button" className="road-chip road-film-skip" onClick={onClose} autoFocus>Pomiń film</button>
      {failed && <p role="status">Film nie załadował się. Możesz przejść do gry.</p>}
    </dialog>
  );
}

interface RoadProps {
  stop: RoadStop;
  gold: number;
  held: number;
  price: number;
  towns: Town[];
  registerError: string;
  onTravel: (stop: RoadStop) => void;
  onMenu: (tab: RoadPanel, city?: string) => void;
  onBuy: (commodity: CommodityId) => void;
  onFilm: () => void;
  onWeighhouse: (moving:boolean) => void;
}
const money = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
export function MerchantRoad({stop, gold, held, price, towns, registerError, onTravel, onMenu, onBuy, onFilm, onWeighhouse}: RoadProps) {
  const [moving, setMoving] = useState(() => !quietPictures());
  const [sheets, setSheets] = useState(false);
  const [receipt, setReceipt] = useState('');
  const [failedPlate, setFailedPlate] = useState('');
  const sheet = useRef<HTMLDialogElement>(null);
  const [knownPlate, setKnownPlate] = useState(stop.plate);
  const [loadedPlate, setLoadedPlate] = useState(stop.plate);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setMoving(!quietPictures());
    preference.addEventListener('change', change);
    return () => preference.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    let active = true;
    const photo = new Image();
    photo.src = cinemaFile(stop.plate + '.webp');
    let timer: number | undefined;
    photo.decode().then(() => {
      if (!active) return;
      setLoadedPlate(stop.plate);
      timer = window.setTimeout(() => setKnownPlate(stop.plate), 700);
    }).catch(() => {});
    setReceipt('');
    return () => { active = false; clearTimeout(timer); };
  }, [stop]);
  useEffect(() => {
    if (sheets) sheet.current?.showModal();
    else sheet.current?.close();
  }, [sheets]);
  return (
    <main className="merchant-road" aria-label="Królewski trakt" style={{'--portrait-focus': {rynek: '84%', trakt: '64%', kuznia: '85%'}[stop.plate]} as CSSProperties}>
      <div className="road-backdrop" style={{backgroundImage: 'url(' + cinemaFile(knownPlate + '.webp') + ')'}} aria-hidden="true"/>
      {loadedPlate === stop.plate && <div key={stop.plate} className="road-shot">
        <img className="road-photo" src={cinemaFile(stop.plate + '.webp')} alt={stop.detail} />
        {moving && failedPlate !== stop.plate && <video className="road-photo" aria-hidden="true" muted playsInline autoPlay loop
          poster={cinemaFile(stop.plate + '.webp')} src={cinemaFile(stop.plate + '.mp4')} onError={() => setFailedPlate(stop.plate)} />}
      </div>}
      <div className="road-shade" />
      <header className="road-head">
        <span className="road-wordmark">Kupiecki Świat</span>
        <div className="road-head-actions">
          <button type="button" className="road-chip" onClick={() => onMenu('profile')}>Konto</button>
          <button type="button" className="road-chip" onClick={() => onMenu('world_map')}>Mapa 3D</button>
        </div>
      </header>
      <section className="road-copy">
        <div key={stop.city} className="road-text" aria-live="polite">
          <p className="road-eyebrow">{stop.place}</p>
          <h1>{stop.name}</h1>
          <p className="road-story">{stop.story}</p>
        </div>
        <div className="road-trade">
          <div><b>{stop.goods}</b><span>W ładowni {held} szt. · Sakwa {money.format(gold)} zł</span></div>
          <button type="button" disabled={gold < price} onClick={() => {
            onBuy(stop.commodity);
            setReceipt('Kupiono 1 szt. za ' + money.format(price) + ' zł.');
          }}>Kup 1 szt. · {money.format(price)} zł</button>
        </div>
        <span role="status" className="road-receipt">{receipt}</span>
        <div className="road-links">
          {stop.plate === 'rynek' && <button onClick={() => onWeighhouse(moving)}>Wejdź do wagi portowej</button>}
          {stop.plate === 'rynek' && <button onClick={() => onMenu('terminal')}>Pełny targ</button>}
          {stop.plate === 'trakt' && <button onClick={() => onMenu('caravans')}>Zorganizuj karawanę</button>}
          {stop.plate === 'kuznia' && <button onClick={() => onMenu('knight')}>Otwórz zbrojownię</button>}
          <button onClick={() => setSheets(true)}>Zapytaj w zajeździe o miasta</button>
        </div>
      </section>
      <footer className="road-footer">
        <nav aria-label="Przystanki traktu">{roadStops.map(s => (
          <button key={s.city} onClick={() => onTravel(s)} aria-current={s.city === stop.city ? 'location' : undefined}>{s.name}</button>
        ))}</nav>
        <div className="road-links">
          <button aria-pressed={moving} onClick={() => setMoving(!moving)}>{moving ? 'Zatrzymaj ruch' : 'Włącz ruch'}</button>
          <button onClick={onFilm}>Obejrzyj prolog</button>
        </div>
      </footer>
      <dialog ref={sheet} className="road-inn" aria-labelledby="inn-title" onCancel={() => setSheets(false)} onClose={() => setSheets(false)}>
        <h2 id="inn-title">Wieści z zajazdu</h2>
        <p>Karczmarz porównuje szlaki z rejestrem lokacji. Wybierz okręg, aby zajrzeć do kancelarii.</p>
        {registerError ? <p role="status">{registerError}</p> : (
          <ul>{CITIES.map(c => {
            const town = towns.find(t => t.site === c.id);
            return <li key={c.id}><button onClick={() => onMenu('duchy_story', c.id)}>
              <strong>{c.name}</strong><span>{town ? (town.approved ? town.name : 'Petycja w toku') : 'Brak ogłoszonej lokacji'}</span>
            </button></li>;
          })}</ul>
        )}
        <button className="road-chip" onClick={() => setSheets(false)} autoFocus>Wróć na trakt</button>
      </dialog>
    </main>
  );
}
