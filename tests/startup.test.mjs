import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('Windows 启动文件保持纯 ASCII 与 CRLF，避免代码页错误解析',async()=>{
 const bytes=await fs.readFile(path.join(project,'启动预览.cmd'));assert.deepEqual(await fs.readFile(path.join(project,'启动系统.cmd')),bytes);
 assert(bytes.every(v=>v<128));const content=bytes.toString('ascii');assert(!/(?<!\r)\n/.test(content));assert(content.includes('scripts\\start.mjs'));assert(content.includes('pause'));
});
const freePort=async()=>{const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;};
test('真实 cmd：中文空格路径、启动就绪、重复打开与缺少 Node 的明确提示',{skip:process.platform!=='win32'},async()=>{
 const tempRoot=path.resolve(os.tmpdir()),base=await fs.mkdtemp(path.join(tempRoot,'hust-launch-')),folder=path.join(base,'足球启动测试 with spaces');await fs.mkdir(folder);
 for(const file of ['server.mjs','package.json','启动预览.cmd','scripts/start.mjs','public/model.js','public/match.js','public/data/demo.json','lib/assets.mjs']){const dest=path.join(folder,file);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.copyFile(path.join(project,file),dest);}
 const port=await freePort();let batch;const healthUrl=`http://127.0.0.1:${port}/api/health`;
 const env={...process.env,PORT:String(port),HUST_NO_BROWSER:'1',HUST_NO_WAIT:'1'};
 const spawnBatch=(extra={})=>spawn('cmd.exe',['/d','/c','启动预览.cmd'],{cwd:folder,env:{...env,...extra},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  batch=spawnBatch();let log='';await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('CMD did not reach READY: '+log)),12000);const read=b=>{log+=b;if(log.includes('[READY]')){clearTimeout(timeout);resolve();}};batch.stdout.on('data',read);batch.stderr.on('data',read);batch.once('exit',code=>{clearTimeout(timeout);reject(new Error('CMD exited '+code+': '+log));});});
  const health=await fetch(healthUrl).then(r=>r.json());assert.equal(health.application,'HUST_CUP_BROADCAST');
  const second=spawnBatch();let secondLog='';second.stdout.on('data',b=>secondLog+=b);second.stderr.on('data',b=>secondLog+=b);const [secondCode]=await once(second,'exit');assert.equal(secondCode,0);assert(secondLog.includes('[ALREADY RUNNING]'));
  const bundled=path.join(process.env.USERPROFILE||'','.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe');
  if(await fs.access(bundled).then(()=>true,()=>false)){const fallback=spawnBatch({PATH:process.env.SystemRoot+'\\System32'});let fallbackLog='';fallback.stdout.on('data',b=>fallbackLog+=b);fallback.stderr.on('data',b=>fallbackLog+=b);const [fallbackCode]=await once(fallback,'exit');assert.equal(fallbackCode,0);assert(fallbackLog.includes('[ALREADY RUNNING]'));}
  const missing=spawnBatch({PATH:process.env.SystemRoot+'\\System32',USERPROFILE:path.join(base,'no-node-profile')});let missingLog='';missing.stdout.on('data',b=>missingLog+=b);missing.stderr.on('data',b=>missingLog+=b);const [missingCode]=await once(missing,'exit');assert.equal(missingCode,1);assert(missingLog.includes('[ERROR] Node.js 20'));
  const savedLog=await fs.readFile(path.join(folder,'runtime/startup.log'),'utf8');assert(savedLog.includes('[READY]'));
 }finally{
  // Terminate only the process tree created by this test.
  if(batch&&!batch.killed){const killer=spawn('taskkill.exe',['/PID',String(batch.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});await once(killer,'exit');}
  assert(base.startsWith(tempRoot+path.sep)&&path.basename(base).startsWith('hust-launch-'));await fs.rm(base,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 }
});
