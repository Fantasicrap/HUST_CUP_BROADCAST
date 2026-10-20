import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createPortraitProcessor} from '../lib/portraits.mjs';
import {inspectAsset} from '../lib/assets.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK0cAAAAASUVORK5CYII=','base64');
test('可选抠图：环境缺失明确提示；拒绝远程路径、越界路径和非照片',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'hust-portrait-'));
 try{const processor=createPortraitProcessor({project:temp,runtime:temp});assert.equal((await processor.status()).ready,false);for(const value of ['https://example.com/a.jpg','../../a.png','uploads/'+ 'a'.repeat(64)+'.svg'])await assert.rejects(processor.processPortrait(value),/仅可处理/);await assert.rejects(processor.processPortrait('uploads/'+'a'.repeat(64)+'.png'),/尚未安装/);assert.equal((await processor.status()).busy,false);}finally{await fs.rm(temp,{recursive:true,force:true});}
});
test('抠图任务隔离：单张并发、保留原图、结果内容命名，失败释放任务且不残留临时文件',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'hust-portrait-'));
 try{
  const folder=path.join(temp,'background'),assets=path.join(temp,'assets'),python=path.join(temp,'.venv-background',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  await fs.mkdir(folder,{recursive:true});await fs.mkdir(assets);await fs.mkdir(path.dirname(python),{recursive:true});await fs.writeFile(python,'');await fs.writeFile(path.join(folder,'u2net_human_seg.onnx'),'');await fs.writeFile(path.join(folder,'ready.json'),'{}');const source='uploads/'+inspectAsset(png,'source.png');await fs.writeFile(path.join(assets,source.slice(8)),png);
  let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);const processor=createPortraitProcessor({project:temp,runtime:temp,run:async(_python,args)=>{entered();await gate;await fs.writeFile(args[2],png);return {width:1,height:1};}});
  const pending=processor.processPortrait(source);await ready;assert.equal((await processor.status()).busy,true);await assert.rejects(processor.processPortrait(source),/已有照片/);release();const result=await pending;assert.equal(result.original,source);assert.match(result.path,/^uploads\/[a-f0-9]{64}\.png$/);assert.deepEqual(await fs.readFile(path.join(assets,source.slice(8))),png);assert.equal((await processor.status()).busy,false);
  const failure=createPortraitProcessor({project:temp,runtime:temp,run:async()=>{throw Error('failed');}});await assert.rejects(failure.processPortrait(source),/failed/);assert.equal((await failure.status()).busy,false);assert.equal((await fs.readdir(folder)).filter(n=>n.endsWith('.png')).length,0);
 }finally{await fs.rm(temp,{recursive:true,force:true});}
});
