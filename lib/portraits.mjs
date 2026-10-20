import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {inspectAsset} from './assets.mjs';

function worker(python,args,env){
 return new Promise((resolve,reject)=>{
  const child=spawn(python,args,{env,windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});let output='',error='';
  const timer=setTimeout(()=>{child.kill();reject(Error('抠图超过120秒，请使用原图或较小的照片重试'));},120000);
  child.stdout.on('data',b=>output+=b.toString());child.stderr.on('data',b=>{error=(error+b.toString()).slice(-2000);});
  child.on('error',()=>{clearTimeout(timer);reject(Error('无法启动本地抠图环境，请重新运行可选抠图安装步骤'));});
  child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error(error.includes('NO_PERSON')?'未检测到清晰人物，请保留原图或换一张照片':'抠图处理失败，请保留原图；检查环境与模型，照片需小于2400万像素'));try{resolve(JSON.parse(output));}catch{reject(Error('抠图结果无效，原图未改变'));}});
 });
}
export function createPortraitProcessor({project,runtime,run=worker}){
 const folder=path.join(runtime,'background'),model=path.join(folder,'u2net_human_seg.onnx');
 const python=process.env.HUST_REMBG_PYTHON||path.join(project,'.venv-background',process.platform==='win32'?'Scripts/python.exe':'bin/python');let busy=false;
 async function status(){const ready=await Promise.all([python,model,path.join(folder,'ready.json')].map(p=>fs.access(p).then(()=>true,()=>false)));return {ready:ready.every(Boolean),busy,model:'u2net_human_seg',message:ready.every(Boolean)?'本地CPU抠图已就绪，处理照片不联网':'尚未安装可选抠图环境；请按 docs/赛前人像抠图.md 完成一次性安装，仍可直接上传原图或透明PNG'};}
 async function processPortrait(source){
  if(!/^uploads\/[a-f0-9]{64}\.(png|jpg|jpeg|webp)$/.test(source||''))throw Error('仅可处理已上传的PNG、JPG或WebP球员照片');
  if(busy)throw Error('已有照片正在抠图，请等待完成');
  busy=true;const temp=path.join(folder,randomUUID()+'.png');const started=Date.now();
  try{
   if(!(await status()).ready)throw Error((await status()).message);
   const input=path.join(runtime,'assets',source.slice(8)),bytes=await fs.readFile(input);inspectAsset(bytes,source);
   const info=await run(python,[path.join(project,'scripts/portrait-cutout.py'),input,temp,model],{...process.env,OMP_NUM_THREADS:'2',PYTHONIOENCODING:'utf-8',U2NET_HOME:folder});
   const result=await fs.readFile(temp),name=inspectAsset(result,'portrait.png');await fs.writeFile(path.join(runtime,'assets',name),result);
   return {original:source,path:'uploads/'+name,width:info.width,height:info.height,elapsedMs:Date.now()-started};
  }finally{busy=false;await fs.rm(temp,{force:true});}
 }
 return {status,processPortrait};
}
