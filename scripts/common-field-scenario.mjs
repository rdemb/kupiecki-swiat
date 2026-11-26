import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function exerciseCommonField({request, db, start, stop}) {
  const api = '/api/mill/srebrny_gaj';
  const read = token => request(api,200,undefined,token);
  const people = await Promise.all(['marta_z_miedzy','jan_znad_mlyna'].map(async username => {
    const credentials = {username,password:randomUUID()};
    const {token,profile} = await request('/api/auth/register',201,credentials);
    return {credentials, token, before:profile.inventory.zboze};
  }));
  const [marta,jan] = people;
  const opening = (await read()).field;
  assert.equal(opening.mine,null);
  assert.equal(opening.lastHarvest,null);
  assert.equal(opening.stage,'earth');
  const round = opening.round;
  const send = (p,action,extra={},status=200) => request(api,status,{action,nonce:randomUUID(),round,...extra},p?.token);
  await send(null,'bringSeed',{quantity:1},401);
  await request('/api/mill/krolewska_przystan',409,{action:'bringSeed',round,quantity:1,nonce:randomUUID()},jan.token);
  for (const quantity of [0,1.5,5]) await send(marta,'bringSeed',{quantity},409);
  await send(jan,'voteSow',{},409);
  const slip = {nonce:randomUUID(),quantity:2};
  await Promise.all([send(marta,'bringSeed',slip),send(marta,'bringSeed',slip)]);
  await send(marta,'bringSeed',{...slip,quantity:1},409);
  assert.equal((await read(marta.token)).wallet.grain,marta.before-2);
  await send(jan,'bringSeed',{quantity:1});
  await send(jan,'takeSeed');
  assert.equal((await read(jan.token)).wallet.grain,jan.before);
  await send(jan,'bringSeed',{quantity:1});
  const waiting = await send(marta,'voteSow');
  assert.equal(waiting.field.sown,null);
  assert.equal(waiting.field.votes,1);
  await send(marta,'holdSow');
  assert.equal((await read()).field.votes,0);
  await send(marta,'voteSow');
  const sowing = await send(jan,'voteSow');
  const day = sowing.field.sown;
  assert.equal(day,sowing.field.day);
  await send(jan,'takeSeed',{},409);

  // Advance only the isolated test world's persisted calendar between restarts.
  async function nextDay(n,weatherIndex) {
    await stop();
    db.prepare("UPDATE world SET snapshot=json_set(snapshot,'$.worldDayNumber',?,'$.activeWeatherIndex',?) WHERE id=1").run(day+n,weatherIndex);
    await start();
    return read();
  }
  const weather = [2,4,0,3], stages=['green','green','gold','stubble'];
  for (const [i,w] of weather.entries()) {
    const page = await nextDay(i+1,w);
    assert.equal(page.field.stage,stages[i]);
    assert.equal(page.field.journal.length,i+1);
    assert.equal((await request('/api/state',200)).macro.fieldStage,stages[i]);
    assert.equal((await read()).field.journal.length,i+1);
  }
  const last = (await read()).field;
  assert.deepEqual(last.journal.map(d=>d.points),[3,0,3,1]);
  assert.deepEqual(last.lastHarvest,{day:day+4,seed:3,yield:5,myShare:null});
  for (const [i,p] of people.entries()) {
    p.token = (await request('/api/auth/login',200,p.credentials)).token;
    const receipt = await read(p.token);
    assert.equal(receipt.field.lastHarvest.myShare,[3,2][i]);
    assert.equal(receipt.wallet.grain,p.before+1);
  }
  await send(marta,'bringSeed',slip);
  assert.equal((await read(marta.token)).wallet.grain,marta.before+1);
  const reopened=(await nextDay(8,1)).field;
  assert.equal(reopened.round,round+1);
  assert.equal(reopened.total,0);
  assert.equal(reopened.stage,'earth');
  assert.equal(reopened.lastHarvest.yield,5);
  marta.token=(await request('/api/auth/login',200,marta.credentials)).token;
  await send(marta,'bringSeed',{quantity:1},409);
  assert.equal((await read(marta.token)).wallet.grain,marta.before+1);
}
