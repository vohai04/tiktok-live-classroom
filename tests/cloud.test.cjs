const {test}=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {createAccess}=require('../lib/classroom-access.cjs');
const {HistoryStore}=require('../lib/classroom-history-store.cjs');
const {QuestionDeck}=require('../lib/classroom-question-deck.cjs');

const origin='https://classroom.example';
async function authApp(t,options={}){
  let time=1000;
  const access=createAccess({cloud:true,password:'test-only-password-123',publicUrl:origin,now:()=>time,...options});
  const app=express();app.use(express.json());
  app.post('/login',access.login);app.get('/session',access.session);
  app.use(access.requireControl);app.post('/logout',access.logout);app.post('/command',(_req,res)=>res.json({ok:true}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(()=>new Promise(r=>server.close(r)));
  return {access,advance(ms){time+=ms;},base:`http://127.0.0.1:${server.address().port}`};
}
test('cloud requires a strong configured password and HTTPS public URL',()=>{
  assert.throws(()=>createAccess({cloud:true,publicUrl:origin}),/ADMIN_PASSWORD/);
  assert.throws(()=>createAccess({cloud:true,password:'test-only-password-123',publicUrl:'http://example.com'}),/https/);
});
test('cloud login issues secure HttpOnly cookie, session CSRF token, and logout revokes access',async t=>{
  const {base}=await authApp(t);
  assert.equal((await fetch(base+'/session')).status,401);
  assert.equal((await fetch(base+'/command',{method:'POST'})).status,401);
  const login=await fetch(base+'/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:'test-only-password-123'})});
  assert.equal(login.status,200);const header=login.headers.get('set-cookie');
  assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=Strict/);
  const cookie=header.split(';')[0];
  const session=await fetch(base+'/session',{headers:{Cookie:cookie,Origin:origin}});
  assert.match(session.headers.get('cache-control'),/no-store/);
  const {token}=await session.json();assert.ok(token);
  assert.equal((await fetch(base+'/command',{method:'POST',headers:{Cookie:cookie,Origin:origin}})).status,403);
  const headers={Cookie:cookie,Origin:origin,'X-Classroom-Token':token};
  assert.equal((await fetch(base+'/command',{method:'POST',headers})).status,200);
  assert.equal((await fetch(base+'/command',{method:'POST',headers:{...headers,Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(base+'/logout',{method:'POST',headers})).status,200);
  assert.equal((await fetch(base+'/command',{method:'POST',headers})).status,401);
});
test('cross-site login and session reads are rejected; repeated wrong passwords are throttled',async t=>{
  const {base,advance}=await authApp(t);
  const login=originValue=>fetch(base+'/login',{method:'POST',headers:{Origin:originValue,'Content-Type':'application/json'},body:'{"password":"wrong"}'});
  assert.equal((await login('https://evil.example')).status,403);
  assert.equal((await fetch(base+'/session',{headers:{Origin:origin,'Sec-Fetch-Site':'cross-site'}})).status,403);
  for(let i=0;i<8;i++)assert.equal((await login(origin)).status,401);
  assert.equal((await login(origin)).status,429);advance(900001);assert.equal((await login(origin)).status,401);
});
test('expired cloud cookies cannot control; local PC access remains loopback-only',async t=>{
  const {base,advance}=await authApp(t);
  const res=await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"test-only-password-123"}'});
  const cookie=res.headers.get('set-cookie').split(';')[0];advance(43200001);
  assert.equal((await fetch(base+'/session',{headers:{Cookie:cookie}})).status,401);
  const local=createAccess({localOrigins:['http://localhost:3000']});
  assert.equal(local.authorized({socket:{remoteAddress:'127.0.0.1'},headers:{}}),true);
  assert.equal(local.authorized({socket:{remoteAddress:'192.168.1.20'},headers:{}}),false);
});
test('HTTPS WebSocket origin is allowed without trusting attacker Host headers',()=>{
  const access=createAccess({cloud:true,password:'test-only-password-123',publicUrl:origin});
  assert.equal(access.wsOriginAllowed(origin),true);
  assert.equal(access.wsOriginAllowed('https://evil.example'),false);
  assert.equal(access.wsOriginAllowed('http://classroom.example'),false);
});
function storeFixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'classroom-store-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  let value=null,fail=false;
  const fetcher=async (_url,opts)=>{
    const command=JSON.parse(opts.body);
    if(fail)return {ok:false};
    if(command[0]==='SET')value=command[2];
    return {ok:true,json:async()=>({result:command[0]==='GET'?value:'OK'})};
  };
  const create=file=>new HistoryStore({file:path.join(root,file),url:'https://classroom-test.upstash.io',token:'test-only-token',fetcher});
  return {create,setFail(v){fail=v;},get value(){return value;},set value(v){value=v;}};
}
test('Redis history survives a fresh filesystem and prevents reusing a question',async t=>{
  const fixture=storeFixture(t),store=fixture.create('first.json');
  const questions=[{subject:'toan',text:'One?',options:['1','2'],correct:0},{subject:'toan',text:'Two?',options:['1','2'],correct:1}];
  const deck=new QuestionDeck({questions,history:await store.load(),persist:h=>store.save(h)});
  const first=deck.pick();await store.flush();
  const secondStore=fixture.create('new-container.json');
  const nextDeck=new QuestionDeck({questions,history:await secondStore.load(),persist:h=>secondStore.save(h)});
  assert.equal(nextDeck.stats().used,1);assert.notEqual(nextDeck.pick().id,first.id);await secondStore.flush();
});
test('failed Redis writes remain dirty and retry without discarding used IDs',async t=>{
  const fixture=storeFixture(t),store=fixture.create('retry.json');await store.load();
  const history={version:1,usedIds:['a'.repeat(24)],servedCount:1};store.save(history);fixture.setFail(true);
  await assert.rejects(store.flush(),/Không lưu/);assert.equal(store.dirty,true);assert.ok(store.snapshot().error);
  fixture.setFail(false);await store.flush();assert.equal(store.dirty,false);assert.equal(store.snapshot().error,'');assert.deepEqual(JSON.parse(fixture.value),history);
});
test('invalid remote history or incomplete credentials never silently start an empty deck',async t=>{
  const fixture=storeFixture(t);fixture.value='{"version":1,"usedIds":"invalid","servedCount":0}';
  await assert.rejects(fixture.create('bad.json').load(),/Sai định dạng/);
  assert.throws(()=>new HistoryStore({file:'unused',url:'https://test.upstash.io'}),/both/);
  assert.throws(()=>new HistoryStore({file:'unused',url:'https://attacker.example',token:'test-only-token'}),/upstash/);
  assert.throws(()=>new HistoryStore({file:'unused',url:'https://attacker.example?host=.upstash.io',token:'test-only-token'}),/upstash/);
});
