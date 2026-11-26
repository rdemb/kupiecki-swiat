import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function exerciseStallBargains({ db, request, send, read, oak, master, smith, ship, inn,
  commissionTrip, arrive, start, stop, logIn }) {
  for (const actor of [master, smith]) await logIn(actor);
  const newcomers = await Promise.all(['alicja_na_targu','filip_na_targu','leon_na_targu'].map(async username => {
    const credentials = {username,password:randomUUID()};
    const {token} = await request('/api/auth/register',201,credentials);
    return {token,credentials};
  }));
  const [alice,filip,leon] = newcomers;
  const wallet = async actor => (await request('/api/auth/me',200,undefined,actor.token)).profile;
  const book = async actor => (await request(inn,200,undefined,actor?.token)).launches;
  db.prepare('UPDATE harborStores SET salt=24').run();
  async function replenish() {
    const order = await send(oak,'postReturn',{fee:8,ask:32});
    const offer = order.returns.find(row => row.own).id;
    const charter = await commissionTrip();
    const trip = {...ship,charter};
    await send(smith,'sail',trip);
    await send(smith,'loadReturn',{...trip,offer});
    await arrive(charter);
    return offer;
  }
  let offer = await replenish();
  const offerPrice = (actor, ask, status=200, extra={}) => send(actor,'bidReturn',{offer,quote:32,ask,...extra},status);
  const pending = async actor => (await book(actor)).stallBids.filter(b=>b.offer===offer && b.state==='open');
  const original = await wallet(alice);
  await offerPrice(null,26,401);
  for (const value of [0,32,33,2.5]) await offerPrice(alice,value,409);
  await offerPrice(oak,26,409);
  await offerPrice(alice,26,409,{quote:31});
  const slip = {nonce:randomUUID()};
  await Promise.all([offerPrice(alice,26,200,slip),offerPrice(alice,26,200,slip)]);
  await offerPrice(alice,27,409,slip);
  await offerPrice(alice,25,409);
  const [{id}] = await pending(alice);
  assert.equal((await wallet(alice)).gold,original.gold-26);
  assert.deepEqual((await book(null)).stallBids,[]);
  assert.deepEqual(await pending(leon),[]);
  assert.deepEqual((await pending(oak)).map(b=>b.amount),[26]);
  await send(filip,'recallReturnBid',{offer,bid:id},409);
  await send(alice,'takeReturnBid',{offer,bid:id},409);
  await offerPrice(filip,25);
  await stop(); await start();
  for (const actor of [master,smith,oak,filip,leon]) await logIn(actor);
  // Alice has no active session when the merchant settles her offer.
  assert.deepEqual((await pending(oak)).map(b=>b.amount),[26,25]);
  const seller = await wallet(oak);
  const accepted = {offer,bid:id,nonce:randomUUID()};
  await Promise.all([send(oak,'takeReturnBid',accepted),send(oak,'takeReturnBid',accepted)]);
  await logIn(alice);
  assert.equal((await wallet(alice)).gold,original.gold-26);
  assert.equal((await wallet(alice)).inventory.zboze,original.inventory.zboze+1);
  assert.equal((await wallet(oak)).gold,seller.gold+26);
  assert.equal((await book(alice)).stallBids[0].state,'accepted');
  const ownBid = (await pending(filip))[0];
  const spare = await wallet(filip);
  await send(oak,'refuseReturnBid',{offer,bid:ownBid.id});
  assert.equal((await wallet(filip)).gold,spare.gold+25);
  await offerPrice(filip,24);
  const b = (await pending(filip))[0];
  await send(filip,'recallReturnBid',{offer,bid:b.id});
  await send(filip,'recallReturnBid',{offer,bid:b.id},409);
  const full = (await wallet(filip)).gold;
  await offerPrice(filip,28);
  await send(oak,'repriceReturn',{offer,quote:32,ask:27});
  assert.equal((await wallet(filip)).gold,full);
  assert.equal((await book(filip)).stallBids[0].state,'cheaper');
  await send(filip,'bidReturn',{offer,quote:27,ask:22});
  const decided = (await pending(filip))[0];
  // The shop and the seller both try to dispose of the very same last sack.
  const rival = await wallet(leon);
  const outcomes = await Promise.allSettled([send(leon,'buyReturn',{offer,quote:27}),
    send(oak,'takeReturnBid',{offer,bid:decided.id})]);
  assert.equal(outcomes.filter(row=>row.status==='fulfilled').length,1);
  assert.equal(outcomes.find(row=>row.status==='rejected').reason.actual,409);
  const direct = outcomes[0].status==='fulfilled';
  const proceeds = direct ? 53 : 48;
  const folio = (await book(oak)).freightAccounts.find(row=>row.id===offer);
  assert.deepEqual([folio.remaining,folio.sold,folio.revenue],[0,2,proceeds]);
  assert.equal((await wallet(leon)).gold,rival.gold-(direct ? 27 : 0));
  assert.equal((await wallet(leon)).inventory.zboze,rival.inventory.zboze+(direct ? 1 : 0));
  assert.equal((await wallet(filip)).gold,full-(direct ? 0 : 22));
  assert.equal((await wallet(filip)).inventory.zboze,spare.inventory.zboze+(direct ? 0 : 1));
  assert.equal((await wallet(oak)).gold,seller.gold+proceeds);
  offer = await replenish();
  const startGold = (await wallet(filip)).gold;
  await offerPrice(filip,21);
  const timed = (await pending(filip))[0];
  db.prepare('UPDATE stallBids SET expires=0 WHERE id=?').run(timed.id);
  await read();
  assert.equal((await book(filip)).stallBids[0].state,'expired');
  assert.equal((await wallet(filip)).gold,startGold);
  await offerPrice(filip,20);
  await send(filip,'buyReturn',{offer,quote:32});
  assert.equal((await wallet(filip)).gold,startGold-32);
  assert.deepEqual(await pending(filip),[]);
  await offerPrice(filip,21);
  const alreadyHeld = await wallet(filip);
  await send(oak,'collectReturn',{offer});
  await stop(); await start(); await logIn(filip); await logIn(oak);
  assert.equal((await wallet(filip)).gold,alreadyHeld.gold+21);
  assert.equal((await book(filip)).stallBids[0].state,'closed');
  assert.deepEqual((await book(null)).stallBids,[]);
  const partial = (await book(oak)).freightAccounts.find(row=>row.id===offer);
  assert.deepEqual([partial.remaining,partial.sold,partial.revenue],[0,1,32]);
}
