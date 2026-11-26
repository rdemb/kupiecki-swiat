import type { DatabaseSync } from 'node:sqlite';
import type { WeatherConditionId } from '../src/economy/economyEngine';
import {
  fairGoods,
  isFairTown,
  type FairBook,
  type FairDelivery,
  type FairGood,
} from '../src/economy/harvestFair';
import { journeySeconds } from '../src/economy/waybills';
import { FeastRule } from './harvestLoaf';

export function openHarvestFair(db: DatabaseSync) {
  // Each town remembers its two founding deliveries, including after later harvests.
  db.exec(`CREATE TABLE IF NOT EXISTS harvestFairWagons(
    town TEXT NOT NULL, good TEXT NOT NULL CHECK(good IN ('zboze','zelazo')),
    loaf INTEGER NOT NULL REFERENCES harvestLoaves(id), carrier TEXT NOT NULL,
    departed INTEGER NOT NULL, arrival INTEGER NOT NULL, road TEXT NOT NULL, weather TEXT NOT NULL,
    PRIMARY KEY(town,good)
  )`);
  const firstLoaf = db.prepare(
    'SELECT id,round,baker FROM harvestLoaves WHERE town=? AND arrival<=? ORDER BY arrival,id LIMIT 1',
  );
  const consignments =
    db.prepare(`SELECT w.good,w.carrier,w.departed,w.arrival,w.road,w.weather,l.round
    FROM harvestFairWagons w JOIN harvestLoaves l ON l.id=w.loaf WHERE w.town=? ORDER BY w.arrival,w.good`);
  function book(town: string, now: number): FairBook {
    return {
      now,
      opening: (firstLoaf.get(town, now) as unknown as FairBook['opening']) ?? null,
      wagons: consignments.all(town) as unknown as FairDelivery[],
    };
  }
  function dispatch(
    town: string,
    cmd: Record<string, unknown>,
    carrier: string,
    now: number,
    weather: WeatherConditionId,
    bridgeClosed: (at: number) => boolean,
    take: (good: FairGood) => void,
  ) {
    if (!isFairTown(town)) throw new FeastRule('W tym mieście nie odbywają się dożynki.');
    const fair = book(town, now);
    if (!fair.opening || cmd.loaf !== fair.opening.id)
      throw new FeastRule('Najpierw do miejscowej karczmy musi dotrzeć bochen dożynkowy.');
    const good = fairGoods.find((g) => g === cmd.good);
    if (!good) throw new FeastRule('Wybierz zamówienie piekarza albo kowala.');
    if (fair.wagons.some((w) => w.good === good))
      throw new FeastRule('Kupiec już wyruszył z tym zamówieniem.');
    const road = bridgeClosed(now) ? 'detour' : 'bridge';
    const duration = journeySeconds(1, weather, road) + (town === 'zelazna_kuznia' ? 15 : 0);
    take(good);
    db.prepare(
      'INSERT INTO harvestFairWagons(town,good,loaf,carrier,departed,arrival,road,weather) VALUES(?,?,?,?,?,?,?,?)',
    ).run(town, good, fair.opening.id, carrier, now, now + 1000 * duration, road, weather);
  }
  return { book, dispatch };
}
