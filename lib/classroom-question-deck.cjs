const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
// Mathematical punctuation is meaningful: 6+4×3 and (6+4)×3 differ.
const normalize = text => String(text).normalize('NFKC').normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/gi,'d').toLowerCase().replace(/[“”„"']/g,'').trim().replace(/[.!?…]+$/g,'').replace(/\s+/g,' ').trim();
const questionId = question => crypto.createHash('sha256').update(normalize(question.text)).digest('hex').slice(0,24);

class QuestionDeck {
  constructor({ questions, history = {}, random = Math.random, persist = () => {}, shuffleOptions = true }) {
    this.questions=questions;this.random=random;this.persist=persist;this.shuffleOptions=shuffleOptions;
    this.used=new Set(history.usedIds || []);this.servedCount=Number(history.servedCount)||this.used.size;
    this.identities=new Map();
    for(const question of questions){
      const id=questionId(question);
      if(this.identities.has(id))throw new Error(`Câu hỏi trùng: ${question.text}`);
      this.identities.set(id,question);
    }
  }
  export(){return {version:1,usedIds:[...this.used],servedCount:this.servedCount};}
  pick(subject,kind='class'){
    const fresh=[...this.identities].filter(([id,q])=>!this.used.has(id)&&(q.kind||'class')===kind);
    if(!fresh.length)return null;
    const preferred=fresh.filter(([,q])=>q.subject===subject);
    const pool=preferred.length?preferred:fresh;
    const [id,question]=pool[Math.min(pool.length-1,Math.floor(this.random()*pool.length))];
    // Commit history before exposing the question; roll back if storage fails.
    this.used.add(id);this.servedCount++;
    try{this.persist(this.export());}catch(err){this.used.delete(id);this.servedCount--;throw err;}
    if(!this.shuffleOptions)return {...question,id};
    const choices=question.options.map((text,index)=>({text,right:index===question.correct}));
    for(let i=choices.length-1;i>0;i--){const j=Math.floor(this.random()*(i+1));[choices[i],choices[j]]=[choices[j],choices[i]];}
    return {...question,id,options:choices.map(c=>c.text),correct:choices.findIndex(c=>c.right)};
  }
  stats(kind){
    const bySubject={};let remaining=0;
    let total=0;
    for(const [id,q] of this.identities){if(kind&&(q.kind||'class')!==kind)continue;total++;bySubject[q.subject] ||= {total:0,remaining:0};bySubject[q.subject].total++;if(!this.used.has(id)){bySubject[q.subject].remaining++;remaining++;}}
    return {total,used:total-remaining,remaining,bySubject};
  }
}
function validateHistory(history){
  if(history.version!==1 || !Array.isArray(history.usedIds) || !history.usedIds.every(id=>typeof id==='string'&&/^[a-f0-9]{24}$/.test(id)) || !Number.isSafeInteger(history.servedCount) || history.servedCount<0)throw new Error('Sai định dạng lịch sử câu hỏi.');
  return history;
}
function loadHistory(file){
  try{
    const history=JSON.parse(fs.readFileSync(file,'utf8'));
    return validateHistory(history);
  }catch(err){if(err.code==='ENOENT')return {};throw new Error(`Không đọc được lịch sử câu hỏi; giữ nguyên file để tránh phát lại câu cũ: ${err.message}`);}
}
function saveHistory(file,history){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temporary=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary,JSON.stringify(history,null,2),'utf8');
  fs.renameSync(temporary,file);
}
module.exports={QuestionDeck,questionId,loadHistory,saveHistory,validateHistory};
