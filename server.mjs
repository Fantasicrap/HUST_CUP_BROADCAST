import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createReadStream,unlinkSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalizeDraft,SCENES,CONTEXTS,assertBenchLimit} from './public/model.js';
import {inspectAsset} from './lib/assets.mjs';
import {newMatch,changeMatch,recordMatchEvent,composeData,deriveMatch,eventScene,clockMs,PHASES,EVENT_LABELS} from './public/match.js';
const project=path.dirname(fileURLToPath(import.meta.url));
const applicationVersion=JSON.parse(await fs.readFile(path.join(project,'package.json'),'utf8')).version;
const root=path.join(project,'public');
const runtime=path.resolve(process.env.HUST_DATA_DIR||path.join(project,'runtime'));
const assetFolder=path.join(runtime,'assets');
await fs.mkdir(assetFolder,{recursive:true});
const lockPath=path.join(runtime,'service.lock');
let lock;
try{lock=await fs.open(lockPath,'wx');}catch(error){
 if(error.code!=='EEXIST')throw error;
 let pid;try{pid=JSON.parse(await fs.readFile(lockPath,'utf8')).pid;}catch{}
 let active=false;if(Number.isInteger(pid)&&pid>0){try{process.kill(pid,0);active=true;}catch(e){active=e.code!=='ESRCH';}}
 if(active||!pid&&Date.now()-(await fs.stat(lockPath)).mtimeMs<30000){console.error('数据目录正在被另一服务使用或启动，请先停止旧服务；多开须指定独立 HUST_DATA_DIR。');process.exit(1);}
 await fs.unlink(lockPath);lock=await fs.open(lockPath,'wx');
}
await lock.writeFile(JSON.stringify({pid:process.pid,startedAt:Date.now()}));
await lock.close();
process.on('exit',()=>{try{unlinkSync(lockPath);}catch{}});
const sample=JSON.parse(await fs.readFile(path.join(root,'data/demo.json'),'utf8'));
const initial=normalizeDraft({},sample);
let state={schema:3,draft:initial,match:newMatch(initial,{demo:true}),queue:[],history:[],live:{data:initial,scene:'scoreboard',context:'pregame',startedAt:Date.now(),runId:randomUUID(),revision:0}};
let restored=false;
try{const saved=JSON.parse(await fs.readFile(path.join(runtime,'state.json'),'utf8'));state={...state,...saved,schema:3,draft:normalizeDraft(saved.draft||{},sample),queue:[],history:[]};state.match=saved.match||newMatch(state.draft,{demo:true});restored=true;
 if(state.match.clock.running){const checkpoint=saved.savedAt||state.match.clock.anchor;state.match.clock.elapsedMs+=Math.max(0,checkpoint-state.match.clock.anchor);state.match.clock.anchor=Date.now();state.match.clock.running=false;state.match.recovery={savedAt:checkpoint,message:'服务中断前计时运行。已停在最近存档；请选择是否补计离线时间，再手动继续。'};}
}catch(error){if(error.code!=='ENOENT'){console.error('存档读取失败，未覆盖原存档。请检查 runtime/state.json。');process.exit(1);}}
state.publishedDraft=normalizeDraft(state.publishedDraft||state.live.data||state.draft,sample);state.outputDelayMs=state.outputDelayMs??state.publishedDraft.config.delayMs;
state.live={...state.live,scene:restored?'clear':'scoreboard',data:composeData(state.publishedDraft,state.match),startedAt:Date.now(),runId:randomUUID(),revision:(state.live.revision||0)+1,expiresAt:null};
state.history=[{at:Date.now()-120001,live:structuredClone(state.live)}];
let writing=Promise.resolve(),mutations=Promise.resolve();
const save=()=>{state.savedAt=Date.now();const content=JSON.stringify(state,null,2);writing=writing.catch(()=>{}).then(async()=>{const temp=path.join(runtime,'state.tmp');await fs.writeFile(temp,content);await fs.rename(temp,path.join(runtime,'state.json'));});return writing;};
const mutate=fn=>{const job=mutations.catch(()=>{}).then(async()=>{const before=structuredClone(state);try{return await fn();}catch(error){state=before;throw error;}});mutations=job;return job;};
const clients=new Map();
function snapshot(){const target=Date.now()-state.outputDelayMs;const frame=state.history.findLast(h=>h.at<=target)||state.history[0];return {live:frame.live,serverNow:target,delayMs:state.outputDelayMs};}
function notify(){const snap=snapshot();for(const [res,entry] of clients){const key=snap.live.revision+':'+snap.live.runId+':'+snap.delayMs;if(entry.key!==key){res.write(`data: ${JSON.stringify(snap)}\n\n`);entry.key=key;}}}
function publish({immediate=false}={}){state.live.revision++;const frame={at:immediate?Date.now()-state.outputDelayMs:Date.now(),live:structuredClone(state.live)};if(immediate)state.history=[frame];else state.history.push(frame);const cutoff=Date.now()-125000;while(state.history.length>2&&state.history[1].at<cutoff)state.history.shift();notify();}
const transient=new Set(['goal','substitution','card','cancelGoal','penalty','var','notice','person','statStrip','officials','commentators','entrance','kickoff','sponsor']);
const priority=scene=>['goal','cancelGoal','card','var'].includes(scene)?90:['substitution','penalty'].includes(scene)?70:['statStrip','statistics','person','sponsor'].includes(scene)?20:50;
const isFulltimeCue=item=>item.scene==='fulltime'||['bottomScore','summary'].includes(item.scene)&&item.context==='fulltime';
function cue(command){
 const scene=command.scene,template=structuredClone(command.eventId?state.publishedDraft:state.draft);if(!SCENES.includes(scene)||!template.config.modules[scene])throw Error('该模块未启用，不能播出');if(scene==='var'&&!template.config.varEnabled)throw Error('VAR 默认关闭，请先启用');
 const context=Object.hasOwn(CONTEXTS,command.context)?command.context:'pregame';if(scene==='bottomScore'&&!template.config.contexts[context])throw Error('该底部比分场景未启用');
 if(state.match.clock.running&&isFulltimeCue({scene,context}))throw Error('计时仍在运行，请先暂停计时或切换全场结束阶段，再播出全场画面');
 const event=command.eventId?state.match.events.find(e=>e.id===command.eventId&&e.active!==false):null;if(command.eventId&&!event)throw Error('事件不存在或已撤销');if(event&&eventScene(event)!==scene)throw Error('事件与播出模块不匹配');if(event?.type==='goal'&&deriveMatch(state.match).goals.find(g=>g.id===event.id)?.cancelled)throw Error('该进球已取消，不能作为有效进球重播');
 return {id:randomUUID(),template,scene,context,eventId:event?.id||null,team:command.team==='away'?'away':command.team==='home'?'home':state.draft.config.team,priority:priority(scene),holdMs:scene==='scoreboard'?null:Math.max(1200,Math.min(120000,Number(command.holdMs)||(scene==='bottomScore'?state.draft.config.bottomHoldMs:scene==='transition'?1400:scene==='formation'?45000:transient.has(scene)?state.draft.config.eventHoldMs:15000))),createdAt:Date.now()};
}
function startCue(item){if(state.match.clock.running&&isFulltimeCue(item))return finishCue();const event=item.eventId?state.match.events.find(e=>e.id===item.eventId):null;state.publishedDraft=structuredClone(item.template||state.publishedDraft);const data=composeData(state.publishedDraft,state.match,event);data.config.team=item.team;state.live={data,scene:item.scene,context:item.context,startedAt:Date.now(),runId:item.id,revision:state.live.revision,expiresAt:item.holdMs?Date.now()+item.holdMs:null,priority:item.priority,eventId:item.eventId};publish();}
function enqueue(item,force=false){const busy=state.live.expiresAt&&state.live.expiresAt>Date.now();if(busy&&!force){if(state.queue.length>=200)throw Error('待播队列已满，请先移除旧画面');state.queue.push(item);state.queue.sort((a,b)=>b.priority-a.priority||a.createdAt-b.createdAt);}else startCue(item);}
function finishCue(){if(state.queue.length)startCue(state.queue.shift());else{state.live={...state.live,data:composeData(state.publishedDraft,state.match),scene:state.publishedDraft.config.restoreScoreboard&&state.publishedDraft.config.modules.scoreboard?'scoreboard':'clear',runId:randomUUID(),startedAt:Date.now(),expiresAt:null,eventId:null};publish();}}
function refreshLive(){const team=state.live.data.config.team,a=deriveMatch(state.match),valid=id=>{const e=state.match.events.find(e=>e.id===id&&e.active!==false);return e&&!(e.type==='goal'&&a.goals.find(g=>g.id===e.id)?.cancelled);};state.queue=state.queue.filter(q=>(!q.eventId||valid(q.eventId))&&!(state.match.clock.running&&isFulltimeCue(q)));if(state.live.eventId&&!valid(state.live.eventId)||state.match.clock.running&&isFulltimeCue(state.live))state.live={...state.live,scene:state.publishedDraft.config.modules.scoreboard?'scoreboard':'clear',expiresAt:null,eventId:null,runId:randomUUID(),startedAt:Date.now()};state.live.data=composeData(state.publishedDraft,state.match,state.match.events.find(e=>e.id===state.live.eventId));state.live.data.config.team=team;publish();}
function controller(){return {match:state.match,derived:deriveMatch(state.match),draft:state.draft,queue:state.queue,live:state.live,output:snapshot(),serverNow:Date.now(),restored,outputDelayMs:state.outputDelayMs};}
const port=Number(process.env.PORT||3210);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm','.otf':'font/otf','.ttf':'font/ttf','.woff':'font/woff','.woff2':'font/woff2','.wav':'audio/wav'};
async function body(req,max=2*1024*1024){const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>max){const error=new Error('上传内容过大');error.status=413;throw error;}chunks.push(chunk);}return Buffer.concat(chunks);}
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(req.method!=='GET'&&req.method!=='HEAD'){
   const expected=`http://${req.headers.host}`;
   if(!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host||'')||(req.headers.origin&&req.headers.origin!==expected))return json(res,{error:'仅接受本机同源请求'},403);
  }
  if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
  if(url.pathname==='/api/health'&&req.method==='GET')return json(res,{application:'HUST_CUP_BROADCAST',version:applicationVersion});
  if(url.pathname==='/api/preview'&&req.method==='GET')return json(res,{data:composeData(state.draft,state.match),serverNow:Date.now()});
  if(url.pathname==='/api/draft'&&req.method==='GET')return json(res,{draft:state.draft,serverNow:Date.now()});
  if(url.pathname==='/api/draft'&&req.method==='PUT'){const raw=JSON.parse((await body(req)).toString('utf8'));await mutate(async()=>{assertBenchLimit(raw.formation,raw.awayFormation);state.draft=normalizeDraft(raw,sample);await save();});return json(res,{draft:state.draft});}
  if(url.pathname==='/api/output'&&req.method==='GET')return json(res,snapshot());
  if(url.pathname==='/api/connections'&&req.method==='GET')return json(res,{outputs:clients.size});
  if(url.pathname==='/api/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`data: ${JSON.stringify(snapshot())}\n\n`);clients.set(res,{key:''});res.on('close',()=>clients.delete(res));return;}
  if(url.pathname==='/api/control-state'&&req.method==='GET')return json(res,controller());
  if(url.pathname==='/api/preview-event'&&req.method==='POST'){
   const command=JSON.parse((await body(req)).toString('utf8'));const m=recordMatchEvent(state.match,{...command,action:'record'});const e=command.id?m.events.find(e=>e.id===command.id):m.events.findLast(e=>!e.parentEventId);return json(res,{scene:e.type==='adjustment'?'scoreboard':eventScene(e),baseRevision:state.match.revision,data:composeData(state.draft,m,e)});
  }
  if(url.pathname==='/api/control'&&req.method==='POST'){
   const command=JSON.parse((await body(req)).toString('utf8'));
   await mutate(async()=>{
    if(command.action==='newMatch'){if(command.confirm!=='RESET')throw Error('新比赛会清空比赛账本，请明确确认');assertBenchLimit(state.draft.formation,state.draft.awayFormation);state.match=newMatch(state.draft,{demo:!!command.demo});state.draft.score=deriveMatch(state.match).score;state.draft.goals=deriveMatch(state.match).goals;state.draft.shootout=structuredClone(state.match.shootout);state.queue=[];state.live={...state.live,scene:'clear',expiresAt:null,eventId:null};refreshLive();publish({immediate:true});}
    else {if(command.action==='lineups')assertBenchLimit(command.lineups?.home,command.lineups?.away);if(command.baseRevision!==undefined&&command.baseRevision!==state.match.revision&&!state.match.events.some(e=>e.id===command.id))throw Error('比赛数据已变化，请重新确认预览');const next=command.action==='record'?recordMatchEvent(state.match,command):changeMatch(state.match,command);state.match=next;state.draft.score=deriveMatch(next).score;state.draft.goals=deriveMatch(next).goals;state.draft.shootout=structuredClone(next.shootout);if(command.publish!==false)refreshLive();}
    if(command.broadcast){const event=state.match.events.find(e=>e.id===command.id)||state.match.events.findLast(e=>!e.parentEventId);enqueue(cue({scene:eventScene(event),eventId:event.id}));}
    await save();
   });return json(res,controller());
  }
  if(url.pathname==='/api/queue'&&req.method==='POST'){
   const command=JSON.parse((await body(req)).toString('utf8'));
   await mutate(async()=>{if(command.action==='next')finishCue();else if(command.action==='remove')state.queue=state.queue.filter(q=>q.id!==command.id);else if(command.action==='flush')state.queue=[];else if(command.action==='sequence'){const scenes=Array.isArray(command.scenes)?command.scenes:[];const items=scenes.slice(0,40).map(c=>cue(typeof c==='string'?{scene:c}:c));for(const item of items)enqueue(item);}else throw Error('队列操作无效');await save();});return json(res,controller());
  }
  if(url.pathname==='/api/live'&&req.method==='POST'){
   const command=JSON.parse((await body(req)).toString('utf8'));
   await mutate(async()=>{
    if(command.action==='clear'){state.queue=[];state.live={...state.live,scene:'clear',runId:randomUUID(),startedAt:Date.now(),expiresAt:null,eventId:null};publish({immediate:true});}
    else if(command.action==='scoreboard'){
     if(!state.publishedDraft.config.modules.scoreboard)throw Error('直播中的常驻比分牌未启用，请在系统设置启用后更新直播资料');
     state.queue=[];startCue({id:randomUUID(),template:structuredClone(state.publishedDraft),scene:'scoreboard',context:'pregame',team:state.publishedDraft.config.team,eventId:null,holdMs:null,priority:50});
    }
    else if(command.action==='update'){
     state.publishedDraft=structuredClone(state.draft);state.outputDelayMs=state.draft.config.delayMs;state.queue=state.queue.filter(q=>state.draft.config.modules[q.scene]).map(q=>({...q,template:structuredClone(state.draft)}));
     const current=deriveMatch(state.match).score;for(const team of ['home','away'])if(state.draft.score[team]!==current[team])state.match=changeMatch(state.match,{action:'record',event:{type:'adjustment',team,delta:state.draft.score[team]-current[team],text:'手动比分校正'}});
     refreshLive();
    }else enqueue(cue(command),!!command.force||command.scene==='scoreboard');
    await save();
   });return json(res,snapshot());
  }
  if(url.pathname==='/api/export'&&req.method==='GET'){
   const assets={},refs=new Set([...JSON.stringify({draft:state.draft,match:state.match}).matchAll(/uploads\/([a-f0-9]{64}\.(?:svg|png|jpg|jpeg|webp|mp4|webm|ttf|otf|woff2?))/g)].map(m=>m[1]));let total=0;for(const name of refs){const stat=await fs.stat(path.join(assetFolder,name)).catch(()=>null);if(!stat)throw Error('项目引用的素材缺失：'+name);total+=stat.size;if(total>180*1024*1024)throw Error('当前引用素材超过180MB，请停止服务后复制完整程序及runtime目录移机');assets[name]=(await fs.readFile(path.join(assetFolder,name))).toString('base64');}
   const match=structuredClone(state.match);match.clock.elapsedMs=clockMs(match.clock);match.clock.anchor=Date.now();match.clock.running=false;match.recovery=null;return json(res,{format:'HUST_CUP_BROADCAST',version:1,exportedAt:Date.now(),draft:state.draft,match,assets});
  }
  if(url.pathname==='/api/import'&&req.method==='POST'){
   const pack=JSON.parse((await body(req,256*1024*1024)).toString('utf8'));
   if(pack.format!=='HUST_CUP_BROADCAST'||pack.version!==1||!pack.match)throw Error('项目包格式无效');
   assertBenchLimit(pack.draft?.formation,pack.draft?.awayFormation,pack.match.initial?.lineups?.home,pack.match.initial?.lineups?.away);const clean=normalizeDraft(pack.draft||{},sample);let match=pack.match;if(match.version!==1||!Array.isArray(match.events)||match.events.length>2000||!match.clock||!PHASES[match.clock.phase]||!Number.isFinite(match.clock.elapsedMs)||match.clock.elapsedMs<0||!Number.isFinite(match.clock.halfMinutes)||match.clock.halfMinutes<1||match.clock.halfMinutes>120||!Number.isFinite(match.clock.extraMinutes)||match.clock.extraMinutes<1||match.clock.extraMinutes>60||match.events.some(e=>!EVENT_LABELS[e.type]))throw Error('比赛或计时存档无效');const sanitized=normalizeDraft({...clean,score:match.initial.score,goals:match.initial.goals,formation:match.initial.lineups.home,awayFormation:match.initial.lineups.away},sample);match.initial={score:sanitized.score,goals:sanitized.goals,lineups:{home:sanitized.formation,away:sanitized.awayFormation}};for(const team of ['home','away'])if(!Array.isArray(match.shootout?.[team])||match.shootout[team].length>200||match.shootout[team].some(v=>v!==0&&v!==1&&v!==null))throw Error('点球存档无效');for(const e of match.events){if(!['home','away'].includes(e.team)||typeof e.id!=='string'||e.id.length>80||e.type==='adjustment'&&(!Number.isInteger(e.delta)||Math.abs(e.delta)>999)||e.type==='substitution'&&(!Array.isArray(e.pairs)||e.pairs.length>10))throw Error('事件存档格式无效');}match.shootout.first=match.shootout.first==='away'?'away':'home';match.shootout.players=match.shootout.players||{home:[],away:[]};match.halftimeStats=changeMatch({...match,clock:{...match.clock,phase:'pregame'}},{action:'stats',stats:match.halftimeStats||{}}).stats;match=changeMatch(match,{action:'stats',stats:match.stats||{}});match=changeMatch(match,{action:'tie',enabled:match.tie?.enabled,home:match.tie?.firstLeg?.home||0,away:match.tie?.firstLeg?.away||0,awayGoals:match.tie?.awayGoals,firstLegAway:match.tie?.firstLegAway});match=changeMatch(match,{action:'result',confirmed:false,winner:match.result?.winner,label:match.result?.label,mvp:match.result?.mvp});deriveMatch(match);
   const entries=Object.entries(pack.assets||{});if(entries.length>500)throw Error('素材过多');const checked=[];
   for(const [name,value] of entries){if(!/^[a-f0-9]{64}\.[a-z0-9]+$/.test(name)||typeof value!=='string')throw Error('素材名称无效');const bytes=Buffer.from(value,'base64');if(inspectAsset(bytes,name)!==name)throw Error('素材校验失败');checked.push([name,bytes]);}
   await mutate(async()=>{for(const [name,bytes] of checked)await fs.writeFile(path.join(assetFolder,name),bytes);state.draft=clean;state.publishedDraft=structuredClone(clean);state.outputDelayMs=clean.config.delayMs;state.match=match;state.match.clock.running=false;state.match.clock.anchor=Date.now();state.match.recovery=null;state.queue=[];state.live={...state.live,scene:'clear',expiresAt:null,eventId:null};state.live.data=composeData(clean,match);publish({immediate:true});await save();});return json(res,controller());
  }
  if(url.pathname==='/api/assets'&&req.method==='POST'){const bytes=await body(req,100*1024*1024);const name=inspectAsset(bytes,url.searchParams.get('name')||'');await fs.writeFile(path.join(assetFolder,name),bytes);return json(res,{path:'uploads/'+name});}
  if(url.pathname.startsWith('/api/'))return json(res,{error:'接口不存在'},404);
  const uploaded=url.pathname.startsWith('/uploads/');
  if(uploaded&&!/^\/uploads\/[a-f0-9]{64}\.(svg|png|jpg|jpeg|webp|mp4|webm|ttf|otf|woff|woff2)$/.test(url.pathname))return json(res,{error:'素材路径无效'},404);
  const base=uploaded?assetFolder:root;
  const relative=uploaded?url.pathname.slice(9):decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
  const target=path.resolve(base,uploaded?relative:'.'+relative);
  if(!target.startsWith(base+path.sep))return json(res,{error:'路径无效'},403);
  const stat=await fs.stat(target);if(!stat.isFile())return json(res,{error:'文件不存在'},404);
  const headers={'Content-Type':mime[path.extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':uploaded?'private, max-age=3600':'no-store','Accept-Ranges':'bytes'};
  if(path.extname(target)==='.svg')headers['Content-Security-Policy']="default-src 'none'; style-src 'unsafe-inline'";
  if(req.headers.range){
   const range=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);let start,end;
   if(range){start=range[1]?Number(range[1]):Math.max(0,stat.size-Number(range[2]));end=range[1]?(range[2]?Number(range[2]):stat.size-1):stat.size-1;}
   if(!range||!Number.isFinite(start)||!Number.isFinite(end)||start>end||start>=stat.size){res.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
   end=Math.min(end,stat.size-1);res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${stat.size}`});if(req.method==='HEAD')res.end();else createReadStream(target,{start,end}).on('error',()=>res.destroy()).pipe(res);return;
  }
  res.writeHead(200,{...headers,'Content-Length':stat.size});if(req.method==='HEAD')res.end();else createReadStream(target).on('error',()=>res.destroy()).pipe(res);
 }catch(error){if(!res.headersSent)json(res,{error:error.code==='ENOENT'?'文件不存在':error.message},error.status||(error.code==='ENOENT'?404:400));else res.destroy();}
});
const scheduler=setInterval(()=>{if(state.live.expiresAt&&Date.now()>=state.live.expiresAt)mutate(async()=>{if(state.live.expiresAt&&Date.now()>=state.live.expiresAt){finishCue();await save();}}).catch(console.error);notify();},100);scheduler.unref();
const checkpoint=setInterval(()=>{if(state.match.clock.running)mutate(()=>save()).catch(console.error);},5000);checkpoint.unref();
const heartbeat=setInterval(()=>{for(const [res] of clients)res.write(': heartbeat\n\n');},15000);heartbeat.unref();
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已占用，请停止旧服务或设置 PORT。`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const activePort=server.address().port;console.log(`HUST_CUP_BROADCAST ${applicationVersion}\n后台：http://127.0.0.1:${activePort}/\nOBS：http://127.0.0.1:${activePort}/overlay.html?mode=live&transparent=1\n按 Ctrl+C 停止。本地完整播出系统；恢复存档后计时暂停，临时包装清空。`);});
