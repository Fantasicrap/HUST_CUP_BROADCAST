const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'hust-goal-net-')),out=path.join(root,'design-previews/v1.8.1');
 await fs.mkdir(out,{recursive:true});let child,browser;
 const errors=[],checks=[];
 try{
  child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'0',HUST_DATA_DIR:temp},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='';const port=await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error(log)),10000);child.stdout.on('data',b=>{log+=b;const m=log.match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(t);resolve(m[1]);}});child.once('error',reject);});
  const base='http://127.0.0.1:'+port;
  const before=await fetch(base+'/api/control-state').then(r=>r.json());
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.qaNow=10000;Date.now=()=>window.qaNow;});
  const payload={team:'home',teamName:'华中星火',kitColor:'#d9354e',playerId:'home-p-2',name:'赵启航',number:4};
  const frame=async(ms)=>{await page.evaluate(ms=>{window.qaNow=10000+ms;},ms);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return page.evaluate(()=>{
   const b=document.querySelector('.ball'),r=b.getBoundingClientRect(),g=document.querySelector('.goal-frame'),a=g.getBoundingClientRect();
   const mouth=[[26,62],[136,18],[136,251],[26,295]],back=[[160,92],[270,48],[270,281],[160,325]];
   const inside=(point,poly)=>{let sign=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],n=(q[0]-p[0])*(point[1]-p[1])-(q[1]-p[1])*(point[0]-p[0]);if(Math.abs(n)<.01)continue;const s=Math.sign(n);if(sign&&s!==sign)return false;sign=s;}return true;};
   const matrix=new DOMMatrix(getComputedStyle(b).transform),radius=parseFloat(getComputedStyle(b).width)*Math.hypot(matrix.a,matrix.b)/2,centre=[(r.x+r.width/2-a.left)*300/a.width,(r.y+r.height/2-a.top)*340/a.height];
   const contained=poly=>inside(centre,poly)&&poly.every((p,i)=>{const q=poly[(i+1)%poly.length];return Math.abs((q[0]-p[0])*(centre[1]-p[1])-(q[1]-p[1])*(centre[0]-p[0]))/Math.hypot(q[0]-p[0],q[1]-p[1])>=radius-.1;});
   const text=document.querySelector('.goal-text').getBoundingClientRect();
   return {x:r.x,y:r.y,width:r.width,height:r.height,opacity:getComputedStyle(b).opacity,transform:getComputedStyle(b).transform,mouth:contained(mouth),net:contained(back),centre,radius,netFloorGap:Math.abs(-110*(centre[1]-281)-44*(centre[0]-270))/Math.hypot(110,44)-radius,leftOfMouth:r.right<a.left+26*a.width/300,aboveText:r.bottom<text.top,textTop:text.top,ballBottom:r.bottom,visible:!document.querySelector('#canvas').hidden,phase:document.querySelector('#canvas').dataset.phase,layers:[getComputedStyle(g).zIndex,getComputedStyle(b).zIndex,getComputedStyle(document.querySelector('.goal-mouth')).zIndex]};
  });};
  for(const seconds of [3,4,5]){
   await page.goto(base+'/goal2.html?preview=1');await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(p=>window.postMessage({type:'goal2Preview',payload:p},location.origin),{...payload,phaseMs:seconds*1000});
   await page.waitForFunction(()=>document.querySelector('#canvas').dataset.kit);
   const ms=seconds*1000;
   const apex=await frame(ms*.38);assert(apex.aboveText,'Ball must fly above GOAL '+JSON.stringify(apex));
   assert((await frame(ms*.70)).leftOfMouth,'Approach must start outside the opening');
   assert((await frame(ms*.77)).mouth,'The full ball must cross through the mouth');
   const settled=await frame(ms*.90);assert(settled.net,'The full ball must finish within the rear net '+JSON.stringify(settled));assert.equal(settled.opacity,'1');assert(settled.netFloorGap>=-.1&&settled.netFloorGap<=3,'Ball must rest on the net floor '+JSON.stringify(settled));assert.deepEqual(settled.layers,['2','4','5']);
   if(seconds===4)await page.screenshot({path:path.join(out,'ball-inside-net.png')});
   const duringName=await frame(ms+450+ms*.5);assert.equal(duringName.phase,'player');assert(duringName.net);assert.equal(duringName.opacity,'1');
   for(const key of ['x','y','width','height','transform'])assert.equal(duringName[key],settled[key],key+' must stay still during player intro');
   const beforeExit=await frame(ms*2+1000-600);assert(beforeExit.net&&beforeExit.visible);assert.equal(beforeExit.transform,settled.transform);
   if(seconds===4)await page.screenshot({path:path.join(out,'name-with-stationary-ball.png')});
   const after=await frame(ms*2+1000+50);assert.equal(after.visible,false);
   checks.push(seconds+'秒/段：越过文字→从左侧门口进入→完整落网→姓名段静止可见→整体结束透明');
  }
  // Record the real-time four-second version, using separate preview state only.
  const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(temp,'video'),size:{width:1280,height:720}}});
  const videoPage=await context.newPage();videoPage.on('pageerror',e=>errors.push(e.message));
  await videoPage.goto(base+'/goal2.html?preview=1');await videoPage.evaluate(()=>document.fonts.ready);
  await videoPage.evaluate(p=>window.postMessage({type:'goal2Preview',payload:p},location.origin),{...payload,phaseMs:4000});
  await videoPage.locator('#canvas:not([hidden])').waitFor();await videoPage.waitForTimeout(9300);
  const video=videoPage.video();await context.close();await fs.copyFile(await video.path(),path.join(out,'goal2-net-demo.webm'));
  const after=await fetch(base+'/api/control-state').then(r=>r.json());assert.deepEqual(after.match,before.match);assert.equal(after.live.runId,before.live.runId);checks.push('只读预览及录制不改变主路/账本');
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'net-validation.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser?.close();child?.kill();await new Promise(r=>setTimeout(r,250));await fs.rm(temp,{recursive:true,force:true,maxRetries:5});}
})().catch(e=>{console.error(e);process.exitCode=1;});
