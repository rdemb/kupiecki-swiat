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
  await send(oak, 'oak', signed);
  await send(oak, 'iron', signed, 409);
  await send(oak, 'oak', ship);
  assert.equal((await read(oak)).wallet.gold, oakStart - 60);
  await send(oak, 'oak', ship, 409);
  const iron = await send(smith, 'iron', ship);
  assert.equal(iron.oak, 0);
  assert.equal(iron.ship.deliveries.length, 3);
  assert.deepEqual(
    iron.ship.deliveries.map((d) => d.name),
    ['Jan od dębu', 'Jan od dębu', 'Ida z Kuźni'],
  );
  await send(smith, 'launch', { ...ship, name: 'Skowronek' }, 409);
  await send(master, 'launch', { ...ship, name: '??' }, 409);
  const named = await send(master, 'launch', { ...ship, name: 'Skowronek' });
  assert.equal(named.ship.hull.name, 'Skowronek');
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
}
