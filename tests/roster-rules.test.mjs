import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeDraft,formationTimeline,formationDuration} from '../public/model.js';
import {MATCH_FORMATS,MAX_BENCH,formationsFor,arrangeFormation,arrangeCustom,assertLineups,lineupErrors} from '../public/roster-rules.js';
import {newMatch,changeMatch,deriveMatch,composeData} from '../public/match.js';
const sample=JSON.parse(await fs.readFile(new URL('../public/data/demo.json',import.meta.url),'utf8'));
const draft=(n=11)=>{const d=normalizeDraft({},sample);d.rules.playersPerSide=n;for(const key of ['formation','awayFormation']){const l=d[key];l.bench.push(...l.players.splice(n));d[key]=arrangeFormation(l,formationsFor(n)[0],n);}return d;};

test('5/7/8/9/11人制每种预设恰好N人和1门将，保留身份媒体，空中场2-0-2自洽',()=>{
 for(const n of MATCH_FORMATS){const d=draft(n);for(const shape of formationsFor(n)){const l=arrangeFormation(d.formation,shape,n);assert.equal(l.players.length,n);assert.equal(l.players.filter(p=>p.goalkeeper).length,1);assert.deepEqual(lineupErrors(l,n),[]);assert.deepEqual(l.players.map(p=>[p.id,p.name,p.number,p.photo]),d.formation.players.map(p=>[p.id,p.name,p.number,p.photo]));assert(l.players.every(p=>p.x>=8&&p.x<=92&&p.y>=10&&p.y<=89));}assert.doesNotThrow(()=>newMatch(d));}
 const d=draft(5);d.formation=arrangeFormation(d.formation,'2-0-2',5);assert(!formationTimeline(d).some(s=>s.group==='midfielders'));assert.equal(normalizeDraft({},sample).rules.playersPerSide,11);
});

test('自定义分线必须正好N人/1门将，拒绝重复号码、身份、空姓名和第17替补，不截断草稿',()=>{
 const d=draft(9),l=d.formation;l.players.forEach((p,i)=>{p.group=i===0?'goalkeeper':i<7?'defenders':'forwards';p.goalkeeper=i===0;});const custom=arrangeCustom(l,9);assert.equal(custom.name,'6-0-2');assert(custom.custom);assert.deepEqual(lineupErrors(custom,9),[]);assert.throws(()=>arrangeCustom(custom,8),/8/);
 for(const mutate of [x=>x.players[1].group='goalkeeper',x=>x.players[1].number=x.players[0].number,x=>x.players[1].id=x.players[0].id,x=>x.players[0].name='']){const invalid=structuredClone(custom);mutate(invalid);assert.throws(()=>assertLineups(d.rules,invalid,d.awayFormation));}
 l.bench=Array.from({length:MAX_BENCH},(_,i)=>({...l.players[0],id:'b'+i,number:100+i}));assert.doesNotThrow(()=>assertLineups(d.rules,arrangeCustom(l,9),d.awayFormation));l.bench.push({...l.bench[0],id:'b16',number:116});assert.throws(()=>assertLineups(d.rules,arrangeCustom(l,9)),/16/);assert.equal(normalizeDraft(d,sample).formation.bench.length,17);
});

test('自定义大分线每批最多5人，全批完成才转回照片阵型；客队时间轴和收起有效',()=>{
 const d=draft();d.config.lineupBoth=true;for(const k of ['formation','awayFormation']){d[k].players.forEach((p,i)=>{p.group=i?'defenders':'goalkeeper';p.goalkeeper=!i;});d[k]=arrangeCustom(d[k],11);}
 const steps=formationTimeline(d);for(const team of ['home','away']){const media=steps.filter(s=>s.team===team&&s.kind==='media'&&s.group==='defenders');assert.equal(media.length,2);assert(media.every(s=>s.playerIds.length===5));assert.equal(new Set(media.flatMap(s=>s.playerIds)).size,10);assert(media.every(s=>s.introStart<s.start&&s.mediaStart===s.start&&s.groupEnd>s.end));const after=steps.find(s=>s.team===team&&s.kind==='formation'&&s.revealed.includes('defenders'));assert(after.start>=media.at(-1).end+700);}
 assert.equal(steps.filter(s=>s.kind==='lineClose').length,6);assert(formationDuration(d)>steps.at(-1).start);
});

test('滚动换人可再次上场；原首发不变、人数不变、普通换人和被罚下者不可回场',()=>{
 const d=draft(5);d.rules.substitutions='rolling';let m=newMatch(d);const off=m.initial.lineups.home.players[1].id,on=m.initial.lineups.home.bench[0].id,swap=(offId,onId)=>({action:'record',event:{type:'substitution',team:'home',pairs:[{offId,onId}]}});
 m=changeMatch(m,swap(off,on));assert(deriveMatch(m).lineups.home.bench.some(p=>p.id===off));m=changeMatch(m,swap(on,off));assert.equal(deriveMatch(m).lineups.home.players.length,5);assert(deriveMatch(m).lineups.home.players.some(p=>p.id===off));assert.deepEqual(m.initial.lineups,newMatch(d).initial.lineups);
 m=changeMatch(m,{action:'record',event:{type:'card',team:'home',role:'bench',playerId:on,card:'red'}});assert.throws(()=>changeMatch(m,swap(off,on)),/罚下/);assert.equal(deriveMatch(m).reds.home,0);
 const once=draft(5);m=newMatch(once);m=changeMatch(m,swap(off,on));assert.throws(()=>changeMatch(m,swap(on,off)));m=newMatch(once);m=changeMatch(m,{action:'record',event:{type:'card',team:'home',role:'player',playerId:off,card:'red'}});assert.equal(deriveMatch(m).reds.home,1);assert.throws(()=>changeMatch(m,swap(off,on)),/罚下/);assert.equal(deriveMatch(m).lineups.home.players.filter(p=>!p.dismissed).length,4);
});

test('人数与换人方式赛前同步，已开赛或已记账须新建比赛；计时时长不随人数暗改',()=>{
 const old=draft(),d=draft(7);let m=newMatch(old);const cmd={action:'lineups',rules:d.rules,lineups:{home:d.formation,away:d.awayFormation}};m=changeMatch(m,cmd);assert.equal(m.rules.playersPerSide,7);assert.equal(m.clock.halfMinutes,45);assert.equal(composeData(old,m).rules.playersPerSide,7);m=changeMatch(m,{action:'clock',operation:'phase',phase:'first'});assert.throws(()=>changeMatch(m,{...cmd,rules:{...d.rules,substitutions:'rolling'}}),/新建比赛/);
 m=newMatch(d);m=changeMatch(m,{action:'record',event:{type:'notice',text:'已开始准备'}});assert.throws(()=>changeMatch(m,{...cmd,rules:{...d.rules,substitutions:'rolling'}}),/新建比赛/);
});
