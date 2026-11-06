// Run inside the Linux image: npm run test:cloud
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const WebSocket=require('ws');
const {once}=require('node:events');
const {setTimeout:delay}=require('node:timers/promises');

(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'classroom-cloud-'));
  const password=crypto.randomBytes(24).toString('hex'),port=10191,base=`http://127.0.0.1:${port}`,origin='https://classroom.example';
  const child=spawn(process.execPath,['classroom-server.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,PORT:String(port),CLASSROOM_CLOUD:'1',CLASSROOM_PUBLIC_URL:origin,ADMIN_PASSWORD:password,CLASSROOM_DATA_DIR:root,CLASSROOM_PREVIEW:'1',DISABLE_TIKTOK_AUTOCONNECT:'1',CLASSROOM_TTS:process.platform==='win32'?'windows':'edge',CLASSROOM_TTS_OFFLINE:'1'},stdio:['ignore','pipe','pipe']});
  let logs='';for(const stream of [child.stdout,child.stderr])stream.on('data',d=>{logs=(logs+d).slice(-3000);});
  try{
    let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/healthz')).ok){ready=true;break;}}catch{}await delay(100);}
    assert.ok(ready,'Cloud server did not start: '+logs);
    assert.equal((await fetch(base+'/admin',{redirect:'manual'})).headers.get('location'),'/login');
    assert.equal((await fetch(base+'/?obs=1')).status,200);
    assert.equal((await fetch(base+'/api/classroom/session')).status,401);
    assert.equal((await fetch(base+'/api/classroom/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
    const login=await fetch(base+'/api/classroom/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password})});assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const token=(await (await fetch(base+'/api/classroom/session',{headers:{Cookie:cookie,Origin:origin}})).json()).token;
    const headers={Cookie:cookie,Origin:origin,'X-Classroom-Token':token,'Content-Type':'application/json'};
    const post=(route,body)=>fetch(base+'/api/classroom/'+route,{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal((await post('demo',{name:'Học sinh cloud',text:'vào lớp'})).status,200);
    assert.equal((await (await fetch(base+'/api/classroom/state')).json()).teacher,null);
    const ws=new WebSocket(`ws://127.0.0.1:${port}/classroom/ws`,{origin});
    const [frame]=await once(ws,'message');assert.equal(JSON.parse(frame).data.students[0].name,'Học sinh cloud');assert.equal(JSON.parse(frame).data.waiting,true);ws.close();
    const getState=async()=>await (await fetch(base+'/api/classroom/state')).json();
    const adminWs=new WebSocket(`ws://127.0.0.1:${port}/classroom/ws`,{origin,headers:{Cookie:cookie}});
    const [activeFrame]=await once(adminWs,'message'),active=JSON.parse(activeFrame).data;
    assert.equal(active.waiting,false);assert.ok(active.question.endAt-active.clockAt>30000);
    await delay(1100);const counting=await getState();assert.ok(counting.clockAt>active.clockAt+500);
    adminWs.close();await delay(1100);const waiting=await getState();assert.equal(waiting.waiting,true);
    await delay(1100);assert.equal((await getState()).clockAt,waiting.clockAt);
    const badWs=new WebSocket(`ws://127.0.0.1:${port}/classroom/ws`,{origin:'https://evil.example'});
    await once(badWs,'error');
    const history=await (await fetch(base+'/api/classroom/history',{headers})).json();assert.equal(history.usedIds.length,1);
    assert.equal((await post('history/import',history)).status,200);
    let speech;
    for(let i=0;i<120;i++){
      const state=await (await fetch(base+'/api/classroom/state')).json();speech=state.narration.events.find(e=>e.kind==='question');
      if(speech)break;await delay(100);
    }
    assert.ok(speech,'No generated voice event');
    const audio=await fetch(base+speech.url),bytes=Buffer.from(await audio.arrayBuffer());
    assert.equal(audio.status,200);assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.ok(bytes.length>1000);
    const boardWs=new WebSocket(`ws://127.0.0.1:${port}/classroom/ws`,{origin,headers:{Cookie:cookie}});await once(boardWs,'message');
    await post('demo',{name:'Học sinh cloud',kind:'gift',coins:1,count:1});
    assert.equal((await getState()).queue.length,1);assert.equal((await getState()).queue[0].priority,true);
    assert.equal((await getState()).stage,null);
    await post('control',{action:'reveal'});await post('control',{action:'call'});
    const stage=(await getState()).stage;assert.ok(stage);assert.equal(stage.question.correct,undefined);
    await post('demo',{name:'Bạn khác',kind:'comment',text:'A'});assert.equal((await getState()).stage.result,null);
    const [,a,operator,b]=stage.question.text.match(/(\d+) ([+−×]) (\d+)/);
    const value=operator==='+'?+a + +b:operator==='−'?a-b:a*b;
    await post('demo',{name:'Học sinh cloud',kind:'comment',text:String(value)});
    const result=await getState();assert.equal(result.stage.result.outcome,'correct');assert.equal(result.students.find(p=>p.name==='Học sinh cloud').boardCorrect,1);
    assert.ok(result.narration.announcements.some(e=>e.kind==='board-result'&&e.boardId===stage.question.id));
    await post('control',{action:'next'});assert.equal((await getState()).stage,null);boardWs.close();
    await post('demo',{name:'An',kind:'gift',coins:10,count:1});assert.equal((await getState()).teacher.name,'An');
    await post('demo',{name:'Bình',kind:'gift',coins:10,count:1});assert.equal((await getState()).teacher.name,'An');
    await post('demo',{name:'Bình',kind:'gift',coins:1,count:1});assert.equal((await getState()).teacher.name,'Bình');
    assert.equal((await getState()).teacher.coins,11);
    await post('control',{action:'reset'});assert.equal((await getState()).teacher,null);
    assert.equal((await post('logout',{})).status,200);
    assert.equal((await post('control',{action:'reset'})).status,401);
    console.log('PASS: cloud auth, WebSocket, clocks, history, fallback WAV, board turns, and unnamed → top gifter → tie → takeover → reset teacher.');
  }finally{if(child.exitCode===null&&child.signalCode===null){child.kill('SIGTERM');await once(child,'exit');}fs.rmSync(root,{recursive:true,force:true});}
})().catch(err=>{console.error(err);process.exitCode=1;});
