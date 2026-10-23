const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'hust-goal-net-')),out=path.join(root,process.env.HUST_REVIEW_OUTPUT||'design-previews/v1.8.6');
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
   const polygon=selector=>{const el=document.querySelector(selector),r=el.getBBox(),ctm=el.getScreenCTM();return [[r.x,r.y],[r.x+r.width,r.y],[r.x+r.width,r.y+r.height],[r.x,r.y+r.height]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(ctm);return [p.x,p.y];});};
   const aperture=document.querySelector('.goal-aperture').getBBox(),mouth=polygon('.goal-aperture'),back=polygon('.net-back');
   const inside=(point,poly)=>{let sign=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],n=(q[0]-p[0])*(point[1]-p[1])-(q[1]-p[1])*(point[0]-p[0]);if(Math.abs(n)<.01)continue;const s=Math.sign(n);if(sign&&s!==sign)return false;sign=s;}return true;};
   const matrix=new DOMMatrix(getComputedStyle(b).transform),radius=parseFloat(getComputedStyle(b).width)*Math.hypot(matrix.a,matrix.b)/2,centre=[r.x+r.width/2,r.y+r.height/2];
   const contained=poly=>inside(centre,poly)&&poly.every((p,i)=>{const q=poly[(i+1)%poly.length];return Math.abs((q[0]-p[0])*(centre[1]-p[1])-(q[1]-p[1])*(centre[0]-p[0]))/Math.hypot(q[0]-p[0],q[1]-p[1])>=radius-.1;});
   const text=document.querySelector('.goal-text').getBoundingClientRect();
   return {x:r.x,y:r.y,width:r.width,height:r.height,opacity:getComputedStyle(b).opacity,transform:getComputedStyle(b).transform,mouth:contained(mouth),net:contained(back),centre,radius,netFloorGap:Math.abs((back[3][0]-back[2][0])*(centre[1]-back[2][1])-(back[3][1]-back[2][1])*(centre[0]-back[2][0]))/Math.hypot(back[3][0]-back[2][0],back[3][1]-back[2][1])-radius,goalWidth:a.width,goalHeight:a.height,nameFont:getComputedStyle(document.querySelector('#name')).fontFamily,nameStyle:getComputedStyle(document.querySelector('#name')).fontStyle,nameWeight:getComputedStyle(document.querySelector('#name')).fontWeight,nameSynthesis:getComputedStyle(document.querySelector('#name')).fontSynthesis,nameMatrix:getComputedStyle(document.querySelector('#name')).transform,modelRatio:aperture.width/aperture.height,projectedWidthRatio:Math.hypot(mouth[1][0]-mouth[0][0],mouth[1][1]-mouth[0][1])/(mouth[3][1]-mouth[0][1]),recedingSlope:(mouth[1][1]-mouth[0][1])/(mouth[1][0]-mouth[0][0]),nameWidth:document.querySelector('#name').getBoundingClientRect().width,namePanelWidth:document.querySelector('.player-text').getBoundingClientRect().width,leftOfMouth:r.right<mouth[0][0],aboveText:r.bottom<text.top,textTop:text.top,ballBottom:r.bottom,visible:!document.querySelector('#canvas').hidden,phase:document.querySelector('#canvas').dataset.phase,layers:[getComputedStyle(g).zIndex,getComputedStyle(b).zIndex,getComputedStyle(document.querySelector('.goal-mouth')).zIndex]};
  });};
  for(const seconds of [3,4,5]){
   await page.goto(base+'/goal2.html?preview=1');await page.evaluate(()=>document.fonts.ready);
   await page.evaluate(p=>window.postMessage({type:'goal2Preview',payload:p},location.origin),{...payload,phaseMs:seconds*1000});
   await page.waitForFunction(()=>document.querySelector('#canvas').dataset.kit);
   const ms=seconds*1000;
   if(seconds===4){await frame(600);await page.screenshot({path:path.join(out,'goal-largest-clearance.png')});}
   const apex=await frame(ms*.38);assert(apex.aboveText,'Ball must fly above GOAL '+JSON.stringify(apex));
   assert((await frame(ms*.70)).leftOfMouth,'Approach must start outside the opening');
   assert((await frame(ms*.77)).mouth,'The full ball must cross through the mouth');
   const settled=await frame(ms*.90);assert(settled.net,'The full ball must finish within the rear net '+JSON.stringify(settled));assert.equal(settled.opacity,'1');assert.equal(settled.goalWidth,510);assert.equal(settled.goalHeight,510);assert(settled.netFloorGap>=-.1&&settled.netFloorGap<=3,'Ball must rest on the net floor '+JSON.stringify(settled));assert.deepEqual(settled.layers,['2','4','5']);
   if(seconds===4)await page.screenshot({path:path.join(out,'ball-inside-net.png')});
   const duringName=await frame(ms+450+ms*.5);assert.equal(duringName.phase,'player');assert(duringName.net);assert.equal(duringName.opacity,'1');assert(duringName.nameFont.includes('HustTitle'));assert.equal(duringName.nameStyle,'italic');assert.equal(duringName.nameWeight,'400');assert(!duringName.nameSynthesis.includes('weight'));assert.equal(duringName.modelRatio,3);assert(Math.abs(duringName.projectedWidthRatio-1.5)<.001);assert(Math.abs(duringName.recedingSlope+1)<.001);assert.equal(duringName.nameMatrix,'none');assert(duringName.nameWidth<=duringName.namePanelWidth);
   for(const key of ['x','y','width','height','transform'])assert.equal(duringName[key],settled[key],key+' must stay still during player intro');
   const beforeExit=await frame(ms*2+1000-600);assert(beforeExit.net&&beforeExit.visible);assert.equal(beforeExit.transform,settled.transform);
   if(seconds===4)await page.screenshot({path:path.join(out,'name-with-stationary-ball.png')});
   const after=await frame(ms*2+1000+50);assert.equal(after.visible,false);
   checks.push(seconds+'秒/段：越过文字→从左侧门口进入→完整落网→姓名段静止可见→斜二测45°半比例及模型3:1→原字体斜体无额外加粗→整体结束透明');
  }
  // Record the real-time four-second version, using separate preview state only.
  if(process.env.HUST_REVIEW_VIDEO==='1'){
  const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:path.join(temp,'video'),size:{width:1280,height:720}}});
  const videoPage=await context.newPage();videoPage.on('pageerror',e=>errors.push(e.message));
  await videoPage.goto(base+'/goal2.html?preview=1');await videoPage.evaluate(()=>document.fonts.ready);
  await videoPage.evaluate(p=>window.postMessage({type:'goal2Preview',payload:p},location.origin),{...payload,phaseMs:4000});
  await videoPage.locator('#canvas:not([hidden])').waitFor();await videoPage.waitForTimeout(9300);
  const video=videoPage.video();await context.close();await fs.copyFile(await video.path(),path.join(out,'goal2-net-demo.webm'));
  }
  const after=await fetch(base+'/api/control-state').then(r=>r.json());assert.deepEqual(after.match,before.match);assert.equal(after.live.runId,before.live.runId);checks.push('只读逐帧预览不改变主路/账本'+(process.env.HUST_REVIEW_VIDEO==='1'?'；额外录制完成':'；录像可选，HUST_REVIEW_VIDEO=1启用'));
  assert.deepEqual(errors,[]);await fs.writeFile(path.join(out,'net-validation.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors}));
 }finally{await browser?.close();child?.kill();await new Promise(r=>setTimeout(r,250));await fs.rm(temp,{recursive:true,force:true,maxRetries:5});}
})().catch(e=>{console.error(e);process.exitCode=1;});
