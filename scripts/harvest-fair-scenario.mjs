import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function exerciseHarvestFair({
  request,
  db,
  stop,
  start,
  loaf,
  forge,
  port,
  marta,
  jan,
}) {
  const url = '/api/mill/' + forge;
  const read = (token) => request(url, 200, undefined, token);
  const send = (token, body, status = 200, town = forge) =>
    request('/api/mill/' + town, status, body, token);
  const fresh = async (p) => (await request('/api/auth/login', 200, p.credentials)).token;
  const tabA = await fresh(jan),
    tabB = await fresh(jan),
    baker = await fresh(marta);
  const iron = { action: 'supplyFair', good: 'zelazo', loaf, nonce: randomUUID() };
  const grain = { ...iron, good: 'zboze', nonce: randomUUID() };
  const initial = (await read(tabA)).wallet;
  const opening = (await read()).fair.opening;
  assert.equal(opening.id, loaf);
  assert.deepEqual((await read()).fair.wagons, []);
  await send(undefined, iron, 401);
  await send(tabA, iron, 409, port);
  await send(tabA, { ...iron, loaf: loaf + 1 }, 409);
  await send(tabA, { ...iron, good: 'woda' }, 409);
  const legacyStock = { zelazo: initial.iron };
  const base = {
    gold: initial.gold - initial.mark.gold,
    grain: initial.grain - initial.mark.grain,
  };
  const noOre = await request('/api/auth/register', 201, {
    username: 'terminator_targowy',
    password: randomUUID(),
  });
  await request('/api/profile/sync', 200, { inventory: { zelazo: 0 } }, noOre.token);
  await send(noOre.token, iron, 409);
  const [loaded] = await Promise.all([send(tabA, iron), send(tabA, iron)]);
  assert.equal(loaded.wallet.iron, initial.iron - 1);
  assert.equal(loaded.wallet.mark.iron, -1);
  assert.equal(loaded.fair.wagons.length, 1);
  assert.ok(loaded.fair.now < loaded.fair.wagons[0].arrival);
  await send(baker, { ...iron, nonce: randomUUID() }, 409);
  await send(tabA, { ...iron, good: 'zboze' }, 409);
  // An older open client and a newer client save concurrently around the delivery.
  const previousTab = await request(
    '/api/profile/sync',
    200,
    { walletSave: { ...base, sequence: 1 }, inventory: legacyStock },
    tabB,
  );
  assert.equal(previousTab.profile.inventory.zelazo, initial.iron - 1);
  const acquired = await request(
    '/api/profile/sync',
    200,
    { walletSave: { ...base, sequence: 1, iron: initial.iron + 2 } },
    tabA,
  );
  assert.equal(acquired.profile.inventory.zelazo, initial.iron + 1);
  const oldBuy = await request(
    '/api/profile/sync',
    200,
    { walletSave: { ...base, sequence: 2 }, inventory: { zelazo: initial.iron + 1 } },
    tabB,
  );
  assert.equal(oldBuy.profile.inventory.zelazo, initial.iron + 2);
  assert.equal((await send(tabA, iron)).wallet.iron, initial.iron + 2);
  const before = (await read(baker)).wallet.grain;
  const second = await send(baker, grain);
  assert.equal(second.wallet.grain, before - 1);
  assert.equal(second.fair.wagons.length, 2);
  assert.equal((await request('/api/mill/' + port, 200)).fair.opening, null);
  const arrive = (good) =>
    db
      .prepare('UPDATE harvestFairWagons SET departed=?,arrival=? WHERE town=? AND good=?')
      .run(Date.now() - 2000, Date.now() - 1000, forge, good);
  arrive('zelazo');
  const progress = (await read()).fair;
  assert.deepEqual(
    progress.wagons.filter((w) => w.arrival <= progress.now).map((w) => w.good),
    ['zelazo'],
  );
  arrive('zboze');
  await stop();
  await start();
  const result = (await read()).fair;
  assert.deepEqual(
    result.wagons
      .filter((w) => w.arrival <= result.now)
      .map((w) => w.carrier)
      .sort(),
    [jan.credentials.username, marta.credentials.username].sort(),
  );
  assert.deepEqual((await request('/api/inn/'+forge,200)).fair.wagons,result.wagons);
  assert.equal((await read()).wallet, null);
  assert.ok(result.wagons.every((w) => w.round === opening.round && !('uid' in w)));
  await send(await fresh(jan), { ...iron, nonce: randomUUID() }, 409);
}
