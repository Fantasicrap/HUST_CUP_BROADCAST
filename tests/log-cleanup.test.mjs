import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeDraft} from '../public/model.js';
import {newMatch,changeMatch,deriveMatch} from '../public/match.js';
const sample=JSON.parse(await fs.readFile(new URL('../public/data/demo.json',import.meta.url),'utf8'));
test('清理日志需确认，只收起既有记录；比分/进球/处罚/换人/点球不变，历史仍可纠错',()=>{
 let m=newMatch(normalizeDraft({},sample));m=changeMatch(m,{action:'record',id:'goal',event:{type:'goal',team:'away'}});const p=m.initial.lineups.home.players[0];m=changeMatch(m,{action:'record',event:{type:'card',team:'home',role:'player',playerId:p.id,card:'red'}});m=changeMatch(m,{action:'pk',operation:'kick',value:1});
 assert.throws(()=>changeMatch(m,{action:'clearLog'}),/确认/);const before=deriveMatch(m),events=structuredClone(m.events),pk=structuredClone(m.shootout);m=changeMatch(m,{action:'clearLog',confirm:'CLEAR_LOG'});assert.equal(m.logStartIndex,events.length);assert.deepEqual(m.events,events);assert.deepEqual(deriveMatch(m),before);assert.deepEqual(m.shootout,pk);
 m=changeMatch(m,{action:'record',event:{type:'notice',text:'新日志'}});assert.equal(m.events.slice(m.logStartIndex).length,1);m=changeMatch(m,{action:'editEvent',id:'goal',active:false});assert.equal(deriveMatch(m).score.away,0);
});
