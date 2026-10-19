import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
const project=new URL('../',import.meta.url);
async function start(folder){const child=spawn(process.execPath,['server.mjs'],{cwd:project,env:{...process.env,PORT:'0',HUST_DATA_DIR:folder},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';const port=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('测试服务启动超时')),10000);child.stdout.on('data',chunk=>{log+=chunk;const match=log.match(/127\.0\.0\.1:(\d+)/);if(match){clearTimeout(timeout);resolve(Number(match[1]));}});child.once('error',reject);child.once('exit',()=>{clearTimeout(timeout);reject(new Error('服务提前退出：'+log));});});return {child,url:'http://127.0.0.1:'+port};}
test('服务：草稿隔离、正式更新不重播、模块禁用、上传、Range、清屏与重启恢复',async()=>{
 const tempRoot=path.resolve(os.tmpdir()),folder=await fs.mkdtemp(path.join(tempRoot,'hust-test-'));let app;
 const stop=async()=>{if(app?.child&&!app.child.killed){const exited=once(app.child,'exit');app.child.kill();await exited;}};
 try{
  app=await start(folder);const call=async(route,method='GET',value)=>{const r=await fetch(app.url+route,{method,headers:value?{'Content-Type':'application/json'}:{},body:value?JSON.stringify(value):undefined});return {status:r.status,data:await r.json()};};
  const draft=(await call('/api/draft')).data.draft,initial=(await call('/api/output')).data.live;draft.score.home=7;draft.config.bottomHoldMs=5000;
  assert.equal((await call('/api/draft','PUT',draft)).status,200);assert.equal((await call('/api/output')).data.live.data.score.home,2);
  let result=await call('/api/live','POST',{scene:'bottomScore',context:'halftime'});assert.equal(result.data.live.data.score.home,2);const id=result.data.live.runId,startTime=result.data.live.startedAt;
  draft.score.home=8;await call('/api/draft','PUT',draft);result=await call('/api/live','POST',{action:'update'});assert.equal(result.data.live.runId,id);assert.equal(result.data.live.startedAt,startTime);assert.equal(result.data.live.data.score.home,8);
  draft.config.modules.goal=false;await call('/api/draft','PUT',draft);assert.equal((await call('/api/live','POST',{scene:'goal'})).status,400);
  const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="#f00" d="M0 0h10v10H0Z"/></svg>');const upload=await fetch(app.url+'/api/assets?name=badge.svg',{method:'POST',body:bytes});assert.equal(upload.status,200);const asset=(await upload.json()).path;const read=await fetch(app.url+'/'+asset);assert.equal(read.status,200);assert.deepEqual(Buffer.from(await read.arrayBuffer()),bytes);
  const range=await fetch(app.url+'/'+asset,{headers:{Range:'bytes=2-12'}});assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),`bytes 2-12/${bytes.length}`);assert.deepEqual(Buffer.from(await range.arrayBuffer()),bytes.subarray(2,13));
  const bad=await fetch(app.url+'/api/assets?name=logo.svg',{method:'POST',body:'<svg onload="x"/>'});assert.equal(bad.status,400);
  draft.home.badge=asset;await call('/api/draft','PUT',draft);
  const stream=await fetch(app.url+'/api/events',{signal:AbortSignal.timeout(6000)}),reader=stream.body.getReader(),decoder=new TextDecoder();let pending='';
  const nextEvent=async()=>{while(!pending.includes('\n\n')){const chunk=await reader.read();assert(!chunk.done);pending+=decoder.decode(chunk.value,{stream:true});}const split=pending.indexOf('\n\n'),block=pending.slice(0,split);pending=pending.slice(split+2);return JSON.parse(block.split('\n').find(line=>line.startsWith('data: ')).slice(6));};
  assert.equal((await nextEvent()).live.scene,'bottomScore');
  await call('/api/live','POST',{action:'clear'});let pushed;for(let i=0;i<20;i++){pushed=await nextEvent();if(pushed.live.scene==='clear')break;}assert.equal(pushed.live.scene,'clear');assert.equal(pushed.draft,undefined);await reader.cancel();
  assert.equal((await call('/api/output')).data.live.scene,'clear');await stop();app=await start(folder);
  const restored=await call('/api/output');assert.equal(restored.data.live.scene,'clear');assert.equal((await call('/api/draft')).data.draft.home.badge,asset);assert.equal((await fetch(app.url+'/'+asset)).status,200);assert.notEqual(initial.runId,restored.data.live.runId);
 }finally{await stop();assert(folder.startsWith(tempRoot+path.sep)&&path.basename(folder).startsWith('hust-test-'));await fs.rm(folder,{recursive:true,force:true});}
});
