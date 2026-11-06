const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
class Narrator {
  constructor(onReady) {
    this.onReady = onReady; this.seq=0; this.seen=0; this.epoch=0; this.events=[]; this.jobs=new Map(); this.status='starting'; this.voice=''; this.error=''; this.lastJoin=0;
    this.dir=path.join(__dirname,'..','data','classroom-voice'); fs.mkdirSync(this.dir,{recursive:true});
    const candidates=[process.env.CLASSROOM_POWERSHELL,path.join(process.env.ProgramFiles || 'C:/Program Files','PowerShell/7/pwsh.exe'),path.join(process.env.USERPROFILE || '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe')];
    const command = candidates.find(p=>p&&fs.existsSync(p)) || 'pwsh.exe';
    this.worker=spawn(command,['-NoLogo','-NoProfile','-NonInteractive','-File',path.join(__dirname,'..','scripts','classroom-voice.ps1')],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    createInterface({input:this.worker.stdout}).on('line',line=>{
      try {
        const result=JSON.parse(line);
        if(result.ready) { this.status='ready'; this.voice=result.voice; this.onReady(); return; }
        const job=this.jobs.get(result.id); if(!job)return; this.jobs.delete(result.id);
        if(result.ok && job.epoch===this.epoch) { this.events.push(job); this.events=this.events.slice(-12); this.error=''; }
        else if(!result.ok) this.error=result.error;
        this.onReady();
      } catch {}
    });
    this.worker.stderr.on('data',data=>{this.error=String(data).slice(0,300);});
    this.worker.on('error',err=>{this.status='error';this.error=err.message;});
    this.worker.on('exit',()=>{this.status='error';this.error ||= 'Tiến trình giọng đọc đã dừng.';});
    this.worker.stdin.on('error',err=>{this.status='error';this.error=err.message;});
    process.once('exit',()=>this.worker.kill());
  }
  reset(){this.seen=0;this.events=[];this.jobs.clear();this.epoch++;}
  speak(text,kind='info',round=0){
    if(this.status==='error' || this.jobs.size>=6)return;
    const safe=String(text).replace(/[^\p{L}\p{N}\s.,!?×%:]/gu,' ').replace(/\s+/g,' ').trim().slice(0,650);
    if(!safe)return;
    const key=crypto.createHash('sha256').update(safe).digest('hex').slice(0,24);
    const file=path.join(this.dir,`${key}.wav`), id=++this.seq;
    const job={id,text:safe,kind,round,url:`/classroom-voice/${key}.wav`,at:Date.now(),epoch:this.epoch};
    if(fs.existsSync(file)&&fs.statSync(file).size>44){this.events.push(job);this.events=this.events.slice(-12);return;}
    this.jobs.set(id,job); this.worker.stdin.write(JSON.stringify({id,text:safe,file})+'\n');
  }
  observe(s){
    for(const e of [...s.log].reverse()) {
      if(e.id<=this.seen)continue;this.seen=e.id;
      if(e.kind==='question')this.speak(`${e.challenge?`Thử thách rung chuông! Mục tiêu ${e.challengeGoal} bạn trả lời đúng. `:''}Cả lớp nghe câu hỏi ${e.round||s.question.round}. ${e.prompt||s.question.text} ${(e.options||s.question.options).map((t,i)=>`${'ABCD'[i]}. ${t}`).join('. ')}. Các bạn bình luận đáp án nhé.`,e.kind,e.round||s.question.round);
      else if(e.kind==='answer'){
        const winners=e.winners||s.winners;
        this.speak(`${e.text} ${e.explain || ''} ${winners.length ? `Chúc mừng ${winners.slice(0,3).map(p=>p.name).join(', ')} đã trả lời đúng. ${winners[0].name} nhanh nhất!${winners[0].streak>=3?` Đã đúng liên tiếp ${winners[0].streak} câu.`:''}` : 'Câu này chưa có bạn trả lời đúng. Cùng cố gắng ở câu sau nhé.'}`,e.kind,e.round||s.question.round);
      }
      else if(e.kind==='stage')this.speak(e.text,e.kind,s.question.round);
      else if(e.kind==='chat')this.speak(e.text,e.kind,s.question.round);
      else if(e.kind==='monitor')this.speak(e.text,e.kind,s.question.round);
      else if(e.kind==='notice')this.speak(e.text,e.kind,s.question.round);
      else if(['lesson','challenge','achievement'].includes(e.kind))this.speak(e.text,e.kind,s.question.round);
      else if(e.kind==='gift')this.speak(`Cảm ơn bạn. ${e.text}`,e.kind,s.question.round);
      else if(e.kind==='join'&&Date.now()-this.lastJoin>4500){this.lastJoin=Date.now();this.speak(`Chào ${e.text.replace(' vừa vào lớp.','')}. Chúc bạn học thật vui!`,e.kind,s.question.round);}
    }
  }
  snapshot(){return {status:this.status,voice:this.voice,error:this.error,events:this.events};}
}
module.exports={Narrator};
