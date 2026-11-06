const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Classroom}=require('../lib/classroom-engine.cjs');
const {QuestionDeck}=require('../lib/classroom-question-deck.cjs');
const boardQuestions=require('../lib/classroom-board-questions.cjs');
const classQuestions=require('../lib/classroom-questions.cjs');
const user=name=>({id:name,name});
function fixture(stageBank=boardQuestions){
  let time=1000000;
  const deck=new QuestionDeck({questions:[...classQuestions,...stageBank],random:()=>0,shuffleOptions:false});
  const room=new Classroom({now:()=>time,deck});
  return {room,deck,advance(ms){time+=ms;room.tick();},call(name='An'){room.comment(user(name),'lên bảng');room.control('reveal');room.control('call');}};
}
test('registration waits for the class result; at most one board turn precedes the next class question',()=>{
  const f=fixture(),r=f.room;
  r.comment(user('An'),'lên bảng');r.comment(user('Bình'),'lên bảng');
  assert.equal(r.stage,null);assert.throws(()=>r.control('call'),/Chốt đáp án/);
  f.advance(35000);assert.equal(r.stage,null);f.advance(7999);assert.equal(r.stage,null);
  f.advance(1);assert.equal(r.stage.id,'An');assert.equal(r.stage.until-r.now(),25000);
  r.comment(user('An'),'A');f.advance(10000);
  assert.equal(r.stage,null);assert.equal(r.question.revealed,false);assert.equal(r.lesson.question,2);assert.equal(r.queue[0].id,'Bình');
  f.advance(35000);f.advance(8000);assert.equal(r.stage.id,'Bình');
});
test('only the selected pupil can answer; full-text works; one star never changes class rankings or team points',()=>{
  const f=fixture(),r=f.room;f.call();
  const publicStage=r.snapshot().stage;
  assert.equal(publicStage.question.correct,undefined);assert.equal(publicStage.question.explain,undefined);
  assert.equal(JSON.stringify(publicStage).includes('correct'),false);
  assert.match(r.comment(user('Other'),'A'),/lượt trả bài của An/);assert.equal(r.stage.result,null);
  r.comment(user('Other'),'vỗ tay');assert.ok(r.students.get('Other').applauseUntil>r.now());
  const answer=r.stage.question.options[0];assert.match(r.comment(user('An'),answer),/1 sao/);
  r.comment(user('An'),'A');r.control('reveal');
  const p=r.students.get('An');assert.equal(p.boardCorrect,1);assert.equal(p.boardAttempts,1);
  assert.equal(p.score,0);assert.equal(p.correct,0);assert.deepEqual(r.snapshot().teams,[0,0,0]);
  assert.equal(r.snapshot().stage.question.correct,0);assert.equal(r.stage.result.outcome,'correct');
});
test('wrong answer, timeout and operator skip give no star and always return the pupil to the class',()=>{
  for(const outcome of ['wrong','timeout','skipped']){
    const f=fixture(),r=f.room;f.call();
    if(outcome==='wrong')r.comment(user('An'),'B');
    if(outcome==='timeout'){f.advance(24999);assert.equal(r.stage.result,null);f.advance(1);assert.match(r.comment(user('An'),'A'),/kết thúc/);}
    if(outcome==='skipped')r.control('reveal');
    assert.equal(r.stage.result.outcome,outcome);assert.equal(r.students.get('An').boardCorrect,0);
    f.advance(10000);assert.equal(r.stage,null);assert.equal(r.lesson.question,2);
  }
  const f=fixture();f.call();f.room.control('next');assert.equal(f.room.stage,null);assert.equal(f.room.students.get('An').boardCorrect,0);
});
test('pause plus idle freezes the board timer and excludes frozen time from answer speed',()=>{
  const f=fixture(),r=f.room;f.call();f.advance(3000);r.control('pause');f.advance(60000);
  r.setRunning(false);f.advance(60000);r.control('pause');f.advance(60000);r.setRunning(true);
  assert.equal(r.stage.until-r.now(),22000);f.advance(2000);r.comment(user('An'),'A');
  assert.equal(r.stage.result.elapsed,5000);r.control('pause');f.advance(60000);r.control('pause');
  assert.equal(r.stage.until-r.now(),10000);f.advance(10000);assert.equal(r.stage,null);
});
test('three independently correct board turns earn the scholar title; gifts and skips cannot earn it',()=>{
  const f=fixture(),r=f.room;r.gift(user('An'),{coins:100,count:100});
  assert.equal(r.students.get('An').boardCorrect,0);
  for(let i=0;i<3;i++){f.call();r.comment(user('An'),'A');f.advance(10000);}
  assert.equal(r.students.get('An').boardCorrect,3);assert.equal(r.students.get('An').score,0);
  assert.match(r.comment(user('An'),'thành tích'),/Học sinh bản lĩnh/);
  assert.ok(r.log.some(e=>e.kind==='board-result'&&e.text.includes('Học sinh bản lĩnh')));
});
test('board questions have distinct arithmetic with one correct choice; class and board histories stay separate and survive reload',()=>{
  const f=fixture();assert.equal(boardQuestions.length,120);
  for(const q of boardQuestions){
    const [,a,operator,b]=q.text.match(/(\d+) ([+−×]) (\d+)/);const expected=operator==='+'?+a + +b:operator==='−'?a-b:a*b;
    assert.equal(q.options[q.correct],String(expected));assert.equal(new Set(q.options).size,4);
  }
  f.call();const id=f.room.stage.question.id,history=f.deck.export();
  const deck=new QuestionDeck({questions:[...classQuestions,...boardQuestions],history,random:()=>0,shuffleOptions:false});
  assert.notEqual(deck.pick('toan','stage').id,id);assert.equal(deck.stats('class').used,1);assert.equal(deck.stats('stage').used,2);
  for(let i=0;i<119;i++)deck.pick('toan','stage');assert.equal(deck.pick('toan','stage'),null);assert.ok(deck.pick('toan'));
});
test('exhausted board bank rejects new registration and clears remaining waiters without looping',()=>{
  const f=fixture(boardQuestions.slice(0,1)),r=f.room;r.comment(user('An'),'lên bảng');r.comment(user('Bình'),'lên bảng');
  r.control('reveal');r.control('call');r.comment(user('An'),'A');f.advance(10000);
  assert.match(r.comment(user('Chi'),'lên bảng'),/hết bài/);f.advance(35000);f.advance(8000);
  assert.equal(r.stage,null);assert.equal(r.queue.length,0);assert.equal(r.question.revealed,false);
});

test('failed persistence cannot expose a board task or consume the waiting player',()=>{
  const f=fixture(),r=f.room;r.comment(user('An'),'lên bảng');r.control('reveal');
  f.deck.persist=()=>{throw new Error('storage unavailable');};
  assert.throws(()=>r.control('call'),/storage unavailable/);assert.equal(r.stage,null);assert.equal(r.queue[0].id,'An');
  assert.equal(f.deck.stats('stage').used,0);assert.equal(r.students.get('An').boardAttempts,0);
});
