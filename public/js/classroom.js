(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const subjects = { toan: 'Toán', tiengviet: 'Tiếng Việt', doivui: 'Đố vui' };
  const obs = document.documentElement.classList.contains('obs');
  if(obs)document.title='Lớp học làng — LIVE tự động';
  document.getElementById('soundBtn').textContent='Nghe thử tại bảng điều khiển';
  let sessionToken = '', latest, toastTimer, audio, sound = obs, lastEvent = 0, settingsSignature = '';
  const voiceSeen = new Set();
  let voiceQueue = [], speaking = false, voiceRound = 0, activeSpeech = '';
  let speechMode='audio',browserVoice=null,speechEpoch=0,nativeUtterance=null;
  const voiceProbeUntil=Date.now()+2000;
  let monitorKey='',promotionTimer;
  const speechPlayer = new Audio(); speechPlayer.preload='auto'; speechPlayer.volume=.95;
  const voiceStatus = document.createElement('p');voiceStatus.className='helper';voiceStatus.id='voiceStatus';
  document.querySelector('.teacher-actions').after(voiceStatus);
  $('classroom').append($('modeTag'));
  const socialActions=document.createElement('div');socialActions.className='quick-actions';
  socialActions.innerHTML='<button data-comment="vỗ tay" class="secondary">👏 Vỗ tay</button><button data-comment="thành tích" class="secondary">🏅 Thành tích của tôi</button>';
  document.querySelector('.answer-buttons').after(socialActions);
  const finishSpeech = () => {speaking=false;$('classroom').classList.remove('speaking');playSpeech();};
  speechPlayer.addEventListener('ended',()=>{if(speechMode==='audio')finishSpeech();});speechPlayer.addEventListener('error',()=>{if(speechMode==='audio')finishSpeech();});
  function stopSpeech(){
    speechEpoch++;speechPlayer.pause();speechPlayer.removeAttribute('src');
    if(nativeUtterance){nativeUtterance.onend=null;nativeUtterance.onerror=null;window.speechSynthesis?.cancel();nativeUtterance=null;}
    speaking=false;$('classroom').classList.remove('speaking');
  }
  function findOriginalVoice(){
    browserVoice=window.speechSynthesis?.getVoices().find(v=>/^vi([-_]VN)?$/i.test(v.lang)&&/Microsoft An(?:\b|$)/i.test(v.name))||null;
  }
  findOriginalVoice();
  window.speechSynthesis?.addEventListener('voiceschanged',()=>{findOriginalVoice();if(latest)syncSpeech(latest);});
  async function playSpeech(){
    if(speaking || !sound || !voiceQueue.length || latest?.paused)return;
    const entry=voiceQueue.shift();speaking=true;activeSpeech=entry.text;
    if(speechMode==='native'&&browserVoice){
      const epoch=speechEpoch,utterance=new SpeechSynthesisUtterance(entry.text);nativeUtterance=utterance;
      utterance.voice=browserVoice;utterance.lang='vi-VN';utterance.rate=1.1;utterance.volume=.95;
      utterance.onstart=()=>{if(epoch===speechEpoch)$('classroom').classList.add('speaking');};
      utterance.onend=()=>{if(epoch===speechEpoch){nativeUtterance=null;finishSpeech();}};
      utterance.onerror=event=>{
        if(epoch!==speechEpoch)return;nativeUtterance=null;speaking=false;$('classroom').classList.remove('speaking');
        if(event.error==='not-allowed'){voiceQueue.unshift(entry);text('voiceStatus','Microsoft An đã sẵn sàng. Mở nguồn trong ứng dụng phát có bật tự phát âm thanh.');}
        else playSpeech();
      };
      if(window.speechSynthesis.paused)window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);return;
    }
    speechPlayer.src=entry.url;
    try {await speechPlayer.play();$('classroom').classList.add('speaking');}
    catch {speaking=false;voiceQueue.unshift(entry);text('voiceStatus','Hãy dùng cửa sổ game riêng để âm thanh tự phát.');}
  }
  function syncSpeech(s){
    findOriginalVoice();
    // Keep the existing server-generated Microsoft An audio on the local PC.
    // Render can use the exact same installed voice directly on Windows.
    const mode=s.cloud&&browserVoice?'native':'audio';
    if(mode!==speechMode){stopSpeech();voiceQueue=[];voiceSeen.clear();speechMode=mode;}
    if(voiceRound!==s.question.round){voiceRound=s.question.round;voiceQueue=[];stopSpeech();}
    if(s.paused){if(speechMode==='native')window.speechSynthesis.pause();else speechPlayer.pause();}
    else if(speaking){if(speechMode==='native'){if(window.speechSynthesis.paused)window.speechSynthesis.resume();}else if(speechPlayer.paused)speechPlayer.play().catch(()=>{speaking=false;});}
    if(s.cloud&&!browserVoice&&Date.now()<voiceProbeUntil)return;
    const entries=(speechMode==='native'?s.narration?.announcements||s.narration?.events:s.narration?.events) || [];
    for(const e of entries){
      if(voiceSeen.has(e.id))continue;voiceSeen.add(e.id);
      if(voiceSeen.size>500)voiceSeen.delete(voiceSeen.values().next().value);
      if(e.round!==s.question.round || Date.now()-e.at>30000 || (e.kind==='question'&&s.question.revealed))continue;
      if(voiceQueue.length<4)voiceQueue.push(e);
    }
    text('voiceStatus',speechMode==='native'?`Giọng tiếng Việt: Microsoft An trên PC${sound?' · Đã bật':' · Đang tắt trên bảng điều khiển'}`:s.narration?.status==='ready'?`Giọng tiếng Việt: ${s.narration.voice}${sound?' · Đã bật':' · Đang tắt trên bảng điều khiển'}`:`Giọng đọc: ${s.narration?.error || 'Đang chuẩn bị…'}`);
    if(sound)playSpeech();
  }
  async function unlockVoice(){
    sound=true; audio ||= new (window.AudioContext || window.webkitAudioContext)();await audio.resume();
    if(!voiceQueue.length && !speaking){const entries=speechMode==='native'?latest?.narration?.announcements||latest?.narration?.events:latest?.narration?.events;const entry=[...(entries||[])].reverse().find(e=>e.round===latest.question.round);if(entry)voiceQueue.push(entry);}
    await playSpeech();
  }
  const html = (id, value) => { if ($(id).innerHTML !== value) $(id).innerHTML = value; };
  const text = (id, value) => { if ($(id).textContent !== String(value)) $(id).textContent = value; };
  function fit() { $('classroom').style.transform = `scale(${$('classroom').parentElement.clientWidth / 540})`; }
  new ResizeObserver(fit).observe($('classroom').parentElement); fit();
  function toast(message) {
    text('toast', message); $('toast').classList.add('visible');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3800);
  }
  async function loadSession(){
    const res=await fetch('/api/classroom/session'),session=await res.json();
    if(!res.ok){if(res.status===401&&!obs)location.replace('/login');throw new Error(session.error||'Không mở được phiên điều khiển.');}
    sessionToken=session.token;$('logoutBtn').hidden=!session.loginRequired;
  }
  async function request(route, data, method='POST') {
    if (!sessionToken) await loadSession();
    const res = await fetch(`/api/classroom/${route}`, { method, headers: { 'Content-Type': 'application/json', 'X-Classroom-Token': sessionToken }, ...(method==='GET'?{}:{body: JSON.stringify(data || {})}) });
    if(res.status===401){sessionToken='';if(!obs)location.replace('/login');}
    const result = await res.json(); if (!res.ok) throw new Error(result.error || 'Không gửi được lệnh.');
    return result;
  }
  function chirp(kind) {
    if (!sound || !audio) return;
    const start = audio.currentTime;
    const notes = kind === 'gift' ? [523,659,784] : [659,523];
    notes.forEach((hz,i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, start+i*.12); gain.gain.linearRampToValueAtTime(.08, start+i*.12+.015); gain.gain.exponentialRampToValueAtTime(.001, start+i*.12+.25);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start+i*.12); oscillator.stop(start+i*.12+.3);
    });
  }
  function avatar(p, extraClass = '', back = false) {
    const shirts = ['#f8fbf0','#d5e9f0','#f4e9ce'];
    const skins = ['#efc19c','#dba780','#f4cdb0'];
    return `<svg class="${extraClass}" style="--shirt:${shirts[p.team % 3]};--skin:${skins[p.team % 3]};--hair:${['#443026','#77502e','#2b2424'][p.team%3]}" aria-hidden="true"><use href="#${back?'pupil-back':'pupil'}"></use></svg>`;
  }
  function render(s) {
    latest = s; const q = s.question;
    const now = s.clockAt??(s.paused ? s.pausedAt : s.now);
    const seconds = q.exhausted?0:Math.max(0, Math.ceil((q.endAt-now)/1000));
    const lesson=s.lesson||{number:1,question:1,ended:false};
    const captains=s.captains||[null,null,null];
    const timerLabel=q.exhausted?'Hết kho':s.waiting?'Chờ mở lớp':s.paused?'Tạm dừng':q.revealed?`Đổi câu ${seconds}s`:`Còn ${seconds}s`;
    text('subject', subjects[q.subject]); text('round', `Tiết ${lesson.number} · ${lesson.question}/10`); text('timer',timerLabel);
    $('timer').setAttribute('aria-label',q.revealed?`Chuyển câu sau ${seconds} giây`:s.waiting?'Chờ mở lớp':`Còn ${seconds} giây trả lời`);
    $('timer').classList.toggle('urgent', seconds <= 5 && !q.revealed&&!s.waiting&&!s.paused);
    $('timer').classList.toggle('waiting',!!s.waiting||!!s.paused||!!q.exhausted);
    $('timer').classList.toggle('revealed',!!q.revealed);
    $('timerBar').style.width = `${Math.min(100, seconds/(q.revealed ? 8 : s.settings.questionSeconds)*100)}%`;
    text('questionText', q.text);
    html('options', q.options.map((option,i) => `<div class="option ${q.revealed ? (i===q.correct ? 'correct':'wrong') : ''}"><b>${'ABCD'[i]}</b><span>${escape(option)}</span></div>`).join(''));
    text('answerCount', `${q.answerCount} bạn đã trả lời`);
    text('boardHint', q.exhausted?'Chờ bổ sung câu mới':s.waiting?'Chờ mở điều khiển hoặc kết nối LIVE':q.revealed ? `${s.winners.length} bạn trả lời đúng` : 'Gõ đáp án hoặc A/B/C/D');
    const n = s.students.length;
    const teamMembers=[0,1,2].map(team=>s.students.filter(p=>p.team===team));
    const pages = Math.max(1,...teamMembers.map(m=>Math.ceil(m.length/10))), page = pages > 1 ? Math.floor(s.now/15000)%pages : 0;
    text('studentCount', `${n} học sinh${pages>1 ? ` · dãy ${page+1}/${pages}` : ''}`);
    const seats = Array.from({length:30},(_,i)=>teamMembers[Math.floor((i%6)/2)][page*10+Math.floor(i/6)*2+i%2]);
    const queueIds = new Set(s.queue.map(p => p.id));
    const winners = new Set(s.winners.map(p => p.id));
    html('desks', Array.from({ length:30 },(_,i) => {
      const p = seats[i], team=Math.floor((i%6)/2), isMonitor=p&&s.monitor?.id===p.id;
      const captain=p&&captains[team]?.id===p.id;
      return `<div class="desk team-${team} ${p?'':'empty'} ${isMonitor?'is-monitor':''} ${p&&winners.has(p.id)?'answered':''}" data-team="${team+1}">${p&&!isMonitor ? avatar(p,'',true) : ''}<div class="desktop"></div><span class="desk-name" ${p?`title="Tổ ${team+1}: ${escape(p.name)}${captain?' · Tổ trưởng':''}${isMonitor?' · Đang ngồi bàn danh dự':''}"`:''}>${p?`<i class="team-number">${team+1}</i>${isMonitor?'👑 ':captain?'🏅 ':''}${escape(p.name)}`:'Chỗ trống'}${p && p.credits>0?' 🌹':''}</span>${isMonitor?'<span class="seat-moved">Bàn danh dự ↗</span>':''}${p&&p.applauseUntil>s.now?'<span class="pupil-applause">👏</span>':p&&p.streak>=3?`<span class="pupil-streak">🔥${p.streak}</span>`:''}${p&&!isMonitor&&queueIds.has(p.id)?'<span class="hand">✋</span>':''}${p&&!isMonitor&&winners.has(p.id)?'<span class="desk-answer">✓</span>':''}</div>`;
    }).join(''));
    text('monitor', s.monitor ? `⭐ Lớp trưởng: ${s.monitor.name} · ${Math.max(0,Math.ceil((s.monitor.until-s.now)/1000))}s` : `⭐ Tặng quà từ ${s.settings.monitorCoins} xu → lớp trưởng 2 phút`);
    const stagePlayer = s.students.find(p => p.id === s.stage?.id);
    text('atBoard', stagePlayer ? `Đang lên bảng: ${stagePlayer.name}${s.stage.priority?' 🌹':''}` : 'Đăng ký lên bảng qua bình luận');
    const monitorPlayer=s.students.find(p=>p.id===s.monitor?.id);
    const key=monitorPlayer?`${monitorPlayer.id}:${s.monitor.until}`:'';
    html('monitorSeat',monitorPlayer?`<div class="monitor-ribbon">LỚP TRƯỞNG</div><div class="monitor-halo"></div><span class="monitor-crown">👑</span>${avatar(monitorPlayer,'monitor-avatar')}<div class="monitor-desk"></div><strong class="monitor-name" title="${escape(monitorPlayer.name)}">${escape(monitorPlayer.name)}</strong><span class="monitor-team">Tổ ${monitorPlayer.team+1} · Bàn danh dự</span>`:'<div class="monitor-ribbon">BÀN LỚP TRƯỞNG</div><span class="monitor-vacant-crown">♛</span><div class="monitor-desk"></div><span class="monitor-vacant">Vị trí danh dự<br>cạnh cô giáo</span>');
    $('monitorSeat').classList.toggle('occupied',!!monitorPlayer);
    if(key!==monitorKey){
      monitorKey=key;clearTimeout(promotionTimer);$('monitorSeat').classList.remove('promoted');
      if(monitorPlayer){
        void $('monitorSeat').offsetWidth;$('monitorSeat').classList.add('promoted');
        text('monitorCelebration',`👑 Chúc mừng lớp trưởng ${monitorPlayer.name}!`);$('monitorCelebration').hidden=false;
        promotionTimer=setTimeout(()=>{$('monitorCelebration').hidden=true;$('monitorSeat').classList.remove('promoted');},4500);
      }else $('monitorCelebration').hidden=true;
    }
    const honor=s.leaderboard.filter(p=>p.correct>0).slice(0,5);
    const showFast=q.revealed&&!lesson.ended&&s.winners.length;
    html('roundWinners',showFast?`<h3>⚡ Trả lời đúng nhanh nhất câu vừa rồi</h3>${s.winners.slice(0,3).map((p,i)=>`<p class="fast-result"><span class="honor-rank">${i+1}</span><span class="honor-name">${escape(p.name)}</span><b>${(p.elapsed/1000).toFixed(2)}s</b><small>+10</small></p>`).join('')}<div class="result-note">${s.winners.length} bạn đúng · ${s.winners.filter(p=>p.streak>=3).length} bạn có chuỗi từ 3</div>`:`<h3>🏅 Vinh danh · Trả lời đúng nhiều nhất</h3>${honor.length?honor.map((p,i)=>`<p><span class="honor-rank">${i+1}</span><span class="honor-name">${escape(p.name)}</span><b>${p.correct} câu đúng</b><small>${p.score}đ</small></p>`).join(''):'<span class="empty">Chưa có bạn trả lời đúng.<br>Bình luận đáp án để ghi tên lên bảng!</span>'}`);
    html('teamScores', (s.lessonTeams||s.teams).map((score,i)=>`<div class="team-score team-${i}"><span>Tổ ${i+1} · ${['Măng non','Hoa phượng','Sao nhỏ'][i]}</span><b>${score}đ</b></div>`).join(''));
    html('teamLabels',teamMembers.map((members,i)=>`<div class="team-label team-${i}"><strong>Tổ ${i+1} · ${members.length} bạn</strong><span title="${escape(captains[i]?.name||'')}">${captains[i]?`🏅 ${escape(captains[i].name)}`:'Tổ trưởng: chờ thành tích'}</span></div>`).join(''));
    const challenge=s.challenge;
    const bestStreak=[...s.students].sort((a,b)=>b.streak-a.streak)[0];
    const activity=challenge?(q.revealed?`${challenge.success?'🔔 Rung chuông thành công':'🔔 Cùng cố gắng lần sau'} · ${challenge.correct}/${challenge.goal} bạn đúng`:`🔔 Rung chuông · Cần ${challenge.goal} bạn trả lời đúng`):(bestStreak?.streak>=3?`🔥 ${bestStreak.streak} câu liên tiếp · ${bestStreak.name}`:'👏 Bình luận “vỗ tay” để cổ vũ · “thành tích” để hỏi điểm');
    html('lessonStrip',`<div><strong>Tiết ${lesson.number}</strong><span>${lesson.ended?'Đang tổng kết':`Câu ${lesson.question}/10`}</span><div class="lesson-progress" aria-hidden="true">${Array.from({length:10},(_,i)=>`<i class="${i<lesson.question?'filled':''}"></i>`).join('')}</div></div><p title="${escape(activity)}">${escape(activity)}</p>`);
    $('lessonStrip').classList.toggle('challenge-active',!!challenge);
    $('lessonSummary').hidden=!lesson.ended;
    if(lesson.ended){
      const summary=lesson.summary;
      html('lessonSummary',`<h2>🏅 Tổng kết tiết ${lesson.number}</h2><p class="summary-teams">${summary.winningTeams.length?`Tổ ${summary.winningTeams.map(t=>t+1).join(' & ')} dẫn đầu thi đua!`:'Tiết sau cùng ghi điểm nhé!'}</p><ol>${summary.top.length?summary.top.map((p,i)=>`<li><b>${['🥇','🥈','🥉'][i]}</b><strong>${escape(p.name)}</strong><span>${p.correct} đúng · ${p.score}đ</span></li>`).join(''):'<li class="summary-empty">Bình luận A/B/C/D để tham gia tiết mới.</li>'}</ol><p class="summary-next">Tiết ${lesson.number+1} bắt đầu sau ${Math.max(0,Math.ceil((lesson.endsAt-now)/1000))} giây</p><small>Điểm cả buổi và kỷ lục chuỗi đúng được giữ lại</small>`);
    }
    text('lessonStatus',`Tiết ${lesson.number} · ${lesson.question}/10 câu. Điểm tổ tính riêng theo từng tiết; bảng vinh danh giữ thành tích cả buổi.`);
    text('nextBtn',lesson.ended?'Bắt đầu tiết mới':'Câu tiếp theo');
    text('queueCount', `${s.queue.length} bạn`);
    // Display in the same order the fair scheduler will call students.
    const pending = [...s.queue], ordered = []; let run = s.stage?.priority ? Math.max(1, s.priorityRun || 1) : 0;
    while(pending.length) {
      const normal = pending.findIndex(p=>!p.priority), priority = pending.findIndex(p=>p.priority);
      const index = priority>=0 && (run<2 || normal<0) ? priority : normal;
      const p = pending.splice(index,1)[0]; ordered.push(p); run = p.priority?run+1:0;
    }
    html('queueList', ordered.length ? ordered.slice(0,4).map((p,i)=>`<span class="queue-chip ${p.priority?'priority':''}">${i+1}. ${p.priority?'🌹 ':''}${escape(p.name)}</span>`).join('') : '<span class="empty-note">Bình luận “lên bảng” để đăng ký lượt.</span>');
    text('giftRules', `🌹 Quà: ưu tiên · ${s.settings.monitorCoins} xu: lớp trưởng`);
    $('pauseShade').hidden = !s.paused;
    const connected = s.live.status === 'connected';
    text('modeTag', s.preview?'Phòng thử':connected ? `LIVE @${s.live.username}` : s.live.status==='disconnected' ? 'Mất kết nối' : s.live.status==='connecting' ? 'Đang kết nối…' : 'Bản thử'); $('modeTag').classList.toggle('live', connected);
    text('liveBadge', connected ? 'Đã kết nối' : s.live.status==='connecting' ? 'Đang kết nối…' : 'Chưa kết nối');
    $('liveBadge').classList.toggle('live', connected);
    text('liveMessage', s.live.error || (connected ? `Đang nhận sự kiện từ @${s.live.username}. ${s.live.viewers} người xem.` : 'Thử lớp học bên dưới trước khi kết nối. Khi kết nối thành công, dữ liệu thử được xóa.'));
    $('disconnectBtn').hidden = !['connected','connecting','disconnected'].includes(s.live.status);
    $('connectBtn').disabled = s.preview || s.live.status==='connecting';
    $('connectForm').hidden=!!s.preview;
    if(s.preview){text('liveBadge','Giả lập');text('liveMessage','Phòng thử trên máy, không phát lên TikTok. Nhập comment và thử quà ở phần bên dưới.');}
    const locked = ['connected','connecting','disconnected'].includes(s.live.status);
    document.querySelectorAll('.simulator button,.simulator input').forEach(el => el.disabled = locked);
    html('leaderboard', s.leaderboard.length ? s.leaderboard.map((p,i)=>`<li><span>${i+1}</span><span>${escape(p.name)}${s.monitor?.id===p.id?' 👑':''}<small>${p.correct} đúng · Kỷ lục chuỗi ${p.bestStreak||0} · ⚡ ${p.fastest||0}</small></span><b>${p.score} điểm</b></li>`).join('') : '<li class="empty-leader">Điểm danh để có tên trong sổ đầu bài.</li>');
    html('activity', s.log.slice(0,8).map(e=>`<p class="${escape(e.kind)}">${escape(e.text)}</p>`).join(''));
    text('pauseBtn', s.paused?'Tiếp tục học':'Tạm dừng');
    document.querySelectorAll('[data-action]').forEach(el => el.disabled = (s.paused && el.dataset.action !== 'pause') || (q.exhausted&&['next','reveal'].includes(el.dataset.action)));
    text('bankStatus',s.questionBank?`Kho câu hỏi: ${s.questionBank.used}/${s.questionBank.total} đã dùng · còn ${s.questionBank.remaining} câu mới. Lịch sử được giữ khi khởi động lại hoặc xóa lớp.`:'');
    text('storageStatus',s.storage?.durable?'Lịch sử đang lưu trên Redis; được giữ khi deploy lại.':s.cloud?'Lịch sử đang lưu tạm trên server. Xuất bản sao trước khi deploy lại, hoặc cấu hình Redis để lưu tự động.':'Lịch sử đang lưu trên PC. Có thể xuất bản sao để chuyển sang server khác.');
    text('monitorGiftLabel', `Quà ${s.settings.monitorCoins} xu · 2 phút`);
    const signature = JSON.stringify(s.settings);
    if (signature !== settingsSignature) { for (const [key,value] of Object.entries(s.settings)) { if($(key))$(key).value = value; } settingsSignature = signature; }
    const newest = s.log[0];
    if (newest && newest.id > lastEvent) {
      if (lastEvent && ['gift','monitor','stage','question'].includes(newest.kind)) chirp(newest.kind==='monitor'?'gift':newest.kind);
      lastEvent = newest.id;
    }
    syncSpeech(s);
  }
  function connectSocket() {
    const ws = new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/classroom/ws`);
    let heartbeat;
    ws.onopen = () => { $('socketDot').classList.add('connected'); text('socketLabel','Màn hình đã kết nối');heartbeat=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send('ping');},25000); };
    ws.onmessage = event => { try { const msg = JSON.parse(event.data); if(msg.type==='state') render(msg.data); } catch(err) { console.error(err); } };
    ws.onclose = () => { clearInterval(heartbeat);$('socketDot').classList.remove('connected'); text('socketLabel','Mất kết nối · đang thử lại…'); setTimeout(connectSocket,2000); };
    ws.onerror = () => ws.close();
  }
  const handle = fn => async event => { event.preventDefault(); try { await fn(event); } catch(err) { toast(err.message); } };
  async function demo(data) {
    const result = await request('demo',{ name:$('demoName').value.trim() || 'Khách', ...data });
    toast(result.message || 'Đã gửi sự kiện thử.');
  }
  document.querySelectorAll('[data-comment]').forEach(el=>el.addEventListener('click',handle(()=>demo({ kind:'comment',text:el.dataset.comment }))));
  document.querySelectorAll('[data-gift]').forEach(el=>el.addEventListener('click',handle(()=>demo({ kind:'gift', count:1, coins:el.dataset.gift==='10'?latest.settings.monitorCoins:1 }))));
  document.querySelectorAll('[data-action]').forEach(el=>el.addEventListener('click',handle(()=>request('control',{action:el.dataset.action}))));
  $('commentForm').addEventListener('submit',handle(async()=>{ await demo({kind:'comment',text:$('comment').value}); $('comment').value=''; }));
  $('connectForm').addEventListener('submit',handle(async()=>{ $('connectBtn').disabled=true; try { await request('connect',{username:$('username').value}); toast('Đã kết nối TikTok LIVE.'); } finally { $('connectBtn').disabled=false; } }));
  $('disconnectBtn').addEventListener('click',handle(()=>request('disconnect')));
  $('logoutBtn').addEventListener('click',handle(async()=>{await request('logout');location.replace('/login');}));
  $('exportHistoryBtn').addEventListener('click',handle(async()=>{
    const history=await request('history',undefined,'GET');
    const url=URL.createObjectURL(new Blob([JSON.stringify(history,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='classroom-question-history.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }));
  $('importHistoryBtn').addEventListener('click',()=>$('historyFile').click());
  $('historyFile').addEventListener('change',handle(async()=>{
    const file=$('historyFile').files[0];if(!file)return;
    if(file.size>32000)throw new Error('File lịch sử quá lớn.');
    await request('history/import',JSON.parse(await file.text()));$('historyFile').value='';toast('Đã gộp lịch sử câu hỏi, không xóa câu đã dùng.');
  }));
  $('settingsForm').addEventListener('submit',handle(async()=>{ await request('settings',Object.fromEntries(['questionSeconds','monitorCoins'].map(k=>[k,Number($(k).value)]))); toast('Đã lưu thiết lập. Thời gian mới áp dụng từ câu tiếp theo.'); }));
  $('seedBtn').addEventListener('click',handle(async()=>{
    $('seedBtn').disabled=true;
    try { for(const name of ['Bảo Ngọc','Gia Huy','Hà My','Tuấn Anh','Mai Chi','Đức Minh','Thảo Vy','Quang Hải']) await request('demo',{name,kind:'comment',text:'vào lớp'}); }
    finally { $('seedBtn').disabled=false; }
    toast('8 bạn đã vào lớp.');
  }));
  $('resetBtn').addEventListener('click',handle(async()=>{ if(confirm('Xóa học sinh, điểm và hàng chờ của phiên hiện tại?')) { await request('control',{action:'reset'}); lastEvent=0; toast('Đã mở lớp mới.'); } }));
  $('soundBtn').addEventListener('click',handle(async()=>{
    audio ||= new (window.AudioContext || window.webkitAudioContext)(); await audio.resume(); sound=!sound;
    $('soundBtn').setAttribute('aria-pressed',sound); text('soundBtn',sound?'Dừng nghe thử':'Nghe thử tại bảng điều khiển');
    if(sound)await unlockVoice();else{stopSpeech();voiceQueue=[];}
  }));
  text('obsUrl',`${location.origin}/?obs=1`);
  // OBS can enable audio with one click through its Interact window.
  if(obs) document.addEventListener('pointerdown',unlockVoice,{once:true});
  else loadSession().catch(err=>toast(err.message));
  connectSocket();
})();
