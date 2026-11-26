import type { LaunchBoard as Board } from '../economy/shipyard';
import { shipRules } from '../economy/shipyard';
import { raftRules } from '../economy/rafts';
import { PortLink } from './PortLink';
import './launchBoard.css';

export function LaunchBoard({
  board,
  yard,
}: {
  board: Board;
  yard: () => void;
}) {
  const last = board.lastLaunch;
  return (
    <section className="launch-board" aria-labelledby="launch-board-title">
      <h2 id="launch-board-title">Pierwsze wodowanie</h2>
      {!board.open.length && (
        <p>
          Na tablicy nie ma teraz zaproszeń do budowy. Mistrz gildii może
          położyć stępkę za {shipRules.berthPrice} zł i zaprosić kupców do
          swojej pochylni.
        </p>
      )}
      {board.open.map((n) => {
        const link = '?miejsce=stocznia&szkuta=' + n.ship;
        return (
          <article key={n.ship} className="launch-bill">
            <h3>{n.guild}</h3>
            <p>
              Na pochylnię nr {n.ship} zaprasza <b>{n.signer}</b>.
            </p>
            {n.oakMissing + n.ironMissing === 0 ? (
              <p>
                Wszystkie materiały dotarły. Kadłub czeka na imię i wodowanie.
              </p>
            ) : (
              <dl>
                <div>
                  <dt>Dąb do poszycia</dt>
                  <dd>
                    {n.oakMissing ? (
                      <>
                        Brakuje {n.oakMissing * raftRules.beamsPerLoad} belek.{' '}
                        {board.portOak ? (
                          <PortLink href={link + '&dostawa=dab'} go={yard}>
                            Wybierz dostawę {raftRules.beamsPerLoad} belek ·{' '}
                            {shipRules.oakPrice} zł
                          </PortLink>
                        ) : (
                          <>
                            Skład czeka na tratwę.{' '}
                            <PortLink href={link + '&dostawa=dab'} go={yard}>
                              Zobacz pochylnię
                            </PortLink>
                          </>
                        )}
                      </>
                    ) : (
                      'Dostarczono'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Okucia z kuźni</dt>
                  <dd>
                    {n.ironMissing ? (
                      <>
                        Brakuje kompletu okuć.{' '}
                        <PortLink href={link + '&dostawa=okucia'} go={yard}>
                          Wybierz dostawę okuć · {shipRules.ironPrice} zł
                        </PortLink>
                      </>
                    ) : (
                      'Dostarczono'
                    )}
                  </dd>
                </div>
              </dl>
            )}
            <PortLink href={link} go={yard}>
              Metryka i podpisy budowniczych
            </PortLink>
          </article>
        );
      })}
      {last && (
        <p className="launch-news">
          Ostatnie wodowanie z tablicy ·{' '}
          <PortLink href={'?miejsce=stocznia&szkuta=' + last.ship} go={yard}>
            „{last.vessel}”
          </PortLink>{' '}
          gildii {last.guild}. W metryce znajdziesz podpisy osób, które
          dostarczyły materiały.
        </p>
      )}
      {!board.open.length && (
        <PortLink href="?miejsce=stocznia" go={yard}>
          Odwiedź stocznię
        </PortLink>
      )}
    </section>
  );
}
