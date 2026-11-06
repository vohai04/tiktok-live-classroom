const express = require('express');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const { WebSocketServer } = require('ws');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');
const { Classroom } = require('./lib/classroom-engine.cjs');
const {QuestionDeck,loadHistory,saveHistory} = require('./lib/classroom-question-deck.cjs');
const questions=require('./lib/classroom-questions.cjs');
const { Narrator } = require('./lib/classroom-narrator.cjs');
const { normalizeGiftPayload, getGiftComboDelta } = require('./lib/tiktok-gift-payload.cjs');

const port = Number(process.env.PORT || 3000);
const preview=process.env.CLASSROOM_PREVIEW==='1';
const dataDir=path.join(__dirname,'data',...(preview?['preview']:[]));
const host = process.env.HOST || '0.0.0.0';
const localAddresses = new Set(['localhost', '127.0.0.1', ...Object.values(os.networkInterfaces()).flat().filter(n => n.family === 'IPv4').map(n => n.address)]);
const isLoopback = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const token = crypto.randomBytes(24).toString('hex');
const dataFile = path.join(dataDir, 'classroom-settings.json');
const livePrefsFile=path.join(dataDir,'classroom-live.json');
let livePrefs={};
try{livePrefs=JSON.parse(fs.readFileSync(livePrefsFile,'utf8'));}catch{}
const saveLivePrefs=(username,enabled)=>{fs.mkdirSync(dataDir,{recursive:true});fs.writeFileSync(livePrefsFile,JSON.stringify({username,enabled},null,2));};
let saved = {};
try { saved = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch {}
const historyFile=process.env.CLASSROOM_HISTORY_FILE || path.join(dataDir,'classroom-question-history.json');
const deck=new QuestionDeck({questions,history:loadHistory(historyFile),persist:history=>saveHistory(historyFile,history)});
let room = new Classroom({ saved,deck });
let live = { status: 'demo', username: '', error: '', viewers: 0 };
let connection = null;
let generation = 0;
let roomOwner='';
const combo = new Map();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
const server = http.createServer(app);
// Phones on the same Wi-Fi can subscribe to the read-only stage.
const wss = new WebSocketServer({ server, path: '/classroom/ws', verifyClient: info => {
  if (!info.origin) return true;
  try { const url = new URL(info.origin); return url.protocol === 'http:' && localAddresses.has(url.hostname) && (url.port || '80') === String(port); }
  catch { return false; }
} });
const narrator = new Narrator(() => broadcast());
const state = () => ({ ...room.snapshot(),preview,live,narration: narrator.snapshot() });
function broadcast() {
  narrator.observe(room.snapshot());
  const msg = JSON.stringify({ type: 'state', data: state() });
  for (const socket of wss.clients) if (socket.readyState === 1) socket.send(msg);
}
room.onChange = broadcast;
wss.on('connection', socket => socket.send(JSON.stringify({ type: 'state', data: state() })));
const userFrom = data => {
  const u = data.user || data;
  return { id: u.userId || u.uniqueId || u.displayId || data.userId, name: u.nickname || u.uniqueId || data.nickname || 'Học sinh' };
};
const safely = fn => (...args) => { try { fn(...args); broadcast(); } catch (err) { console.warn('[Event]', err.message); } };
function resetRoom() { narrator.reset(); room = new Classroom({ saved: { settings: room.settings }, deck,onChange: broadcast }); combo.clear(); }
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
app.get('/api/classroom/state', (_req, res) => res.json(state()));
app.use('/classroom-voice', express.static(path.join(__dirname,'data','classroom-voice'),{maxAge:'1d'}));
app.get('/api/classroom/session', (req, res) => {
  if (!isLoopback(req) || req.headers['sec-fetch-site'] === 'cross-site') return res.sendStatus(403);
  res.set('Cache-Control', 'no-store').json({ token });
});
app.use('/api/classroom', (req, res, next) => {
  if (!isLoopback(req)) return res.status(403).json({ error: 'Điều khiển lớp học trên máy tính chạy server.' });
  if (req.headers['x-classroom-token'] !== token) return res.status(403).json({ error: 'Phiên điều khiển hết hạn. Tải lại trang.' });
  next();
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
  if (!isLoopback(req) && req.query.obs !== '1') return res.redirect('/?obs=1');
  res.sendFile(path.join(__dirname, 'public', 'classroom.html'));
});
app.use(express.static(path.join(__dirname, 'public')));
setInterval(() => { if(wss.clients.size || live.status==='connected')room.tick(); broadcast(); }, 1000).unref();
server.listen(port, host, () => {
  console.log(`Lớp học làng${preview?' — PHÒNG THỬ':''}: http://localhost:${port}\nMàn hình: http://localhost:${port}/?obs=1`);
  if(!preview && process.env.DISABLE_TIKTOK_AUTOCONNECT!=='1' && livePrefs.enabled && livePrefs.username)connect(livePrefs.username).catch(err=>console.warn('[TikTok reconnect]',err.message));
});
server.on('error', err => { console.error(err.code === 'EADDRINUSE' ? `Cổng ${port} đang được dùng. Đổi PORT hoặc dừng server cũ.` : err); process.exit(1); });
