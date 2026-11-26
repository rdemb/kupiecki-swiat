import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
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
  await stop();
  await start();
  const restored = await request('/api/state', 200);
  assert.ok(restored.chatMessages.some((m) => m.id === 'test_chat'));
  assert.deepEqual(restored.markets, state.markets);
  const logged = await request('/api/auth/login', 200, first);
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
  } finally {testDb.close();}
});
