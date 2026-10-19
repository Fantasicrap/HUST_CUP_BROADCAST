import {clockView,STAT_LABELS,PHASES} from './match.js';
import {SCENES,CONTEXTS,GROUPS,lineupFor,formationAt,goalRows,outputScene,shootoutStatus} from './model.js';
const q=new URLSearchParams(location.search),isLive=q.get('mode')==='live';
let data=isLive?null:(await fetch('api/preview').then(r=>r.json())).data;
let currentElapsed=0;let live=null,offset=0,startedAt=Date.now(),timer,previewScene=SCENES.includes(q.get('scene'))?q.get('scene'):'scoreboard';
const stage=document.querySelector('#stage'),layer=document.querySelector('#graphics');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trophy=()=>'<svg class="trophy" viewBox="0 0 120 120" aria-label="HUST CUP"><g fill="none" stroke="currentColor" stroke-width="8"><path d="M30 18v48l30 24 30-24V18M30 45h60M43 18v23m34-23v23M60 90v14m-22 0h44"/><path d="M30 26H15v26l17 14m58-40h15v26L88 66" stroke-width="6"/></g></svg>';
const logo=()=>!data.competition.logo||data.competition.logo==='assets/competition.svg'?trophy():`<span class="custom-logo"><span class="logo-fallback">${trophy()}</span><img src="${esc(data.competition.logo)}" alt="赛事 logo"></span>`;
const badge=(team,extra='')=>`<span class="badge ${extra}"><span class="badge-fallback">${esc((team.short||team.name).slice(0,2))}</span>${team.badge?`<img src="${esc(team.badge)}" alt="${esc(team.name)}队徽">`:''}</span>`;
const kit=t=>`<i class="kit" style="--kit:${esc(t.kitColor)}"></i>`;
const name=t=>esc(t.name);
const compactName=t=>esc(t.name.length>8&&t.short?t.short:t.name);
const competition=()=>`<div class="competition">${logo()}<div><b>${esc(data.competition.name)}</b><span>${esc(data.competition.subtitle)} · ${esc(data.competition.round)}</span></div></div>`;
const safeImgError=()=>layer.querySelectorAll('img').forEach(img=>{const failed=()=>img.remove();img.addEventListener('error',failed,{once:true});if(img.complete&&!img.naturalWidth)failed();});
function scoreRow(extra='',scores=data.score){
 return `<div class="score-row ${extra}"><div class="score-team home">${kit(data.home)}${badge(data.home)}<strong title="${name(data.home)}">${compactName(data.home)}</strong></div><b class="score-value" data-side="home">${scores.home}</b><div class="score-logo">${logo()}</div><b class="score-value" data-side="away">${scores.away}</b><div class="score-team away"><strong title="${name(data.away)}">${compactName(data.away)}</strong>${badge(data.away)}${kit(data.away)}</div></div>`;
}
function scoreboard(){
 if(!data.config.modules.scoreboard)return '';
 const cv=data.matchClock?clockView(data.matchClock,Date.now()+offset):data.clock;const ext=[];if(cv.announced||data.matchClock?.announced)ext.push('宣布补时 +'+(cv.announced||data.matchClock.announced));if(cv.added)ext.push('<span data-added-clock>实际补时 '+cv.added+'</span>');if(data.tie?.enabled)ext.push(`总比分 ${data.aggregate.home} : ${data.aggregate.away}`);for(const side of ['home','away'])if(data.reds?.[side])ext.push(`<i class="red-mark"></i> ${esc(data[side].short)} ${data.reds[side]}`);if(data.matchClock?.phase==='shootout')ext.push(`点球 ${shootoutStatus(data.shootout).home} : ${shootoutStatus(data.shootout).away}`);
 return `<section class="slim-score" style="left:${Math.min(data.config.x,1920-54-782*data.config.scale)}px;top:${Math.min(data.config.y,1080-54-100*data.config.scale)}px;--scale:${data.config.scale}" aria-label="单行常驻比分牌">${scoreRow()}<div class="slim-clock"><b>${q.get('added')==='1'?'90:00':esc(cv.display)}</b><span>${esc(cv.phase)}</span></div>${ext.length?`<div class="slim-extension">${ext.map(v=>`<span>${v}</span>`).join('')}</div>`:''}${q.get('added')==='1'?'<div class="slim-extension"><span>宣布补时 +4</span><span>实际补时 02:16</span><span>总比分 3 : 3</span><span>▰ 远航 1</span></div>':''}</section>`;
}
function event(type){
 const goal=type==='goal';let item=goal?data.goal:data.substitution;if(!goal&&item.pairs?.length){const index=Math.min(item.pairs.length-1,Math.floor(currentElapsed/Math.max(1200,data.config.eventHoldMs/item.pairs.length)));item={...item,...item.pairs[index]};}const team=data[item.team]||data.home;
 const content=goal?`<div class="mini-heading"><span>进球 / GOAL</span><b>${esc(item.time)}</b></div><div class="mini-player"><b>${esc(item.number)}</b><strong>${esc(item.name)}</strong><span>${esc(item.kind)}</span></div>`:`<div class="mini-heading"><span>换人 / SUBSTITUTION</span><b>${esc(item.time)}</b></div><div class="mini-sub"><span class="in">↑ 换上</span><b>${esc(item.on?.number??'')}</b><strong>${esc(item.on?.name??'')}</strong></div><div class="mini-sub"><span class="out">↓ 换下</span><b>${esc(item.off?.number??'')}</b><strong>${esc(item.off?.name??'')}</strong></div>`;
 return `${scoreboard()}<section class="mini-event ${goal?'mini-goal':'mini-substitution'}"><div class="mini-badge">${badge(team)}</div><div class="mini-content">${content}</div></section>`;
}
const fullBase=()=>`<div class="full-bg"><div class="light-arc arc-one"></div><div class="light-arc arc-two"></div><div class="grid-lines"></div><div class="ghost-mark">${trophy()}</div></div>`;
function marks(p){return `<span class="player-marks">${data.config.showCaptain&&p.captain?'<i class="captain-mark" title="队长">C</i>':''}${data.config.showYellow&&p.yellowCards?`<i class="yellow-mark" title="累计黄牌 ${p.yellowCards}"><em></em>${p.yellowCards}</i>`:''}</span>`;}
function shirt(p){const team=data[data.config.team],color=p.shirtColor||(p.goalkeeper?team.goalkeeperColor:team.kitColor);const rgb=color.slice(1).match(/../g).map(x=>parseInt(x,16));const ink=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>155?'#142033':'#ffffff';return `<span class="jersey" style="--shirt:${esc(color)};--number-ink:${ink}"><b>${p.number}</b></span>`;}
function media(p,small=false,origin=0){const photo=data.config.usePhotos&&p.photo,video=!small&&data.config.useVideos&&p.video;return `<span class="player-media">${shirt(p)}${photo?`<img src="${esc(p.photo)}" alt="${esc(p.name)}定妆照">`:''}${video?`<video src="${esc(p.video)}" data-origin="${origin}" loop muted playsinline preload="auto" aria-label="${esc(p.name)}球员视频"></video>`:''}</span>`;}
function field(revealed=[]){
 const players=lineupFor(data).players;
 return `<div class="formation-pitch"><div class="field-line field-border"></div><div class="field-line field-half"></div><div class="field-line field-circle"></div><div class="field-line field-box top"></div><div class="field-line field-box bottom"></div>${players.map(p=>`<div class="lineup-player" data-player="${esc(p.id)}" style="left:${p.x}%;top:${p.y}%"><div class="player-avatar">${revealed.includes(p.group)?media(p,true):shirt(p)}${marks(p)}</div><strong>${esc(p.name)}</strong><small>${p.number}</small></div>`).join('')}</div>`;
}
function benchPanel(){
 const bench=lineupFor(data).bench;
 return `<div class="bench-panel"><div class="panel-kicker">SUBSTITUTES / 替补球员 <small>${bench.length} 人</small></div><div class="bench-grid ${bench.length>10?'two-cols':''}">${bench.map(p=>`<div class="bench-row"><b>${p.number}</b><strong>${esc(p.name)}</strong><span class="bench-position">（${esc(p.position)}）</span><span class="bench-marks">${marks(p)}</span></div>`).join('')}</div>${!bench.length?'<div class="empty-bench">未录入替补名单</div>':''}</div>`;
}
function focus(step,elapsed){
 const players=lineupFor(data).players.filter(p=>p.group===step.group),back=step.kind==='media';
 const origin=step.forced?0:step.kind==='shirts'?step.end+(data.config.flip?360:0):step.kind==='flip'?step.start+360:step.start-(data.config.flip?360:0);
 return `<div class="focus-panel"><div class="panel-kicker">${esc(GROUPS[step.group])} <small>PLAYER INTRODUCTION</small></div><div class="focus-cards" style="--cards:${players.length}">${players.map(p=>`<article class="focus-card"><div class="flip-space"><div class="flip-card ${step.kind==='flip'?'turning':back?'turned':''}" style="--flip-age:-${Math.max(0,elapsed-step.start)}ms"><div class="card-face card-front">${shirt(p)}</div><div class="card-face card-back">${media(p,false,origin)}</div></div>${marks(p)}</div><div class="focus-name"><b>${p.number}</b><strong>${esc(p.name)}</strong></div><small>${esc(p.position)}</small></article>`).join('')}</div></div>`;
}
function leftTeam(bench=false){
 const t=data[data.config.team],lineup=lineupFor(data);
 return `<div class="lineup-team ${t.name.length>10?'long-name':''}"><div class="overline">${bench?'SUBSTITUTES':'STARTING XI'}</div>${badge(t,'lineup-badge')}<h1>${name(t)}</h1><p>${esc(t.english)}</p><div class="lineup-shape">${bench?`${lineup.bench.length} 人`:esc(lineup.name)}</div><div class="coach"><small>HEAD COACH / 主教练</small><strong>${esc(lineup.coach)}</strong></div><div class="lineup-legend">${data.config.showCaptain?'<span><i class="captain-mark">C</i> 队长</span>':''}${data.config.showYellow?'<span><i class="yellow-mark"><em></em>1</i> 累计黄牌</span>':''}</div></div>`;
}
function formation(elapsed,standaloneBench=false){
 let step=standaloneBench?{kind:'bench',revealed:[],start:0,end:Infinity}:formationAt(data,elapsed);
 const force=isLive?'':q.get('step')||'';
 if(force==='initial')step={kind:'formation',revealed:[],start:0,end:Infinity};
 if(force==='portraits')step={kind:'formation',revealed:Object.keys(GROUPS),start:0,end:Infinity};
 if(force==='bench')step={kind:'bench',revealed:Object.keys(GROUPS),start:0,end:Infinity};
 if(force?.startsWith('media-'))step={kind:'media',group:force.slice(6),revealed:[],start:0,end:Infinity,forced:true};
 const isBench=step.kind==='bench';let content;
 if(isBench)content=benchPanel();
 else if(step.kind==='benchFlip')content=`<div class="panel-flip-space"><div class="panel-flipper" style="--flip-age:-${elapsed-step.start}ms"><div class="panel-face">${field(step.revealed)}</div><div class="panel-face panel-back">${benchPanel()}</div></div></div>`;
 else if(step.kind==='formation')content=field(step.revealed);
 else content=focus(step,elapsed);
 return {html:`${fullBase()}<section class="full lineup-screen"><header class="full-header">${competition()}<span>${isBench?'SUBSTITUTES / 替补名单':'TEAM LINE-UP / 首发阵型'}</span></header>${leftTeam(isBench)}<div class="lineup-panel" data-step="${step.kind}" data-group="${step.group||''}">${content}</div><footer class="full-footer"><span>${esc(data.competition.name)} · ${esc(data.competition.round)}</span><span>${!isLive?'预览可拖动球员位置 · ':''}${isBench?'替补名单':step.kind==='formation'?'首发阵容':GROUPS[step.group]||'替补翻页'}</span></footer></section>`,next:Number.isFinite(step.end)?step.end-elapsed:Infinity};
}
function kickIcon(value,active=false){return `<span class="kick ${active?'active-kick ':''}${value===1?'made':value===0?'missed':'pending'}" aria-label="${value===1?'罚进':value===0?'罚失':'待罚'}">${value===1?'●':value===0?'×':'—'}</span>`;}
function shootout(compact=false){
 const s=data.shootout,status=shootoutStatus(s),count=Math.max(5,s.home.length,s.away.length,status.round);
 const size=compact?8:12,start=Math.max(0,count-size),end=count;
 const rows=['home','away'].map(side=>`<div class="pk-row ${status.next===side&&!status.winner?'current-kicker':''}">${badge(data[side])}<div class="pk-team"><strong>${name(data[side])}</strong>${compact?'':`<small>${esc(data[side].english)}</small>`}</div><b class="pk-score">${status[side]}</b><div class="pk-kicks" style="--round-count:${end-start}">${Array.from({length:end-start},(_,i)=>kickIcon(s[side][start+i],side===status.next&&!status.winner&&start+i===(s[side].indexOf(null)>=0?s[side].indexOf(null):s[side].length))).join('')}</div></div>`).join('');
 const lastSide=s.home.length===s.away.length?(s.first==='home'?'away':'home'):s.home.length>s.away.length?'home':'away',last=s.players?.[lastSide]?.[s[lastSide].length-1],kickerLine=last?.name?`<div class="pk-kicker-line">上脚罚球 · ${esc(data[lastSide].short)}　${esc(last.number||'')} ${esc(last.name)}</div>`:'';
 const notice=status.winner?(s.confirmed?`${esc(data[status.winner].name)} · 点球获胜`:'满足决胜条件 · 待确认'): `第 ${status.round} 轮 · ${esc(data[status.next].short)}待罚`;
 return compact?`<section class="compact-pk"><div class="compact-pk-title"><span>点球大战</span><b>${notice}</b><small>第 ${start+1}–${end} 轮</small></div>${rows}${kickerLine}</section>`:`<section class="shootout result-pk"><div class="pk-header">${logo()}<div><span>PENALTY SHOOT-OUT</span><strong>点球大战 · 结果</strong></div><div class="pk-match">比赛比分 <b>${data.score.home} : ${data.score.away}</b><small>与点球比分分别保存</small></div></div><div class="rounds"><span>第 ${start+1}–${end} 轮</span><div style="--round-count:${end-start}">${Array.from({length:end-start},(_,i)=>`<span>${start+i+1}</span>`).join('')}</div></div>${rows}<div class="pk-footer"><span>${s.first==='home'?data.home.short:data.away.short}先罚</span><strong>${notice}</strong></div>${kickerLine}</section>`;
}
function bottomScore(context,elapsed){
 const goals=goalRows(data,context),sides={home:goals.filter(g=>g.team==='home'),away:goals.filter(g=>g.team==='away')};
 const pages=Math.max(1,Math.ceil(Math.max(sides.home.length,sides.away.length)/4)),period=data.config.bottomHoldMs/pages,page=Math.min(pages-1,Math.floor(elapsed/period));
 const goalText=g=>`<span>${esc(g.name)}${g.kind==='penalty'?' (P)':g.kind==='own'?' (OG)':''}<b>${esc(g.time)}</b></span>`;
 const expansion=goals.length?`<div class="bottom-goals ${context==='restart'?'last-goal':''}">${context==='restart'?`<div>${badge(data[goals[0].team])}<small>刚刚进球</small>${goalText(goals[0])}</div>`:`<div>${['home','away'].map(side=>`<div class="scorers">${sides[side].slice(page*4,page*4+4).map(goalText).join('')||'<span class="no-goals">—</span>'}</div>`).join('')}</div>`}${pages>1?`<small class="goal-page">进球记录 ${page+1} / ${pages}</small>`:''}</div>`:'';
 return {html:`<section class="bottom-score"><div class="bottom-context">${esc(CONTEXTS[context])}${context==='halftime'?' / HALF-TIME':context==='fulltime'?' / FULL-TIME':''}</div>${expansion}${scoreRow('bottom-row',context==='halftime'?data.halftimeScore:data.score)}</section>`,next:pages>1?(page+1)*period-elapsed:Infinity};
}
function opening(){
 const t=(team,side)=>`<div class="opening-team ${side} ${team.name.length>14?'long-name':''}">${badge(team)}<h1>${name(team)}</h1><p>${esc(team.english)}</p><div class="team-rule" style="--brand:${esc(team.brandColor)}"></div></div>`;
 return `${fullBase()}<section class="opening full"><header class="full-header">${competition()}<span>THE MATCH / ${esc(data.competition.round)}</span></header><div class="opening-title"><span>THIS IS OUR GAME.</span><h2>为热爱而战</h2></div><div class="opening-versus">${t(data.home,'home')}<div class="opening-center">${logo()}<span>VS</span><small>${esc(data.competition.name)}</small></div>${t(data.away,'away')}</div><div class="opening-location"><b>${esc(data.competition.kickoff)}</b><span>${esc(data.competition.venue)} · ${esc(data.competition.subtitle)}</span></div><footer class="full-footer"><span>HUST CUP ORIGINAL BROADCAST IDENTITY</span><span>赛前对阵 / MATCH PREVIEW</span></footer></section>`;
}
function setupDragging(){
 if(isLive)return;
 layer.querySelectorAll('.lineup-player').forEach(el=>el.addEventListener('pointerdown',event=>{
  event.preventDefault();const pitch=el.closest('.formation-pitch'),rect=pitch.getBoundingClientRect();el.setPointerCapture(event.pointerId);
  const move=e=>{const x=Math.max(8,Math.min(92,(e.clientX-rect.left)/rect.width*100)),y=Math.max(10,Math.min(89,(e.clientY-rect.top)/rect.height*100));el.style.left=x+'%';el.style.top=y+'%';el.dataset.x=x;el.dataset.y=y;};
  const up=e=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);if(el.dataset.x)parent.postMessage({type:'playerPosition',id:el.dataset.player,x:Number(el.dataset.x),y:Number(el.dataset.y)},location.origin);};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
 }));
}
let lastRun=null,soundRun=null;
function render(){
 clearTimeout(timer);layer.classList.remove('exiting');
 const previousScores=Object.fromEntries([...layer.querySelectorAll('.slim-score .score-value')].map(e=>[e.dataset.side,e.textContent]));
 const now=Date.now()+offset,session=live||{data,scene:previewScene,context:q.get('context')||'pregame',startedAt};
 const resolved=isLive?outputScene(session,now):outputScene(session,Date.now());if(isLive&&session.expiresAt&&now<session.expiresAt){resolved.scene=session.scene;}if(isLive&&session.expiresAt&&now>=session.expiresAt){resolved.scene=data.config.restoreScoreboard?'scoreboard':'clear';}const {scene,elapsed}=resolved;currentElapsed=elapsed;
 const theme=isLive?data.config.theme:q.get('theme')||data.config.theme;
 stage.className='stage '+theme+(q.get('transparent')==='1'?' transparent':'');
 document.querySelector('#safe').classList.toggle('visible',q.get('safe')==='1');
 let html='',next=Infinity;
 if(scene==='scoreboard')html=scoreboard();
 if(scene==='goal'||scene==='substitution')html=event(scene);
 if(scene==='opening')html=opening();
 if(scene==='formation'||scene==='bench'){const result=formation(elapsed,scene==='bench');html=result.html;next=result.next;}
 if(scene==='shootout'||scene==='shootoutCompact')html=shootout(scene==='shootoutCompact');
 if(scene==='bottomScore'){const result=bottomScore(session.context,elapsed);html=result.html;next=Math.min(result.next,data.config.bottomHoldMs-elapsed);}
 if(['goal','substitution','card','cancelGoal','penalty','notice','var','person','statStrip','officials','entrance','kickoff','sponsor'].includes(scene))next=Math.min(next,data.config.eventHoldMs-elapsed);if(scene==='substitution'&&data.substitution.pairs?.length>1)next=Math.min(next,1200);
 if(extraScenes[scene])html=extraScenes[scene](session,elapsed);
 const outputPart=q.get('part');if(outputPart==='persistent')html=['scoreboard','goal','substitution','card','cancelGoal','notice','var','penalty','statStrip','person','officials','sponsor'].includes(scene)?scoreboard():'';if(outputPart==='temporary'){const temp=document.createElement('div');temp.innerHTML=html;temp.querySelectorAll('.slim-score').forEach(e=>e.remove());html=temp.innerHTML;}
 if(data.config.replay&&scene!=='clear'&&outputPart!=='persistent')html+='<div class="replay-corner">回放 / REPLAY</div>';
 layer.innerHTML=html;safeImgError();setupDragging();applyFont();
 const isRefresh=lastRun===session.runId;if(isRefresh)layer.querySelectorAll('.full,.full-bg,.shootout').forEach(e=>e.style.animation='none');lastRun=session.runId;
 const age=Math.max(0,elapsed),animation=layer.querySelector('.cue-graphic');if(animation)animation.style.animationDelay=`-${age}ms`;
 if(isLive&&session.expiresAt){const remaining=session.expiresAt-now;if(remaining<=300&&remaining>0)layer.classList.add('exiting');next=Math.min(next,remaining>300?remaining-300:remaining);}
 if(data.matchClock)updateClock();
 const eventGraphic=layer.querySelector('.mini-event');if(eventGraphic)eventGraphic.style.animationDelay=`-${elapsed}ms`;
 layer.querySelectorAll('.slim-score .score-value').forEach(e=>{if(previousScores[e.dataset.side]!==undefined&&previousScores[e.dataset.side]!==e.textContent)e.classList.add('changed');});
 layer.querySelectorAll('video').forEach(video=>{video.muted=true;video.volume=0;video.addEventListener('error',()=>video.remove(),{once:true});const seek=()=>{const age=elapsed-Number(video.dataset.origin||0);if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=(Math.max(0,age)/1000)%video.duration;const play=()=>{if(video.isConnected)video.play().catch(()=>video.remove());};if(age<0)setTimeout(play,-age);else play();};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});});
 if(data.config.sound&&scene!=='clear'&&soundRun!==session.runId){soundRun=session.runId;const sound=new Audio('assets/cue.wav');sound.volume=data.config.volume;sound.play().catch(()=>{});}
 stage.dataset.scene=scene;stage.dataset.elapsed=String(Math.round(elapsed));document.documentElement.dataset.ready='1';
 parent.postMessage({type:'previewState',scene,step:layer.querySelector('.lineup-panel')?.dataset.step},location.origin);
 if(scene==='transition')next=Math.min(next,elapsed<1250?1250-elapsed:elapsed<1400?1400-elapsed:Infinity);if(['summary','halftime','fulltime'].includes(scene))next=Math.min(next,5000-elapsed%5000);if(Number.isFinite(next))timer=setTimeout(render,Math.max(16,next+5));
}
let hadAdded=false;
function updateClock(){const cv=clockView(data.matchClock,Date.now()+offset);if(Boolean(cv.added)!==hadAdded){hadAdded=Boolean(cv.added);if(['scoreboard','goal','substitution'].includes(stage.dataset.scene)){queueMicrotask(render);}}layer.querySelectorAll('[data-added-clock]').forEach(e=>e.textContent='实际补时 '+cv.added);layer.querySelectorAll('.slim-clock>b').forEach(e=>e.textContent=cv.display);layer.querySelectorAll('.slim-clock>span').forEach(e=>e.textContent=cv.phase);}
setInterval(()=>{if(data?.matchClock)updateClock();},200);
let activeFont='';
function applyFont(){const path=data.config.font||'';if(path===activeFont)return;activeFont=path;if(!path){document.body.style.removeProperty('font-family');stage.style.removeProperty('--font-num');return;}new FontFace('HustCustom',`url("${path}")`).load().then(font=>{if(activeFont!==path)return;document.fonts.add(font);document.body.style.fontFamily='HustCustom, HustBlack, sans-serif';stage.style.setProperty('--font-num','HustCustom, HustBlack, sans-serif');}).catch(()=>{});}
const ptitle=(title,english)=>`<header class="full-header">${competition()}<span>${english} / ${title}</span></header>`;
function noticeStrip(label,content,extra=''){return `${scoreboard()}<section class="info-strip cue-graphic ${extra}"><div class="info-label">${esc(label)}</div><div class="info-content">${content}</div></section>`;}
function personContent(){return `<strong>${esc(data.presentation.personName)}</strong><small>${esc(data.presentation.personRole)}</small>`;}
function statRows(single=false,values=data.stats){const keys=single?[data.presentation.statKey]:Object.keys(STAT_LABELS);return keys.filter(k=>values?.[k]&&values[k].home!==null&&values[k].away!==null).map(k=>{const v=values[k],unit=k==='possession'?'%':'';return `<div class="comparison-row"><b>${v.home}${unit}</b><span>${STAT_LABELS[k]}</span><b>${v.away}${unit}</b></div>`;}).join('')||'<p class="unknown-stat">未录入完整对比数据</p>';}
function summaryPanel(session){const half=session.scene==='halftime',goals=goalRows(data,half?'halftime':'fulltime'),pages=Math.max(1,Math.ceil(goals.length/10)),page=Math.floor(currentElapsed/5000)%pages,visible=goals.slice(page*10,page*10+10),title=half?'半场总结':session.scene==='fulltime'?'全场赛果':'比赛总结';return `${fullBase()}<section class="full summary-screen cue-graphic">${ptitle(title,half?'HALF TIME':'MATCH REPORT')}<div class="report-score">${badge(data.home)}<strong>${name(data.home)}</strong><b>${(half?data.halftimeScore:data.score).home} : ${(half?data.halftimeScore:data.score).away}</b><strong>${name(data.away)}</strong>${badge(data.away)}</div><div class="report-subtitle">${esc(data.matchClock?PHASES[data.matchClock.phase]:'')}${data.tie?.enabled?` · 总比分 ${data.aggregate.home} : ${data.aggregate.away}`:''}${data.shootout.home.length?` · 点球 ${shootoutStatus(data.shootout).home} : ${shootoutStatus(data.shootout).away}`:''}</div><div class="report-columns"><div><h2>进球记录 ${pages>1?`${page+1}/${pages}`:''}</h2>${visible.map(g=>`<div class="report-goal"><span>${esc(data[g.team].short)}</span><strong>${esc(g.name)}${g.kind==='penalty'?' (P)':g.kind==='own'?' (OG)':''}</strong><b>${esc(g.time)}</b></div>`).join('')||'<p>本场暂无有效进球</p>'}</div><div><h2>比赛统计</h2>${statRows(false,half?data.halftimeStats:data.stats)}</div></div>${data.result?.confirmed?`<div class="confirmed-result">${esc(data.result.label)} · ${data.result.winner==='draw'?'平局':name(data[data.result.winner])}</div>`:''}${data.result?.mvp?`<div class="mvp">最佳球员 · ${esc(data.result.mvp)}</div>`:''}<footer class="full-footer"><span>${esc(data.competition.venue)}</span><span>HUST CUP · MATCH REPORT</span></footer></section>`;}
const extraScenes={
 intro:()=>`${fullBase()}<section class="intro-screen cue-graphic">${logo()}<div class="intro-overline">HUST CUP BROADCAST</div><h1>${esc(data.competition.name)}</h1><h2>${esc(data.competition.subtitle)}</h2><div class="intro-rule"></div><p>${esc(data.competition.round)} · ${esc(data.competition.venue)}</p></section>`,
 entrance:()=>`<section class="entrance-bar cue-graphic"><div>${esc(data.competition.name)} · ${esc(data.competition.round)}</div>${scoreRow()}<small>${esc(data.competition.kickoff)}　${esc(data.competition.venue)}</small></section>`,
 kickoff:()=>noticeStrip('即将开球 / KICK OFF',`${badge(data.home)}<strong>${name(data.home)}　vs　${name(data.away)}</strong>${badge(data.away)}`),
 starters:()=>{const l=lineupFor(data);return `${fullBase()}<section class="full lineup-screen cue-graphic">${ptitle('首发名单','STARTING XI')}${leftTeam()}<div class="lineup-panel"><div class="starters-list">${l.players.map(p=>`<div><b>${p.number}</b><strong>${esc(p.name)}</strong><small>${esc(p.position)}</small><span class="list-marks">${marks(p)}</span></div>`).join('')}</div></section>`;},
 officials:()=>noticeStrip('比赛团队',`<div class="officials-content">${data.presentation.referee?`<span>裁判 <b>${esc(data.presentation.referee)}</b></span>`:''}${data.presentation.commentator?`<span>解说 <b>${esc(data.presentation.commentator)}</b></span>`:''}</div>`),
 person:()=>noticeStrip('人物介绍',personContent()),
 card:()=>{const e=data.event||{name:'球员姓名',number:5,team:'home',card:'yellow'},kind=e.effectiveCard||e.card,label=kind==='secondYellow'?'两黄变红':kind==='red'?'红牌':'黄牌';return noticeStrip(label,`${badge(data[e.team])}<span class="card-symbol ${kind}">${kind==='secondYellow'?'<i></i>':''}</span><strong>${esc(e.number)} ${esc(e.name)}</strong><small>${esc(e.time||'')}</small>`);},
 cancelGoal:()=>noticeStrip('进球无效 / NO GOAL',`<strong>${esc(data.event?.text||'进球已取消，比分已修正')}</strong><small>${esc(data.event?.time||'')}</small>`),
 penalty:()=>noticeStrip('点球 / PENALTY',`<strong>${esc(data.event?.text||'点球判罚')}</strong><small>${esc(data.event?.name||'')} ${esc(data.event?.time||'')}</small>`),
 var:()=>noticeStrip('VAR / 判罚审核',`<span class="var-scan"></span><strong>${esc(data.event?.subject||'进球')} · ${esc(data.event?.status||'检查中')}</strong><small>${esc(data.event?.text||'')}</small>`),
 notice:()=>noticeStrip('赛事通知',`<strong>${esc(data.event?.text||data.presentation.notice)}</strong>`),
 statStrip:()=>noticeStrip('比赛数据',statRows(true),'single-stat'),
 statistics:()=>`${fullBase()}<section class="full stats-screen cue-graphic">${ptitle('比赛统计','MATCH STATISTICS')}<div class="stats-heading">${badge(data.home)}<strong>${name(data.home)}</strong><strong>${name(data.away)}</strong>${badge(data.away)}</div><div class="stats-body">${statRows()}</div></section>`,
 halftime:summaryPanel,fulltime:summaryPanel,summary:summaryPanel,
 transition:(s,elapsed)=>`<section class="transition-screen ${elapsed>=1250?'wipe-out':''}" style="--wipe-age:-${elapsed}ms">${logo()}<h1>回放 / REPLAY</h1><span>HUST CUP</span></section>`,
 sponsor:()=>noticeStrip('鸣谢 / THANK YOU',`${data.presentation.sponsorLogo?`<img class="sponsor-logo" src="${esc(data.presentation.sponsorLogo)}" alt="赞助商">`:''}<strong>${esc(data.presentation.sponsorName||'感谢支持本届赛事')}</strong>`)
};

