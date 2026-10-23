import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeDraft} from '../public/model.js';
import {normalizeRules,assertRules} from '../public/roster-rules.js';
import {newMatch,changeMatch,deriveMatch,composeData} from '../public/match.js';
import {eligibleSubstitutes,remainingSubstitutions} from '../public/substitution-rules.js';
const sample=JSON.parse(await fs.readFile(new URL('../public/data/demo.json',import.meta.url),'utf8'));
function fresh(limits={},rolling=false){const d=normalizeDraft({},sample);d.rules=normalizeRules({...d.rules,substitutions:rolling?'rolling':'once',substitutionLimits:{enabled:true,players:5,windows:3,concussion:true,...limits}});for(const key of ['formation','awayFormation'])d[key].bench=Array.from({length:8},(_,i)=>({...d[key].bench[0],id:key+'-sub-'+i,number:30+i,name:'替补'+i}));return {d,m:changeMatch(newMatch(d),{action:'clock',operation:'apply',phase:'first'},1000)};}
const phase=(m,p)=>changeMatch(m,{action:'clock',operation:'apply',phase:p},1000);
const swap=(m,{team='home',count=1,kind='normal',windowMode='new',id}={})=>{const l=deriveMatch(m).lineups[team];return changeMatch(m,{action:'record',id,event:{type:'substitution',team,windowMode,pairs:l.bench.slice(0,count).map((p,i)=>({offId:l.players[i+1].id,onId:p.id,kind}))}},1000);};
test('赛前换人名额/窗口配置与旧档兼容，开赛后不能改规则',()=>{
 assert.equal(normalizeRules({}).substitutionLimits.enabled,false);assert.equal(normalizeRules({}).substitutionLimits.concussion,false);
 for(const l of [{players:-1},{windows:1.5},{players:1000},{concussion:'yes'}])assert.throws(()=>assertRules({substitutionLimits:l}));
 const {m,d}=fresh();assert.throws(()=>changeMatch(m,{action:'lineups',rules:{...d.rules,substitutionLimits:{...d.rules.substitutionLimits,windows:4}},lineups:m.initial.lineups}),/新建比赛/);
});
test('整批多人换人只占一个窗口，中场占名额不占窗口，暂停不冒充中场',()=>{
 let {m}=fresh();m=swap(m,{count:2});assert.equal(deriveMatch(m).substitutions.home.windows,1);assert.equal(deriveMatch(m).substitutions.home.players,2);
 m=changeMatch(m,{action:'clock',operation:'pause'},1000);m=swap(m);assert.equal(deriveMatch(m).substitutions.home.windows,2);
 m=phase(m,'halftime');m=swap(m,{count:2});const a=deriveMatch(m);assert.equal(a.substitutions.home.windows,2);assert.equal(a.substitutions.home.players,5);assert.equal(a.lineups.home.players.length,11);assert.equal(m.initial.lineups.home.players.length,11);assert.throws(()=>swap(m),/名额不足/);
});
test('沿用同次暂停窗口不重复扣次数，阶段改变不能沿用；中场/加时休息窗口免费',()=>{
 let {m}=fresh({windows:1,players:8});m=swap(m);m=swap(m,{windowMode:'reuse'});assert.equal(deriveMatch(m).substitutions.home.windows,1);assert.throws(()=>swap(m),/窗口已用完/);
 m=phase(m,'halftime');m=swap(m);m=phase(m,'second');assert.throws(()=>swap(m,{windowMode:'reuse'}),/当前阶段/);
 for(const p of ['regulationEnd','extraBreak']){m=phase(m,p);m=swap(m);}assert.equal(deriveMatch(m).substitutions.home.windows,1);
});
test('脑震荡不占普通名额/窗口，对手获得一个专项额外名额/窗口，两队对称',()=>{
 for(const team of ['home','away']){let {m}=fresh({players:0,windows:0});const other=team==='home'?'away':'home';m=swap(m,{team,kind:'concussion'});let a=deriveMatch(m);assert.equal(a.substitutions[team].players,0);assert.equal(a.substitutions[team].windows,0);assert.equal(a.substitutions[team].concussion,1);assert.equal(a.substitutions[other].extraGranted,1);assert.throws(()=>swap(m,{team,kind:'concussion'}),/最多1/);assert.throws(()=>swap(m,{team:other}),/普通换人名额/);m=swap(m,{team:other,kind:'additional'});a=deriveMatch(m);assert.equal(a.substitutions[other].extraPlayers,1);assert.equal(a.substitutions[other].extraWindows,1);assert.throws(()=>swap(m,{team:other,kind:'additional'}),/额外换人名额不足/);}
});
test('同一批混合普通与脑震荡换人，只扣普通人数和一个窗口',()=>{
 const {m}=fresh(),l=deriveMatch(m).lineups.home;const next=changeMatch(m,{action:'record',event:{type:'substitution',team:'home',pairs:[{offId:l.players[1].id,onId:l.bench[0].id,kind:'normal'},{offId:l.players[2].id,onId:l.bench[1].id,kind:'concussion'}]}});const u=deriveMatch(next).substitutions;assert.equal(u.home.players,1);assert.equal(u.home.windows,1);assert.equal(u.home.concussion,1);assert.equal(u.away.extraGranted,1);
});
test('脑震荡换下者循环换人也不能再上，普通换下者仍可回场',()=>{
 let {m}=fresh({},true);const off=m.initial.lineups.home.players[1];m=swap(m,{kind:'concussion'});const a=deriveMatch(m);assert(!a.lineups.home.bench.some(p=>p.id===off.id));assert(a.lineups.home.used.some(p=>p.id===off.id&&p.concussionWithdrawn));assert(!eligibleSubstitutes(m,a,'home','concussion').some(p=>p.id===off.id));
});
test('旧记录/重播不重复扣额，撤销自动回滚；已使用的对手赠送额度阻止直接撤销来源',()=>{
 let {m}=fresh();m=swap(m,{kind:'concussion',id:'concussion-source'});m=swap(m,{team:'away',kind:'additional',id:'additional-use'});assert.throws(()=>changeMatch(m,{action:'editEvent',id:'concussion-source',active:false}),/额外/);m=changeMatch(m,{action:'editEvent',id:'additional-use',active:false});m=changeMatch(m,{action:'editEvent',id:'concussion-source',active:false});assert.equal(deriveMatch(m).substitutions.away.extraGranted,0);assert.equal(deriveMatch(m).substitutions.home.concussion,0);
 let normal=fresh().m;normal=swap(normal,{id:'repeat'});normal=changeMatch(normal,{action:'record',id:'repeat',event:{type:'substitution',team:'home'}});assert.equal(deriveMatch(normal).substitutions.home.players,1);
});
test('换人类型/真实发生时段纠错会重算名额与窗口，不改原始首发',()=>{
 let {m,d}=fresh();m=swap(m,{id:'correct-sub'});m=changeMatch(m,{action:'editEvent',id:'correct-sub',patch:{substitutionPhase:'halftime'}});assert.equal(deriveMatch(m).substitutions.home.windows,0);m=changeMatch(m,{action:'editEvent',id:'correct-sub',patch:{substitutionKinds:['concussion']}});const out=composeData(d,m);assert.equal(out.substitutionUsage.home.players,0);assert.equal(out.substitutionUsage.away.extraGranted,1);assert.equal(out.currentLineups.home.players.length,11);assert.equal(m.initial.lineups.home.players.length,11);
});

