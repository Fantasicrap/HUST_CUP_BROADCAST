import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {normalizeDraft,SCENES,CONTEXTS} from './public/model.js';
import {inspectAsset} from './lib/assets.mjs';
const project=path.dirname(fileURLToPath(import.meta.url));
const root=path.join(project,'public');
const runtime=path.resolve(process.env.HUST_DATA_DIR||path.join(project,'runtime'));
const assetFolder=path.join(runtime,'assets');
await fs.mkdir(assetFolder,{recursive:true});
const sample=JSON.parse(await fs.readFile(path.join(root,'data/demo.json'),'utf8'));
const initial=normalizeDraft({},sample);
let state={schema:2,draft:initial,live:{data:structuredClone(initial),scene:'scoreboard',context:'pregame',startedAt:Date.now(),runId:randomUUID(),revision:0}};
try{const saved=JSON.parse(await fs.readFile(path.join(runtime,'state.json'),'utf8'));state={schema:2,draft:normalizeDraft(saved.draft||{},sample),live:{...saved.live,data:normalizeDraft(saved.live?.data||{},sample)}};}catch(error){if(error.code!=='ENOENT'){console.error('存档读取失败，未覆盖原存档。请检查 runtime/state.json。');process.exit(1);}}
let writing=Promise.resolve();
const save=()=>{const content=JSON.stringify(state,null,2);writing=writing.catch(()=>{}).then(async()=>{const temp=path.join(runtime,'state.tmp');await fs.writeFile(temp,content);await fs.rename(temp,path.join(runtime,'state.json'));});return writing;};
const clients=new Set();
const snapshot=()=>({live:state.live,serverNow:Date.now()});
const notify=()=>{const message=`data: ${JSON.stringify(snapshot())}\n\n`;for(const res of clients)res.write(message);};
const port=Number(process.env.PORT||3210);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.webm':'video/webm'};
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
  if(url.pathname==='/api/draft'&&req.method==='GET')return json(res,{draft:state.draft,serverNow:Date.now()});
  if(url.pathname==='/api/draft'&&req.method==='PUT'){state.draft=normalizeDraft(JSON.parse((await body(req)).toString('utf8')),sample);await save();return json(res,{draft:state.draft});}
  if(url.pathname==='/api/output'&&req.method==='GET')return json(res,snapshot());
  if(url.pathname==='/api/connections'&&req.method==='GET')return json(res,{outputs:clients.size});
  if(url.pathname==='/api/events'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`data: ${JSON.stringify(snapshot())}\n\n`);clients.add(res);res.on('close',()=>clients.delete(res));return;}
  if(url.pathname==='/api/live'&&req.method==='POST'){
   const command=JSON.parse((await body(req)).toString('utf8'));
   if(command.action==='clear')state.live={...state.live,scene:'clear',runId:randomUUID(),startedAt:Date.now(),revision:state.live.revision+1};
   else if(command.action==='update')state.live={...state.live,data:structuredClone(state.draft),revision:state.live.revision+1};
   else{
    if(!SCENES.includes(command.scene)||!state.draft.config.modules[command.scene])return json(res,{error:'该模块未启用，不能播出'},400);
    const context=Object.hasOwn(CONTEXTS,command.context)?command.context:'pregame';
    if(command.scene==='bottomScore'&&!state.draft.config.contexts[context])return json(res,{error:'该底部比分场景未启用'},400);
    state.live={data:structuredClone(state.draft),scene:command.scene,context,runId:randomUUID(),startedAt:Date.now(),revision:state.live.revision+1};
   }
   await save();notify();return json(res,snapshot());
  }
  if(url.pathname==='/api/assets'&&req.method==='POST'){const bytes=await body(req,100*1024*1024);const name=inspectAsset(bytes,url.searchParams.get('name')||'');await fs.writeFile(path.join(assetFolder,name),bytes);return json(res,{path:'uploads/'+name});}
  if(url.pathname.startsWith('/api/'))return json(res,{error:'接口不存在'},404);
  const uploaded=url.pathname.startsWith('/uploads/');
  if(uploaded&&!/^\/uploads\/[a-f0-9]{64}\.(svg|png|jpg|jpeg|webp|mp4|webm)$/.test(url.pathname))return json(res,{error:'素材路径无效'},404);
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
const heartbeat=setInterval(()=>{for(const res of clients)res.write(': heartbeat\n\n');},15000);heartbeat.unref();
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`端口 ${port} 已占用，请停止旧服务或设置 PORT。`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{const activePort=server.address().port;console.log(`HUST_CUP_BROADCAST v0.2\n后台：http://127.0.0.1:${activePort}/\nOBS：http://127.0.0.1:${activePort}/overlay.html?mode=live&transparent=1\n按 Ctrl+C 停止。计时仍为示例；资料编辑与正式播出已分离。`);});
