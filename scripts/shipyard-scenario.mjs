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
  await innAction('leave');
  const archive = await read(smith, '?ship=' + id);
  assert.ok(archive.ship.archived && archive.ship.mayManage);
  assert.equal(archive.ship.completed, 1);
}
