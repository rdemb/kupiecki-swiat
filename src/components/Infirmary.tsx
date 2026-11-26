import { useState } from 'react';
import {
  restMinutes,
  supplySacks,
  vialPrice,
  waitingForCare,
  infirmaryHref,
  type WardBook,
  type WardCommand,
} from '../economy/infirmary';
import { townNames } from '../economy/garrison';
import type { FeastTown } from '../economy/harvestLoaf';
import type { MillBook } from '../economy/mill';
import { PortLink } from './PortLink';
import { cinemaFile } from './MerchantRoad';

interface Props {
  book: WardBook;
  town: FeastTown;
  wallet: MillBook['wallet'];
  busy: boolean;
  sign: (command: WardCommand, note: string) => Promise<boolean>;
  login: () => void;
}
const minutes = (due: number, now: number) => Math.max(1, Math.ceil((due - now) / 60000));
export function SupplyBoard({ book, wallet, busy, sign, login }: Props) {
  return (
    <section className="ward-board">
      <h3>Wezwania po prowiant</h3>
      {!book.calls.length && <p>Karczmarz nie ma dziś otwartych wezwań z lazaretu.</p>}
      {book.calls.map((c) => (
        <div key={c.id}>
          <b>{c.knight}</b>
          <p>
            Potrzeba {supplySacks} worków zboża na posiłki. Bez dostawy pozostało do{' '}
            {minutes(c.due, book.now)} min odpoczynku.
          </p>
          {wallet ? (
            book.mine?.last?.id === c.id ? (
              <small>Twoje wezwanie czeka na innego kupca.</small>
            ) : (
              <button
                disabled={busy || wallet.grain < supplySacks}
                onClick={() =>
                  sign(
                    { action: 'supplyWard', sortie: c.id },
                    'Prowiant wydany. Rycerz może już wrócić do służby.',
                  )
                }
              >
                Dostarcz 2 worki zboża
              </button>
            )
          ) : (
            <button onClick={login}>Zaloguj się, by dostarczyć prowiant</button>
          )}
        </div>
      ))}
    </section>
  );
}
export function Infirmary(props: Props & { visitWard: (town: FeastTown) => void }) {
  const { town, book, wallet, busy, sign, login } = props;
  const [packed, setPacked] = useState(0);
  const m = book.mine,
    last = m?.last,
    rest = waitingForCare(last, book.now);
  const onRoad = last?.state === 'march',
    away = last && last.town !== town && (rest || onRoad);
  const cost = Math.max(0, packed - (m?.shelf ?? 0)) * vialPrice;
  return (
    <article className="garrison">
      <header className="field-hero garrison-cover ward-cover">
        <img
          src={cinemaFile('lazaret.webp')}
          alt="Ranny rycerz odpoczywa przy oknie, a kupiec wnosi worek zboża do lazaretu."
        />
        <div>
          <span>{townNames[town]}</span>
          <h1>Lazaret przy koszarach</h1>
        </div>
      </header>
      <div className="garrison-pages">
        <section>
          <h2>
            {onRoad ? 'Na Krwawym Szczycie' : rest ? 'Powrót spod Iglicy' : 'Wyprawa na Ignisa'}
          </h2>
          {away ? (
            <p>
              Twój lazaret to {townNames[last.town]}.{' '}
              <PortLink href={infirmaryHref(last.town)} go={() => props.visitWard(last.town)}>
                Otwórz księgę tej placówki
              </PortLink>
            </p>
          ) : rest && last ? (
            <>
              <p role="status">
                {last.knight} dochodzi do siebie. Do powrotu na służbę pozostało do{' '}
                {minutes(last.due, book.now)} min.
              </p>
              <p>
                Karczmarz może poprosić miejscowych kupców o zboże na posiłki. Dostawa kończy
                odpoczynek wcześniej.
              </p>
              <button
                disabled={busy || last.called}
                onClick={() =>
                  sign({ action: 'callWard', sortie: last.id }, 'Karczmarz wywiesił wezwanie.')
                }
              >
                {last.called ? 'Wezwanie wisi w karczmie' : 'Poproś karczmę o prowiant'}
              </button>
            </>
          ) : onRoad && last && m ? (
            <>
              <p>Ignis broni Iglicy. Wybierz, jak rycerz rozegra następną turę.</p>
              <p role="status">
                <b>Tura {m.activeStep} z 5</b> · Ignis {m.enemyHp} PŻ · rycerz {m.hp} PŻ · tury w
                zapasie {m.turns} · eliksiry {last.packed}.
              </p>
              {m.lastTurn && <p>{m.lastTurn}</p>}
              {(
                [
                  ['aggressive', 'Szarża'],
                  ['balanced', 'Równowaga'],
                  ['defensive', 'Garda'],
                ] as const
              ).map(([stance, label]) => (
                <button
                  key={stance}
                  disabled={busy}
                  onClick={() =>
                    sign(
                      { action: 'fightIgnis', sortie: last.id, step: m.activeStep, stance },
                      'Rozstrzygnięto turę wyprawy.',
                    )
                  }
                >
                  {label}
                </button>
              ))}
            </>
          ) : (
            <>
              <p>
                Przed drogą na Krwawy Szczyt zdecyduj, ile fiolek bierzesz do sakwy. Po odwrocie
                medyk zużyje zapas. Po zwycięstwie odłoży pełne fiolki na twoją półkę.
              </p>
              <label className="ward-pack">
                Eliksiry na drogę{' '}
                <select value={packed} onChange={(e) => setPacked(Number(e.target.value))}>
                  <option value={0}>Bez eliksiru</option>
                  <option value={1}>Jedna fiolka</option>
                  <option value={2}>Dwie fiolki</option>
                </select>
              </label>
              <p aria-live="polite">
                Koszt przygotowania {cost} zł.{' '}
                {restMinutes[packed]
                  ? 'Odpoczynek po odwrocie wyniesie ' + restMinutes[packed] + ' min.'
                  : 'Po odwrocie rycerz od razu wróci do służby.'}
              </p>
              {m && wallet ? (
                <>
                  <p>
                    Na półce {m.shelf} · w sakwie {wallet.gold} zł.{' '}
                    {m.otherQuest
                      ? 'Najpierw dokończ obecną wyprawę.'
                      : m.dutyUntil > book.now
                        ? 'Rycerz pełni obecnie służbę garnizonową.'
                        : ''}
                  </p>
                  <button
                    className="inn-primary"
                    disabled={busy || m.otherQuest || m.dutyUntil > book.now || wallet.gold < cost}
                    onClick={() =>
                      sign(
                        { action: 'beginIgnis', quantity: packed, revision: m.revision },
                        'Zapisano pierwszą turę starcia.',
                      )
                    }
                  >
                    {m.activeStep ? 'Podejmij wcześniejszą wyprawę' : 'Wyrusz na Ignisa'}
                  </button>
                </>
              ) : (
                <button className="inn-primary" onClick={login}>
                  Zaloguj się, by wyruszyć
                </button>
              )}
            </>
          )}
          {last && !onRoad && !rest && (
            <p role="status">
              <b>Ostatnia wyprawa.</b>{' '}
              {last.state === 'victory'
                ? 'Ignis pokonany. Niewykorzystane eliksiry wróciły na półkę.'
                : last.carrier
                  ? 'Prowiant dostarczył kupiec ' + last.carrier + '. Rycerz wrócił do służby.'
                  : 'Rycerz wrócił do służby po odwrocie.'}
            </p>
          )}
        </section>
        <aside>
          <SupplyBoard {...props} />
          {!!m?.history.length && (
            <section className="ward-record">
              <h3>Karty wypraw</h3>
              {m.history.map((card) => (
                <details key={card.id}>
                  <summary>
                    {townNames[card.town]} ·{' '}
                    {card.state === 'victory' ? 'Zwycięstwo pod Iglicą' : 'Odwrót spod Iglicy'}
                  </summary>
                  <p>
                    Eliksiry zabrane na drogę · {card.packed}.{' '}
                    {card.state === 'victory'
                      ? 'Pełne fiolki zwrócono do zapasów.'
                      : card.carrier
                        ? 'Dostawa kupca ' +
                          card.carrier +
                          ' skróciła odpoczynek o ' +
                          Math.floor(card.savedMs / 60000) +
                          ' min ' +
                          (Math.floor(card.savedMs / 1000) % 60) +
                          ' s.'
                        : 'Przewidziany odpoczynek po powrocie · ' +
                          restMinutes[card.packed] +
                          ' min.'}
                  </p>
                </details>
              ))}
            </section>
          )}
        </aside>
      </div>
    </article>
  );
}
