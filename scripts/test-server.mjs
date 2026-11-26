import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { exerciseInfirmary } from './infirmary-scenario.mjs';
import { exerciseBarter } from './barter-scenario.mjs';
import { exerciseCommonField } from './common-field-scenario.mjs';
import { exerciseShipyard } from './shipyard-scenario.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import test from 'node:test';

test('rejestracja, sesje dwóch kupców i zapis profilu po restarcie', { timeout: 20000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kupiecki-test-'));
  let server;
  let base;
  async function start() {
    server = spawn(process.execPath, ['server.cjs'], {
      env: { ...process.env, HOST: '127.0.0.1', PORT: '0', GAME_DATA_DIR: dir },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    for await (const line of createInterface({ input: server.stdout })) {
      const address = line.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (address) { base = address[0]; return; }
    }
    throw new Error('Serwer zakończył pracę przed startem');
  }
  async function stop() {
    if (!server || server.exitCode !== null || server.signalCode) return;
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  t.after(async () => { await stop(); await rm(dir, { recursive: true, force: true }); });
  async function request(route, status, data, token) {
    const headers = { 'Content-Type': 'application/json', Origin: 'https://rdemb.github.io' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(base + route, {
      method: data ? 'POST' : 'GET', headers, body: data ? JSON.stringify(data) : undefined,
    });
    assert.equal(res.headers.get('access-control-allow-origin'), headers.Origin);
    assert.equal(res.status, status, route);
    return res.json();
  }

  const first = { username: 'kupiec_testowy', password: randomUUID() };
  const second = { username: 'kupiec_drugi', password: randomUUID() };
  await start();
  const preflight = await fetch(base + '/api/profile/sync', {
    method: 'OPTIONS',
    headers: { Origin: 'https://rdemb.github.io', 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-headers'), /Authorization/i);
  const index = await (await fetch(base)).text();
  const asset = index.match(/<script[^>]+src="([^"]+)"/)[1];
  assert.equal((await fetch(base + asset)).status, 200);
  const a = await request('/api/auth/register', 201, first);
  const b = await request('/api/auth/register', 201, second);
  const decree = {requestId:randomUUID(), recipient:b.profile.uid, kind:'bars', value:4, reason:'Za uratowanie karawany'};
  assert.equal((await fetch(base+'/api/court')).status,401);
  assert.equal((await request('/api/court', 200, undefined, a.token)).admin,false);
  const forbidden = await fetch(base+'/api/court/decrees',{method:'POST',headers:{Authorization:'Bearer '+b.token,'Content-Type':'application/json'},body:JSON.stringify(decree)});
  assert.equal(forbidden.status,403);
  execFileSync(process.execPath,['scripts/seat-emperor.mjs',first.username,a.profile.uid],{env:{...process.env,GAME_DATA_DIR:dir}});
  await request('/api/court/decrees',201,decree,a.token);
  await request('/api/court/decrees',200,decree,a.token);
  await request('/api/court/decrees',409,{...decree,value:5},a.token);
  await request('/api/court/decrees',400,{...decree,requestId:randomUUID(),value:-1},a.token);
  await request('/api/court/decrees',201,{...decree,requestId:randomUUID(),kind:'prefix',value:'Sir'},a.token);
  await request('/api/profile/sync',200,{bars:999,prefix:'Imperator',admin:true},b.token);
  const treasury = await request('/api/court',200,undefined,b.token);
  assert.deepEqual(treasury,{bars:4,prefix:'Sir',admin:false,players:[],history:[]});
  assert.equal((await request('/api/court',200,undefined,a.token)).history.length,2);
  await request('/api/auth/register', 409, first);
  await request('/api/auth/login', 401, { ...first, password: randomUUID() });
  await request('/api/profile/sync', 401, { title: 'Kupiec północy' });
  await request('/api/profile/sync', 200, { title: 'Kupiec północy' }, a.token);
  assert.equal((await request('/api/auth/me', 200, undefined, b.token)).profile.title, b.profile.title);
  const state = await request('/api/state', 200);
  assert.equal(state.registeredPlayers.length, 2);
  const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws');
  try {
    const msg = await once(ws, 'message');
    assert.equal(JSON.parse(msg[0].data).type, 'init');
    const received = once(ws, 'message');
    ws.send(JSON.stringify({ type: 'chat:send', payload: { id: 'test_chat', text: 'Przybyła karawana' } }));
    assert.equal(JSON.parse((await received)[0].data).type, 'chat:new');
  } finally { ws.close(); }
  await request('/api/auth/logout', 200, {}, b.token);
  await request('/api/auth/me', 401, undefined, b.token);
  const work={action:'start',id:randomUUID(),site:'mierzeja'};
  await request('/api/careers',401,work);
  const ledger=await request('/api/careers',200,work,a.token);
  await request('/api/careers',200,work,a.token);
  await request('/api/careers',409,{...work,id:randomUUID(),site:'solanki'},a.token);
  assert.deepEqual((await request('/api/careers',200)).jobs,[]);
  await stop();
  await start();
  const restored = await request('/api/state', 200);
  assert.ok(restored.chatMessages.some((m) => m.id === 'test_chat'));
  assert.deepEqual(restored.markets, state.markets);
  const logged = await request('/api/auth/login', 200, first);
  let lastPatron;
  for(let i=0;i<9;i++){
    const job=i===0?ledger.jobs[0]:(await request('/api/careers',200,{...work,id:randomUUID()},logged.token)).jobs[0];
    assert.notEqual(job.patron,lastPatron);lastPatron=job.patron;
    const finish={action:'finish',id:job.id,site:job.site,choice:job.task};
    await request('/api/careers',409,{...finish,choice:(job.task+1)%3},logged.token);
    const [delivery]=await Promise.all([request('/api/careers',200,finish,logged.token),request('/api/careers',200,finish,logged.token)]);
    assert.equal(delivery.progress.bursztynnik,i+1);
  }
  const publicBook=await request('/api/careers',200);
  assert.equal(publicBook.stocks.mierzeja,3+5*2+3);
  assert.equal(publicBook.marks[0].craft,'bursztynnik');
  assert.deepEqual(publicBook.progress,{});
  for (const [site,solutions,count] of [['panwie',[1,2,0],4],['pochylnia',[2,0,1],5]]) {
    for(let i=0;i<count;i++){
      const job=(await request('/api/careers',200,{...work,id:randomUUID(),site},logged.token)).jobs[0];
      const finish={id:job.id,site,choice:solutions[job.task],action:'finish'};
      await request('/api/careers',200,finish,logged.token);
      await request('/api/careers',200,finish,logged.token);
    }
  }
  const fleet=await request('/api/careers',200);
  assert.equal(fleet.sailings,1);
  assert.equal(fleet.lastShipment.site,'pochylnia');
  assert.equal(fleet.stores.szkutnik,1);
  const court = await request('/api/court',200,undefined,logged.token);
  assert.equal(court.admin,true);
  assert.equal(court.players.find(p=>p.uid===b.profile.uid).bars,4);
  assert.equal(restored.registeredPlayers.find(p=>p.uid===b.profile.uid).prefix,'Sir');
  assert.equal(logged.profile.uid, a.profile.uid);
  assert.equal(logged.profile.title, 'Kupiec północy');
  await request('/api/auth/me', 401, undefined, a.token);
  const renter = await request('/api/auth/login',200,second);
  async function order(token,action,params={},status=200) {
    return request('/api/provinces/orders',status,{nonce:randomUUID(),action,...params},token);
  }
  // Use the same live server routes that the scales and the provincial office use.
  const readPort = token => request('/api/weighhouse', 200, undefined, token);
  const seal = (token, slip, status) => request('/api/weighhouse/seal',status,slip,token);
  const third = await request('/api/auth/register',201,{username:'kupiec_trzeci',password:randomUUID()});
  let guest = await readPort();
  if (guest.closes-guest.now < 5000) {
    await new Promise(resolve => setTimeout(resolve,guest.closes-guest.now+50));
    guest=await readPort();
  }
  assert.equal(guest.count,0);
  await seal(null,{watch:guest.watch,mass:guest.sample},401);
  async function sample(token) {
    const {watch,sample:mass} = await readPort(token);
    return {watch,mass};
  }
  const slip = await sample(logged.token);
  await seal(logged.token,{...slip,mass:slip.mass===1?2:1},422);
  await seal(logged.token,{...slip,watch:slip.watch-1},409);
  await seal(logged.token,slip,201);
  const retry = await seal(logged.token,slip,200);
  assert.equal(retry.count,1); assert.equal(retry.signed,true);
  const registry = async token => request('/api/provinces',200,undefined,token);
  const grant = (uid,value)=>request('/api/court/decrees',201,{...decree,requestId:randomUUID(),recipient:uid,value},logged.token);
  await grant(a.profile.uid,14);
  await order(logged.token,'petition',{name:'Port Solny',site:'krolewska_przystan'});
  await order(renter.token,'petition',{name:'Leśny Dwór',site:'srebrny_gaj'});
  const [port,forest]=(await registry(logged.token)).towns.map(t=>t.id);
  assert.equal((await registry()).towns.length,0);
  await order(renter.token,'approve',{town:forest},400);
  await order(logged.token,'approve',{town:forest});
  await order(logged.token,'approve',{town:port});
  assert.equal((await request('/api/court',200,undefined,renter.token)).bars,0);
  await order(logged.token,'found',{town:port},400);
  const testDb=new DatabaseSync(path.join(dir,'game.sqlite'));
  try {
    const send = async(town,cargo,expectedSeconds) => {
      const before = Date.now();
      await order(renter.token,'dispatch',{town,cargo});
      const job = (await registry(renter.token)).freight;
      assert.ok(job.due>=before+expectedSeconds*1000 && job.due<=Date.now()+expectedSeconds*1000);
      return job.due;
    };
    const initialDue = await send(port,'wood',60);
    const works = token => request('/api/harbor-works',200,undefined,token);
    const work = (token,action,status=201,nonce=randomUUID()) =>
      request('/api/harbor-works',status,{action,nonce},token);
    const land = () => testDb.exec('UPDATE harborShifts SET due=0');
    assert.equal((await works()).food,0);
    await work(null,'fish',401);
    await work(logged.token,'boil',409);
    const fishing = randomUUID();
    await work(logged.token,'fish',201,fishing);
    await work(logged.token,'fish',200,fishing);
    await work(logged.token,'ship',409,fishing);
    await work(logged.token,'fish',409);
    assert.equal((await works()).workers.length,1);
    assert.equal((await works()).mine,null);
    land();
    assert.equal((await works()).food,4);
    assert.equal((await works()).food,4);
    await Promise.all([work(renter.token,'boil'),work(third.token,'boil')]);
    await work(logged.token,'boil',409);
    assert.equal((await works()).food,0);
    assert.equal((await works()).salt,0);
    land();
    assert.equal((await works()).salt,4);
    const exportSlips = [randomUUID(),randomUUID()];
    const shippers = [logged.token,third.token];
    const outcomes = await Promise.all(shippers.map((token,i) => fetch(base+'/api/harbor-works',{
      method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({action:'ship',nonce:exportSlips[i]})})));
    assert.deepEqual(outcomes.map(x=>x.status).sort(),[201,409]);
    const winner = outcomes.findIndex(x=>x.status===201);
    await work(shippers[winner],'ship',200,exportSlips[winner]);
    assert.equal((await works()).shipments,1);
    assert.equal((await works()).provisions,1);
    assert.equal((await works()).salt,0);
    assert.equal((await registry(renter.token)).freight.due,initialDue);
    // An inland dispatch leaves the paid team waiting for the next port waybill.
    await order(third.token,'dispatch',{town:forest,cargo:'iron'});
    assert.equal((await works()).provisions,1);
    const secondSlip=await sample(renter.token), thirdSlip=await sample(third.token);
    await Promise.all([seal(renter.token,secondSlip,201),seal(third.token,thirdSlip,201)]);
    assert.equal((await registry(renter.token)).freight.due,initialDue);
    await Promise.all([seal(renter.token,secondSlip,200),seal(third.token,thirdSlip,200)]);
    const released=await readPort();
    assert.equal(released.count,3);assert.equal(released.signatures.length,3);
    const lines=(await request('/api/provinces/chronicle',200)).entries;
    assert.equal(lines.filter(row=>row.story.includes('Trzej kupcy')).length,1);
    assert.equal(released.signed,false);
    testDb.prepare('UPDATE freight SET due=0 WHERE carrier=?').run(b.profile.uid);
    await order(renter.token,'arrive',{town:port});
    for(const town of [port,forest]) {
      for(const cargo of (town===port ? ['iron','wood','iron'] : ['wood','iron','wood','iron'])){
        const reserve = (await works()).provisions;
        await send(town,cargo,town===port ? (reserve ? 15 : 30) : 60);
        if (town===port) assert.equal((await works()).provisions,0);
        await order(renter.token,'arrive',{town},400);
        testDb.prepare('UPDATE freight SET due=0 WHERE carrier=?').run(b.profile.uid);
        await order(renter.token,'arrive',{town});
      }
    }
    await order(logged.token,'found',{town:port});
    assert.equal((await request('/api/court',200,undefined,logged.token)).bars,0);
    await order(logged.token,'invite',{town:forest,toll:7});
    await order(logged.token,'accept',{town:forest},400);
    await order(renter.token,'accept',{town:forest});
    await order(logged.token,'dispatch',{town:forest,cargo:'handel'});
    testDb.prepare('UPDATE freight SET due=0 WHERE carrier=?').run(a.profile.uid);
    const receipt={action:'arrive',town:forest,nonce:randomUUID()};
    await request('/api/provinces/orders',200,receipt,logged.token);
    await request('/api/provinces/orders',200,receipt,logged.token);
    assert.deepEqual((await registry()).towns.map(t=>t.treasury),[94.4,5.6]);
    const honour={...decree,requestId:randomUUID(),kind:'prefix',value:'Sir',site:'srebrny_gaj'};
    await request('/api/court/decrees',201,honour,logged.token);
    await request('/api/court/decrees',200,honour,logged.token);
    const latest=(await request('/api/provinces/chronicle',200)).entries[0];
    assert.match(latest.story,/Sir/);
    await order(logged.token,'witness',{town:latest.id});
    assert.equal((await request('/api/provinces/chronicle',200)).entries[0].witnesses.length,1);
    await work(third.token,'fish');
    await stop();await start();
    assert.equal((await works()).workers.length,1);
    land();
    assert.equal((await works()).food,4);
    assert.equal((await works()).shipments,1);
    assert.equal((await works()).provisions,0);
    assert.equal((await readPort()).count,3);
    assert.deepEqual((await registry()).towns.map(t=>t.treasury),[94.4,5.6]);
    const captain = (await request('/api/auth/login', 200, first)).token;
    const merchant = (await request('/api/auth/login', 200, second)).token;
    const hall = '/api/inn/krolewska_przystan';
    const room = token => request(hall, 200, undefined, token);
    const act = (token, action, data={}, status=200) => request(hall,status,{nonce:randomUUID(),action,...data},token);
    assert.equal((await room(captain)).membership, '');
    const charter = {nonce:randomUUID(),body:'Bractwo Rzeki',tag:'RZEKA'};
    const founded = await act(captain,'create',charter);
    const guild = founded.membership;
    assert.ok(guild);
    assert.equal((await act(captain,'create',charter)).membership,guild);
    await act(captain,'letter',{groupId:guild,body:'Ruszamy o świcie.'});
    assert.deepEqual((await room()).letters,[]);
    await act(merchant,'apply',{groupId:guild});
    assert.deepEqual((await room(merchant)).letters,[]);
    assert.equal((await room(captain)).applicants[0].uid,b.profile.uid);
    await act(captain,'accept',{who:b.profile.uid});
    const joined = await room(merchant);
    assert.equal(joined.groups.find(g=>g.id===guild).count,2);
    assert.equal(joined.letters[0].body,'Ruszamy o świcie.');
    assert.equal(JSON.stringify(await request('/api/state',200)).includes('Ruszamy o świcie.'),false);
    const privateCheck = new WebSocket(base.replace('http:', 'ws:')+'/ws');
    try { assert.equal((await once(privateCheck,'message'))[0].data.includes('Ruszamy o świcie.'),false); }
    finally { privateCheck.close(); }
    const intended = (await readPort()).count===3 ? 28500 : 57000;
    const departedAt=Date.now();
    await order(captain,'dispatch',{town:forest,cargo:'handel'});
    const arrival = (await registry(captain)).freight.due;
    assert.ok(arrival>=departedAt+intended && arrival<=Date.now()+intended);
    const ad={kind:'wyprawa',body:'Szukam załogi na północ.',nonce:randomUUID()};
    await act(captain,'post',ad);
    const board=await act(captain,'post',ad);
    assert.equal(board.notices.length,1);
    const notice=board.notices[0].id;
    assert.equal((await request('/api/inn/srebrny_gaj',200)).notices.length,0);
    await act(undefined,'sign',{notice},401);
    await act(merchant,'sign',{notice});
    assert.equal((await room(merchant)).notices[0].volunteered,1);
    await act(merchant,'close',{notice},400);
    await act(merchant,'unsign',{notice});
    assert.deepEqual((await room()).notices[0].signed,[]);
    await act(captain,'close',{notice});
    assert.equal((await room()).notices.length,0);
    await act(captain,'transfer',{who:b.profile.uid});
    await act(captain,'leave');
    assert.deepEqual((await room(captain)).letters,[]);
    await stop();await start();
    const returned=(await request('/api/auth/login',200,second)).token;
    const reopened=await room(returned);
    assert.equal(reopened.groups.find(g=>g.id===guild).founder,b.profile.uid);
    assert.equal(reopened.letters[0].body,'Ruszamy o świcie.');
    await act(returned,'leave');
    assert.ok(!(await room()).groups.some(g=>g.id===guild));
    const mill='/api/mill/krolewska_przystan';
    const view=token=>request(mill,200,undefined,token);
    const sign=(token,action,params={},status=200)=>request(mill,status,{nonce:randomUUID(),action,...params},token);
    const clientA=(await request('/api/auth/login',200,first)).token;
    const clientB=returned;
    const clientC=(await request('/api/auth/register',201,{username:'woznica_test',password:randomUUID()})).token;
    const initialA=(await view(clientA)).wallet,initialB=(await view(clientB)).wallet;
    const draft={purpose:'mill',quantity:30,price:28,nonce:randomUUID()};
    await sign(null,'post',draft,401);
    await sign(clientA,'post',{...draft,quantity:300,price:1000},409);
    const placed=await sign(clientA,'post',draft), grainId=placed.orders.find(x=>x.issuer===initialA.uid).id;
    assert.equal(placed.wallet.gold,initialA.gold-840);
    assert.equal((await sign(clientA,'post',draft)).wallet.gold,initialA.gold-840);
    await sign(clientA,'post',{...draft,price:29},409);
    await sign(clientA,'deliver',{order:grainId,quantity:5},409);
    await sign(clientB,'cancel',{order:grainId},409);
    await request('/api/profile/sync',200,{gold:initialA.gold,inventory:{zboze:initialA.grain}},clientA);
    assert.equal((await view(clientA)).wallet.gold,initialA.gold-840);
    const firstLoad={order:grainId,quantity:7,nonce:randomUUID()};
    const sacks=await sign(clientB,'deliver',firstLoad);
    assert.equal(sacks.wallet.gold,initialB.gold+196);
    assert.equal(sacks.wallet.grain,initialB.grain-7);
    assert.equal(sacks.flour,placed.flour+3);assert.equal(sacks.grain,3);
    await sign(clientB,'deliver',firstLoad);
    const payments=await Promise.all([clientB,clientC].map(token=>fetch(base+mill,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action:'deliver',order:grainId,quantity:23,nonce:randomUUID()})})));
    assert.deepEqual(payments.map(r=>r.status).sort(),[200,409]);
    const allSacks=await view();
    assert.equal(allSacks.flour,placed.flour+21);assert.equal(allSacks.grain,2);
    assert.equal(allSacks.deliveries.length,2);
    assert.equal(allSacks.orders.some(x=>x.id===grainId),false);
    assert.equal(allSacks.wallet,null);
    assert.equal((await request('/api/mill/srebrny_gaj',200)).flour,0);

    // Partial private order, cancellation, and collection into an offline buyer's warehouse.
    const privateOrder=await sign(clientA,'post',{purpose:'merchant',quantity:10,price:31});
    const privateId=privateOrder.orders.find(x=>x.issuer===initialA.uid).id;
    await sign(clientC,'deliver',{order:privateId,quantity:4});
    const cancelled=await sign(clientA,'cancel',{order:privateId});
    assert.equal(cancelled.wallet.gold,initialA.gold-840-4*31);
    assert.equal(cancelled.wallet.grain,initialA.grain+4);
    assert.equal(cancelled.flour,allSacks.flour);
    const idle=await sign(clientA,'post',{purpose:'merchant',quantity:5,price:28});
    const idleId=idle.orders.find(x=>x.issuer===initialA.uid).id;
    testDb.prepare('UPDATE millOrders SET expires=0 WHERE id=?').run(idleId);
    assert.equal((await view(clientA)).wallet.gold,cancelled.wallet.gold);
    assert.equal((await view(clientA)).wallet.gold,cancelled.wallet.gold);

    // Provision is paid once, survives until an actual departure, and lowers only that due time.
    const purse=(await view(clientB)).wallet, provisions={nonce:randomUUID()};
    const bought=await sign(clientB,'ration',provisions);
    assert.equal(bought.wallet.ration,true);assert.equal(bought.wallet.gold,purse.gold-32);
    assert.equal(bought.flour,allSacks.flour-3);
    assert.equal((await sign(clientB,'ration',provisions)).flour,bought.flour);
    await sign(clientB,'ration',{},409);
    const handling=(await readPort()).count===3?30000:60000;
    const beforeTrip=Date.now();
    await order(clientB,'dispatch',{town:port,cargo:'handel'});
    const trip=(await registry(clientB)).freight;
    assert.ok(trip.due>=beforeTrip+handling-5000 && trip.due<=Date.now()+handling-5000);
    assert.equal((await view(clientB)).wallet.ration,false);
    testDb.prepare('UPDATE mills SET bakeryAt=bakeryAt-1200000 WHERE city=?').run('krolewska_przystan');
    const bread=await view();assert.equal(bread.flour,bought.flour-2);assert.equal(bread.baked,bought.baked+2);

    const secondTown='srebrny_gaj';
    let winter=await request('/api/world/season',200,{seasonId:'zima'},clientA);
    if(winter.macro.activeWeather!=='zamiec_i_mroz')winter=await request('/api/world/season',200,{seasonId:'zima'},clientA);
    assert.equal(winter.macro.activeWeather,'zamiec_i_mroz');
    const afterFrost=await request('/api/mill/'+secondTown,200);
    const citySlip=afterFrost.orders.filter(o=>o.issuer===null);
    assert.equal(citySlip.length,1);
    assert.equal(citySlip[0].quantity,30);assert.equal(afterFrost.treasury,60);
    assert.equal((await request('/api/mill/'+secondTown,200)).orders.filter(o=>o.issuer===null).length,1);
    await stop();await start();
    const reload=(await request('/api/auth/login',200,first)).token;
    assert.equal((await view(reload)).wallet.grain,cancelled.wallet.grain);
    assert.equal((await view(reload)).wallet.gold,cancelled.wallet.gold);
    assert.equal((await view()).deliveries.length,3);
    // Two tabs can save gameplay gains around a deposit or refund without replacing either.
    const other=(await request('/api/auth/login',200,first)).token;
    const before=(await view(reload)).wallet;
    const basis={gold:before.gold-before.mark.gold,grain:before.grain-before.mark.grain};
    const save=(token,sequence,gold,grain)=>request('/api/profile/sync',200,{walletSave:{sequence,gold,grain}},token);
    const bill=await sign(reload,'post',{purpose:'merchant',quantity:8,price:32});
    await save(reload,1,basis.gold-15,basis.grain+1);
    const fromOther=await save(other,1,basis.gold-12,basis.grain+2);
    assert.equal(fromOther.profile.gold,before.gold-256-27);
    assert.equal(fromOther.profile.inventory.zboze,before.grain+3);
    assert.equal(fromOther.walletAdjustment.gold,-15);
    const still=await save(other,1,basis.gold-12,basis.grain+2);
    assert.equal(still.profile.gold,fromOther.profile.gold);
    const cancelledId=bill.orders.find(o=>o.issuer===before.uid).id;
    await sign(reload,'cancel',{order:cancelledId});
    await save(other,3,basis.gold-20,basis.grain+2);
    await save(other,2,basis.gold,basis.grain);
    const finalWallet=(await view(reload)).wallet;
    assert.equal(finalWallet.gold,before.gold-35);
    assert.equal(finalWallet.grain,before.grain+3);
    // Real HTTP routes against a private game database. Advance only this fixture's waybills.
    const carrier=(await request('/api/auth/login',200,second)).token;
    const free=(await request('/api/auth/register',201,{username:'wolny_woznica',password:randomUUID()})).token;
    const bridgeUrl='/api/bridge';
    const watch=token=>request(bridgeUrl,200,undefined,token);
    const placeWater = (level, sky='sloneczna_pogoda') =>
      testDb.prepare('UPDATE riverGauge SET level=?,sampled=?,sky=?').run(level,Date.now(),sky);
    async function rainySeason(imperator=reload) {
      await request('/api/world/season',200,{seasonId:'jesien'},imperator);
      // Fast-forward only this disposable river to just before the crest.
      placeWater(169_980,'ulewne_deszcze');
      await watch();
      await new Promise(resolve=>setTimeout(resolve,20));
      await watch();
    }
    const gauge=(token,action,params={},status=200)=>request(bridgeUrl,status,{action,nonce:randomUUID(),...params},token);
    const innAtRiver=()=>request('/api/inn/srebrny_gaj',200);
    await gauge(undefined,'measure',{},401);
    assert.equal((await watch()).reading,null);
    const firstNote=(await gauge(free,'measure',{cm:999,name:'Podszyty'})).reading;
    assert.notEqual(firstNote.cm,999);assert.notEqual(firstNote.name,'Podszyty');
    assert.equal(firstNote.previousCm,null);
    assert.equal((await gauge(free,'measure')).reading.id,firstNote.id);
    assert.equal((await watch(carrier)).reading,null);
    assert.deepEqual((await innAtRiver()).riverReports,[]);
    // Preserve a genuinely private previous mark even after the next is published.
    testDb.prepare('UPDATE riverReadings SET at=at-11000 WHERE id=?').run(firstNote.id);
    await request('/api/world/season',200,{seasonId:'lato'},reload);
    placeWater(145_500);
    const note=(await gauge(free,'measure')).reading;
    assert.ok(note.cm>=144 && note.cm<=145);
    assert.equal(note.previousCm,firstNote.cm);
    await gauge(carrier,'publishReading',{reading:note.id},409);
    await gauge(free,'publishReading',{reading:firstNote.id},409);
    const paper={reading:note.id,nonce:randomUUID()};
    await gauge(free,'publishReading',paper);await gauge(free,'publishReading',paper);
    let reports=(await innAtRiver()).riverReports;
    assert.equal(reports.length,1);assert.equal(reports[0].at,note.at);
    assert.equal(reports[0].previousCm,null);assert.equal(reports[0].name,firstNote.name);
    assert.deepEqual((await request('/api/inn/krolewska_przystan',200)).riverReports,[]);
    const secondNote=(await gauge(carrier,'measure')).reading;
    await gauge(carrier,'publishReading',{reading:secondNote.id});
    reports=(await innAtRiver()).riverReports;
    assert.equal(reports[0].previousCm,note.cm);assert.equal(reports[0].previousAt,note.at);
    const stale=(await gauge(reload,'measure')).reading;
    testDb.prepare('UPDATE riverReadings SET at=at-45001 WHERE id=?').run(stale.id);
    await gauge(reload,'publishReading',{reading:stale.id},409);
    testDb.prepare('UPDATE riverReadings SET at=at-600001 WHERE id=?').run(note.id);
    assert.equal((await innAtRiver()).riverReports.length,1);
    assert.equal((await innAtRiver()).riverReports[0].previousCm,null);
    await rainySeason();
    const flood=await watch();
    assert.ok(flood.damaged); assert.equal(flood.wallet,null);
    const cycle=flood.cycle;
    const cross=(token,action,params={},status=200)=>request(bridgeUrl,status,{action,nonce:randomUUID(),cycle,...params},token);
    await cross(undefined,'fund',{material:'wood'},401);
    await cross(free,'fund',{material:'wood'},409);
    const founder=(await act(reload,'create',{body:'Cech Mostowy',tag:'MOST'})).membership;
    await act(carrier,'create',{body:'Cech Hutników',tag:'HUTA'});
    const fundedBefore=(await watch(reload)).wallet.gold;
    const firstSlip={material:'wood',nonce:randomUUID()};
    const one=await cross(reload,'fund',firstSlip);
    assert.equal(one.wallet.gold,fundedBefore-48);
    assert.equal((await cross(reload,'fund',firstSlip)).loads.length,1);
    await cross(reload,'fund',{...firstSlip,material:'iron'},409);
    await cross(reload,'fund',{material:'wood'});await cross(reload,'fund',{material:'wood'});
    await cross(reload,'fund',{material:'wood'},409);
    await cross(carrier,'fund',{material:'iron'});const five=await cross(carrier,'fund',{material:'iron'});
    assert.equal(five.loads.length,5);
    // Previously dispatched freight keeps its original price/time. A closed bridge offers a detour.
    testDb.prepare('UPDATE freight SET due=0 WHERE carrier=?').run(a.profile.uid);
    if((await registry(reload)).freight)await order(reload,'arrive',{town:forest});
    await order(reload,'dispatch',{town:forest,cargo:'handel',passage:'bridge'},400);
    await order(reload,'dispatch',{town:forest,cargo:'handel',passage:'detour'});
    const issued=(await registry(reload)).freight;
    assert.equal(issued.road,'detour');assert.equal(issued.duty,7);
    const beforeWages=(await watch(free)).wallet.gold;
    const load=five.loads[0].id;
    const offers=await Promise.all([free,carrier].map(token=>fetch(base+bridgeUrl,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'haul',cycle,load,nonce:randomUUID()})})));
    assert.deepEqual(offers.map(r=>r.status).sort(),[200,409]);
    const driver=offers[0].status===200?free:carrier;
    await cross(driver,'unload',{load},409);
    await cross(driver,'haul',{load:five.loads[1].id},409);
    testDb.prepare('UPDATE bridgeLoads SET due=0 WHERE id=?').run(load);
    assert.equal((await watch()).loads[0].driver,null);
    for(const s of five.loads) {
      await cross(free,'haul',{load:s.id});
      await cross(reload,'unload',{load:s.id},409);
      testDb.prepare('UPDATE bridgeLoads SET due=? WHERE id=?').run(Date.now()-20,s.id);
      const ticket={load:s.id,nonce:randomUUID()};
      await cross(free,'unload',ticket);
      await cross(free,'unload',ticket);
    }
    const rebuilt=await watch(free);
    assert.equal(rebuilt.damaged,false);assert.equal(rebuilt.flag,founder);assert.equal(rebuilt.tag,'MOST');
    assert.equal(rebuilt.wallet.gold,beforeWages+102);
    assert.equal((await watch(reload)).wallet.gold,fundedBefore-144);
    assert.equal(rebuilt.openings.length,1);
    assert.equal(rebuilt.openings[0].builders,'wolny_woznica');
    assert.equal((await registry(reload)).freight.due,issued.due);
    testDb.prepare('UPDATE freight SET due=0 WHERE carrier=?').run(a.profile.uid);
    await order(reload,'arrive',{town:forest});
    const dispatchAndRead=async (expectedDuty)=>{
      await order(reload,'dispatch',{town:forest,cargo:'handel',passage:'bridge'});
      const way=(await registry(reload)).freight;
      assert.equal(way.duty,expectedDuty);assert.equal(way.road,'bridge');
      testDb.prepare('UPDATE freight SET due=0 WHERE carrier=?').run(a.profile.uid);
      await order(reload,'arrive',{town:forest});
    };
    await dispatchAndRead(0);
    assert.match((await request('/api/provinces/chronicle',200)).entries[0].story,/myto 0 zł/);
    testDb.prepare('UPDATE towns SET toll=10 WHERE id=?').run(forest);
    await dispatchAndRead(10);
    await act(reload,'leave');
    testDb.prepare('UPDATE towns SET toll=7 WHERE id=?').run(forest);
    await dispatchAndRead(7);
    assert.equal((await watch()).openings[0].guildName,'Cech Mostowy');
    await request('/api/world/season',200,{seasonId:'lato'},reload);await watch();
    await rainySeason();assert.equal((await watch()).damaged,false);
    await stop();await start();
    assert.equal((await watch()).openings.length,1);
    assert.equal((await innAtRiver()).riverReports[0].id,secondNote.id);
    // A later flood creates a fresh set of contracts but the old names remain on record.
    testDb.exec('UPDATE bridgeState SET opened=1, wet=0');
    await rainySeason((await request('/api/auth/login',200,first)).token);
    const nextFlood=await watch();
    assert.equal(nextFlood.cycle,cycle+1);assert.equal(nextFlood.loads.length,0);assert.equal(nextFlood.openings.length,1);

    {
      // A merchant, a grower and a carrier use real accounts on a private copy of the game.
      const destination='/api/mill/srebrny_gaj';
      const desk=token=>request(destination,200,undefined,token);
      const job=(token,action,params={},status=200)=>request(destination,status,{action,nonce:randomUUID(),...params},token);
      const buyer=(await request('/api/auth/login',200,first)).token;
      const growerProfile={username:'dostawca_zboza',password:randomUUID()};
      const grower=(await request('/api/auth/register',201,growerProfile)).token;
      const driverProfile={username:'przewoznik_zboza',password:randomUUID()};
      const driver=(await request('/api/auth/register',201,driverProfile)).token;
      const [originBuyer,originGrower,originDriver]=await Promise.all([buyer,grower,driver].map(desk));
      const orderTerms={quantity:8,price:20,wage:18};
      const manifest={...orderTerms,nonce:randomUUID()};
      await job(null,'commission',manifest,401);
      await job(buyer,'commission',{...manifest,quantity:21},409);
      const posted=await job(buyer,'commission',manifest);
      const ticket=posted.freight.bills[0].id,item={bill:ticket};
      assert.equal(posted.wallet.gold,originBuyer.wallet.gold-178);
      assert.equal((await job(buyer,'commission',manifest)).wallet.gold,posted.wallet.gold);
      await job(buyer,'commission',{...manifest,wage:21},409);
      await job(buyer,'seal',item,409);
      await job(driver,'depart',{...item,road:'detour'},409);
      const sealed=await job(grower,'seal',item);
      assert.equal(sealed.wallet.grain,originGrower.wallet.grain-8);
      assert.equal(sealed.wallet.gold,originGrower.wallet.gold);
      assert.equal(sealed.flour,originGrower.flour);
      await job(driver,'seal',item,409);
      await job(driver,'withdraw',item,409);
      await job(driver,'depart',{...item,road:'bridge'},409);
      const launch={...item,road:'detour',nonce:randomUUID()};
      const rolling=await job(driver,'depart',launch);
      const route=rolling.freight.bills.find(b=>b.id===ticket);
      assert.equal(route.status,'rolling');assert.equal(route.road,'detour');
      const weatherDelay=rolling.freight.weather==='ulewne_deszcze'?8:rolling.freight.weather==='zamiec_i_mroz'?14:0;
      assert.equal(route.due-route.departed,(24+8+weatherDelay+25)*1000);
      assert.deepEqual((await job(driver,'depart',launch)).freight.bills[0],route);
      assert.equal(rolling.freight.receipts.length,0);
      assert.equal(rolling.flour,originGrower.flour);
      assert.equal(rolling.wallet.gold,originDriver.wallet.gold);
      await job(buyer,'withdraw',item,409);
      const extra=await job(buyer,'commission',orderTerms);
      const otherBill=extra.freight.bills[0].id;
      await job(grower,'seal',{bill:otherBill});
      await job(driver,'depart',{bill:otherBill,road:'detour'},409);
      await order(driver,'dispatch',{town:forest,cargo:'handel'},400);
      const undone=await job(buyer,'withdraw',{bill:otherBill});
      assert.equal(undone.wallet.gold,posted.wallet.gold);
      assert.equal((await desk(grower)).wallet.grain,sealed.wallet.grain);
      const exp=await job(buyer,'commission',orderTerms);
      const expires=exp.freight.bills[0].id;
      await job(grower,'seal',{bill:expires});
      testDb.prepare('UPDATE grainWaybills SET expires=0 WHERE id IN (?,?)').run(ticket,expires);
      assert.equal((await desk(grower)).wallet.grain,sealed.wallet.grain);
      assert.equal((await desk(buyer)).wallet.gold,posted.wallet.gold);
      // A signed trip survives the expiry of its order and the disappearance of all clients.
      await stop();
      testDb.prepare('UPDATE grainWaybills SET due=? WHERE id=?').run(Date.now()-1,ticket);
      await start();
      const login=async(profile)=>(await request('/api/auth/login',200,profile)).token;
      const [buyer2,grower2,driver2]=await Promise.all([first,growerProfile,driverProfile].map(login));
      const received=await desk(driver2);
      assert.equal(received.wallet.gold,originDriver.wallet.gold+18);
      assert.equal((await desk(grower2)).wallet.gold,originGrower.wallet.gold+160);
      assert.equal((await desk(buyer2)).wallet.gold,posted.wallet.gold);
      assert.equal(received.flour,originGrower.flour+6);
      assert.equal(received.grain,originGrower.grain);
      assert.equal(received.freight.bills.length,0);
      const receipt=received.freight.receipts[0];
      assert.equal(receipt.id,ticket);assert.equal(receipt.road,'detour');assert.equal(receipt.driverName,route.driverName);
      assert.equal((await desk()).wallet,null);
      assert.equal((await desk(driver2)).wallet.gold,received.wallet.gold);
      // Open span: two competing carriers cannot claim the same load, including after a repeat.
      testDb.exec("UPDATE bridgeState SET damaged=0,opened=9000000000000");
      const last=await job(buyer2,'commission',{quantity:1,price:3,wage:2});
      const lastId=last.freight.bills[0].id;
      await job(grower2,'seal',{bill:lastId});
      const claims=await Promise.all([driver2,grower2].map(token=>fetch(base+destination,{method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
        body:JSON.stringify({action:'depart',nonce:randomUUID(),bill:lastId,road:'bridge'})})));
      assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);
      assert.equal((await desk()).freight.bills[0].road,'bridge');
      // A guild of two backs one insured cart. Use only this disposable world's clock and bridge.
      testDb.prepare('UPDATE grainWaybills SET due=? WHERE id=?').run(Date.now()-1,lastId);
      await desk();
      const mutualGuild=(await act(buyer2,'create',{body:'Kasa nad Rzeką',tag:'KASA'})).membership;
      await act(grower2,'apply',{groupId:mutualGuild});
      await act(buyer2,'accept',{who:(await desk(grower2)).wallet.uid});
      const fund=(page)=>page.freight.insurance.guilds.find(g=>g.id===mutualGuild);
      const capital=(page)=>page.freight.insurance.holdings.find(g=>g.guild===mutualGuild);
      const manager=(token,op,options={},status=200)=>job(token,op,{guild:mutualGuild,...options},status);
      const quoteTerms={fee:4,cover:30};
      await manager(grower2,'tariff',quoteTerms,409);
      await manager(driver2,'pledge',{amount:30},409);
      const pledge={amount:18,nonce:randomUUID()};
      const wealth=(await desk(buyer2)).wallet.gold;
      assert.equal((await manager(buyer2,'pledge',pledge)).wallet.gold,wealth-18);
      assert.equal((await manager(buyer2,'pledge',pledge)).wallet.gold,wealth-18);
      await manager(buyer2,'pledge',{...pledge,amount:19},409);
      await manager(grower2,'pledge',{amount:12});
      const quoted=await manager(buyer2,'tariff',quoteTerms);
      const quote=fund(quoted).quote;
      assert.equal(fund(quoted).free,30);
      const loadBill=async()=>{
        const bill=(await job(buyer2,'commission',{quantity:2,price:5,wage:7})).freight.bills[0].id;
        await job(grower2,'seal',{bill});
        return bill;
      };
      await request('/api/world/season',401,{seasonId:'lato'});
      await request('/api/world/season',403,{seasonId:'lato'},driver2);
      await request('/api/world/season',200,{seasonId:'lato'},buyer2);
      testDb.exec('UPDATE bridgeState SET damaged=0,wet=0,opened=0');
      placeWater(100_000);
      const insured=await loadBill();
      const coins=(await desk(driver2)).wallet.gold;
      const departure={bill:insured,road:'bridge',quote,nonce:randomUUID()};
      await job(driver2,'depart',{bill:insured,road:'detour',quote},409);
      const underway=await job(driver2,'depart',departure);
      assert.equal(underway.wallet.gold,coins-4);
      const beforeRoute=underway.freight.bills.find(row=>row.id===insured);
      assert.equal(beforeRoute.cover,30);assert.equal(beforeRoute.fee,4);
      assert.equal(beforeRoute.crosses,beforeRoute.departed+(beforeRoute.due-beforeRoute.departed)/2);
      assert.equal(fund(underway).free,0);assert.equal(fund(underway).locked,30);
      assert.equal((await job(driver2,'depart',departure)).wallet.gold,coins-4);
      await job(driver2,'depart',{...departure,quote:quote+1},409);
      assert.equal(capital(await desk(buyer2)).locked,18);
      await manager(buyer2,'redeem',{amount:1},409);
      const uncovered=await loadBill();
      await job(grower2,'depart',{bill:uncovered,road:'bridge',quote},409);
      await job(grower2,'depart',{bill:uncovered,road:'bridge'});
      await manager(buyer2,'suspendCover');
      const rain=await request('/api/world/season',200,{seasonId:'jesien'},buyer2);
      assert.equal(rain.macro.activeWeather,'ulewne_deszcze');
      assert.equal((await watch()).damaged,false);
      await rainySeason(buyer2);
      const during=await desk(driver2);
      const reroute=during.freight.bills.find(row=>row.id===insured);
      assert.equal(reroute.road,'detour');assert.ok(reroute.floodAt>=beforeRoute.departed && reroute.floodAt<reroute.crosses);
      assert.equal(reroute.due,beforeRoute.due+25000);assert.equal(reroute.paid,null);
      assert.equal(during.wallet.gold,coins-4);
      assert.equal(during.freight.bills.find(row=>row.id===uncovered).road,'detour');
      assert.equal(during.freight.bills.find(row=>row.id===uncovered).insurer,null);
      assert.equal((await desk()).freight.bills.find(row=>row.id===insured).due,reroute.due);
      await stop();
      testDb.prepare('UPDATE grainWaybills SET due=? WHERE id IN (?,?)').run(Date.now()-1,insured,uncovered);
      await start();
      const [master3,grower3,driver3]=await Promise.all([first,growerProfile,driverProfile].map(login));
      const after=await desk(driver3);
      assert.equal(after.wallet.gold,coins-4+7+30);
      assert.equal(after.freight.receipts.find(row=>row.id===insured).paid,30);
      assert.equal(fund(after).trips,1);assert.equal(fund(after).claims,1);assert.equal(fund(after).paid,30);
      assert.equal(fund(after).locked,0);assert.equal(fund(after).free,4);
      assert.equal((await desk(driver3)).wallet.gold,after.wallet.gold);
      assert.equal(capital(await desk(master3)).free,2);
      assert.equal(capital(await desk(grower3)).free,2);
      await manager(master3,'pledge',{amount:26});
      await request('/api/world/season',200,{seasonId:'lato'},master3);
      testDb.exec('UPDATE bridgeState SET damaged=0,wet=0,opened=0');
      placeWater(100_000);
      const later=(await job(master3,'commission',{quantity:1,price:2,wage:6})).freight.bills[0].id;
      await job(grower3,'seal',{bill:later});
      const revised=fund(await manager(master3,'tariff',{fee:3,cover:30})).quote;
      await job(driver3,'depart',{bill:later,road:'bridge',quote},409);
      const safe=(await job(driver3,'depart',{bill:later,road:'bridge',quote:revised})).freight.bills[0];
      // The far bank has already been reached when the next flood is observed.
      testDb.prepare('UPDATE grainCrossings SET crosses=? WHERE bill=?').run(Date.now()-1,later);
      await rainySeason(master3);
      const past=(await desk()).freight.bills[0];
      assert.equal(past.road,'bridge');assert.equal(past.floodAt,null);assert.equal(past.due,safe.due);
      testDb.prepare('UPDATE grainWaybills SET due=? WHERE id=?').run(Date.now()-1,later);
      const clean=await desk(driver3);
      assert.equal(clean.freight.receipts.find(row=>row.id===later).paid,0);
      assert.equal(fund(clean).free,33);assert.equal(fund(clean).locked,0);
      assert.equal(fund(clean).trips,2);assert.equal(fund(clean).claims,1);
      assert.deepEqual((await desk()).freight.insurance.holdings,[]);
      // Contributors keep their free coin after leaving and after the guild is dissolved.
      await act(grower3,'leave');
      await act(master3,'leave');
      const funds=capital(await desk(grower3)).free;
      const oldGold=(await desk(grower3)).wallet.gold;
      assert.equal((await manager(grower3,'redeem',{amount:funds})).wallet.gold,oldGold+funds);
      assert.equal(fund(await desk()).quote,null);
    }
    // One forest stock funds both river and bridge contracts. All clock adjustments are fixture-only.
    {
    const patron=(await request('/api/auth/login',200,first)).token;
    const skipper=(await request('/api/auth/login',200,second)).token;
    const driverLogin={username:'flisak_z_gaju',password:randomUUID()};
    const rival=(await request('/api/auth/register',201,driverLogin)).token;
    await act(patron,'create',{body:'Cech Flisaków',tag:'SPL'});
    testDb.exec("UPDATE bridgeState SET damaged=1,wet=0,cycle=cycle+1; UPDATE raftYard SET forest=3,port=0");
    testDb.prepare('UPDATE raftYard SET cutAt=?').run(Date.now());
    const broken=await watch(patron);
    const fundWood=()=>gauge(patron,'fund',{cycle:broken.cycle,material:'wood'});
    const stock=(await fundWood()).rafting;
    assert.equal(stock.forest,2); assert.equal(stock.neededAtBridge,2);
    const bid=stock.offer;
    const quote={offer:bid,nonce:randomUUID()};
    placeWater(85_000);
    await gauge(skipper,'launchRaft',quote,409);
    placeWater(188_000);
    await gauge(skipper,'launchRaft',quote,409);
    assert.equal((await watch()).rafting.forest,2);
    placeWater(142_000);
    await gauge(undefined,'launchRaft',quote,401);
    await gauge(skipper,'launchRaft',{offer:bid+1},409);
    const people=[skipper,rival];
    const balances=await Promise.all(people.map(async t=>(await watch(t)).wallet.gold));
    const papers=[quote,{offer:bid,nonce:randomUUID()}];
    const race=await Promise.all(people.map((t,i)=>fetch(base+bridgeUrl,{method:'POST',
      headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},
      body:JSON.stringify({action:'launchRaft',...papers[i]})})));
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);
    const winner=race.findIndex(r=>r.ok);
    const embarked=await gauge(people[winner],'launchRaft',papers[winner]);
    assert.equal(embarked.wallet.gold,balances[winner]-60);
    assert.equal(embarked.rafting.forest,0);assert.equal(embarked.rafting.runs.length,1);
    assert.equal(embarked.rafting.inbound,2);assert.equal(embarked.rafting.offer,bid-8);
    assert.ok(embarked.rafting.runs[0].own);
    assert.equal((await watch(people[1-winner])).rafting.runs[0].own,false);
    await gauge(patron,'fund',{cycle:broken.cycle,material:'wood'},409);
    testDb.prepare('UPDATE raftYard SET cutAt=?').run(Date.now()-240_001);
    assert.equal((await fundWood()).rafting.forest,0);
    const run=embarked.rafting.runs[0];
    await stop(); await start();
    const returned=(await request('/api/auth/login',200,winner===0?second:driverLogin)).token;
    assert.equal((await watch(returned)).rafting.runs[0].id,run.id);
    testDb.prepare('UPDATE raftRuns SET due=? WHERE id=?').run(Date.now()-50,run.id);
    const landed=await watch(returned);
    assert.equal(landed.wallet.gold,balances[winner]-60+bid);
    assert.equal(landed.rafting.port,2);assert.equal(landed.rafting.inbound,0);
    assert.equal(landed.rafting.arrivals[0].id,run.id);
    assert.equal((await gauge(returned,'launchRaft',papers[winner])).wallet.gold,landed.wallet.gold);
    assert.equal((await watch()).rafting.port,2);
    const port='/api/harbor-works', invoice={action:'ship',nonce:randomUUID()};
    testDb.exec('UPDATE harborStores SET salt=4');
    const teams=(await request(port,200)).provisions;
    const ship=await request(port,201,invoice,returned);
    assert.equal(ship.timber,1);assert.equal(ship.provisions,teams+2);
    assert.equal((await request(port,200,invoice,returned)).timber,1);
    assert.equal((await watch()).rafting.offer,bid-4);
    testDb.exec('UPDATE raftYard SET port=5, forest=4');
    placeWater(120_000);
    assert.equal((await watch()).rafting.offer,null);
    await gauge(returned,'launchRaft',{offer:bid},409);
    }
    const currentEmperor=(await request('/api/auth/login',200,first)).token;
    await exerciseShipyard({request,db:testDb,start,stop,imperator:currentEmperor});
    await exerciseCommonField({request,db:testDb,start,stop});
    await exerciseBarter({request,db:testDb,start,stop,emperorLogin:()=>request('/api/auth/login',200,first)});
    await exerciseInfirmary({request,db:testDb,start,stop});
  } finally {testDb.close();}
});
