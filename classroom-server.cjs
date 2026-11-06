const express = require('express');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
const { Classroom } = require('./lib/classroom-engine.cjs');
const {QuestionDeck,validateHistory} = require('./lib/classroom-question-deck.cjs');
const {HistoryStore}=require('./lib/classroom-history-store.cjs');
const {createAccess}=require('./lib/classroom-access.cjs');
const questions=require('./lib/classroom-questions.cjs');
const { Narrator } = require('./lib/classroom-narrator.cjs');
const { normalizeGiftPayload, getGiftComboDelta } = require('./lib/tiktok-gift-payload.cjs');

async function main(){
const port = Number(process.env.PORT || 3000);
const preview=process.env.CLASSROOM_PREVIEW==='1';
const cloud=process.env.CLASSROOM_CLOUD==='1'||process.env.RENDER==='true';
const dataDir=path.join(process.env.CLASSROOM_DATA_DIR||path.join(__dirname,'data'),...(preview?['preview']:[]));
const host = process.env.HOST || '0.0.0.0';
const localAddresses = new Set(['localhost', '127.0.0.1', ...Object.values(os.networkInterfaces()).flat().filter(n => n.family === 'IPv4').map(n => n.address)]);
const access=createAccess({cloud,password:process.env.ADMIN_PASSWORD||'',publicUrl:process.env.CLASSROOM_PUBLIC_URL||process.env.RENDER_EXTERNAL_URL||'',localOrigins:[...localAddresses].map(host=>`http://${host}:${port}`)});
const dataFile = path.join(dataDir, 'classroom-settings.json');
const livePrefsFile=path.join(dataDir,'classroom-live.json');
let livePrefs={};
try{livePrefs=JSON.parse(fs.readFileSync(livePrefsFile,'utf8'));}catch{}
const saveLivePrefs=(username,enabled)=>{fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(livePrefsFile,JSON.stringify({username,enabled},null,2));};
let saved = {};
try { saved = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch {}
const historyFile=process.env.CLASSROOM_HISTORY_FILE || path.join(dataDir,'classroom-question-history.json');
const historyStore=new HistoryStore({file:historyFile,url:process.env.UPSTASH_REDIS_REST_URL||'',token:process.env.UPSTASH_REDIS_REST_TOKEN||'',key:process.env.CLASSROOM_HISTORY_KEY||`classroom:${preview?'preview':'live'}:question-history`});
const deck=new QuestionDeck({questions,history:await historyStore.load(),persist:history=>historyStore.save(history)});
let room = new Classroom({ saved,deck });
room.setRunning(!cloud);
await historyStore.flush();
let live = { status: 'demo', username: '', error: '', viewers: 0 };
let connection = null;
let generation = 0;
let roomOwner='';
const combo = new Map();
const app = express();
if(cloud)app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
const server = http.createServer(app);
// The stage is read-only. Browser origins must match the configured public URL.
const wss = new WebSocketServer({ server, path: '/classroom/ws',maxPayload:1024, verifyClient: info => {
  return access.wsOriginAllowed(info.origin);
} });
const narrator = new Narrator(() => broadcast(),{dir:path.join(dataDir,'classroom-voice')});
const state = () => ({ ...room.snapshot(),preview,cloud,storage:historyStore.snapshot(),live,narration: narrator.snapshot() });
async function publish() {
  await historyStore.flush();
  narrator.observe(room.snapshot());
  const msg = JSON.stringify({ type: 'state', data: state() });
  for (const socket of wss.clients) if (socket.readyState === 1) socket.send(msg);
}
function broadcast(){return publish().catch(err=>console.warn('[History]',err.message));}
room.onChange = broadcast;
wss.on('connection', async (socket,request) => {
  socket.controllerRequest=request;
  if(access.authorized(request)||live.status==='connected')room.setRunning(true);
  socket.alive=true;socket.on('pong',()=>{socket.alive=true;});socket.on('error',()=>{});
  socket.on('message',data=>{if(String(data)==='ping')socket.send('"pong"');});
  try{await historyStore.flush();if(socket.readyState===1)socket.send(JSON.stringify({type:'state',data:state()}));}catch{socket.close(1013,'Storage temporarily unavailable');}
});
const userFrom = data => {
  const u = data.user || data;
  return { id: u.userId || u.uniqueId || u.displayId || data.userId, name: u.nickname || u.uniqueId || data.nickname || 'Học sinh' };
};
const safely = fn => (...args) => { try { fn(...args); broadcast(); } catch (err) { console.warn('[Event]', err.message); } };
function resetRoom() { const running=room.running;narrator.reset(); room = new Classroom({ saved: { settings: room.settings }, deck,onChange: broadcast });room.setRunning(running); combo.clear(); }
async function disconnect() {
  generation++; const old = connection; connection = null;
  live = { status: 'demo', username: '', error: '', viewers: 0 }; combo.clear();
  if (old) await old.disconnect().catch(() => {});
  broadcast();
}
async function connect(username) {
  if(preview)throw new Error('Phòng thử chỉ dùng comment/quà giả lập; không kết nối TikTok.');
  const match = String(username || '').trim().match(/^(?:https:\/\/(?:www\.)?tiktok\.com\/@|@)?([\w.]{2,30})(?:\/live\/?(?:\?.*)?)?$/);
  if (!match) throw new Error('Nhập @username hoặc link tiktok.com/@username/live.');
  saveLivePrefs(match[1],true);
  await disconnect(); const current = ++generation;
  live = { status: 'connecting', username: match[1], error: '', viewers: 0 }; broadcast();
  // Optional room/gift metadata routes require premium URL signing on the
  // current provider. The basic event socket works without those requests.
  const client = new TikTokLiveConnection(match[1], {
    processInitialData: false,
    fetchRoomInfoOnConnect: false,
    enableExtendedGiftInfo: false
  });
  connection = client;
  const active = fn => safely(data => { if (current === generation) fn(data); });
  client.on(WebcastEvent.CHAT, active(data => room.comment(userFrom(data), data.comment || data.content || '')));
  client.on(WebcastEvent.GIFT, active(data => {
    const user = userFrom(data); const gift = normalizeGiftPayload(data, user.id);
    const count = getGiftComboDelta(combo, gift); if (count <= 0) return;
    // Unknown gift values still give queue credit; never guess a high-tier value.
    const rawValue = data.gift?.diamondCount ?? data.gift?.diamond_count ?? data.giftDetails?.diamondCount ?? data.giftDetails?.diamond_count ?? data.diamondCount ?? data.extendedGiftInfo?.diamondCount ?? data.extendedGiftInfo?.diamond_count;
    const value = Math.max(0, Number(rawValue) || 0);
    const eventId = gift.streakable ? `${current}:${gift.groupId}:${gift.repeatCount}` : data.msgId || data.common?.msgId;
    room.gift(user, { count, coins: value * (gift.streakable ? gift.repeatCount : count), name: gift.giftName || 'quà', eventId });
  }));
  client.on(WebcastEvent.ROOM_USER, active(data => { live.viewers = Number(data.viewerCount ?? data.total ?? 0); }));
  client.on(ControlEvent.ERROR, active(err => { live.error = err.message || 'Lỗi kết nối TikTok.'; }));
  client.on(ControlEvent.DISCONNECTED, active(() => { live.status = 'disconnected'; live.error = 'Đã mất kết nối. Bấm kết nối lại để tiếp tục.'; }));
  let timeout;
  try {
    const pending = client.connect();
    pending.then(() => { if (current !== generation) client.disconnect().catch(() => {}); }, () => {});
    await Promise.race([pending, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Quá 25 giây chưa kết nối được. Kiểm tra tài khoản đang LIVE rồi thử lại.')), 25000); timeout.unref(); })]);
    if (current !== generation) { await client.disconnect().catch(() => {}); return; }
    if(roomOwner!==match[1]){resetRoom();roomOwner=match[1];}
    live.status = 'connected'; live.error = ''; broadcast();
  } catch (err) {
    if (current === generation) { await disconnect(); live.status = 'error'; live.error = err.message; broadcast(); }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
app.get('/healthz',(_req,res)=>res.status(historyStore.error?503:200).json({ok:!historyStore.error}));
app.get('/api/classroom/state', async (_req, res) => {
  try{await historyStore.flush();res.set('Cache-Control','no-store').json(state());}catch(err){res.status(503).json({error:err.message});}
});
app.use('/classroom-voice', express.static(path.join(dataDir,'classroom-voice'),{maxAge:'1d'}));
app.get('/api/classroom/session',access.session);
app.post('/api/classroom/login',access.login);
app.use('/api/classroom',access.requireControl);
app.post('/api/classroom/logout',access.logout);
app.get('/api/classroom/history',async (_req,res)=>{try{await historyStore.flush();res.set('Cache-Control','no-store').json(deck.export());}catch(err){res.status(503).json({error:err.message});}});
app.post('/api/classroom/history/import',async (req,res)=>{
  try{
    const history=validateHistory(req.body);
    const replaceQuestion=history.usedIds.includes(room.question.id);
    for(const id of history.usedIds)deck.used.add(id);
    deck.servedCount=Math.max(deck.servedCount,history.servedCount,deck.used.size);
    historyStore.save(deck.export());
    if(replaceQuestion)resetRoom();
    await historyStore.flush();broadcast();res.json({ok:true});
  }catch(err){res.status(400).json({error:err.message});}
});
app.post('/api/classroom/connect', async (req, res) => {
  try { await connect(req.body.username); res.json({ ok: true }); }
  catch (err) { res.status(400).json({ error: err.message }); }
});
app.post('/api/classroom/disconnect', async (_req, res) => { if(!preview)saveLivePrefs(live.username || livePrefs.username || '',false);await disconnect(); res.json({ ok: true }); });
app.post('/api/classroom/demo', (req, res) => {
  try {
    if (connection) throw new Error('Ngắt TikTok trước khi dùng giả lập.');
    const { name, id, kind, text, coins, count } = req.body;
    const player = { id: id || `demo:${String(name || 'Khách').slice(0, 40)}`, name: name || 'Khách' };
    const message = kind === 'gift' ? room.gift(player, { coins, count, name: Number(coins) === 1 ? 'Hoa hồng' : 'quà thử' }) : room.comment(player, String(text || 'vào lớp').slice(0, 240));
    broadcast(); res.json({ ok: true, message });
  } catch (err) { res.status(400).json({ error: err.message }); }
});
app.post('/api/classroom/control', (req, res) => {
  try {
    if (req.body.action === 'reset') resetRoom(); else room.control(req.body.action);
    broadcast(); res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});
app.post('/api/classroom/settings', (req, res) => {
  try {
    room.configure(req.body); fs.mkdirSync(path.dirname(dataFile), { recursive: true });
    fs.writeFileSync(dataFile, JSON.stringify({ settings: room.settings }, null, 2));
    broadcast(); res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});
app.get(['/', '/admin'], (req, res) => {
  res.set('Cache-Control','no-store');
  if(req.query.obs!=='1'&&!access.authorized(req))return res.redirect(access.protectedMode?'/login':'/?obs=1');
  res.sendFile(path.join(__dirname, 'public', 'classroom.html'));
});
app.get('/login',(req,res)=>{res.set('Cache-Control','no-store');if(access.authorized(req))return res.redirect('/admin');res.sendFile(path.join(__dirname,'public','classroom-login.html'));});
app.use(express.static(path.join(__dirname, 'public')));
const timer=setInterval(() => {
  const watching=cloud?[...wss.clients].some(socket=>access.authorized(socket.controllerRequest)):wss.clients.size>0;
  room.setRunning(!!(watching||live.status==='connected'));
  if(!historyStore.dirty&&(watching||live.status==='connected'))room.tick();broadcast();
},1000);timer.unref();
const heartbeat=setInterval(()=>{for(const socket of wss.clients){if(!socket.alive){socket.terminate();continue;}socket.alive=false;socket.ping();}},30000);heartbeat.unref();
let stopping=false;
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,async()=>{
  if(stopping)return;stopping=true;clearInterval(timer);clearInterval(heartbeat);
  await historyStore.flush().catch(()=>{});narrator.close();
  if(connection)connection.disconnect().catch(()=>{});
  for(const client of wss.clients)client.close(1001,'Server restarting');
  server.close(()=>process.exit(0));setTimeout(()=>process.exit(0),5000).unref();
});
server.listen(port, host, () => {
  console.log(`Lớp học làng${preview?' — PHÒNG THỬ':''}: http://localhost:${port}\nMàn hình: http://localhost:${port}/?obs=1`);
  if(!preview && process.env.DISABLE_TIKTOK_AUTOCONNECT!=='1' && livePrefs.enabled && livePrefs.username)connect(livePrefs.username).catch(err=>console.warn('[TikTok reconnect]',err.message));
});
server.on('error', err => { console.error(err.code === 'EADDRINUSE' ? `Cổng ${port} đang được dùng. Đổi PORT hoặc dừng server cũ.` : err); process.exit(1); });
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});
