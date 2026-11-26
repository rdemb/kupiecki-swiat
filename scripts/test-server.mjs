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
});
