import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {normalizeDraft} from '../public/model.js';
import {newMatch,changeMatch,clockMs,deriveMatch} from '../public/match.js';
import {parseClockInput} from '../public/clock-input.js';
const sample=JSON.parse(await fs.readFile(new URL('../public/data/demo.json',import.meta.url),'utf8'));
const fresh=()=>newMatch(normalizeDraft({},sample),{now:1000});
const clock=(m,command,now=1000)=>changeMatch(m,{action:'clock',...command},now);

test('应用：同阶段继续不归零，换阶段按自定义起点开表，休息/结束暂停',()=>{
 let m=fresh();m=clock(m,{operation:'settings',halfMinutes:40,extraMinutes:10});
 m=clock(m,{operation:'apply',phase:'first'});assert(m.clock.running);
 m=clock(m,{operation:'apply',phase:'first'},65123);assert.equal(clockMs(m.clock,65123),64123);
 m=clock(m,{operation:'pause'},66000);const stopped=clockMs(m.clock,66000);
 m=clock(m,{operation:'apply',phase:'first'},80000);assert.equal(clockMs(m.clock,80000),stopped);
 m=clock(m,{operation:'apply',phase:'second'},81000);assert.equal(clockMs(m.clock,81000),40*60000);assert(m.clock.running);
 m=clock(m,{operation:'apply',phase:'extraSecond'},82000);assert.equal(clockMs(m.clock,82000),90*60000);assert(m.clock.running);
 m=clock(m,{operation:'apply',phase:'interrupted'},83000);assert(!m.clock.running);const interrupted=m.clock.elapsedMs;
 m=clock(m,{operation:'apply',phase:'extraSecond'},90000);assert.equal(m.clock.elapsedMs,interrupted);assert(m.clock.running);
 for(const phase of ['halftime','regulationEnd','extraBreak','shootout','finished','pregame']){m=clock(m,{operation:'apply',phase},91000);assert(!m.clock.running,phase);}
 assert.throws(()=>clock(m,{operation:'apply',phase:'invalid'}));
});

test('相对校准在服务端按实际时间加减，保留运行状态与毫秒，不产生负计时',()=>{
 let m=clock(fresh(),{operation:'apply',phase:'first'});
 m=clock(m,{operation:'calibrate',deltaSeconds:-10},20500);assert.equal(clockMs(m.clock,20500),9500);assert(m.clock.running);
 m=clock(m,{operation:'calibrate',deltaSeconds:10},21500);assert.equal(clockMs(m.clock,21500),20500);
 m=clock(m,{operation:'calibrate',deltaSeconds:-100},22000);assert.equal(clockMs(m.clock,22000),0);assert(m.clock.running);
 m=clock(m,{operation:'pause'},22000);m=clock(m,{operation:'calibrate',seconds:45*60},23000);assert.equal(m.clock.elapsedMs,2700000);assert(!m.clock.running);
 assert.throws(()=>clock(m,{operation:'calibrate',deltaSeconds:0.5}));assert.throws(()=>clock(m,{operation:'calibrate',seconds:-1}));
});

test('计时清零须确认，确认后暂停但保留比分、事件、阶段与宣布补时',()=>{
 let m=changeMatch(fresh(),{action:'record',event:{type:'goal',team:'away',name:'进球者'}},1000);
 m=clock(m,{operation:'apply',phase:'second'});m=clock(m,{operation:'added',minutes:2});
 assert.throws(()=>clock(m,{operation:'reset'}));const before=structuredClone(m);
 m=clock(m,{operation:'reset',confirm:'RESET_CLOCK'},10000);assert.equal(m.clock.elapsedMs,0);assert(!m.clock.running);assert.equal(m.clock.phase,'second');assert.equal(m.clock.announced,2);assert.deepEqual(m.events,before.events);assert.deepEqual(deriveMatch(m).score,{home:0,away:1});
});

test('校准输入区分绝对时间、带正负号的增减，拒绝不完整或非法秒数',()=>{
 assert.deepEqual(parseClockInput('45:00'),{seconds:2700});assert.deepEqual(parseClockInput('-00:10'),{deltaSeconds:-10});assert.deepEqual(parseClockInput('+01:20'),{deltaSeconds:80});assert.deepEqual(parseClockInput('−00:05'),{deltaSeconds:-5});
 for(const input of ['', '-', '00:60','abc','1:2'])assert.throws(()=>parseClockInput(input));
});
