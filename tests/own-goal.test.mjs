import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeDraft} from '../public/model.js';
import {newMatch,changeMatch,deriveMatch,composeData,goalTeams,specialGoalLabel} from '../public/match.js';
import {scoreboardEvent} from '../public/scoreboard.js';
const sample=JSON.parse(await fs.readFile(new URL('../public/data/demo.json',import.meta.url),'utf8'));
const draft=()=>normalizeDraft({},sample);
const record=(m,team,kind,id='g')=>changeMatch(m,{action:'record',id,event:{type:'goal',team,kind,name:'乌龙球员',number:4,period:'first',time:'12′'}});

test('乌龙球：双方分别测试，对方加分、归乌龙方球员并在该方扩展播报',()=>{
 for(const team of ['home','away']){const other=team==='home'?'away':'home',d=draft();let m=record(newMatch(d),team,'own');const a=deriveMatch(m),out=composeData(d,m,m.events[0]);assert.equal(a.score[team],0);assert.equal(a.score[other],1);assert.equal(a.halftimeScore[other],1);assert.equal(a.goals[0].team,team);assert.equal(a.goals[0].scoreTeam,other);assert.equal(out.goal.team,team);assert.equal(scoreboardEvent(out,'goal').team,team);assert.equal(scoreboardEvent(out,'goal').label,'进球');assert.equal(scoreboardEvent(out,'goal').goalMark,'(OG)');m=changeMatch(m,{action:'tie',enabled:true,home:2,away:2});assert.equal(deriveMatch(m).aggregate[other],3);}
});

test('取消乌龙球、撤销取消及修正普通/点球类型会同步双方比分与半场记录',()=>{
 let m=record(newMatch(draft()),'home','own');m=changeMatch(m,{action:'record',id:'cancel',event:{type:'cancelGoal',goalId:'g'}});assert.deepEqual(deriveMatch(m).score,{home:0,away:0});assert(deriveMatch(m).goals[0].cancelled);
 m=changeMatch(m,{action:'editEvent',id:'cancel',active:false});assert.deepEqual(deriveMatch(m).score,{home:0,away:1});
 m=changeMatch(m,{action:'editEvent',id:'g',patch:{kind:'normal'}});assert.deepEqual(deriveMatch(m).score,{home:1,away:0});assert.deepEqual(deriveMatch(m).halftimeScore,{home:1,away:0});
 m=changeMatch(m,{action:'editEvent',id:'g',patch:{kind:'own'}});assert.deepEqual(deriveMatch(m).score,{home:0,away:1});
 m=changeMatch(m,{action:'editEvent',id:'g',patch:{kind:'penalty'}});assert.deepEqual(deriveMatch(m).score,{home:1,away:0});
});

test('普通进球无特殊标注，点球与乌龙仅提供各自标记，普通/点球给本队加分',()=>{
 assert.equal(specialGoalLabel('normal'),'');assert.equal(specialGoalLabel('运动战'),'');assert.equal(specialGoalLabel('penalty'),'点球');assert.equal(specialGoalLabel('own'),'乌龙球');
 for(const kind of ['normal','penalty']){const m=record(newMatch(draft()),'away',kind);assert.deepEqual(deriveMatch(m).score,{home:0,away:1});}
});

test('旧乌龙存档仍按原受益方记分，转换显示归属及规范化/导入后不反转历史比分',()=>{
 const d=draft();let m=newMatch(d);m.events.push({id:'legacy',type:'goal',team:'home',kind:'own',name:'旧乌龙球员',number:3,time:'45+1′',period:'first',active:true});
 let a=deriveMatch(m);assert.deepEqual(a.score,{home:1,away:0});assert.equal(a.goals[0].team,'away');assert.equal(composeData(d,m,m.events[0]).goal.team,'away');
 const clean=normalizeDraft({...d,score:a.score,goals:a.goals},sample);assert.equal(clean.goals[0].teamRole,'player');m=newMatch(clean,{demo:true});a=deriveMatch(m);assert.equal(a.halftimeScore.home,1);assert.deepEqual(goalTeams(a.goals[0]),{team:'away',scoreTeam:'home'});
 m=changeMatch(m,{action:'record',event:{type:'cancelGoal',goalId:'legacy'}});assert.deepEqual(deriveMatch(m).score,{home:0,away:0});
});
