const questions = require('./classroom-questions.cjs');
const {QuestionDeck} = require('./classroom-question-deck.cjs');
const SUBJECTS = { toan: 'Toán', tiengviet: 'Tiếng Việt', doivui: 'Đố vui' };
const clean = (s, max = 40) => String(s || '').normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').slice(0, max).trim();
const fold = s => clean(s, 240).normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();

class Classroom {
  constructor({ now = Date.now, saved = {}, onChange = () => {}, deck = new QuestionDeck({questions}) } = {}) {
    this.now = now; this.onChange = onChange;
    this.settings = { questionSeconds: saved.settings?.questionSeconds ?? 35, monitorCoins: saved.settings?.monitorCoins ?? 10 };
    this.students = new Map(); this.queue = []; this.priorityRun = 0; this.stage = null;
    this.monitor = null;
    this.lesson = { number: 1, question: 0, ended: false, endsAt: null, summary: null };
    this.log = []; this.seq = 0; this.deck=deck; this.round = deck.servedCount; this.paused = false;
    this.running=true;this.frozenAt=null;
    this.lastSeen = new Map(); this.startQuestion();
  }
  emit(text, kind = 'info', details = {}) {
    this.log.unshift({ id: ++this.seq, text, kind, at: this.now(), ...details });
    this.log.length = Math.min(30, this.log.length);
  }
  clockNow(){return this.frozenAt??this.now();}
  syncClock(){
    if(this.paused||!this.running){if(this.frozenAt===null)this.frozenAt=this.now();return;}
    if(this.frozenAt===null)return;
    const elapsed=this.now()-this.frozenAt;
    if(this.question.endAt!==null)this.question.endAt+=elapsed;
    if(this.question.startedAt!==undefined)this.question.startedAt+=elapsed;
    if(this.stage)this.stage.until+=elapsed;
    if(this.lesson.ended)this.lesson.endsAt+=elapsed;
    this.queue.forEach(q=>q.at+=elapsed);this.frozenAt=null;
  }
  setRunning(running){
    if(this.running===running)return;
    if(!running&&!this.paused)this.tick();
    this.running=running;this.syncClock();
    if(running&&!this.paused&&!this.question.revealed&&!this.question.exhausted&&!this.lesson.ended)this.announceQuestion();
  }
  announceQuestion(){
    const q=this.question;
    this.emit(`Câu ${this.round}: ${SUBJECTS[q.subject]}.`, 'question', {round:this.round,prompt:q.text,options:q.options,challenge:q.challenge,challengeGoal:q.challengeGoal});
  }
  player(input) {
    const id = clean(input.id || input.uniqueId || input.name, 80);
    if (!id) throw new Error('Thiếu ID người chơi.');
    let p = this.students.get(id);
    if (!p) {
      if (this.students.size >= 200) throw new Error('Lớp đã đủ 200 học sinh trong phiên này.');
      p = { id, name: clean(input.name || id), team: this.students.size % 3, score: 0, correct: 0, gifts: 0, credits: 0, creditsUntil: 0, lessonCorrect: 0, lessonScore: 0, streak: 0, bestStreak: 0, fastest: 0, applauseUntil: 0, reportAt: null };
      this.students.set(id, p);
      this.emit(`${p.name} vừa vào lớp.`, 'join');
    }
    p.name = clean(input.name || p.name); return p;
  }
  startQuestion() {
    const keys = Object.keys(SUBJECTS);
    const subject = keys[this.round % keys.length];
    const next=this.deck.pick(subject);
    this.answers = new Map(); this.answerTimes = new Map(); this.winners = [];
    if(!next){
      this.question={subject,text:'Đã hết câu hỏi mới',options:[],round:this.round,endAt:null,revealed:false,exhausted:true};
      this.emit('Đã dùng hết kho câu hỏi. Bổ sung câu mới để tiếp tục; không tự lặp lại câu cũ.','notice');return;
    }
    this.round=this.deck.servedCount;
    this.lesson.question++;
    this.question = {...next,round:this.round,endAt:this.clockNow()+this.settings.questionSeconds*1000,revealed:false,startedAt:this.clockNow(),challenge:this.lesson.question%5===0,challengeGoal:Math.min(10,Math.max(1,Math.ceil(this.students.size/2)))};
    this.announceQuestion();
  }
  finishLesson() {
    if(this.lesson.ended)return;
    const people=[...this.students.values()];
    const top=people.filter(p=>p.lessonCorrect>0).sort((a,b)=>b.lessonCorrect-a.lessonCorrect).slice(0,3).map(p=>({id:p.id,name:p.name,correct:p.lessonCorrect,score:p.lessonScore}));
    const teams=[0,1,2].map(t=>people.filter(p=>p.team===t).reduce((sum,p)=>sum+p.lessonScore,0));
    const best=Math.max(...teams);
    const winningTeams=best>0?teams.flatMap((score,i)=>score===best?[i]:[]):[];
    this.lesson={...this.lesson,ended:true,endsAt:this.clockNow()+15000,summary:{top,teams,winningTeams}};
    this.emit(`Hết tiết ${this.lesson.number}! ${top.length?`Tuyên dương ${top[0].name} với ${top[0].correct} câu đúng.`:'Cả lớp cùng cố gắng ở tiết sau nhé.'} ${winningTeams.length?`Chúc mừng tổ ${winningTeams.map(t=>t+1).join(' và tổ ')} dẫn đầu thi đua.`:''} Tiết mới bắt đầu sau mười lăm giây.`, 'lesson');
  }
  startLesson() {
    this.lesson={number:this.lesson.number+1,question:0,ended:false,endsAt:null,summary:null};
    for(const p of this.students.values()){p.lessonCorrect=0;p.lessonScore=0;}
    this.startQuestion();
  }
  advanceQuestion() {
    if(this.lesson.ended)this.startLesson();
    else if(this.lesson.question>=10)this.finishLesson();
    else this.startQuestion();
  }
  reveal() {
    if(this.question.exhausted)return;
    if (this.question.revealed) return;
    this.question.revealed = true; this.question.endAt = this.clockNow() + 8000;
    this.emit(`Đáp án ${'ABCD'[this.question.correct]} — ${this.question.options[this.question.correct]}.`, 'answer', {round:this.round,explain:this.question.explain,winners:this.winners});
  }
  hand(p) {
    if(!this.running)return 'Chờ mở lớp trước khi đăng ký lên bảng.';
    if (this.stage?.id === p.id) return 'Bạn đang ở trên bảng.';
    if (this.queue.some(q => q.id === p.id)) return 'Bạn đã đăng ký lên bảng rồi.';
    const priority = p.credits > 0 && p.creditsUntil > this.now();
    if (priority) p.credits--;
    this.queue.push({ id: p.id, priority, at: this.now() });
    this.emit(`${p.name} đăng ký lên bảng${priority ? ' · ưu tiên' : ''}.`, 'hand');
    this.pickStudent(); return 'Đã đăng ký lên bảng.';
  }
  pickStudent() {
    if (this.stage || this.paused || !this.running || !this.queue.length) return;
    const normal = this.queue.findIndex(q => !q.priority);
    const premium = this.queue.findIndex(q => q.priority);
    const index = premium >= 0 && (this.priorityRun < 2 || normal < 0) ? premium : normal;
    const entry = this.queue.splice(index, 1)[0];
    this.priorityRun = entry.priority ? this.priorityRun + 1 : 0;
    this.stage = { ...entry, until: this.now() + 18000 };
    this.emit(`Mời ${this.students.get(entry.id).name} lên bảng!`, 'stage');
  }
  answer(p, text) {
    if(this.question.exhausted)return 'Đã hết câu hỏi mới. Chờ bổ sung kho câu hỏi.';
    if (this.paused) return 'Lớp đang tạm dừng.';
    if(!this.running)return 'Chờ mở lớp để bắt đầu trả lời.';
    if (this.question.revealed || this.now() >= this.question.endAt) return 'Đã hết giờ trả lời.';
    if (this.answers.has(p.id)) return 'Mỗi câu chỉ được trả lời một lần.';
    const index = 'ABCD'.indexOf(text.toUpperCase());
    if (index < 0) return 'Trả lời A, B, C hoặc D.';
    this.answers.set(p.id, index);
    this.answerTimes.set(p.id, this.now() - this.question.startedAt);
    return 'Đã nhận đáp án; kết quả được công bố khi hết giờ.';
  }
  // Score only on reveal: correct options never leak through live score changes.
  scoreRound() {
    if(this.question.exhausted)return;
    if (this.question.scored) return;
    this.question.scored = true;
    for (const p of this.students.values()) {
      if (this.answers.get(p.id) === this.question.correct) {
        p.score += 10; p.correct++; p.lessonCorrect++; p.lessonScore+=10;
        p.streak++;p.bestStreak=Math.max(p.bestStreak,p.streak);
        this.winners.push({ id:p.id, name:p.name, elapsed:this.answerTimes.get(p.id)||0,streak:p.streak });
      } else p.streak=0;
    }
    this.winners.sort((a,b)=>a.elapsed-b.elapsed);
    if(this.winners.length)this.students.get(this.winners[0].id).fastest++;
    if(this.question.challenge)this.emit(this.winners.length>=this.question.challengeGoal?`Rung chuông thành công! ${this.winners.length} bạn trả lời đúng, vượt mục tiêu ${this.question.challengeGoal} bạn. Cả lớp cùng vỗ tay!`:`Thử thách rung chuông: ${this.winners.length} trên ${this.question.challengeGoal} bạn đúng. Cả lớp cùng cố gắng lần sau nhé.`, 'challenge');
  }
  comment(input, message) {
    this.tick(); const p = this.player(input); const text = fold(message);
    if (/^[abcd]$/.test(text)) { const result = this.answer(p, text); this.changed(); return result; }
    const normalizeOption=value=>clean(value,240).toLocaleLowerCase('vi').replace(/[.,!?]/g,'').trim();
    const exact=this.question.options.findIndex(value=>normalizeOption(value)===normalizeOption(message));
    const matches=this.question.options.flatMap((value,i)=>fold(value).replace(/[.,!?]/g,'')===text.replace(/[.,!?]/g,'')?[i]:[]);
    const option=exact>=0?exact:matches.length===1?matches[0]:-1;
    if (option >= 0) { const result = this.answer(p, 'ABCD'[option]); this.changed(); return result; }
    if(matches.length>1){this.changed();return 'Có nhiều đáp án giống nhau khi bỏ dấu. Hãy bình luận A, B, C hoặc D để chọn rõ nhé.';}
    if (/^(co oi|chao co|chao ca lop|hello|cam on co)$/.test(text)) {
      if (!this.lastChatAt || this.now()-this.lastChatAt>=5000) {
        this.lastChatAt=this.now();this.emit(`Chào ${p.name}! Cùng trả lời câu hỏi trên bảng nhé. Muốn lên bảng, em bình luận lên bảng.`, 'chat');
      }
      this.changed();return 'Cô đã nghe lời chào của bạn.';
    }
    if (text === 'vao lop' || text === 'diem danh') { this.changed(); return 'Đã điểm danh.'; }
    if (text === 'vo tay' || text === 'co vu') {
      if(p.applauseUntil>0 && p.applauseUntil>this.now()-5000)return 'Đợi một chút rồi cổ vũ tiếp nhé.';
      p.applauseUntil=this.now()+3000;this.changed();return 'Cả lớp thấy bạn đang vỗ tay!';
    }
    if (text === 'thanh tich' || text === 'diem cua toi') {
      const message=`${p.name}: ${p.correct} câu đúng, ${p.score} điểm. Chuỗi tốt nhất ${p.bestStreak} câu. Tiết này đúng ${p.lessonCorrect} câu.`;
      if(p.reportAt===null || this.now()-p.reportAt>=15000){p.reportAt=this.now();this.emit(message,'achievement');}
      this.changed();return message;
    }
    if (text === 'gio tay' || text === 'len bang') {
      if (this.paused) return 'Lớp đang tạm dừng.';
      const result = this.hand(p); this.changed(); return result;
    }
    this.changed(); return 'Bình luận: vào lớp · lên bảng · A/B/C/D hoặc nội dung đáp án.';
  }
  gift(input, { count = 1, coins = 1, name = 'Hoa hồng', eventId } = {}) {
    this.tick();
    if (eventId && this.lastSeen.has(eventId)) return 'Đã xử lý quà này.';
    if (eventId) { this.lastSeen.set(eventId, this.now()); if (this.lastSeen.size > 2000) this.lastSeen.delete(this.lastSeen.keys().next().value); }
    const p = this.player(input);
    const amount = Math.min(1000, Math.max(1, Math.floor(Number(count) || 1)));
    const value = Math.min(100000, Math.max(0, Number(coins) || 0));
    p.gifts += amount; p.credits = Math.min(3, p.credits + amount); p.creditsUntil = this.now() + 600000;
    const queued = this.queue.find(q => q.id === p.id);
    if (queued && !queued.priority) { queued.priority = true; p.credits--; }
    const benefits = ['ưu tiên lượt lên bảng'];
    if (value >= this.settings.monitorCoins) { this.monitor = { id: p.id, until: this.now() + 120000 }; benefits.push('lớp trưởng 2 phút'); }
    if(value>=this.settings.monitorCoins){
      this.emit(`Cảm ơn ${p.name} đã tặng ${amount} ${clean(name,30)}. Chúc mừng lớp trưởng ${p.name}! Mời bạn ngồi bàn danh dự cạnh cô giáo trong hai phút.`, 'monitor');
    }else this.emit(`${p.name} tặng ${amount} ${clean(name, 30)}: ${benefits.join(', ')}.`, 'gift');
    this.changed(); return benefits.join(', ');
  }
  tick() {
    const now = this.now();
    if (this.monitor?.until <= now) this.monitor = null;
    for (const p of this.students.values()) if (p.creditsUntil <= now) p.credits = 0;
    if (this.paused || !this.running) return;
    if (this.stage?.until <= now) this.stage = null;
    this.queue = this.queue.filter(q => now - q.at < 300000);
    this.pickStudent();
    if(this.lesson.ended){if(now>=this.lesson.endsAt)this.startLesson();return;}
    if (!this.question.exhausted && now >= this.question.endAt) {
      if (!this.question.revealed) { this.reveal(); this.scoreRound(); }
      else this.advanceQuestion();
    }
  }
  control(action) {
    if (this.paused && action !== 'pause') throw new Error('Tiếp tục học trước khi điều khiển tiết học.');
    if (action === 'reveal') { this.reveal(); this.scoreRound(); }
    else if (action === 'next') { if(!this.lesson.ended){this.reveal();this.scoreRound();} this.advanceQuestion(); }
    else if (action === 'call') { this.stage = null; this.pickStudent(); }
    else if (action === 'pause') {
      this.paused = !this.paused;
      if (this.paused) this.pausedAt = this.now();
      this.syncClock();
    } else throw new Error('Lệnh điều khiển không hợp lệ.');
    this.changed();
  }
  configure(settings) {
    for (const key of ['questionSeconds', 'monitorCoins']) {
      const value = Number(settings[key]);
      if (!Number.isInteger(value) || value < (key === 'questionSeconds' ? 10 : 1) || value > (key === 'questionSeconds' ? 180 : 100000)) throw new Error('Thiết lập không hợp lệ.');
    }
    Object.assign(this.settings, Object.fromEntries(Object.keys(this.settings).map(k => [k, Number(settings[k])])));
    this.changed();
  }
  changed() { this.onChange(); }
  snapshot() {
    const people = [...this.students.values()];
    const question = { id:this.question.id,exhausted:!!this.question.exhausted,subject: this.question.subject, text: this.question.text, options: this.question.options, round: this.round, endAt: this.question.endAt, revealed: this.question.revealed, answerCount: this.answers.size };
    if (question.revealed) { question.correct = this.question.correct; question.explain = this.question.explain; }
    const person = value => value ? { ...value, name: this.students.get(value.id)?.name } : null;
    const captains=[0,1,2].map(team=>people.filter(p=>p.team===team&&p.lessonCorrect>0).sort((a,b)=>b.lessonCorrect-a.lessonCorrect)[0]).map(p=>p?{id:p.id,name:p.name,correct:p.lessonCorrect}:null);
    const challenge=this.question.challenge?{goal:this.question.challengeGoal,...(question.revealed?{correct:this.winners.length,success:this.winners.length>=this.question.challengeGoal}:{})}:null;
    return { now: this.now(),clockAt:this.clockNow(),waiting:!this.running,lesson:this.lesson,captains,challenge,questionBank:this.deck.stats(), pausedAt: this.pausedAt, paused: this.paused, settings: this.settings, students: people, priorityRun: this.priorityRun, queue: this.queue.map(person), stage: person(this.stage), monitor: person(this.monitor), question, winners: this.winners, log: this.log.slice(0, 12), leaderboard: [...people].sort((a,b) => b.correct-a.correct || b.score-a.score).slice(0, 6), teams: [0,1,2].map(team => people.filter(p => p.team === team).reduce((sum,p) => sum+p.score,0)),lessonTeams:[0,1,2].map(team=>people.filter(p=>p.team===team).reduce((sum,p)=>sum+p.lessonScore,0)) };
  }
}
module.exports = { Classroom, SUBJECTS };
