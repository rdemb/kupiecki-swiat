import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// The caller owns the temporary database and can restart this private server.
export async function exerciseShipyard({
  request,
  db,
  start,
  stop,
  imperator,
}) {
  const account = async (username, displayName) => {
    const credentials = { username, password: randomUUID() };
    const b = await request('/api/auth/register', 201, {
      ...credentials,
      displayName,
    });
    return { token: b.token, credentials };
  };
  const master = await account('pisarz_stoczni', 'Róża'),
    oak = await account('mistrz_drewna', 'Jan od dębu'),
    smith = await account('mistrz_okuc', 'Ida z Kuźni');
  const api = '/api/shipyard',
    inn = '/api/inn/krolewska_przystan';
  const read = (actor, query = '') =>
    request(api + query, 200, undefined, actor?.token);
  const send = (actor, action, data = {}, status = 200) =>
    request(
      api,
      status,
      { action, nonce: randomUUID(), ...data },
      actor?.token,
    );
  const logIn = async (a) => {
    a.token = (await request('/api/auth/login', 200, a.credentials)).token;
  };
  const innAction = (action, data = {}) =>
    request(inn, 200, { action, nonce: randomUUID(), ...data }, master.token);
  assert.equal((await read()).wallet, null);
  await send(undefined, 'commission', {}, 401);
  await send(oak, 'commission', {}, 409);
  await innAction('create', { body: 'Bractwo Szkutników', tag: 'SZKT' });
  const first = await read(master),
    slip = { nonce: randomUUID() };
  const built = await send(master, 'commission', slip);
  const id = built.ship.hull.id,
    ship = { ship: id };
  assert.equal(built.wallet.gold, first.wallet.gold - 35);
  assert.equal((await send(master, 'commission', slip)).ship.hull.id, id);
  await send(master, 'commission', {}, 409);
  const notices = async () => (await request(inn, 200)).launches;
  assert.equal((await notices()).open.length, 0);
  assert.equal((await request('/api/inn/srebrny_gaj', 200)).launches, null);
  await send(undefined, 'inviteBuilders', ship, 401);
  await send(smith, 'inviteBuilders', ship, 409);
  const noticeSlip = { ...ship, nonce: randomUUID() };
  await Promise.all([
    send(master, 'inviteBuilders', noticeSlip),
    send(master, 'inviteBuilders', noticeSlip),
  ]);
  assert.equal((await notices()).open.length, 1);
  await send(master, 'inviteBuilders', ship, 409);
  await send(oak, 'removeInvitation', ship, 409);
  await send(master, 'removeInvitation', ship);
  assert.equal((await notices()).open.length, 0);
  await send(master, 'inviteBuilders', ship);
  const published = (await notices()).open[0];
  assert.deepEqual(
    [
      published.ship,
      published.guild,
      published.signer,
      published.oakMissing,
      published.ironMissing,
    ],
    [id, 'Bractwo Szkutników', 'Róża', 2, 1],
  );
  assert.equal((await read()).ship.invitation.signer, 'Róża');
  await send(master, 'launch', { ...ship, name: 'Skowronek' }, 409);
  db.exec('UPDATE raftYard SET port=0');
  await send(oak, 'oak', ship, 409);
  // Prime a timber raft using the real existing delivery contract.
  db.prepare('UPDATE riverGauge SET level=140000,sampled=?').run(Date.now());
  const bid = (await request('/api/bridge', 200, undefined, oak.token)).rafting
    .offer;
  const trip = await request(
    '/api/bridge',
    200,
    { action: 'launchRaft', offer: bid, nonce: randomUUID() },
    oak.token,
  );
  db.prepare('UPDATE raftRuns SET due=? WHERE id=?').run(
    Date.now() - 1,
    trip.rafting.runs.find((r) => r.own).id,
  );
  assert.equal((await read(oak)).oak, 2);
  const signed = { ...ship, nonce: randomUUID() };
  const oakStart = (await read(oak)).wallet.gold;
  await send(oak, 'oak', signed);
  assert.equal((await notices()).open[0].oakMissing, 1);
  await send(oak, 'oak', signed);
  assert.equal((await notices()).open[0].oakMissing, 1);
  await send(oak, 'iron', signed, 409);
  await send(oak, 'oak', ship);
  assert.equal((await read(oak)).wallet.gold, oakStart - 60);
  await send(oak, 'oak', ship, 409);
  const iron = await send(smith, 'iron', ship);
  assert.equal(iron.oak, 0);
  assert.equal(iron.ship.deliveries.length, 3);
  const readyBill = (await notices()).open[0];
  assert.deepEqual(
    [readyBill.oakMissing, readyBill.ironMissing, readyBill.launched],
    [0, 0, null],
  );
  assert.deepEqual(
    iron.ship.deliveries.map((d) => d.name),
    ['Jan od dębu', 'Jan od dębu', 'Ida z Kuźni'],
  );
  await send(smith, 'launch', { ...ship, name: 'Skowronek' }, 409);
  await send(master, 'launch', { ...ship, name: '??' }, 409);
  const named = await send(master, 'launch', { ...ship, name: 'Skowronek' });
  assert.equal(named.ship.hull.name, 'Skowronek');
  const archivedBill = await notices();
  assert.equal(archivedBill.open.length, 0);
  assert.equal(archivedBill.lastLaunch.vessel, 'Skowronek');
  assert.equal(archivedBill.lastLaunch.ship, id);
  await send(master, 'inviteBuilders', ship, 409);
  await send(master, 'removeInvitation', ship, 409);
  await send(master, 'iron', ship, 409);
  db.exec('UPDATE harborStores SET salt=0');
  await send(master, 'hire', ship, 409);
  db.exec('UPDATE harborStores SET salt=4');
  const coins = (await read(master)).wallet.gold;
  let job = (await send(master, 'hire', ship)).ship.job;
  assert.equal((await read(master)).wallet.gold, coins - 18);
  assert.equal((await read()).salt, 0);
  await send(smith, 'withdraw', { ...ship, charter: job.id }, 409);
  await send(master, 'withdraw', { ...ship, charter: job.id });
  assert.equal((await read(master)).wallet.gold, coins);
  assert.equal((await read()).salt, 4);
  job = (await send(master, 'hire', ship)).ship.job;
  db.prepare('UPDATE yardVoyages SET expires=0 WHERE id=?').run(job.id);
  await send(smith, 'sail', { ...ship, charter: job.id }, 409);
  assert.equal((await read(master)).wallet.gold, coins);
  assert.equal((await read()).salt, 4);
  const actual = (await send(master, 'hire', ship)).ship.job;
  await send(smith, 'sail', { ...ship, charter: job.id }, 409);
  const tickets = [oak, smith];
  const fees = await Promise.all(
    tickets.map(async (who) => (await read(who)).wallet.gold),
  );
  await request('/api/world/season', 200, { seasonId: 'lato' }, imperator);
  const race = await Promise.allSettled(
    tickets.map((actor) =>
      send(actor, 'sail', { ...ship, charter: actual.id }),
    ),
  );
  assert.equal(race.filter((r) => r.status === 'fulfilled').length, 1);
  const i = race.findIndex((r) => r.status === 'fulfilled');
  assert.ok(race[i].value.ship.job.departed);
  assert.equal(race[1 - i].reason.actual, 409);
  const teams = (await request('/api/harbor-works', 200)).provisions;
  await stop();
  await start();
  for (const a of [master, oak, smith]) await logIn(a);
  assert.equal((await read(master, '?ship=' + id)).ship.job.id, actual.id);
  assert.equal((await notices()).lastLaunch.signer, 'Róża');
  assert.deepEqual(
    (await read(null, '?ship=' + id)).ship.deliveries.map((d) => d.name),
    ['Jan od dębu', 'Jan od dębu', 'Ida z Kuźni'],
  );
  db.prepare('UPDATE yardVoyages SET due=? WHERE id=?').run(
    Date.now() - 2,
    actual.id,
  );
  const paid = await read(master);
  assert.equal(paid.ship.completed, 1);
  assert.equal(paid.ship.job, null);
  assert.equal(paid.ship.journal[0].skipper, ['Jan od dębu', 'Ida z Kuźni'][i]);
  assert.equal(paid.wallet.gold, coins - 18 + 36);
  assert.equal((await read(tickets[i])).wallet.gold, fees[i] + 18);
  assert.equal((await read(tickets[1 - i])).wallet.gold, fees[1 - i]);
  assert.equal((await request('/api/harbor-works', 200)).provisions, teams + 1);
  assert.equal(
    (await read(null, '?ship=' + id + '&before=' + actual.id)).ship.journal
      .length,
    0,
  );
  // A second skipper can act on a signed sounding. Work entirely in the fixture port.
  db.exec('UPDATE harborStores SET salt=24');
  db.exec('UPDATE pilotBank SET cm=146');
  async function commissionTrip() {
    return (await send(master, 'hire', ship)).ship.job.id;
  }
  async function arrive(voyage) {
    db.prepare('UPDATE yardVoyages SET due=? WHERE id=?').run(
      Date.now() - 1,
      voyage,
    );
    return read(null);
  }
  async function setSky(index) {
    await stop();
    db.prepare(
      "UPDATE world SET snapshot=json_set(snapshot,'$.activeWeatherIndex',?,'$.tickCounter',1)",
    ).run(index);
    await start();
    for (const a of [master, oak, smith]) await logIn(a);
  }
  await setSky(0);
  const survey = await commissionTrip();
  await send(
    smith,
    'sail',
    { ...ship, charter: survey, course: 'cut', reference: 999999 },
    409,
  );
  const surveySlip = {
    ...ship,
    charter: survey,
    course: 'survey',
    nonce: randomUUID(),
  };
  const outbound = (await send(oak, 'sail', surveySlip)).ship.job;
  assert.equal(outbound.due - outbound.departed, 72000);
  await send(oak, 'sail', { ...surveySlip, course: 'outer' }, 409);
  assert.equal((await read()).pilotage.latest, null);
  const witnessed = (await arrive(survey)).pilotage.latest;
  assert.equal(witnessed.cm, 146);
  assert.equal(witnessed.skipper, 'Jan od dębu');
  assert.equal(witnessed.voyage, survey);
  assert.equal((await request(inn, 200)).pilotage.latest.voyage, survey);
  assert.equal((await request('/api/inn/srebrny_gaj', 200)).pilotage, null);
  const passage = await commissionTrip();
  const choice = {
    ...ship,
    charter: passage,
    course: 'cut',
    reference: survey,
    nonce: randomUUID(),
  };
  const fast = (await send(smith, 'sail', choice)).ship.job;
  assert.equal(fast.due - fast.departed, 40000);
  assert.equal(fast.pilot, 'Jan od dębu');
  assert.equal((await send(smith, 'sail', choice)).ship.job.id, passage);
  const arrived = (await arrive(passage)).ship.journal[0];
  assert.equal(arrived.skipper, 'Ida z Kuźni');
  assert.equal(arrived.pilot, 'Jan od dębu');
  assert.equal(arrived.depth, 146);
  const crossing = await commissionTrip();
  await send(smith, 'sail', { ...ship, charter: crossing, course: 'survey' });
  await setSky(3);
  const squall = (await read()).pilotage;
  assert.equal(squall.storm, true);
  assert.equal(squall.edition, witnessed.edition + 1);
  assert.equal((await arrive(crossing)).ship.journal[0].depth, null);
  assert.equal((await read()).pilotage.latest.voyage, survey);
  await setSky(3);
  assert.equal((await read()).pilotage.edition, squall.edition);
  const pledges = '/api/pilots/pledges';
  const offer = (payer, edition, amount, status = 200, nonce = randomUUID()) =>
    request(pledges, status, { edition, amount, nonce }, payer?.token);
  const balance = async (a) => (await read(a)).wallet.gold;
  const beforeR = await balance(master),
    beforeI = await balance(smith),
    beforeJ = await balance(oak);
  const rev = squall.edition,
    ticket = randomUUID();
  await offer(undefined, rev, 11, 401);
  await offer(master, rev - 1, 11, 409);
  for (const amount of [0, 1.5, 501]) await offer(master, rev, amount, 409);
  const duplicates = await Promise.all([
    offer(master, rev, 11, 200, ticket),
    offer(master, rev, 11, 200, ticket),
  ]);
  assert.ok(duplicates.every((x) => x.book.fund.mine === 11));
  await offer(master, rev, 12, 409, ticket);
  await offer(master, rev, 11, 409);
  await offer(smith, rev, 17);
  assert.equal(await balance(master), beforeR - 11);
  assert.equal(await balance(smith), beforeI - 17);
  const kitty = (await request(inn, 200)).pilotage.fund;
  assert.equal(kitty.total, 28);
  assert.equal(kitty.mine, 0);
  assert.deepEqual(
    kitty.patrons.map((p) => p.amount).sort((a, b) => a - b),
    [11, 17],
  );
  const after = await commissionTrip();
  await send(oak, 'sail', { ...ship, charter: after, course: 'outer' }, 409);
  await setSky(0);
  await send(
    oak,
    'sail',
    { ...ship, charter: after, course: 'cut', reference: survey },
    409,
  );
  db.exec('UPDATE pilotBank SET cm=108');
  await send(oak, 'sail', { ...ship, charter: after, course: 'survey' });
  const low = (await arrive(after)).pilotage.latest;
  assert.equal(low.cm, 108);
  assert.equal(low.edition, squall.edition);
  assert.equal(low.reward, 28);
  assert.equal(await balance(oak), beforeJ + 18 + 28);
  const settled = (await request(inn, 200)).pilotage.fund;
  assert.equal(settled.total, 0);
  assert.deepEqual(
    [settled.last.skipper, settled.last.cm, settled.last.total],
    ['Jan od dębu', 108, 28],
  );
  await offer(smith, rev, 10, 409);
  await offer(master, rev, 11, 200, ticket);
  await setSky(0);
  assert.equal(await balance(oak), beforeJ + 18 + 28);
  assert.equal(await balance(smith), beforeI - 17);
  const last = await commissionTrip();
  await send(
    smith,
    'sail',
    { ...ship, charter: last, course: 'cut', reference: after },
    409,
  );
  await send(smith, 'sail', { ...ship, charter: last }); // Existing clients take the deep route.
  assert.equal((await arrive(last)).ship.journal[0].course, 'outer');
  assert.equal((await read()).pilotage.history.length, 2);
  // A shared arrival time exercises the archive's secondary cursor (voyage number).
  db.exec('UPDATE harborStores SET salt=32');
  for (let n = 0; n < 8; n++) {
    const next = await commissionTrip();
    await send(oak, 'sail', { ...ship, charter: next, course: 'survey' });
    await arrive(next);
  }
  db.exec('UPDATE pilotSoundings SET at=1000');
  const firstPage = await request('/api/pilots', 200);
  assert.equal(firstPage.history.length, 8);
  assert.equal(firstPage.more, true);
  const secondPage = await request(
    '/api/pilots?before=' + firstPage.history.at(-1).voyage,
    200,
  );
  assert.deepEqual(
    secondPage.history.map((m) => m.voyage),
    [after, survey],
  );
  assert.equal(secondPage.more, false);
  await request('/api/pilots?before=xyz', 400);
  await innAction('leave');
  const archive = await read(smith, '?ship=' + id);
  assert.ok(archive.ship.archived && archive.ship.mayManage);
  assert.equal(archive.ship.completed, 14);
  assert.ok(
    (await request('/api/pilots', 200)).history.every((m) => m.reward === 0),
  );
  // Two later fronts without a sounding return all escrow, including for offline patrons.
  await setSky(3);
  const ed = (await read()).pilotage.edition;
  const gold1 = await balance(oak),
    gold2 = await balance(smith);
  await offer(oak, ed, 31);
  await offer(smith, ed, 4);
  await setSky(3);
  assert.equal(
    (await request(inn, 200, undefined, smith.token)).pilotage.fund.mine,
    4,
  );
  await setSky(0);
  await setSky(3);
  const refund = (await request('/api/pilots', 200)).fund;
  assert.equal(refund.total, 0);
  assert.equal(refund.last.skipper, null);
  assert.equal(refund.last.total, 35);
  await setSky(3);
  assert.equal(await balance(oak), gold1);
  assert.equal(await balance(smith), gold2);
  const newest = (await read()).pilotage.edition;
  const short = await account('szkutnik_bez_sakwy', 'Uczeń');
  db.prepare(
    "UPDATE players SET profile=json_set(profile,'$.gold',2) WHERE username=?",
  ).run(short.credentials.username);
  await offer(short, newest, 3, 409);
  assert.equal((await read(short)).wallet.gold, 2);
  // Two different guild ships report at the very same instant in the fixture.
  await request(
    inn,
    200,
    {
      action: 'create',
      body: 'Cech Mierniczych',
      tag: 'MIAR',
      nonce: randomUUID(),
    },
    smith.token,
  );
  const secondHull = { ship: (await send(smith, 'commission')).ship.hull.id };
  db.exec('UPDATE raftYard SET port=2');
  db.exec('UPDATE harborStores SET salt=8');
  await send(smith, 'oak', secondHull);
  await send(smith, 'oak', secondHull);
  await send(smith, 'iron', secondHull);
  await send(smith, 'launch', { ...secondHull, name: 'Jaskółka' });
  await offer(short, newest, 2);
  await setSky(0);
  const a = await commissionTrip(),
    b = (await send(smith, 'hire', secondHull)).ship.job.id;
  await send(oak, 'sail', { ...ship, charter: a, course: 'survey' });
  await send(smith, 'sail', { ...secondHull, charter: b, course: 'survey' });
  const baseline = await balance(oak);
  db.prepare('UPDATE yardVoyages SET due=? WHERE id IN (?,?)').run(
    Date.now() - 1,
    a,
    b,
  );
  const finish = (await read()).pilotage;
  assert.deepEqual(
    finish.history.slice(0, 2).map((m) => [m.voyage, m.reward]),
    [
      [b, 0],
      [a, 2],
    ],
  );
  assert.equal(finish.fund.last.skipper, 'Jan od dębu');
  assert.equal(await balance(oak), baseline + 18 + 2);
  assert.equal(
    db
      .prepare('SELECT COUNT(*) AS n FROM pilotPledges WHERE voyage=?')
      .get(after).n,
    2,
  );

  // A second player can earn a passage without a hull or a guild. These tests
  // use the existing charter, salt stocks, funds and ship journal.
  db.exec('UPDATE harborStores SET salt=32');
  db.exec('UPDATE pilotBank SET cm=108');
  const measure = await commissionTrip();
  await send(oak, 'sail', { ...ship, charter: measure, course: 'survey' });
  assert.equal((await arrive(measure)).pilotage.latest.cm, 108);
  await logIn(short);
  await send(undefined, 'offerLighter', { fee: 6 }, 401);
  for (const fee of [0, 19, 1.5])
    await send(short, 'offerLighter', { fee }, 409);
  const standing = { fee: 6, nonce: randomUUID() };
  const board = await send(short, 'offerLighter', standing);
  const slot = board.lighterOffers.find((o) => o.own).id;
  assert.equal(
    (await send(short, 'offerLighter', standing)).lighterOffers.length,
    1,
  );
  await send(short, 'offerLighter', { fee: 8 }, 409);
  await send(smith, 'recallLighter', { offer: slot }, 409);
  const run = await commissionTrip();
  const secondRun = (await send(smith, 'hire', secondHull)).ship.job.id;
  const ticketL = {
    ...ship,
    charter: run,
    course: 'cut',
    reference: measure,
    offer: slot,
    nonce: randomUUID(),
  };
  await send(short, 'sail', ticketL, 409);
  await send(oak, 'sail', { ...ticketL, reference: survey }, 409);
  await send(oak, 'sail', { ...ticketL, course: 'outer' }, 409);
  const carrierBalance = await balance(short),
    captainBalance = await balance(oak);
  const harborBefore = await request('/api/harbor-works', 200);
  const booked = await send(oak, 'sail', ticketL);
  assert.equal(booked.wallet.gold, captainBalance - 6);
  assert.deepEqual(booked.ship.job.lighter, {
    name: 'Uczeń',
    fee: 6,
    barrels: 2,
  });
  assert.equal(booked.ship.job.due - booked.ship.job.departed, 48000);
  assert.equal(booked.ship.job.barrels, 4);
  assert.equal(booked.ship.job.depth, 108);
  assert.equal(
    (await send(oak, 'sail', ticketL)).wallet.gold,
    captainBalance - 6,
  );
  await send(
    smith,
    'sail',
    {
      ...secondHull,
      charter: secondRun,
      course: 'cut',
      reference: measure,
      offer: slot,
    },
    409,
  );
  await send(short, 'sail', { ...secondHull, charter: secondRun }, 409);
  await send(short, 'offerLighter', { fee: 9 }, 409);
  await send(oak, 'offerLighter', { fee: 1 }, 409);
  await send(short, 'recallLighter', { offer: slot }, 409);
  await stop();
  await start();
  for (const who of [short, oak, master, smith]) await logIn(who);
  assert.equal((await read(short)).wallet.duty.role, 'lighter');
  assert.equal(await balance(short), carrierBalance);
  await arrive(run);
  const journal = (await read(null, '?ship=' + id)).ship.journal[0];
  assert.equal(journal.lighter.name, 'Uczeń');
  assert.equal(journal.lighter.barrels, 2);
  assert.equal(await balance(short), carrierBalance + 6);
  assert.equal(await balance(oak), captainBalance + 12);
  assert.equal((await read(short)).wallet.duty, null);
  assert.equal(
    (await request('/api/harbor-works', 200)).provisions,
    harborBefore.provisions + 1,
  );
  assert.equal(
    (await send(oak, 'sail', ticketL)).wallet.gold,
    captainBalance + 12,
  );
  await send(short, 'offerLighter', { fee: 18 });
  const later = (await read(short)).lighterOffers.find((o) => o.own).id;
  await send(short, 'recallLighter', { offer: later });
  assert.equal((await read()).lighterOffers.length, 0);
  const expire = (
    await send(smith, 'offerLighter', { fee: 2 })
  ).lighterOffers.find((o) => o.own).id;
  db.prepare('UPDATE yardLighters SET expires=0 WHERE id=?').run(expire);
  assert.equal((await read()).lighterOffers.length, 0);
  assert.equal(await balance(short), carrierBalance + 6);
  // The same ship always carries four barrels overall. Only the division changes.
  // These depths are fixture inputs, never mutations of the shared world.
  for (const [cm, moved] of [
    [103, 0],
    [104, 2],
    [111, 2],
    [112, 1],
    [119, 1],
    [120, 0],
  ]) {
    db.prepare('UPDATE pilotSoundings SET cm=? WHERE voyage=?').run(
      cm,
      measure,
    );
    const posting = await send(oak, 'offerLighter', { fee: 1 });
    const o = posting.lighterOffers.find((x) => x.own);
    const voyage =
      (await read(smith, '?ship=' + secondHull.ship)).ship.job?.id ??
      (await send(smith, 'hire', secondHull)).ship.job.id;
    const order = {
      ...secondHull,
      charter: voyage,
      course: 'cut',
      offer: o.id,
      reference: measure,
    };
    if (!moved) {
      await send(smith, 'sail', order, 409);
      await send(oak, 'recallLighter', { offer: o.id });
    } else {
      const job = (await send(smith, 'sail', order)).ship.job;
      assert.equal(job.lighter.barrels, moved);
      assert.equal(job.due - job.departed, 40000 + 4000 * moved);
      await arrive(voyage);
    }
  }
}
