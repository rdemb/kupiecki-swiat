import { useRef } from 'react';
import { CITIES, WEATHER_CONDITIONS } from '../economy/economyEngine';
import {
  fairGoods,
  fairHref,
  type FairBook,
  type FairCommand,
  type FairGood,
} from '../economy/harvestFair';
import type { MillBook } from '../economy/mill';
import type { FeastVisit } from './HarvestFeast';
import { cinemaFile } from './MerchantRoad';
import { PortLink } from './PortLink';
import './harvestFair.css';

const booths = {
  zboze: {
    name: 'Ława piekarza',
    cargo: 'Worek królewskiego zboża',
    dispatch: 'Wyślij 1 worek zboża',
    detail: 'Pod lnianym daszkiem stygną bochny.',
  },
  zelazo: {
    name: 'Kram kowala',
    cargo: 'Partia rudy żelaza',
    dispatch: 'Wyślij 1 partię rudy',
    detail: 'Kowal wystawił okucia, garnki i obręcze do kół.',
  },
};
const scenes = [
  'Plac przed ratuszem. Oba miejsca na stragany są wolne.',
  'Po lewej stanęła ława piekarza pod jasnym płótnem.',
  'Po prawej stanął kram kowala pod rudym płótnem.',
  'Na placu stoją piekarska ława i kram kowala.',
];
export function HarvestFair({
  city,
  fair,
  wallet,
  busy,
  login,
  sign,
  visit,
}: {
  city: string;
  fair: FairBook;
  wallet: MillBook['wallet'];
  busy: boolean;
  login: () => void;
  sign: (cmd: FairCommand, note: string) => Promise<boolean>;
  visit: FeastVisit;
}) {
  const cards = useRef<Partial<Record<FairGood, HTMLHeadingElement | null>>>({});
  const town = CITIES.find((c) => c.id === city)?.name;
  const other = city === 'zelazna_kuznia' ? 'krolewska_przystan' : 'zelazna_kuznia';
  const arrived = fair.wagons.filter((w) => w.arrival <= fair.now);
  const scene = arrived.reduce((mask, w) => mask | (w.good === 'zboze' ? 1 : 2), 0);
  return (
    <article className="harvest-fair">
      <figure className="fair-picture">
        <div
          key={scene}
          className={'fair-frame fair-scene-' + scene}
          style={{ backgroundImage: 'url(' + cinemaFile('jarmark.webp') + ')' }}
          role="img"
          aria-label={scenes[scene]}
        />
        {arrived.map((w) => (
          <button
            key={w.good}
            className={'fair-pin fair-' + w.good}
            aria-label={'Odwiedź: ' + booths[w.good].name}
            onClick={() => cards.current[w.good]?.focus()}
          >
            {booths[w.good].name}
          </button>
        ))}
        <figcaption>{town}</figcaption>
      </figure>
      <section className="fair-ledger">
        <h1>Jarmark po dożynkach</h1>
        {fair.opening ? (
          <p>
            Bochen ze żniw nr {fair.opening.round} dotarł do karczmy. Przy wspólnym stole piekarz i
            kowal poprosili kupców o pierwsze dostawy na plac.
          </p>
        ) : (
          <p>
            Plac czeka na dożynki. Kiedy kupcy wybiorą tutejszą karczmę i przywiozą chleb ze
            Srebrnego Gaju, piekarz i kowal otworzą zamówienia.{' '}
            <PortLink href="?miejsce=dozynki" go={() => visit('feast')}>
              Zajrzyj do piekarni
            </PortLink>
          </p>
        )}
        <div className="fair-orders">
          {fairGoods.map((good) => {
            const b = booths[good],
              w = fair.wagons.find((cart) => cart.good === good);
            const stock = good === 'zboze' ? wallet?.grain : wallet?.iron;
            const open = w && w.arrival <= fair.now;
            return (
              <section key={good} className="fair-order">
                <h2
                  ref={(el) => {
                    cards.current[good] = el;
                  }}
                  tabIndex={-1}
                >
                  {b.name}
                </h2>
                {w ? (
                  <>
                    <p>{open ? b.detail : 'Wóz jest na trakcie.'}</p>
                    <dl>
                      <dt>{open ? 'Pierwsza dostawa' : 'Woźnica'}</dt>
                      <dd>{w.carrier}</dd>
                      <dt>Ładunek</dt>
                      <dd>{b.cargo}</dd>
                      <dt>Trasa</dt>
                      <dd>
                        {w.road === 'detour' ? 'Objazd' : 'Przez most'} ·{' '}
                        {WEATHER_CONDITIONS[w.weather].name}
                      </dd>
                    </dl>
                    {!open && (
                      <>
                        <progress
                          value={fair.now - w.departed}
                          max={w.arrival - w.departed}
                          aria-label="Przejazd wozu"
                        />
                        <small>Do placu około {Math.ceil((w.arrival - fair.now) / 1000)} s</small>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <p>
                      {b.cargo} · {fair.opening ? 'zamówienie otwarte' : 'po przyjeździe bochna'}
                    </p>
                    {fair.opening &&
                      (wallet ? (
                        <>
                          <small>
                            W twoim magazynie: {stock ?? 0} szt. Jedna sztuka z dostawy zostaje na
                            jarmarku.
                          </small>
                          <button
                            disabled={busy || !stock}
                            onClick={() =>
                              void sign(
                                { action: 'supplyFair', good, loaf: fair.opening!.id },
                                'Towar opuścił magazyn. Wóz wyruszył na plac.',
                              )
                            }
                          >
                            {b.dispatch}
                          </button>
                        </>
                      ) : (
                        <button onClick={login}>Zaloguj się, żeby przywieźć towar</button>
                      ))}
                  </>
                )}
              </section>
            );
          })}
        </div>
        <PortLink href={fairHref(other)} go={() => visit('fair', other)}>
          Drugi plac · {CITIES.find((c) => c.id === other)?.name}
        </PortLink>
      </section>
    </article>
  );
}