test('默认新项目3窗口5名额，旧规则不追溯限制；额外括号仅实际赠送后产生',()=>{
 const d=normalizeDraft({},sample);assert.deepEqual(d.rules.substitutionLimits,{enabled:true,players:5,windows:3,concussion:false});
 assert.equal(normalizeDraft({rules:{playersPerSide:11,substitutions:'once'}},sample).rules.substitutionLimits.enabled,false);
 let {m}=fresh();let remaining=remainingSubstitutions(m.rules,deriveMatch(m).substitutions,'away');assert.equal(remaining.extraPlayers,0);assert.equal(remaining.extraWindows,0);
 m=swap(m,{kind:'concussion'});remaining=remainingSubstitutions(m.rules,deriveMatch(m).substitutions,'away');assert.equal(remaining.extraPlayers,1);assert.equal(remaining.extraWindows,1);
 m=swap(m,{team:'away',kind:'additional'});remaining=remainingSubstitutions(m.rules,deriveMatch(m).substitutions,'away');assert.equal(remaining.extraPlayers,0);assert.equal(remaining.extraWindows,0);
});

test('沿用窗口保存明确关联，撤销窗口来源不能把后续换人挂到别的窗口',()=>{
 let {m}=fresh({players:8});m=swap(m,{id:'window-0'});m=swap(m,{id:'window-1'});m=swap(m,{id:'reuse-1',windowMode:'reuse'});
 assert.equal(m.events.at(-1).windowId,'window-1');assert.throws(()=>changeMatch(m,{action:'editEvent',id:'window-1',active:false}),/窗口已被撤销或改变/);
});
test('报名替补人数等于普通名额时，脑震荡可使用已正常换下者，禁止出现重复场上球员',()=>{
 let {m}=fresh();for(const team of ['home','away'])m.initial.lineups[team].bench=m.initial.lineups[team].bench.slice(0,5);
 const originalOff=m.initial.lineups.home.players[1];m=swap(m);const a=deriveMatch(m),off=a.lineups.home.players[2];assert(eligibleSubstitutes(m,a,'home','concussion').some(p=>p.id===originalOff.id));
 m=changeMatch(m,{action:'record',event:{type:'substitution',team:'home',pairs:[{offId:off.id,onId:originalOff.id,kind:'concussion'}]}});
 const current=deriveMatch(m);assert(current.lineups.home.players.some(p=>p.id===originalOff.id));assert.equal(new Set(current.lineups.home.players.map(p=>p.id)).size,11);assert.equal(current.substitutions.home.concussion,1);
});
