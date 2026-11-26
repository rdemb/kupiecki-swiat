import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function exerciseBarter({ request, db, stop, start }) {
  const town = 'zelazna_kuznia',
    other = 'krolewska_przystan';
  const buyers = [];
  for (const username of ['Piekarz_Tola', 'Drwal_Bor', 'Kowal_Iwo', 'Kupiec_Leon']) {
    const credentials = { username, password: randomUUID() };
    const { token } = await request('/api/auth/register', 201, credentials);
    buyers.push({ token, credentials });
  }
  const read = (i, city = town) => request('/api/mill/' + city, 200, undefined, buyers[i]?.token);
  const send = (i, cmd, status = 200, city = town) =>
    request('/api/mill/' + city, status, { nonce: randomUUID(), ...cmd }, buyers[i]?.token);
  const lots = [
    { action: 'postBarter', give: 'zboze', giveQty: 4, want: 'drewno_elfickie', wantQty: 2 },
    { action: 'postBarter', give: 'drewno_elfickie', giveQty: 2, want: 'zelazo', wantQty: 3 },
    { action: 'postBarter', give: 'zelazo', giveQty: 3, want: 'zboze', wantQty: 4 },
  ];
  const initial = await Promise.all([0, 1, 2].map(async (i) => (await read(i)).wallet));
  const legacy = (await request('/api/auth/login', 200, buyers[1].credentials)).token;
  await send(-1, lots[0], 401);
  await send(0, { ...lots[0], giveQty: 0 }, 409);
  await send(1, { ...lots[1], giveQty: initial[1].wood + 1 }, 409);
  await send(0, lots[0], 409, 'srebrny_gaj');
  const first = { ...lots[0], nonce: randomUUID() };
  await Promise.all([send(0, first), send(0, first)]);
  await send(0, { ...first, giveQty: 3 }, 409);
  await send(0, lots[0], 409);
  assert.equal((await read(0)).wallet.grain, initial[0].grain - 4);
  await send(1, lots[1]);
  const base = initial[1];
  await request(
    '/api/profile/sync',
    200,
    {
      walletSave: { sequence: 1, gold: base.gold, grain: base.grain, iron: base.iron },
      inventory: { drewno_elfickie: base.wood },
    },
    legacy,
  );
  assert.equal((await read(1)).wallet.wood, base.wood - 2, 'old tab cannot return the deposit');
  const abroad = await send(2, lots[2], 200, other);
  assert.equal((await read()).barter.waiting.length, 2);
  await send(2, { action: 'withdrawBarter', offer: abroad.barter.waiting[0].id }, 200, other);
  const wrong = await send(2, { ...lots[2], wantQty: 5 });
  assert.equal(wrong.barter.waiting.length, 3);
  assert.equal(wrong.barter.circles.length, 0);
  await send(2, { action: 'withdrawBarter', offer: wrong.barter.waiting.find((o) => o.mine).id });
  const cycle = (await send(2, lots[2])).barter.circles[0];
  function seal(c, i) {
    const offer = c.offers.find((o) => o.give === lots[i].give);
    return { action: 'sealBarter', offer: offer.id, circle: c.id };
  }
  await send(3, seal(cycle, 0), 409);
  await send(0, seal(cycle, 0));
  await send(1, seal(cycle, 1));
  const cancelled = await send(2, { action: 'withdrawBarter', offer: seal(cycle, 2).offer });
  assert.equal(cancelled.wallet.iron, initial[2].iron);
  assert.equal(cancelled.barter.waiting.length, 2);
  assert.ok(cancelled.barter.waiting.every((o) => !o.sealed));
  const next = (await send(2, lots[2])).barter.circles[0];
  assert.notEqual(next.id, cycle.id);
  await send(0, seal(cycle, 0), 409);
  await stop();
  await start();
  for (const b of buyers) b.token = (await request('/api/auth/login', 200, b.credentials)).token;
  await send(1, seal(next, 1));
  await send(2, seal(next, 2));
  // Simulate a failure crediting the last recipient, after earlier wallets were written.
  const changeUid = db.prepare(
    "UPDATE players SET profile=json_set(profile,'$.uid',?) WHERE username='kowal_iwo'",
  );
  changeUid.run('unavailable-test-merchant');
  try {
    await send(0, seal(next, 0), 409);
    assert.equal((await read(0)).wallet.wood, initial[0].wood);
    assert.equal((await read(1)).wallet.iron, initial[1].iron);
    assert.equal((await read()).barter.circles[0].offers.filter((o) => o.sealed).length, 2);
  } finally {
    changeUid.run(initial[2].uid);
  }
  const final = { ...seal(next, 0), nonce: randomUUID() };
  await Promise.all([send(0, final), send(0, final)]);
  await send(2, seal(next, 2), 409);
  const expected = [
    [-4, 2, 0],
    [0, -2, 3],
    [4, 0, -3],
  ];
  for (let i = 0; i < 3; i++) {
    const wallet = (await read(i)).wallet;
    assert.deepEqual(
      ['grain', 'wood', 'iron'].map((k) => wallet[k] - initial[i][k]),
      expected[i],
    );
    assert.equal(wallet.gold, initial[i].gold);
  }
  await stop();
  await start();
  const { barter } = await read();
  assert.equal(barter.circles.length, 0);
  assert.equal(barter.recent.length, 1);
  assert.equal(barter.recent[0].id, next.id);
  assert.ok(barter.recent[0].offers.every((o) => o.sealed && !o.mine && !('owner' in o)));
  assert.deepEqual((await read(undefined, other)).barter, { waiting: [], circles: [], recent: [] });
}