document.querySelector('#backdrop').innerHTML='<div class="sample-field"><span></span><i></i><small>示意球场 · 透明输出不包含底图</small></div>';
if(!isLive&&q.get('stress')==='1'){data.home.name='华中科技大学星火足球队';data.away.name='东湖国际学院远航足球队';data.away.badge='';}
if(isLive){
 const accept=message=>{live=message.live;data=live.data;offset=message.serverNow-Date.now();render();};
 accept(await fetch('api/output').then(r=>r.json()));
 const events=new EventSource('api/events');events.onmessage=e=>accept(JSON.parse(e.data));events.onerror=()=>{stage.dataset.connected='false';};events.onopen=()=>{stage.dataset.connected='true';};
}else render();
addEventListener('message',async event=>{
 if(event.origin!==location.origin||event.source!==parent||isLive)return;
 if(event.data?.type==='draft'){const matchClock=data.matchClock;data={...data,...event.data.data,matchClock};render();}if(event.data?.type==='clock'){data.matchClock=event.data.clock;render();}
 if(event.data?.type==='cue'){data=event.data.data;previewScene=event.data.scene;startedAt=Date.now();render();}
 if(event.data?.type==='replay'){startedAt=Date.now();render();}
 if(event.data?.type==='exit')layer.classList.add('exiting');
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data)render();});
