import path from 'node:path';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PORT||3210);
const url=`http://127.0.0.1:${port}/`;
const noBrowser=process.env.HUST_NO_BROWSER==='1';
let logFile;
async function report(message){console.log(message);if(logFile)await fs.appendFile(logFile,`[${new Date().toISOString()}] ${message}\n`).catch(()=>{});}
async function health(){try{const r=await fetch(url+'api/health',{signal:AbortSignal.timeout(700)});if(!r.ok)return false;return (await r.json()).application==='HUST_CUP_BROADCAST';}catch{return false;}}
function openBrowser(){
 if(noBrowser)return;
 const command=process.platform==='win32'?['cmd.exe',['/d','/c','start','',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
 const browser=spawn(command[0],command[1],{windowsHide:true,stdio:'ignore'});browser.on('error',()=>report('Open this address in your browser: '+url));
}
async function main(){
 if(Number(process.versions.node.split('.')[0])<20)throw new Error('Node.js 20 or newer is required.');
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
 const runtime=path.resolve(process.env.HUST_DATA_DIR||path.join(root,'runtime'));await fs.mkdir(runtime,{recursive:true});logFile=path.join(runtime,'startup.log');
 await report('HUST_CUP_BROADCAST startup');
 if(await health()){await report('[ALREADY RUNNING] '+url);openBrowser();return;}
 const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env:{...process.env,PORT:String(port)},windowsHide:true,stdio:['inherit','pipe','pipe']});
 let closed=false,exitCode=0,spawnError;
 const completion=new Promise(resolve=>{child.once('error',error=>{spawnError=error;closed=true;exitCode=1;resolve();});child.once('close',code=>{closed=true;exitCode=code??1;resolve();});});
 for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{(stream===child.stdout?process.stdout:process.stderr).write(chunk);fs.appendFile(logFile,chunk).catch(()=>{});});
 const stop=()=>{if(!closed)child.kill('SIGINT');};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{
  let ready=false;
  for(let attempt=0;attempt<24;attempt++){if(await health()){ready=true;break;}if(closed)break;await new Promise(resolve=>setTimeout(resolve,250));}
  if(!ready){stop();await completion;throw new Error(spawnError?.message||'Server did not start. Check the messages above and runtime/startup.log. The port may be in use.');}
  await report('[READY] '+url);await report('Keep this window open. Press Ctrl+C to stop.');openBrowser();
  await completion;process.exitCode=exitCode;
 }finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
main().catch(async error=>{await report('[ERROR] '+error.message);process.exitCode=1;});
