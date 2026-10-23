import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {normalizeDraft,outputScene} from '../public/model.js';
import {newMatch,changeMatch,deriveMatch} from '../public/match.js';
import {createGoal2} from '../lib/goal2.mjs';
const sample=JSON.parse(await fs.readFile(new URL('../public/data/demo.json',import.meta.url),'utf8'));
const draft=()=>normalizeDraft({},sample);
test('播出明确停留时长优先于模块默认值，刷新使用相同过期时间',()=>{
 const d=draft(),live={scene:'officials',data:d,startedAt:1000,expiresAt:10000};
 assert.equal(outputScene(live,8500).scene,'officials');
 assert.equal(outputScene(live,10000).scene,'scoreboard');
 live.scene='bottomScore';live.context='halftime';live.expiresAt=6500;
 assert.equal(outputScene(live,6499).scene,'bottomScore');
 assert.equal(outputScene(live,6500).scene,'scoreboard');
});
test('中场补记事件归上半场，临时中断事件保留原阶段补时分钟',()=>{
 let m=newMatch(draft(),{now:1000});
 m=changeMatch(m,{action:'clock',operation:'apply',phase:'first'},1000);
 m=changeMatch(m,{action:'clock',operation:'calibrate',seconds:47*60+20},1000);
 m=changeMatch(m,{action:'clock',operation:'phase',phase:'interrupted'},1000);
 m=changeMatch(m,{action:'record',id:'interrupted-goal',event:{type:'goal',team:'home'}},1000);
 assert.equal(m.events.at(-1).period,'first');assert.equal(m.events.at(-1).time,'45+3′');
 m=changeMatch(m,{action:'clock',operation:'phase',phase:'halftime'},1000);
 m=changeMatch(m,{action:'record',id:'halftime-correction',event:{type:'adjustment',team:'away',delta:1}},1000);
 assert.deepEqual(deriveMatch(m).halftimeScore,{home:1,away:1});
});
test('明确两黄变红未单记第一黄时，累计黄牌仍增加两张',()=>{
 let m=newMatch(draft()),p=m.initial.lineups.home.players[1];
 m=changeMatch(m,{action:'record',event:{type:'card',team:'home',role:'player',playerId:p.id,card:'secondYellow'}});
 const a=deriveMatch(m),current=a.lineups.home.players.find(x=>x.id===p.id);
 assert.equal(current.matchYellow,2);assert.equal(current.yellowCards,p.yellowCards+2);assert.equal(a.reds.home,1);
});
test('二路连续播出时，统一延迟期间继续显示上一条，不能提前切空',()=>{
 const d=draft(),m=newMatch(d),originalNow=Date.now;let now=10000;Date.now=()=>now;
 try{
  const g=createGoal2(()=>({match:m,draft:d,delayMs:1000})),p=m.initial.lineups.home.players;
  const a=g.prepare({team:'home',playerId:p[0].id});g.play({token:a.token});now=12000;const first=g.snapshot().run;
  const b=g.prepare({team:'home',playerId:p[1].id});g.play({token:b.token});
  assert.equal(g.snapshot().run.id,first.id);now=13000;assert.equal(g.snapshot().run.payload.playerId,p[1].id);
  g.control({action:'clear'});assert.equal(g.snapshot().run,null);
 }finally{Date.now=originalNow;}
});
test('服务：仅调整延迟不发布其他草稿，多组换人停留足够展示全部组合',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'hust-audit-'));let child;
 try{
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0',HUST_DATA_DIR:folder},windowsHide:true,stdio:['ignore','pipe','pipe']});
  const port=await new Promise((resolve,reject)=>{let log='';const t=setTimeout(()=>reject(Error('启动超时 '+log)),10000);child.stdout.on('data',b=>{log+=b;const m=log.match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(t);resolve(m[1]);}});child.once('error',reject);});
  const api=async(route,method='GET',data)=>{const r=await fetch('http://127.0.0.1:'+port+route,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const v=await r.json();assert.equal(r.status,200,JSON.stringify(v));return v;};
  await api('/api/control','POST',{action:'newMatch',confirm:'RESET'});
  const initial=await api('/api/control-state'),lineup=initial.match.initial.lineups.home;
  await api('/api/control','POST',{action:'record',id:'batch-sub',event:{type:'substitution',team:'home',pairs:lineup.bench.map((p,i)=>({onId:p.id,offId:lineup.players[i].id}))}});
  await api('/api/live','POST',{scene:'substitution',eventId:'batch-sub',holdMs:1200,force:true});
  const cue=(await api('/api/control-state')).live;assert(cue.expiresAt-cue.startedAt>=lineup.bench.length*1200);
  const before=await api('/api/control-state'),d=(await api('/api/draft')).draft;d.home.name='未核对的草稿名称';d.formation.players.pop();await api('/api/draft','PUT',d);
  await api('/api/live','POST',{action:'delay',delayMs:1200});const after=await api('/api/control-state');
  assert.equal(after.outputDelayMs,1200);assert.equal(after.draft.config.delayMs,1200);assert.equal(after.live.data.home.name,before.live.data.home.name);assert.equal(after.draft.home.name,d.home.name);assert.deepEqual(after.match,before.match);
 }finally{if(child&&!child.killed){const stopped=once(child,'exit');child.kill();await stopped;}await fs.rm(folder,{recursive:true,force:true,maxRetries:5});}
});
