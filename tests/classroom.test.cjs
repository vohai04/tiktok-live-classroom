const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Classroom } = require('../lib/classroom-engine.cjs');
const {QuestionDeck}=require('../lib/classroom-question-deck.cjs');
const fixtureQuestions=[
  {subject:'toan',text:'7 × 8 bằng bao nhiêu?',options:['54','56','64','48'],correct:1,explain:'7 × 8 = 56.'},
  {subject:'tiengviet',text:'Có công mài sắt, có ngày nên …',options:['vàng','thép','kim','bạc'],correct:2,explain:'Kiên trì.'},
  {subject:'doivui',text:'Cái gì càng lấy đi thì càng lớn?',options:['Cái túi','Cái hố','Cái cây','Cái bánh'],correct:1,explain:'Cái hố.'},
];
const { normalizeGiftPayload, getGiftComboDelta } = require('../lib/tiktok-gift-payload.cjs');
const user = name => ({ id: name, name });
function fixture() {
  let time = 1000000;
  const room = new Classroom({ now: () => time,deck:new QuestionDeck({questions:fixtureQuestions,random:()=>0,shuffleOptions:false}) });
  return { room, advance(ms) { time += ms; room.tick(); } };
}
function lessonFixture() {
  let time=1000000;
  const bank=Array.from({length:30},(_,i)=>({...fixtureQuestions[i%3],text:`${fixtureQuestions[i%3].text} (bộ ${i})`}));
  const room=new Classroom({now:()=>time,deck:new QuestionDeck({questions:bank,random:()=>0,shuffleOptions:false})});
  return {room,advance(ms){time+=ms;room.tick();}};
}
test('one answer per student; correct answer and scores stay hidden until reveal', () => {
  const { room } = fixture();
  room.comment(user('An'), 'B');
  room.comment(user('An'), 'A');
  assert.equal(room.answers.size, 1);
  assert.equal(room.answers.get('An'), 1);
  assert.equal(room.snapshot().question.correct, undefined);
  assert.equal(room.students.get('An').score, 0);
  room.control('reveal');
  assert.equal(room.students.get('An').score, 10);
  assert.equal(room.snapshot().question.correct, 1);
  room.control('reveal');
  assert.equal(room.students.get('An').score, 10);
});
test('deadline rejects late answers and advances through reveal to a new round', () => {
  const { room, advance } = fixture();
  advance(35000); room.comment(user('An'), 'B');
  assert.equal(room.answers.size, 0);
  assert.equal(room.question.revealed, true);
  advance(8000);
  assert.equal(room.round, 2);
  assert.equal(room.question.revealed, false);
});
test('full text and numeric answers use the same scoring and per-user limit', () => {
  const {room,advance}=fixture();advance(1200);
  room.comment(user('An'),'56');room.comment(user('An'),'A');
  room.control('reveal');assert.equal(room.students.get('An').score,10);assert.equal(room.winners[0].elapsed,1200);
  room.control('next');room.comment(user('Bình'),'KIM');room.control('reveal');assert.equal(room.students.get('Bình').score,10);
});
test('accented full-text answers distinguish Vietnamese words; ambiguous unaccented answers must use a letter',()=>{
  const room=new Classroom({deck:new QuestionDeck({questions:[{subject:'tiengviet',text:'Điền từ: … trọng',options:['trăn','trân','chăn','chân'],correct:1,explain:'Trân trọng.'}],shuffleOptions:false})});
  room.comment(user('Có dấu'),'TRÂN');
  assert.match(room.comment(user('Không dấu'),'tran'),/nhiều đáp án/);
  assert.equal(room.answers.has('Không dấu'),false);
  room.comment(user('Không dấu'),'B');room.control('reveal');
  assert.equal(room.students.get('Có dấu').score,10);assert.equal(room.students.get('Không dấu').score,10);
});
test('two priority students are followed by one ordinary student', () => {
  const { room } = fixture();
  room.comment(user('Đang học'), 'giơ tay');
  room.comment(user('Thường'), 'giơ tay');
  for (const name of ['Ưu tiên 1','Ưu tiên 2','Ưu tiên 3']) {
    room.gift(user(name), { count: 1, coins: 1 });
    room.comment(user(name), 'giơ tay');
  }
  room.control('call'); assert.equal(room.stage.id, 'Ưu tiên 1');
  room.control('call'); assert.equal(room.stage.id, 'Ưu tiên 2');
  room.control('call'); assert.equal(room.stage.id, 'Thường');
  room.control('call'); assert.equal(room.stage.id, 'Ưu tiên 3');
});
test('gift upgrades existing queue entry without duplicating or charging twice', () => {
  const { room } = fixture();
  room.comment(user('Đang học'), 'giơ tay');
  room.comment(user('An'), 'giơ tay');
  room.gift(user('An'), { count: 1, coins: 1, eventId: 'gift-1' });
  room.gift(user('An'), { count: 1, coins: 1, eventId: 'gift-1' });
  assert.equal(room.queue.length, 1);
  assert.equal(room.queue[0].priority, true);
  assert.equal(room.students.get('An').credits, 0);
  assert.equal(room.students.get('An').gifts, 1);
  assert.equal(room.students.get('An').score, 0);
});
test('priority credits are capped and expire', () => {
  const { room, advance } = fixture();
  room.gift(user('An'), { count: 100, coins: 100 });
  assert.equal(room.students.get('An').credits, 3);
  advance(600001);
  assert.equal(room.students.get('An').credits, 0);
});
test('large gifts grant monitor but never a subject-selection privilege', () => {
  const { room, advance } = fixture();
  room.gift(user('An'), { coins: 30 });
  assert.equal(room.monitor.id, 'An');
  assert.ok(room.log.some(e=>e.kind==='monitor'&&e.text.includes('An')&&e.text.includes('bàn danh dự')));
  room.comment(user('An'), 'môn đố vui');
  assert.equal('chooser' in room.snapshot(), false);
  assert.equal('nextSubject' in room.snapshot(), false);
  assert.equal(room.log.some(e=>e.text.includes('chọn môn')),false);
  room.control('next'); assert.equal(room.question.subject, 'tiengviet');
  advance(120001); assert.equal(room.monitor, null);
});
test('pause freezes round deadline; resumes with the remaining time', () => {
  const { room, advance } = fixture();
  advance(5000); room.control('pause'); advance(60000);
  assert.throws(() => room.control('next'), /Tiếp tục học/);
  room.comment(user('An'), 'B'); assert.equal(room.answers.size, 0);
  room.control('pause'); advance(29000); assert.equal(room.question.revealed, false);
  advance(1000); assert.equal(room.question.revealed, true);
});
test('waiting for an operator freezes the question clock instead of leaving a stale zero',()=>{
  const {room,advance}=fixture();room.setRunning(false);advance(300000);
  const waiting=room.snapshot();assert.equal(waiting.waiting,true);
  assert.equal(waiting.question.endAt-waiting.clockAt,35000);
  assert.equal(waiting.question.revealed,false);assert.equal(waiting.questionBank.used,1);
  room.setRunning(true);advance(34999);assert.equal(room.question.revealed,false);
  advance(1);assert.equal(room.question.revealed,true);advance(8000);assert.equal(room.round,2);
});
test('idle and manual pause overlap only freezes time once and keeps answer speed accurate',()=>{
  const {room,advance}=fixture();advance(5000);room.setRunning(false);advance(60000);
  room.control('pause');advance(60000);room.setRunning(true);advance(60000);
  room.control('pause');assert.equal(room.question.endAt-room.now(),30000);
  advance(1000);room.comment(user('An'),'B');room.control('reveal');
  assert.equal(room.winners[0].elapsed,6000);assert.equal(room.students.get('An').score,10);
});
test('waiting during a lesson summary preserves its remaining break time',()=>{
  const {room,advance}=lessonFixture();for(let i=0;i<10;i++)room.control('next');
  assert.equal(room.lesson.ended,true);room.setRunning(false);advance(60000);
  assert.equal(room.lesson.endsAt-room.snapshot().clockAt,15000);
  room.setRunning(true);advance(14999);assert.equal(room.lesson.number,1);
  advance(1);assert.equal(room.lesson.number,2);
});
test('gift combo 1→2→3→final only grants three units, duplicate final is deduped', () => {
  const { room } = fixture(); const tracker = new Map();
  for (const [count,final] of [[1,false],[2,false],[3,false],[3,true],[3,true]]) {
    const gift = normalizeGiftPayload({ giftId: 1, giftName: 'Rose', giftType: 1, repeatCount: count, repeatEnd: final, groupId: 'combo-1', diamondCount: 1 }, 'An');
    const delta = getGiftComboDelta(tracker,gift);
    if (delta>0) room.gift(user('An'), { count:delta, coins:count, eventId:`${gift.groupId}:${gift.repeatCount}` });
  }
  assert.equal(room.students.get('An').gifts, 3);
});
test('settings validate thresholds and reject malformed durations', () => {
  const { room } = fixture();
  assert.throws(()=>room.configure({questionSeconds:1,monitorCoins:10}));
  assert.throws(()=>room.configure({questionSeconds:35,monitorCoins:0}));
  room.configure({questionSeconds:20,monitorCoins:5,subjectCoins:15});
  assert.equal('subjectCoins' in room.settings,false);
  room.control('next'); assert.equal(room.question.endAt-room.now(),20000);
});
test('greeting replies include the player and throttle repeated chat',()=>{
  const {room,advance}=fixture();
  room.comment(user('An'),'cô ơi');room.comment(user('Bình'),'chào cô');
  assert.equal(room.log.filter(e=>e.kind==='chat').length,1);
  assert.match(room.log.find(e=>e.kind==='chat').text,/An/);
  advance(5000);room.comment(user('Bình'),'chào cô');
  assert.equal(room.log.filter(e=>e.kind==='chat').length,2);
});
test('enrollment distributes teams evenly and repeated comments/gifts keep the team',()=>{
  const {room}=fixture();
  for(let i=0;i<9;i++)room.comment(user(`Bạn ${i}`),'vào lớp');
  assert.deepEqual([0,1,2].map(t=>[...room.students.values()].filter(p=>p.team===t).length),[3,3,3]);
  room.comment(user('Bạn 1'),'vào lớp');room.gift(user('Bạn 1'),{coins:30});
  assert.equal(room.students.get('Bạn 1').team,1);assert.equal(room.students.size,9);
});
test('honor ranking counts correct answers and never ranks by gifts',()=>{
  const {room}=fixture();
  room.comment(user('Học sinh giỏi'),'B');room.comment(user('Một câu đúng'),'B');
  room.control('reveal');room.control('next');room.comment(user('Học sinh giỏi'),'kim');room.control('reveal');
  room.gift(user('Người tặng quà'),{count:100,coins:1000});
  const top=room.snapshot().leaderboard;
  assert.equal(top[0].id,'Học sinh giỏi');assert.equal(top[0].correct,2);
  assert.equal(top[1].correct,1);assert.equal(room.students.get('Người tặng quà').correct,0);
});
test('correct streaks settle only on reveal and break on wrong or missed answers',()=>{
  const {room}=lessonFixture();
  for(let i=0;i<3;i++){
    room.comment(user('An'),'ABCD'[room.question.correct]);
    assert.equal(room.students.get('An').streak,i);
    room.control('reveal');assert.equal(room.students.get('An').streak,i+1);
    room.control('reveal');assert.equal(room.students.get('An').score,(i+1)*10);
    room.control('next');
  }
  room.comment(user('An'),'ABCD'[(room.question.correct+1)%4]);room.control('reveal');
  assert.equal(room.students.get('An').streak,0);assert.equal(room.students.get('An').bestStreak,3);
  room.control('next');room.comment(user('An'),'ABCD'[room.question.correct]);room.control('next');
  room.control('reveal');assert.equal(room.students.get('An').streak,0);
});
test('fastest correct answers are ordered by elapsed active time, not enrollment order',()=>{
  const {room,advance}=lessonFixture();
  room.comment(user('Vào trước'),'vào lớp');room.comment(user('Nhanh nhất'),'vào lớp');
  advance(1000);room.control('pause');advance(60000);room.control('pause');
  room.comment(user('Nhanh nhất'),'ABCD'[room.question.correct]);
  advance(500);room.comment(user('Vào trước'),'ABCD'[room.question.correct]);room.control('reveal');
  assert.deepEqual(room.winners.map(p=>[p.id,p.elapsed]),[['Nhanh nhất',1000],['Vào trước',1500]]);
  assert.equal(room.students.get('Nhanh nhất').fastest,1);assert.equal(room.students.get('Vào trước').fastest,0);
});
test('team captains are earned from the current lesson; tied performance keeps enrollment order',()=>{
  const {room}=lessonFixture();
  ['An','Bình','Chi','Dung'].forEach(name=>room.comment(user(name),'vào lớp'));
  room.gift(user('Dung'),{coins:100});assert.equal(room.snapshot().captains[0],null);
  room.comment(user('An'),'ABCD'[room.question.correct]);room.comment(user('Dung'),'ABCD'[room.question.correct]);
  assert.equal(room.snapshot().captains[0],null);room.control('reveal');
  assert.equal(room.snapshot().captains[0].id,'An');
  room.control('next');room.comment(user('Dung'),'ABCD'[room.question.correct]);room.control('reveal');
  assert.equal(room.snapshot().captains[0].id,'Dung');
  assert.equal(room.snapshot().monitor.id,'Dung');
});
test('ten questions lead to a timed lesson summary; next lesson preserves cumulative achievements and question history',()=>{
  const {room,advance}=lessonFixture();
  for(let i=0;i<10;i++){
    room.comment(user('An'),'ABCD'[room.question.correct]);room.control('reveal');room.control('next');
  }
  assert.equal(room.lesson.ended,true);assert.equal(room.round,10);
  assert.equal(room.lesson.summary.top[0].correct,10);
  assert.deepEqual(room.lesson.summary.winningTeams,[0]);
  assert.match(room.comment(user('An'),'B'),/hết giờ/i);
  room.control('pause');advance(30000);assert.equal(room.lesson.ended,true);room.control('pause');
  advance(14999);assert.equal(room.lesson.ended,true);advance(1);
  assert.equal(room.lesson.number,2);assert.equal(room.lesson.question,1);assert.equal(room.round,11);
  const an=room.students.get('An');assert.equal(an.score,100);assert.equal(an.correct,10);assert.equal(an.bestStreak,10);
  assert.equal(an.lessonScore,0);assert.deepEqual(room.snapshot().captains,[null,null,null]);
  assert.equal(room.deck.stats().used,11);
});
test('rung chuong freezes the goal at question start and never leaks correct participation before reveal',()=>{
  const {room}=lessonFixture();
  ['An','Bình','Chi','Dung'].forEach(name=>room.comment(user(name),'vào lớp'));
  for(let i=0;i<4;i++)room.control('next');
  assert.equal(room.snapshot().challenge.goal,2);
  room.comment(user('An'),'ABCD'[room.question.correct]);room.comment(user('Bình'),'ABCD'[room.question.correct]);
  room.comment(user('Đến muộn'),'vào lớp');assert.equal(room.snapshot().challenge.goal,2);
  assert.equal('correct' in room.snapshot().challenge,false);
  room.control('reveal');assert.equal(room.snapshot().challenge.success,true);assert.equal(room.students.get('An').score,10);
  assert.ok(room.log.some(e=>e.kind==='challenge'&&e.text.includes('thành công')));
});
test('applause is throttled, expires, and achievements cannot change scores or replay speech without a cooldown',()=>{
  const {room,advance}=lessonFixture();
  assert.match(room.comment(user('An'),'vỗ tay'),/đang vỗ tay/);
  const until=room.students.get('An').applauseUntil;
  assert.match(room.comment(user('An'),'vỗ tay'),/Đợi/);assert.equal(room.students.get('An').applauseUntil,until);
  advance(8000);assert.match(room.comment(user('An'),'cổ vũ'),/đang vỗ tay/);
  room.comment(user('An'),'thành tích');room.comment(user('An'),'điểm của tôi');
  assert.equal(room.log.filter(e=>e.kind==='achievement').length,1);assert.equal(room.students.get('An').score,0);
  advance(15000);room.comment(user('An'),'thành tích');assert.equal(room.log.filter(e=>e.kind==='achievement').length,2);
});
