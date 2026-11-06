const crypto = require('node:crypto');

const isLoopback = req => ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
const digest = value => crypto.createHash('sha256').update(String(value)).digest();

function createAccess({cloud=false,password='',publicUrl='',localOrigins=[],now=Date.now}={}) {
  if(cloud && password.length<12)throw new Error('Set ADMIN_PASSWORD to a private password of at least 12 characters before starting cloud mode.');
  const origin=publicUrl?new URL(publicUrl).origin:'';
  if(cloud && (!origin || !origin.startsWith('https://')))throw new Error('Cloud mode requires CLASSROOM_PUBLIC_URL or RENDER_EXTERNAL_URL with an https:// URL.');
  const protectedMode=cloud||!!password;
  const origins=new Set(cloud?[origin]:[...localOrigins,...(origin?[origin]:[])]);
  const sessions=new Map(),attempts=new Map();
  const cookieName='classroom_session';
  const cookie=(id,age)=>`${cookieName}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${cloud||origin.startsWith('https:')?'; Secure':''}`;
  const validOrigin=req=>req.headers['sec-fetch-site']!=='cross-site' && (!req.headers.origin||origins.has(req.headers.origin));
  const getSession=req=>{
    const id=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    const session=sessions.get(id);
    if(session?.expires>now())return session;
    if(id)sessions.delete(id);return null;
  };
  const authorized=req=>protectedMode?!!getSession(req):isLoopback(req);
  const localToken=crypto.randomBytes(24).toString('hex');
  return {
    cloud,protectedMode,origin,validOrigin,authorized,
    wsOriginAllowed(value){return !value||origins.has(value);},
    session(req,res){
      if(!validOrigin(req))return res.status(403).json({error:'Nguồn yêu cầu không hợp lệ.'});
      if(!authorized(req))return res.status(401).json({error:'Đăng nhập để điều khiển lớp học.'});
      res.set('Cache-Control','no-store').json({token:protectedMode?getSession(req).csrf:localToken,authenticated:true,loginRequired:protectedMode});
    },
    login(req,res){
      res.set('Cache-Control','no-store');
      if(!protectedMode)return res.status(400).json({error:'Bản PC không yêu cầu đăng nhập.'});
      if(!validOrigin(req))return res.status(403).json({error:'Nguồn yêu cầu không hợp lệ.'});
      for(const [key,value] of attempts)if(value.until<=now())attempts.delete(key);
      const key=req.ip||req.socket.remoteAddress;
      const attempt=attempts.get(key)||{count:0,until:now()+900000};
      if(attempt.count>=8)return res.status(429).json({error:'Thử đăng nhập quá nhiều lần. Đợi 15 phút rồi thử lại.'});
      if(!crypto.timingSafeEqual(digest(req.body?.password||''),digest(password))){
        attempt.count++;attempts.set(key,attempt);
        if(attempts.size>1000)attempts.delete(attempts.keys().next().value);
        return res.status(401).json({error:'Mật khẩu chưa đúng.'});
      }
      attempts.delete(key);
      for(const [id,value] of sessions)if(value.expires<=now())sessions.delete(id);
      if(sessions.size>=20)sessions.delete(sessions.keys().next().value);
      const id=crypto.randomBytes(32).toString('hex');
      sessions.set(id,{csrf:crypto.randomBytes(24).toString('hex'),expires:now()+43200000});
      res.set('Set-Cookie',cookie(id,43200)).json({ok:true});
    },
    requireControl(req,res,next){
      if(!authorized(req))return res.status(protectedMode?401:403).json({error:protectedMode?'Đăng nhập để điều khiển lớp học.':'Điều khiển lớp học trên máy tính chạy server.'});
      if(!validOrigin(req))return res.status(403).json({error:'Nguồn yêu cầu không hợp lệ.'});
      const expected=protectedMode?getSession(req).csrf:localToken;
      if(req.headers['x-classroom-token']!==expected)return res.status(403).json({error:'Phiên điều khiển hết hạn. Tải lại trang.'});
      next();
    },
    logout(req,res){
      const value=getSession(req);
      if(value)for(const [id,session] of sessions)if(session===value)sessions.delete(id);
      res.set('Set-Cookie',cookie('',0)).json({ok:true});
    }
  };
}
module.exports={createAccess,isLoopback};
