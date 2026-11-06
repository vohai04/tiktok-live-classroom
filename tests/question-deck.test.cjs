const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const questions=require('../lib/classroom-questions.cjs');
const {QuestionDeck,questionId,loadHistory,saveHistory}=require('../lib/classroom-question-deck.cjs');
const {Classroom}=require('../lib/classroom-engine.cjs');
const sample=[
 {subject:'toan',text:'Hai cộng ba bằng bao nhiêu?',options:['3','4','5','6'],correct:2,explain:'2 + 3 = 5.'},
 {subject:'tiengviet',text:'Từ trái nghĩa với cao là gì?',options:['thấp','lớn','xa','dài'],correct:0,explain:'Cao và thấp trái nghĩa.'},
];
test('question bank has 120 distinct prompts and one valid answer per question',()=>{
 assert.equal(questions.length,120);assert.equal(new Set(questions.map(questionId)).size,120);
 for(const q of questions){
  assert.ok(['toan','tiengviet','doivui'].includes(q.subject));
  assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(t=>t.toLowerCase())).size,4,q.text);
  assert.ok(Number.isInteger(q.correct)&&q.correct>=0&&q.correct<4,q.text);
  assert.ok(q.explain.length>10,q.text);
 }
});
test('question identity preserves mathematical operators and parentheses',()=>{
 assert.notEqual(questionId({text:'6 + 4 × 3 bằng bao nhiêu?'}),questionId({text:'(6 + 4) × 3 bằng bao nhiêu?'}));
 assert.notEqual(questionId({text:'1/2 + 1/4'}),questionId({text:'1/2 - 1/4'}));
});
test('serves all fresh prompts once and never silently wraps',()=>{
 const deck=new QuestionDeck({questions});const ids=new Set();
 for(let i=0;i<questions.length;i++){
  const q=deck.pick('toan');assert.ok(q);assert.ok(!ids.has(q.id));ids.add(q.id);
  const original=questions.find(p=>questionId(p)===q.id);
  assert.equal(q.options[q.correct],original.options[original.correct],'shuffling must preserve the correct answer');
 }
 assert.equal(deck.pick('toan'),null);assert.equal(deck.stats().remaining,0);
 const restored=new QuestionDeck({questions,history:deck.export()});assert.equal(restored.pick(),null);
});
test('resetting class keeps the used deck and exhausts without a fake question',()=>{
 const deck=new QuestionDeck({questions:sample});const first=new Classroom({deck});
 const second=new Classroom({deck});assert.notEqual(first.question.id,second.question.id);
 const exhausted=new Classroom({deck});assert.equal(exhausted.question.exhausted,true);
 assert.equal(exhausted.question.options.length,0);const count=deck.servedCount;
 exhausted.control('next');exhausted.tick();assert.equal(deck.servedCount,count);
 assert.match(exhausted.comment({id:'a',name:'An'},'A'),/hết câu hỏi/);
});
test('when a selected subject is exhausted another fresh subject is used',()=>{
 const deck=new QuestionDeck({questions:sample});
 assert.equal(deck.pick('toan').subject,'toan');
 assert.equal(deck.pick('toan').subject,'tiengviet');assert.equal(deck.pick('toan'),null);
});
test('adding questions or changing option order does not resurrect used prompts',()=>{
 const deck=new QuestionDeck({questions:sample});deck.pick('toan');deck.pick('tiengviet');
 const revised=[...sample.map(q=>({...q,options:[...q.options].reverse(),correct:3-q.correct})),{...sample[0],text:'Bốn cộng ba bằng bao nhiêu?',options:['5','6','7','8']}];
 const next=new QuestionDeck({questions:revised,history:deck.export()});
 assert.equal(next.stats().remaining,1);assert.equal(next.pick().text,'Bốn cộng ba bằng bao nhiêu?');assert.equal(next.pick(),null);
});
test('history survives a real file reload; corrupt files do not reset silently',()=>{
 const root=path.resolve(__dirname,'../work');fs.mkdirSync(root,{recursive:true});
 const dir=fs.mkdtempSync(path.join(root,'question-history-test-'));const file=path.join(dir,'history.json');
 try{
  const first=new QuestionDeck({questions:sample,persist:h=>saveHistory(file,h)});const q=first.pick();
  const second=new QuestionDeck({questions:sample,history:loadHistory(file),persist:h=>saveHistory(file,h)});
  assert.notEqual(second.pick().id,q.id);
  assert.equal(new QuestionDeck({questions:sample,history:loadHistory(file)}).pick(),null);
  fs.writeFileSync(file,'broken json');assert.throws(()=>loadHistory(file),/Không đọc được lịch sử/);
 }finally{if(fs.existsSync(file))fs.unlinkSync(file);fs.rmdirSync(dir);}
});
test('failed persistence never exposes a question as successfully served',()=>{
 const deck=new QuestionDeck({questions:sample,persist:()=>{throw new Error('disk full');}});
 assert.throws(()=>deck.pick(),/disk full/);assert.equal(deck.stats().used,0);assert.equal(deck.servedCount,0);
});
