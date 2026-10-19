import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeDraft,COMMON_FORMATIONS,REFEREE_ROLES,arrangeFormation,assertBenchLimit,goalRows,bottomScores,formationTimeline} from '../public/model.js';
import {scoreboardVisible,scoreboardEvent} from '../public/scoreboard.js';
import {newMatch,changeMatch,recordMatchEvent,composeData,penaltyStatus} from '../public/match.js';
const sample=JSON.parse(await fs.readFile(new URL('../public/data/demo.json',import.meta.url),'utf8'));
const draft=()=>normalizeDraft({},sample);
test('下半场开场与半场结束比分/进球一致，排除后续进球并跟随取消纠错',()=>{
 const d=draft();let m=newMatch(d);
 for(const [id,team,period] of [['a','home','first'],['b','away','first'],['c','home','second']])m=changeMatch(m,{action:'record',id,event:{type:'goal',team,period,name:id}});
 let out=composeData(d,m);assert.deepEqual(bottomScores(out,'secondhalf'),{home:1,away:1});assert.deepEqual(bottomScores(out,'secondhalf'),bottomScores(out,'halftime'));assert.deepEqual(goalRows(out,'secondhalf'),goalRows(out,'halftime'));assert.deepEqual(goalRows(out,'secondhalf').map(g=>g.id),['a','b']);
 m=changeMatch(m,{action:'record',event:{type:'cancelGoal',goalId:'a'}});out=composeData(d,m);assert.deepEqual(bottomScores(out,'secondhalf'),{home:0,away:1});assert.deepEqual(goalRows(out,'secondhalf').map(g=>g.id),['b']);assert.deepEqual(bottomScores(out,'fulltime'),{home:1,away:1});
});
test('左上比分牌只随比赛阶段显示，暂停和超出补时均不隐藏，不依赖计时是否运行',()=>{
 const d=draft();for(const phase of ['first','second','extraFirst','extraSecond'])for(const running of [false,true])assert(scoreboardVisible({...d,matchClock:{phase,running,elapsedMs:99*60000}}));
 for(const phase of ['pregame','halftime','regulationEnd','extraBreak','shootout','finished','interrupted'])assert(!scoreboardVisible({...d,matchClock:{phase}}),phase);
 d.config.modules.scoreboard=false;assert(!scoreboardVisible(d));
});
test('10种常用阵型完整保留球员资料，替补12人可用、13人拒绝且不截断旧存档',()=>{
 const d=draft(),l=d.formation;l.players[2].photo='assets/home.svg';l.players[2].captain=true;l.players[2].yellowCards=2;
 for(const shape of COMMON_FORMATIONS){const out=arrangeFormation(l,shape);assert.equal(out.name,shape);assert.equal(out.players.filter(p=>p.goalkeeper).length,1);assert.equal(out.players.filter(p=>p.group==='defenders').length,Number(shape.split('-')[0]));assert.deepEqual(out.players.map(p=>[p.id,p.number,p.name,p.photo,p.captain,p.yellowCards]),l.players.map(p=>[p.id,p.number,p.name,p.photo,p.captain,p.yellowCards]));assert(out.players.every(p=>p.x>=8&&p.x<=92&&p.y>=10&&p.y<=89));}
 l.bench=Array.from({length:12},(_,i)=>({...l.bench[0],id:'b'+i}));assert.doesNotThrow(()=>assertBenchLimit(l));l.bench.push({...l.bench[0],id:'b12'});assert.throws(()=>assertBenchLimit(l),/12/);assert.equal(normalizeDraft(d,sample).formation.bench.length,13);
});
test('球队官员空值保持为空，替补动画由单个开关决定，独立名单不受影响',()=>{
 const d=draft();Object.assign(d.formation,{assistantCoach:'助教甲',manager:'领队乙',medic:''});const out=normalizeDraft(d,sample);assert.equal(out.formation.assistantCoach,'助教甲');assert.equal(out.formation.manager,'领队乙');assert.equal(out.formation.medic,'');assert(formationTimeline(out).some(s=>s.kind==='bench'));out.config.benchAfter=false;assert(!formationTimeline(out).some(s=>s.kind==='bench'));assert(out.config.modules.bench);
});
test('点球提前决胜锁定，突然死亡须同轮完成，纠错重罚后重新开放',()=>{
 const d=draft();for(const first of ['home','away']){let m=newMatch(d);m=changeMatch(m,{action:'pk',operation:'reset',first});for(const value of [1,0,1,0,1,0])m=changeMatch(m,{action:'pk',operation:'kick',value});assert.equal(penaltyStatus(m.shootout).winner,first);assert(!m.shootout.confirmed);assert.throws(()=>changeMatch(m,{action:'pk',operation:'kick',value:1}));m=changeMatch(m,{action:'pk',operation:'confirm'});m=changeMatch(m,{action:'pk',operation:'edit',team:first==='home'?'away':'home',index:2,value:null});assert(!m.shootout.confirmed);assert.equal(penaltyStatus(m.shootout).winner,null);assert.equal(penaltyStatus(m.shootout).next,first==='home'?'away':'home');}
 const p={first:'home',home:Array(5).fill(1),away:Array(5).fill(1)};assert(penaltyStatus(p).suddenDeath);p.home.push(1);assert.equal(penaltyStatus(p).winner,null);p.away.push(1);assert.equal(penaltyStatus(p).winner,null);p.home.push(0);assert.equal(penaltyStatus(p).winner,null);p.away.push(1);assert.equal(penaltyStatus(p).winner,'away');
});
test('裁判与解说分开规范化，七种裁判及学院持久保存并兼容原主裁判字段',()=>{
 const d=draft();for(const key of Object.keys(REFEREE_ROLES)){d.presentation[key]='阿卜杜拉·阿不都热合曼';d.presentation[key+'College']='计算机科学学院';}d.presentation.commentator='解说甲';d.presentation.commentatorCollege='人工智能学院';const clean=normalizeDraft(d,sample);for(const key of Object.keys(REFEREE_ROLES)){assert.equal(clean.presentation[key],d.presentation[key]);assert.equal(clean.presentation[key+'College'],d.presentation[key+'College']);}assert.equal(clean.presentation.commentatorCollege,'人工智能学院');clean.config.modules.officials=false;assert(clean.config.modules.commentators);
});
test('进球无效原因、所属队和球员从关联进球确定，取消乌龙回滚受益方并可纠错',()=>{
 const d=draft();let m=newMatch(d);m=changeMatch(m,{action:'record',id:'own',event:{type:'goal',team:'away',kind:'own',name:'乌龙球员',number:4,time:'12′',period:'first'}});m=changeMatch(m,{action:'record',id:'cancel',event:{type:'cancelGoal',goalId:'own',team:'home',text:'进攻方犯规在先'}});assert.deepEqual(composeData(d,m).score,{home:0,away:0});const e=m.events.at(-1);assert.equal(e.team,'away');assert.equal(e.name,'乌龙球员');assert.equal(e.goalTime,'12′');let out=composeData(d,m,e),item=scoreboardEvent(out,'cancelGoal');assert.equal(item.team,'away');assert.equal(item.reason,'进攻方犯规在先');assert.equal(item.label,'进球无效');m=changeMatch(m,{action:'editEvent',id:'cancel',patch:{text:'越位'}});out=composeData(d,m,m.events.at(-1));assert.equal(scoreboardEvent(out,'cancelGoal').reason,'越位');assert.deepEqual(goalRows(out,'halftime'),[]);
});
test('点球与给牌原子记账、重试幂等，左上读关联给牌，左下仍为点球',()=>{
 const d=draft(),original=newMatch(d),p=original.initial.lineups.away.players[2],command={action:'record',id:'penalty-card',event:{type:'penalty',team:'home',text:'判罚点球'},companionCard:{team:'away',role:'player',playerId:p.id,card:'red'}};
 const m=recordMatchEvent(original,command);assert.equal(original.events.length,0);assert.equal(m.events.length,2);assert.equal(recordMatchEvent(m,command),m);assert.equal(m.events[0].type,'penalty');assert.equal(m.events[1].parentEventId,'penalty-card');assert.equal(composeData(d,m).reds.away,1);const out=composeData(d,m,m.events[0]),card=scoreboardEvent(out,'penalty');assert.equal(card.name,p.name);assert.equal(card.team,'away');assert.equal(card.label,'红牌');assert.deepEqual(out.score,{home:0,away:0});
 assert.throws(()=>recordMatchEvent(original,{...command,companionCard:{...command.companionCard,playerId:'missing'}}));assert.equal(original.events.length,0);
 const undone=changeMatch(m,{action:'editEvent',id:m.events[1].id,active:false});assert.equal(scoreboardEvent(composeData(d,undone,undone.events[0]),'penalty'),null);
});
