import test from 'node:test';
import assert from 'node:assert/strict';
import {kitChannels,readableInk,kitSurfaceVariables} from '../public/material-colors.js';
test('材质读取本场球衣色而非品牌色，主客及进球队独立绑定',()=>{
 const d={home:{kitColor:'#ff0000',brandColor:'#000000'},away:{kitColor:'#00aaff',brandColor:'#ffffff'},goal:{team:'away'}};
 const v=kitSurfaceVariables(d);assert.equal(v['--home-rgb'],'255 0 0');assert.equal(v['--away-rgb'],'0 170 255');assert.equal(v['--event-rgb'],'0 170 255');
 d.home.kitColor='#ffffff';assert.equal(kitSurfaceVariables(d)['--home-rgb'],'255 255 255');assert.deepEqual(kitChannels('invalid'),[19,85,252]);
});
test('极深极浅球衣采用对应可读文字，中央白色区域保持深字',()=>{
 assert.equal(readableInk([0,0,0]),'#ffffff');assert.equal(readableInk([255,255,255]),'#102033');assert.equal(readableInk([0,0,0],1),'#102033');
});
