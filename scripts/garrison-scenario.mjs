import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

// Use only the disposable game database provided by the server scenario.
export async function exerciseGarrison({
  read,
  send,
  request,
  db,
  stop,
  start,
  town,
  other,
  circle,
  terms,
}) {
  const recruit = (unit, quantity) => ({ action: 'recruitUnit', unit, quantity });
  const duty = (unit) => ({ action: 'knightDuty', unit });
  const letter = { action: 'carryNews', circle, escort: true, nonce: randomUUID() };
  const inn = async (city) => (await request('/api/inn/' + city, 200)).newsLetters;
  assert.equal((await read()).garrison.mine, null);
  assert.deepEqual(await inn(other), []);
  await send(-1, duty('guards'), 401);
  await send(3, recruit('guards', 1), 409);
  await send(3, letter, 409, other);
  await send(3, letter, 409);
  const funding = { action: 'fundGarrison', level: 0, nonce: randomUUID() };
  await send(3, funding, 409, 'srebrny_gaj');
  const before = (await read(3)).wallet;
  const [funded] = await Promise.all([send(3, funding), send(3, funding)]);
  assert.equal(funded.garrison.mine.level, 1);
  assert.equal(funded.wallet.gold, before.gold - 180);
  assert.equal(funded.wallet.wood, before.wood - 2);
  await send(3, { ...funding, level: 1 }, 409);
  await send(3, recruit('guards', -1), 409);
  await send(3, recruit('guards', 5), 409);
  await send(3, recruit('guards', 1));
  await send(3, recruit('archers', 2));
  const full = await send(3, recruit('axemen', 1));
  assert.equal(full.garrison.mine.available, 0);
  await send(3, recruit('guards', 1), 409);
  assert.deepEqual(full.garrison.mine.counts, { guards: 1, archers: 2, axemen: 1 });
  await send(3, duty('axemen'), 409);
  const march = await send(3, duty('guards'));
  assert.equal(march.wallet.grain, full.wallet.grain - 1);
  assert.equal(march.garrison.mine.marks, 0);
  await send(3, duty('archers'), 409);
  await send(3, letter, 409);
  const finishDuty = () =>
    db
      .prepare('UPDATE knightDuties SET due=? WHERE uid=? AND due>?')
      .run(Date.now() - 1, before.uid, Date.now());
  finishDuty();
  assert.equal((await read(3, other)).garrison.mine.marks, 1);
  await send(3, duty('archers'));
  finishDuty();
  assert.equal((await read(3)).garrison.mine.marks, 3);
  db.prepare('UPDATE garrisonMusters SET at=at-3600001 WHERE uid=?').run(before.uid);
  assert.equal((await read(3)).garrison.mine.available, 4);
  await send(3, recruit('axemen', 1));
  await send(3, duty('axemen'));
  finishDuty();
  assert.equal((await read(3, other)).garrison.mine.marks, 6);
  const [dispatch] = await Promise.all([send(3, letter), send(3, letter)]);
  assert.ok(dispatch.garrison.mine.wagon);
  await send(0, { ...letter, escort: false, nonce: randomUUID() }, 409);
  assert.deepEqual(await inn(other), []);
  assert.deepEqual(await inn(town), []);
  const row = db.prepare('SELECT * FROM marketNews WHERE circle=?').get(circle);
  const weatherDelay = { ulewne_deszcze: 8, zamiec_i_mroz: 14 }[row.weather] ?? 0;
  const { detourSeconds } = await import('../src/economy/bridge.ts');
  assert.equal(
    row.arrival - row.departed,
    ((25 + weatherDelay + (row.road === 'detour' ? detourSeconds : 0)) * 2 - 10) * 1000,
  );
  assert.equal(dispatch.garrison.mine.duty.due - row.departed, 2 * (row.arrival - row.departed));
  assert.equal(dispatch.wallet.grain, before.grain - 5 - 5 - 2);
  // A different merchant supplies the mess. The same receipt cannot fill it twice.
  finishDuty();
  const donor = (await read(2)).wallet;
  const load = {action:'stockKitchen',quantity:4,nonce:randomUUID()};
  await send(-1, load, 401);
  await send(3, {...duty('guards'), ration:'half'}, 409);
  await send(2, {...load, quantity:-1}, 409);
  const [fed] = await Promise.all([send(2,load),send(2,load)]);
  assert.equal(fed.wallet.grain, donor.grain-4);
  assert.equal(fed.garrison.kitchen.portions,8);
  assert.equal((await read(undefined,other)).garrison.kitchen.portions,0);
  await send(3,{...duty('guards'),ration:'invalid'},409);
  const marchOrder = {...duty('guards'),ration:'half',nonce:randomUUID()};
  const half = await send(3,marchOrder);
  assert.equal(half.garrison.mine.fatigue,1);
  assert.equal(half.garrison.kitchen.portions,7);
  assert.equal(half.wallet.grain,dispatch.wallet.grain);
  assert.ok(Math.abs(half.garrison.mine.duty.due - half.garrison.now - 50000)<1000);
  await send(3,{...marchOrder,ration:'extra'},409);
  finishDuty();
  const fullMeal=await send(3,{...duty('archers'),ration:'full'});
  assert.equal(fullMeal.garrison.mine.fatigue,1);
  assert.equal(fullMeal.garrison.kitchen.portions,3);
  finishDuty();
  await send(3,{...duty('archers'),ration:'extra'},409);
  const rested=await send(3,{...duty('guards'),ration:'extra'});
  assert.equal(rested.garrison.mine.fatigue,0);
  assert.equal(rested.garrison.kitchen.portions,0);
  assert.ok(Math.abs(rested.garrison.mine.duty.due - rested.garrison.now - 40000)<1000);
  db.prepare('UPDATE marketNews SET arrival=? WHERE circle=?').run(Date.now() - 1, circle);
  await stop();
  await start();
  assert.deepEqual((await read()).garrison.kitchen,rested.garrison.kitchen);
  const [arrived] = await inn(other);
  assert.equal(arrived.circle, circle);
  assert.equal(arrived.signed, row.signed);
  assert.deepEqual(arrived.terms, terms);
  assert.ok(!('uid' in arrived));
  assert.deepEqual((await read(undefined, other)).garrison.letters, [arrived]);
  assert.deepEqual(await inn(town), []);
}
