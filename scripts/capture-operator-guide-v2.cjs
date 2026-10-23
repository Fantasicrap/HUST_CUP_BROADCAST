// All screenshots use an isolated demonstration match, never the live service.
const {chromium}=require('playwright'),sharp=require('sharp'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'hust-guide-')),out=path.join(root,'docs/操作指南/配图-v2.0.0');
 await fs.mkdir(out,{recursive:true});let child,browser;
 try{
  child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'0',HUST_DATA_DIR:temp},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let log='';const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(log)),15000);child.stdout.on('data',b=>{log+=b;const m=log.match(/127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(m[1]);}});child.stderr.on('data',b=>log+=b);});
  const base='http://127.0.0.1:'+port;
  browser=await chromium.launch({headless:true,executablePath:process.env.HUST_EDGE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1.5}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('.operator-guided').waitFor();await page.evaluate(()=>document.fonts.ready);
  const shot=async(selector,name)=>page.locator(selector).screenshot({path:path.join(out,name+'.png')});
  await shot('.broadcast-bar','broadcast-controls');await shot('.clock-desk','clock-controls');
  await page.click('button[data-workflow=pregame]');await page.click('#prep-tab-0');await shot('#format-settings','format-controls');await shot('.preparation-steps','preparation-controls');
  await page.click('button[data-workflow=settings]');await shot('.material-controls','material-controls');
  await page.click('button[data-workflow=extra]');await shot('[data-desk-panel=pk] .desk-card:first-child','penalty-controls');
  await page.click('button[data-workflow=live]');
  await page.locator('#goal2-drawer').evaluate(e=>e.open=true);await page.click('#g2-open');await page.click('#g2-preview');await page.waitForFunction(()=>!document.querySelector('#g2-play').disabled);await page.waitForTimeout(1200);await shot('#goal2-dialog','goal2-controls');
  const roster=await fetch(base+'/api/goal2/roster').then(r=>r.json());
  const prepared=await fetch(base+'/api/goal2/preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({team:'home',playerId:roster.teams.home.players[0].id,seconds:4})}).then(r=>r.json());
  const output=await browser.newPage({viewport:{width:1920,height:1080}});output.on('pageerror',e=>errors.push(e.message));
  await output.addInitScript(()=>{window.qaNow=10000;Date.now=()=>window.qaNow;});
  await output.goto(base+'/goal2.html?preview=1');await output.evaluate(()=>document.fonts.ready);
  await output.evaluate(payload=>window.postMessage({type:'goal2Preview',payload},location.origin),prepared.payload);
  await output.waitForFunction(()=>document.querySelector('#canvas').dataset.kit);
  for(const [age,name] of [[2200,'goal2-largest.png'],[6200,'goal2-name.png']]){
   await output.evaluate(age=>window.qaNow=10000+age,age);await output.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await output.screenshot({path:path.join(out,name)});
  }
  await sharp(path.join(root,'design-previews/v2.0.0/footer-pulse.png')).trim().extend({top:18,bottom:18,left:18,right:18,background:{r:0,g:0,b:0,alpha:0}}).toFile(path.join(out,'substitution-budget.png'));
  if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({isolated:true,images:await fs.readdir(out),errors}));
 }finally{await browser?.close();child?.kill();await new Promise(r=>setTimeout(r,250));await fs.rm(temp,{recursive:true,force:true,maxRetries:5});}
})().catch(e=>{console.error(e);process.exitCode=1;});
