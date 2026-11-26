import type { DatabaseSync } from 'node:sqlite';
import type { ServerPlayerAccount } from '../server';
import { MONSTER_QUESTS, RACES, TECH_TREE } from '../src/economy/gameData';
import { computeDerivedHeroStats } from '../src/economy/heroProgression';
import type { FeastTown } from '../src/economy/harvestLoaf';
import {
  ignisQuest,
  vialPrice,
  supplySacks,
  restMinutes,
  waitingForCare,
  type ReliefCall,
  type WardReport,
  type WardBook,
} from '../src/economy/infirmary';
import { resolveQuestTurn } from '../src/economy/questTurn';
import { FeastRule } from './harvestLoaf';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new FeastRule(message);
}
const quest = MONSTER_QUESTS.find((q) => q.id === ignisQuest)!;
export function openInfirmary(
  db: DatabaseSync,
  transfer: (uid: string, gold: number, grain: number) => void,
) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wardSorties(id INTEGER PRIMARY KEY,uid TEXT NOT NULL,knight TEXT NOT NULL,town TEXT NOT NULL,packed INTEGER NOT NULL,state TEXT NOT NULL,due INTEGER NOT NULL DEFAULT 0,called INTEGER NOT NULL DEFAULT 0,savedMs INTEGER NOT NULL DEFAULT 0,carrier TEXT);
    CREATE INDEX IF NOT EXISTS wardByKnight ON wardSorties(uid,id DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS wardSingleMarch ON wardSorties(uid) WHERE state='march';
    CREATE INDEX IF NOT EXISTS wardByTown ON wardSorties(town,called,due);
    CREATE TABLE IF NOT EXISTS wardShelf(uid TEXT PRIMARY KEY,stock INTEGER NOT NULL CHECK(stock>=0));`);
  const columns = 'id,knight,town,packed,state,due,called,savedMs,carrier';
  const latest = db.prepare(
    'SELECT ' + columns + ' FROM wardSorties WHERE uid=? ORDER BY id DESC LIMIT 1',
  );
  const profileRow = db.prepare(
    "SELECT username,profile FROM players WHERE json_extract(profile,'$.uid')=?",
  );
  function profile(uid: string) {
    const row = profileRow.get(uid);
    check(row, 'Kupca nie ma w księdze.');
    return JSON.parse(String(row.profile)) as ServerPlayerAccount;
  }
  function report(uid: string) {
    const row = latest.get(uid);
    return row ? ({ ...row, called: !!row.called } as unknown as WardReport) : null;
  }
  const stock = (uid: string) =>
    Number(db.prepare('SELECT stock FROM wardShelf WHERE uid=?').get(uid)?.stock ?? 0);
  const shelf = db.prepare(
    'INSERT INTO wardShelf VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET stock=excluded.stock',
  );
  function calls(town: string, now: number) {
    return db
      .prepare(
        "SELECT id,knight,town,due FROM wardSorties WHERE town=? AND called=1 AND state='retreat' AND due>? ORDER BY due,id LIMIT 30",
      )
      .all(town, now) as unknown as ReliefCall[];
  }
  function resting(uid: string, now: number) {
    return waitingForCare(report(uid), now);
  }
  function occupied(uid: string, now: number) {
    const r = report(uid);
    return r?.state === 'march' || waitingForCare(r, now);
  }
  function dutyUntil(uid: string, now: number) {
    return Number(
      db.prepare('SELECT max(due) due FROM knightDuties WHERE uid=? AND due>?').get(uid, now)
        ?.due ?? 0,
    );
  }
  function book(town: FeastTown, uid: string | null, now: number): WardBook {
    const common = { now, calls: calls(town, now) };
    if (!uid) return { ...common, mine: null };
    const k = profile(uid).knight,
      q = k.activeQuest;
    return {
      ...common,
      mine: {
        last: report(uid),
        history: db
          .prepare(
            'SELECT ' +
              columns +
              " FROM wardSorties WHERE uid=? AND state!='march' ORDER BY id DESC LIMIT 3",
          )
          .all(uid)
          .map((r) => ({ ...r, called: !!r.called })) as unknown as WardReport[],
        shelf: stock(uid),
        dutyUntil: dutyUntil(uid, now),
        revision: k.wardRevision ?? 0,
        activeStep: q?.questId === ignisQuest ? q.currentStep : 0,
        enemyHp: q?.questId === ignisQuest ? q.monsterCurrentHp : quest.monsterMaxHp,
        hp: k.hp,
        lastTurn: q?.questId === ignisQuest ? q.combatLogs?.[0] ?? null : null,
        turns: k.availableTurns,
        name: k.name,
        otherQuest: !!q && q.questId !== ignisQuest,
      },
    };
  }
  function command(
    town: FeastTown,
    me: { uid: string; displayName: string },
    body: Record<string, unknown>,
    now: number,
  ) {
    const uid = me.uid;
    if (body.action === 'supplyWard') {
      check(
        typeof body.sortie === 'number' && Number.isSafeInteger(body.sortie),
        'Wybierz wezwanie.',
      );
      const call = db
        .prepare(
          "SELECT uid FROM wardSorties WHERE id=? AND town=? AND called=1 AND state='retreat' AND due>?",
        )
        .get(body.sortie, town, now);
      check(
        call && call.uid !== uid,
        'Lazaret przyjmuje pomoc innego kupca tylko na otwarte wezwanie.',
      );
      transfer(uid, 0, -supplySacks);
      db.prepare('UPDATE wardSorties SET savedMs=due-?,due=?,carrier=? WHERE id=?').run(
        now,
        now,
        me.displayName,
        body.sortie,
      );
      return;
    }
    let last = report(uid);
    if (body.action === 'callWard') {
      check(
        last &&
          last.id === body.sortie &&
          last.town === town &&
          waitingForCare(last, now) &&
          !last.called,
        'Wezwanie można wystawić raz podczas leczenia w tym lazarecie.',
      );
      db.prepare('UPDATE wardSorties SET called=1 WHERE id=?').run(last.id);
      return;
    }
    const acc = profile(uid),
      k = acc.knight;
    const begin = body.action === 'beginIgnis';
    const oldQuest = k.activeQuest;
    if (begin) {
      check(
        !occupied(uid, now) && !dutyUntil(uid, now),
        'Rycerz jest jeszcze na wyprawie, na służbie lub w lazarecie.',
      );
      check(
        (k.wardRevision ?? 0) === body.revision && (!oldQuest || oldQuest.questId === ignisQuest),
        'Sprawdź aktualny wpis rycerza i dokończ jego wyprawę.',
      );
      const n = body.quantity;
      check(
        typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 2,
        'Wybierz od zera do dwóch eliksirów.',
      );
      const onShelf = stock(uid),
        purchase = Math.max(0, n - onShelf);
      if (purchase) transfer(uid, -purchase * vialPrice, 0);
      shelf.run(uid, Math.max(0, onShelf - n));
      db.prepare(
        "INSERT INTO wardSorties(uid,knight,town,packed,state) VALUES(?,?,?,?,'march')",
      ).run(uid, k.name, town, n);
      last = report(uid);
    } else {
      check(
        body.action === 'fightIgnis' &&
          last?.state === 'march' &&
          body.sortie === last.id &&
          last.town === town &&
          oldQuest?.questId === ignisQuest &&
          oldQuest.currentStep === body.step,
        'Ten etap wyprawy jest już rozstrzygnięty lub należy do innego lazaretu.',
      );
    }
    const stance = begin ? 'balanced' : body.stance;
    check(
      stance === 'balanced' || stance === 'aggressive' || stance === 'defensive',
      'Wybierz taktykę rycerza.',
    );
    // Regeneration also works when the player stays in the infirmary or logs back in after a break.
    if (
      k.nextTurnRegenAt <= now &&
      k.availableTurns < computeDerivedHeroStats(k).effectiveMaxTurns
    ) {
      const count = 1 + Math.floor((now - k.nextTurnRegenAt) / 90000);
      k.availableTurns = Math.min(
        computeDerivedHeroStats(k).effectiveMaxTurns,
        k.availableTurns + count,
      );
      k.nextTurnRegenAt = now + 90000;
    }
    check(
      k.availableTurns > 0 && (oldQuest || k.hp > 15),
      'Rycerz potrzebuje sił. W panelu Rycerz można uzupełnić tury i zdrowie prowiantem.',
    );
    const tech = TECH_TREE.filter(
      (t) => t.effectType === 'combat_escort' && acc.unlockedTechIds.includes(t.id),
    ).reduce((s, t) => s + t.effectValue, 0);
    const race = RACES.find((r) => r.id === acc.raceId);
    const result = resolveQuestTurn(
      k,
      quest,
      stance,
      !oldQuest,
      Math.min(0.92, tech + (race?.combatEscortBonus ?? 0)),
      acc.companionAttack ?? 0,
      now,
    );
    const next = result.knight;
    next.wardRevision = (k.wardRevision ?? 0) + 1;
    if (result.outcome !== 'march') {
      const minutes = result.outcome === 'retreat' ? restMinutes[last!.packed] : 0;
      db.prepare('UPDATE wardSorties SET state=?,due=? WHERE id=?').run(
        result.outcome,
        now + minutes * 60000,
        last!.id,
      );
      if (result.outcome === 'victory') shelf.run(uid, stock(uid) + last!.packed);
      if (result.outcome === 'retreat') next.hp = Math.max(next.hp, Math.ceil(next.maxHp * 0.3));
    }
    if (result.gold) transfer(uid, result.gold, 0);
    const updated = profile(uid); // transfer wrote the wallet and settlement marker.
    for (const { id, qty } of result.goods)
      updated.inventory[id] = (updated.inventory[id] ?? 0) + qty;
    updated.knight = next;
    updated.updatedAt = new Date(now).toISOString();
    db.prepare('UPDATE players SET profile=? WHERE username=?').run(
      JSON.stringify(updated),
      updated.username.toLowerCase(),
    );
  }
  function snapshot(uid: string) {
    const a = profile(uid);
    return { knight: a.knight, scales: a.inventory.smocza_luska, mithril: a.inventory.mithril };
  }
  return { book, calls, occupied, resting, command, snapshot };
}
