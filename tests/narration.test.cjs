const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const {Narrator}=require('../lib/classroom-narrator.cjs');

function narrator(status='error'){
  return Object.assign(Object.create(Narrator.prototype),{status,engine:'edge',format:'mp3',dir:os.tmpdir(),seq:0,seen:0,epoch:0,events:[],announcements:[],jobs:new Map(),voice:'',error:''});
}
test('local Microsoft An receives narration text even when cloud speech fails',()=>{
  const n=narrator();n.speak('Chào Minh Anh!','join',12);
  const state=n.snapshot();assert.equal(state.announcements[0].text,'Chào Minh Anh!');
  assert.equal(state.announcements[0].round,12);assert.equal(state.events.length,0);assert.equal(n.jobs.size,0);
});
test('slow cloud speech never blocks native announcements and text history stays bounded',()=>{
  const n=narrator('ready');for(let i=0;i<6;i++)n.jobs.set(i,{});
  for(let i=0;i<20;i++)n.speak(`Câu hỏi ${i}`,'question',i);
  assert.equal(n.announcements.length,12);assert.equal(n.announcements.at(-1).text,'Câu hỏi 19');assert.equal(n.jobs.size,6);
});
test('reset discards old text without reusing voice IDs',()=>{
  const n=narrator();n.speak('Lớp cũ','join',1);const id=n.announcements[0].id;
  n.reset();assert.equal(n.announcements.length,0);n.speak('Lớp mới','join',2);assert.ok(n.announcements[0].id>id);
});
