const {loadHistory,saveHistory,validateHistory}=require('./classroom-question-deck.cjs');

class HistoryStore {
  constructor({file,url='',token='',key='classroom:question-history',fetcher=fetch}){
    if(!!url!==!!token)throw new Error('Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.');
    if(url){
      const endpoint=new URL(url);
      if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.upstash.io')||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/'||(endpoint.port&&endpoint.port!=='443'))throw new Error('UPSTASH_REDIS_REST_URL must be an HTTPS *.upstash.io endpoint.');
      url=endpoint.origin;
    }
    this.file=file;this.url=url;this.token=token;this.key=key;this.fetcher=fetcher;this.dirty=false;this.pending=null;this.error='';
  }
  async command(command){
    try{
      const res=await this.fetcher(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(10000)});
      if(!res.ok)throw new Error('Redis request failed');
      const data=await res.json();if(data.error)throw new Error('Redis error');return data.result;
    }catch{throw new Error('Không lưu/đọc được lịch sử trên Redis. Kiểm tra kết nối và biến Upstash; không tự xóa lịch sử.');}
  }
  async load(){
    const local=loadHistory(this.file);
    if(!this.url)return local;
    const value=await this.command(['GET',this.key]);
    const remote=value===null?{}:validateHistory(JSON.parse(value));
    const history={version:1,usedIds:[...new Set([...(remote.usedIds||[]),...(local.usedIds||[])])],servedCount:Math.max(remote.servedCount||0,local.servedCount||0)};
    history.servedCount=Math.max(history.servedCount,history.usedIds.length);
    this.save(history);await this.flush();return history;
  }
  save(history){
    saveHistory(this.file,history);this.target=JSON.parse(JSON.stringify(history));this.dirty=!!this.url;
  }
  async flush(){
    if(this.pending){await this.pending;return this.flush();}
    if(!this.dirty)return;
    const snapshot=this.target;
    this.pending=this.command(['SET',this.key,JSON.stringify(snapshot)]).then(()=>{this.dirty=this.target!==snapshot;this.error='';}).catch(err=>{this.error=err.message;throw err;}).finally(()=>{this.pending=null;});
    await this.pending;if(this.dirty)await this.flush();
  }
  snapshot(){return {mode:this.url?'redis':'file',durable:!!this.url,error:this.error};}
}
module.exports={HistoryStore};
