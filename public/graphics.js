import {decoratePanels} from './woven.js';
import {kitSurfaceVariables,materialSettings} from './material-colors.js';
import {createMotion,ENTER_MS,EXIT_MS} from './motion.js';
import {scoreboardVisible,scoreboardClock,dismissalMarkers,scoreboardEvent} from './scoreboard.js';
import {STAT_LABELS,PHASES,goalMarker} from './match.js';
import {MAX_BENCH,REFEREE_ROLES,SCENES,CONTEXTS,GROUPS,lineupFor,formationAt,goalRows,bottomScores,outputScene,shootoutStatus} from './model.js';
const q=new URLSearchParams(location.search),isLive=q.get('mode')==='live';
let data=isLive?null:(await fetch('api/preview').then(r=>r.json())).data;
let currentScene='scoreboard',currentElapsed=0;let live=null,offset=0,startedAt=Date.now(),timer,previewScene=SCENES.includes(q.get('scene'))?q.get('scene'):'scoreboard';
const stage=document.querySelector('#stage'),layer=document.querySelector('#graphics');
const motion=createMotion(layer);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trophy=()=>'<svg class="trophy" viewBox="0 0 120 120" aria-label="HUST CUP"><g fill="none" stroke="currentColor" stroke-width="8"><path d="M30 18v48l30 24 30-24V18M30 45h60M43 18v23m34-23v23M60 90v14m-22 0h44"/><path d="M30 26H15v26l17 14m58-40h15v26L88 66" stroke-width="6"/></g></svg>';
const logo=()=>!data.competition.logo||data.competition.logo==='assets/competition.svg'?trophy():`<span class="custom-logo"><span class="logo-fallback">${trophy()}</span><img src="${esc(data.competition.logo)}" alt="赛事 logo"></span>`;
const badge=(team,extra='')=>`<span class="badge ${extra}"><span class="badge-fallback">${esc((team.short||team.name).slice(0,2))}</span>${team.badge?`<img src="${esc(team.badge)}" alt="${esc(team.name)}队徽">`:''}</span>`;
const kit=t=>`<i class="kit" style="--kit:${esc(t.kitColor)}"></i>`;
const name=t=>esc(t.name);
const compactName=t=>esc(t.name.length>8&&t.short?t.short:t.name);
const competition=()=>`<div class="competition">${logo()}<div><b>${esc(data.competition.name)}</b><span>${esc(data.competition.subtitle)} · ${esc(data.competition.round)}</span></div></div>`;
const safeImgError=()=>layer.querySelectorAll('img').forEach(img=>{const failed=()=>img.remove();img.addEventListener('error',failed,{once:true});if(img.complete&&!img.naturalWidth)failed();});
const scoreFlags=(team,side)=>{const count=dismissalMarkers(data,side);return count?`<span class="dismissal-flags ${side}" data-red-team="${side}" aria-label="${esc(team.name)}场上红牌 ${count} 张">${'<i></i>'.repeat(count)}</span>`:'';};
function scoreRow(extra='',scores=data.score,center=null){
 return `<div class="score-row ${extra}"><div class="score-team home">${kit(data.home)}${badge(data.home)}<strong title="${name(data.home)}">${compactName(data.home)}</strong></div><b class="score-value" data-side="home">${scores.home}</b>${center||`<div class="score-logo">${logo()}</div>`}<b class="score-value" data-side="away">${scores.away}</b><div class="score-team away"><strong title="${name(data.away)}">${compactName(data.away)}</strong>${badge(data.away)}${kit(data.away)}</div>${scoreFlags(data.home,'home')}${scoreFlags(data.away,'away')}</div>`;
}
function scoreboard(){
 if(!data.config.modules.scoreboard||!scoreboardVisible(data)&&currentScene!=='cancelGoal')return '';
 const cv=scoreboardClock(data,Date.now()+offset,!isLive&&q.get('added')==='1'),item=scoreboardEvent(data,currentScene),width=782+(cv.announced?60:0),context=[];
 if(data.tie?.enabled)context.push(`总比分 ${data.aggregate.home} : ${data.aggregate.away}`);
 if(data.matchClock?.phase==='shootout')context.push(`点球 ${shootoutStatus(data.shootout).home} : ${shootoutStatus(data.shootout).away}`);
 const extension=item?`<div class="team-event-extensions"><div class="team-event-extension ${item.team}" data-event-team="${item.team}"><div><i class="bug-event-symbol ${item.symbol}">${item.symbol==='goal'?'●':item.symbol==='cancel'?'×':''}</i><span>${esc(data[item.team].short||data[item.team].name)} · ${esc(item.label)}</span><b>${esc(item.time||'')}</b></div><strong>${esc(item.number||'')} ${esc(item.name)}${item.goalMark?' '+esc(item.goalMark):''}</strong>${item.reason?`<p class="cancel-reason">${esc(item.reason)}</p>`:''}</div></div>`:'';
 const swapped=data.config.scoreboardLayout==='clock-center',clock=`<div class="slim-clock"><b>${esc(cv.display)}</b><span>${esc(cv.phase)}</span></div>`,added=cv.announced?`<div class="added-time-block" aria-label="补时 ${cv.announced} 分钟"><strong>+${cv.announced}</strong><small>分钟</small></div>`:'';
 const rowWidth=swapped?732+(cv.announced?60:0):660;
 return `<section class="slim-score ${swapped?'clock-center':''}" style="width:${width}px;left:${Math.min(data.config.x,1920-54-width*data.config.scale)}px;top:${Math.min(data.config.y,1080-54-125*data.config.scale)}px;--scale:${data.config.scale};--score-row-width:${rowWidth}px;--clock-slot-width:${122+(cv.announced?60:0)}px" aria-label="单行常驻比分牌">${swapped?scoreRow('',data.score,`<div class="score-clock-slot">${clock}${added}</div>`)+`<div class="score-logo score-end-logo">${logo()}</div>`:scoreRow()+clock+added}${context.length?`<div class="score-context">${context.map(v=>`<span>${v}</span>`).join('')}</div>`:''}${extension}</section>`;
}
function event(type){
 const goal=type==='goal';let item=goal?data.goal:data.substitution;if(!goal&&item.pairs?.length){const index=Math.min(item.pairs.length-1,Math.floor(currentElapsed/Math.max(1200,data.config.eventHoldMs/item.pairs.length)));item={...item,...item.pairs[index]};}const team=data[item.team]||data.home;
 const content=goal?`<div class="mini-heading"><span>进球 / GOAL</span><b>${esc(item.time)}</b></div><div class="mini-player"><b>${esc(item.number)}</b><strong>${esc(item.name)}</strong>${goalMarker(item.kind)?`<span>${esc(goalMarker(item.kind))}</span>`:''}</div>`:`<div class="mini-heading"><span>换人 / SUBSTITUTION</span><b>${esc(item.time)}</b></div><div class="mini-sub"><span class="in">↑ 换上</span><b>${esc(item.on?.number??'')}</b><strong>${esc(item.on?.name??'')}</strong></div><div class="mini-sub"><span class="out">↓ 换下</span><b>${esc(item.off?.number??'')}</b><strong>${esc(item.off?.name??'')}</strong></div>`;
 return `${scoreboard()}<section class="mini-event ${goal?'mini-goal':'mini-substitution'}"><div class="mini-badge">${badge(team)}</div><div class="mini-content">${content}</div></section>`;
}
const fullBase=()=>`<div class="full-bg"><div class="light-arc arc-one"></div><div class="light-arc arc-two"></div><div class="grid-lines"></div><div class="ghost-mark">${trophy()}</div></div>`;
function marks(p){return `<span class="player-marks">${data.config.showCaptain&&p.captain?'<i class="captain-mark" title="队长">C</i>':''}${data.config.showYellow&&p.yellowCards?`<i class="yellow-mark" title="累计黄牌 ${p.yellowCards}"><em></em>${p.yellowCards}</i>`:''}</span>`;}
function shirt(p){const team=data[data.config.team],color=p.shirtColor||(p.goalkeeper?team.goalkeeperColor:team.kitColor);const rgb=color.slice(1).match(/../g).map(x=>parseInt(x,16));const ink=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>155?'#142033':'#ffffff';return `<span class="jersey" style="--shirt:${esc(color)};--number-ink:${ink}"><b>${p.number}</b></span>`;}
function media(p,small=false,origin=0){const photo=data.config.usePhotos&&p.photo,video=!small&&data.config.useVideos&&p.video;return `<span class="player-media">${shirt(p)}${photo?`<img class="portrait-cutout" src="${esc(p.photo)}" alt="${esc(p.name)}定妆照">`:''}${video?`<video src="${esc(p.video)}" data-origin="${origin}" loop muted playsinline preload="auto" aria-label="${esc(p.name)}球员视频"></video>`:''}</span>`;}
function field(revealed=[]){
 const players=lineupFor(data).players,dense=lineupFor(data).name.split('-').length>=4;
 const token=p=>{const near=players.filter(o=>o!==p&&Math.abs(o.y-p.y)<7),gap=near.length?Math.min(...near.map(o=>Math.abs(o.x-p.x)))*13.64:220,width=Math.max(76,Math.min(players.length<=7?220:190,gap-8)),avatar=Math.min(players.length<=7?120:dense?104:112,width-38);return `--token-width:${width}px;--avatar-size:${Math.max(46,avatar)}px;--name-size:${width<125?23:players.length<=7?36:32}px`;};
 return `<div class="formation-pitch ${dense?'dense-formation':''}"><div class="field-line field-border"></div><div class="field-line field-half"></div><div class="field-line field-circle"></div><div class="field-line field-box top"></div><div class="field-line field-box bottom"></div>${players.map(p=>`<div class="lineup-player" data-player="${esc(p.id)}" data-team="${data.config.team}" style="left:${p.x}%;top:${p.y}%;${token(p)}"><div class="player-avatar">${revealed.includes(p.group)?media(p,true):shirt(p)}${marks(p)}</div><strong class="formation-name" title="${esc(p.name)}">${esc(p.name)}</strong><small>${p.number}</small></div>`).join('')}</div>`;
}
function benchPanel(){
 const bench=lineupFor(data).bench.slice(0,MAX_BENCH);
 return `<div class="bench-panel" data-count="${bench.length}"><div class="panel-kicker">SUBSTITUTES / 替补球员 <small>${bench.length} 人</small></div><div class="bench-grid ${bench.length>6?'two-cols':''}" style="--bench-rows:${Math.max(1,Math.ceil(bench.length/(bench.length>6?2:1)))}">${bench.map(p=>`<div class="bench-row"><b>${p.number}</b><strong>${esc(p.name)}</strong><span class="bench-position">（${esc(p.position)}）</span><span class="bench-marks">${marks(p)}</span></div>`).join('')}</div>${!bench.length?'<div class="empty-bench">未录入替补名单</div>':''}</div>`;
}
function focus(step,elapsed){
 const groupPlayers=lineupFor(data).players.filter(p=>p.group===step.group),players=step.playerIds?groupPlayers.filter(p=>step.playerIds.includes(p.id)):groupPlayers.slice((Number(q.get('page'))||0)*5,(Number(q.get('page'))||0)*5+5),back=['media','lineClose'].includes(step.kind);
 const origin=step.forced?0:step.mediaStart, lineAge=step.forced?(q.get('hold')==='1'?5000:elapsed):Math.max(0,elapsed-step.introStart);
 return `<div class="focus-panel ${data.config.positionRibbon?'has-position-ribbon':''}"><div class="panel-kicker">${esc(GROUPS[step.group])} <small>PLAYER INTRODUCTION${step.pages>1?` · ${step.page+1}/${step.pages}`:''}</small></div><div class="focus-cards" style="--cards:${players.length};--focus-card-width:${players.length===1?440:players.length===2?410:players.length===3?360:players.length===4?300:240}px;--focus-media-height:${players.length<=2?500:players.length===3?480:450}px">${players.map((p,i)=>`<article class="focus-card" style="--intro-index:${i};--intro-age:-${Math.max(0,lineAge)}ms"><div class="flip-space"><div class="flip-card ${step.kind==='flip'?'turning':back?'turned':''}" style="--flip-age:-${Math.max(0,elapsed-step.start)}ms"><div class="card-face card-front">${shirt(p)}</div><div class="card-face card-back">${media(p,false,origin)}</div></div>${marks(p)}</div><div class="focus-name"><b>${p.number}</b><strong>${esc(p.name)}</strong></div><small>${esc(p.position)}</small></article>`).join('')}</div>${data.config.positionRibbon?positionRibbon(step,elapsed):''}</div>`;
}
function positionRibbon(step,elapsed){
 const english={goalkeeper:'GOALKEEPER',defenders:'DEFENDERS',midfielders:'MIDFIELDERS',forwards:'FORWARDS'};
 const age=step.forced?elapsed:Math.max(0,elapsed-step.introStart),remaining=step.end-elapsed,groupRemaining=step.forced?Infinity:step.groupEnd-elapsed;
 return `<div class="position-ribbon ${step.kind==='lineClose'?'ribbon-leaving':''}" data-position="${step.group}" data-page="${step.page||0}" ${Number.isFinite(groupRemaining)?`data-motion-remaining="${groupRemaining}"`:""} style="--ribbon-age:-${age}ms;--ribbon-exit-age:-${Math.max(0,450-remaining)}ms"><span>${esc(GROUPS[step.group])}</span><b>${english[step.group]}</b><i></i></div>`;
}
function fitFormationNames(){
 layer.querySelectorAll('.formation-name,.focus-name>strong').forEach(el=>{el.style.fontSize='';let size=parseFloat(getComputedStyle(el).fontSize);while(el.scrollWidth>el.clientWidth+1&&size>14){size--;el.style.fontSize=size+'px';}});
}
function lineupLegend(){return `<div class="lineup-legend">${data.config.showCaptain?'<span><i class="captain-mark">C</i> 队长</span>':''}${data.config.showYellow?'<span><i class="yellow-mark"><em></em>1</i> 累计黄牌</span>':''}</div>`;}
function leftTeam(bench=false){const t=data[data.config.team],l=lineupFor(data),officials=[['coach','主教练','HEAD COACH'],['assistantCoach','助理教练','ASSISTANT COACH'],['manager','领队','TEAM MANAGER'],['medic','队医','TEAM DOCTOR']].filter(([key])=>l[key]?.trim());return `<div class="lineup-team ${t.name.length>10?'long-name':''}"><div class="overline">${bench?'SUBSTITUTES':'STARTERS'}</div>${badge(t,'lineup-badge')}<h1>${name(t)}</h1><p>${esc(t.english)}</p><div class="lineup-shape" style="font-size:${bench?64:Math.min(60,270/(l.name.replace(/\s/g,'').length*.95))}px;white-space:nowrap;letter-spacing:1px">${bench?`${Math.min(MAX_BENCH,l.bench.length)} 人`:esc(l.name)}</div><div class="team-officials">${officials.map(([key,label,en])=>`<div class="team-official ${key==='coach'?'head-coach':''}" data-official="${key}"><small>${label} / ${en}</small><strong>${esc(l[key])}</strong></div>`).join('')}</div></div>`;}
function formation(elapsed,standaloneBench=false,single=false){
 let step=standaloneBench?{kind:'bench',revealed:[],start:0,end:Infinity}:formationAt(single?{...data,config:{...data.config,lineupBoth:false}}:data,elapsed);
 const force=isLive?'':q.get('step')||'';
 if(force==='initial')step={kind:'formation',revealed:[],start:0,end:Infinity};
 if(force==='portraits')step={kind:'formation',revealed:Object.keys(GROUPS),start:0,end:Infinity};
 if(force==='bench')step={kind:'bench',revealed:Object.keys(GROUPS),start:0,end:Infinity};
 if(force?.startsWith('media-'))step={kind:'media',group:force.slice(6),revealed:[],start:0,end:Infinity,forced:true};
 if(step.kind==='teamFlip'){const saved=data.config.team;data.config.team=step.fromTeam;const front=formation(step.start-1,false,true).html;data.config.team=step.team;const back=formation(0,false,true).html;data.config.team=saved;return {html:`<div class="team-turn-space"><div class="team-turn" style="--team-turn-age:-${Math.max(0,elapsed-step.start)}ms"><div class="team-turn-face">${front}</div><div class="team-turn-face team-turn-back">${back}</div></div></div>`,next:step.end-elapsed};}
 const savedTeam=data.config.team;if(step.team)data.config.team=step.team;
 const isBench=step.kind==='bench';let content;
 if(isBench)content=benchPanel();
 else if(step.kind==='benchFlip')content=`<div class="panel-flip-space"><div class="panel-flipper" style="--flip-age:-${elapsed-step.start}ms"><div class="panel-face">${field(step.revealed)}</div><div class="panel-face panel-back">${benchPanel()}</div></div></div>`;
 else if(step.kind==='formation')content=field(step.revealed);
 else content=focus(step,elapsed);
 const html=`${fullBase()}<section class="full lineup-screen" data-lineup-team="${data.config.team}"><header class="full-header">${competition()}<span>${isBench?'SUBSTITUTES / 替补名单':'TEAM LINE-UP / 首发阵型'}</span></header>${leftTeam(isBench)}<div class="lineup-panel" data-step="${step.kind}" data-group="${step.group||''}" data-player-count="${lineupFor(data).players.length}" style="--line-age:-${Math.max(0,elapsed-(step.introStart??0))}ms;--close-age:-${Math.max(0,elapsed-step.start)}ms">${content}${lineupLegend()}</div><footer class="full-footer"><span>${esc(data.competition.name)} · ${esc(data.competition.round)}</span><span>${!isLive?'预览可拖动球员位置 · ':''}${isBench?'替补名单':step.kind==='formation'?'首发阵容':GROUPS[step.group]||'替补翻页'}</span></footer></section>`;data.config.team=savedTeam;return {html,next:step.kind==='media'&&data.config.positionRibbon&&step.end-elapsed>450?step.end-elapsed-450:Number.isFinite(step.end)?step.end-elapsed:Infinity};
}
function kickIcon(value,active=false,unneeded=false){return `<span class="kick ${active?'active-kick ':''}${value===1?'made':value===0?'missed':unneeded?'unneeded':'pending'}" aria-label="${value===1?'罚进':value===0?'罚失':unneeded?'无需再罚':'待罚'}">${value===1?'●':value===0?'×':'—'}</span>`;}
function shootout(compact=false){
 const s=data.shootout,status=shootoutStatus(s),count=Math.max(5,s.home.length,s.away.length,status.round);
 const size=compact?8:12,start=Math.max(0,count-size),end=count;
 const rows=['home','away'].map(side=>`<div data-team="${side}" class="pk-row ${status.next===side&&!status.winner?'current-kicker':''}">${badge(data[side])}<div class="pk-team"><strong>${name(data[side])}</strong>${compact?'':`<small>${esc(data[side].english)}</small>`}</div><b class="pk-score">${status[side]}</b><div class="pk-kicks" style="--round-count:${end-start}">${Array.from({length:end-start},(_,i)=>kickIcon(s[side][start+i],side===status.next&&!status.winner&&start+i===(s[side].indexOf(null)>=0?s[side].indexOf(null):s[side].length),!!status.winner&&s[side][start+i]===undefined)).join('')}</div></div>`).join('');
 const lastSide=s.home.length===s.away.length?(s.first==='home'?'away':'home'):s.home.length>s.away.length?'home':'away',last=s.players?.[lastSide]?.[s[lastSide].length-1],kickerLine=last?.name?`<div class="pk-kicker-line">上脚罚球 · ${esc(data[lastSide].short)}　${esc(last.number||'')} ${esc(last.name)}</div>`:'';
 const notice=status.winner?(s.confirmed?`${esc(data[status.winner].name)} · 点球获胜`:'已决胜 · 待确认结束'): `${status.suddenDeath?'突然死亡 · ':''}第 ${status.round} 轮 · ${esc(data[status.next].short)}待罚`;
 return compact?`<section class="compact-pk"><div class="compact-pk-title"><span>点球大战</span><b>${notice}</b><small>第 ${start+1}–${end} 轮</small></div>${rows}${kickerLine}</section>`:`<section class="shootout result-pk"><div class="pk-header">${logo()}<div><span>PENALTY SHOOT-OUT</span><strong>点球大战 · 结果</strong></div><div class="pk-match">比赛比分 <b>${data.score.home} : ${data.score.away}</b><small>与点球比分分别保存</small></div></div><div class="rounds"><span>第 ${start+1}–${end} 轮</span><div style="--round-count:${end-start}">${Array.from({length:end-start},(_,i)=>`<span>${start+i+1}</span>`).join('')}</div></div>${rows}<div class="pk-footer"><span>${s.first==='home'?data.home.short:data.away.short}先罚</span><strong>${notice}</strong></div>${kickerLine}</section>`;
}
function bottomScore(context,elapsed){
 const goals=goalRows(data,context),sides={home:goals.filter(g=>g.team==='home'),away:goals.filter(g=>g.team==='away')};
 const pages=Math.max(1,Math.ceil(Math.max(sides.home.length,sides.away.length)/4)),period=data.config.bottomHoldMs/pages,page=Math.min(pages-1,Math.floor(elapsed/period));
 const goalText=g=>`<span>${esc(g.name)}${goalMarker(g.kind)?' '+goalMarker(g.kind):''}<b>${esc(g.time)}</b></span>`;
 const expansion=goals.length?`<div class="bottom-goals ${context==='restart'?'last-goal':''}">${context==='restart'?`<div>${badge(data[goals[0].team])}<small>刚刚进球</small>${goalText(goals[0])}</div>`:`<div>${['home','away'].map(side=>`<div class="scorers">${sides[side].slice(page*4,page*4+4).map(goalText).join('')||'<span class="no-goals">—</span>'}</div>`).join('')}</div>`}${pages>1?`<small class="goal-page">进球记录 ${page+1} / ${pages}</small>`:''}</div>`:'';
 return {html:`<section class="bottom-score"><div class="bottom-context">${esc(CONTEXTS[context])}${context==='halftime'?' / HALF-TIME':context==='fulltime'?' / FULL-TIME':''}</div>${expansion}${scoreRow('bottom-row',bottomScores(data,context))}</section>`,next:pages>1?(page+1)*period-elapsed:Infinity};
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
  const up=e=>{el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);if(el.dataset.x)parent.postMessage({type:'playerPosition',team:el.dataset.team,id:el.dataset.player,x:Number(el.dataset.x),y:Number(el.dataset.y)},location.origin);};
  el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
 }));
}
let lastRun=null,soundRun=null;
function render(){
 clearTimeout(timer);layer.classList.remove('exiting');
 const previousScores=Object.fromEntries([...layer.querySelectorAll('.slim-score .score-value')].map(e=>[e.dataset.side,e.textContent]));
 const now=Date.now()+offset,session=live||{data,scene:previewScene,context:q.get('context')||'pregame',startedAt};
 const resolved=isLive?outputScene(session,now):outputScene(session,Date.now());if(isLive&&session.expiresAt&&now<session.expiresAt){resolved.scene=session.scene;}if(isLive&&session.expiresAt&&now>=session.expiresAt){resolved.scene=data.config.restoreScoreboard?'scoreboard':'clear';}if(!isLive&&q.get('hold')==='1'){resolved.scene=previewScene;resolved.elapsed=ENTER_MS+100;}const {scene,elapsed}=resolved;currentElapsed=elapsed;currentScene=scene;
 const theme=isLive?data.config.theme:q.get('theme')||data.config.theme;
 const surface=materialSettings(data.config,{live:isLive,query:q});
 stage.className='stage '+theme+' line-motion-active'+(q.get('transparent')==='1'?' transparent':'')+(surface.material==='acrylic'?' acrylic-surface':'')+(!isLive&&q.get('backdrop')==='stadium'?' stadium-prototype':'');
 stage.dataset.materialPalette=surface.palette;stage.dataset.texture=data.config.texture===false?'none':'woven';
 for(const [key,value] of Object.entries(kitSurfaceVariables(data,scene)))stage.style.setProperty(key,value);
 stage.dataset.corners=(!isLive&&q.has('corners')?q.get('corners'):data.config.cornerRadius===18?'round':'square');
 stage.style.setProperty('--material-alpha',String(surface.alpha));
 document.querySelector('#safe').classList.toggle('visible',q.get('safe')==='1');
 let html='',next=Infinity;
 if(scene==='scoreboard')html=scoreboard();
 if(scene==='goal'||scene==='substitution')html=event(scene);
 if(scene==='opening')html=opening();
 if(scene==='formation'||scene==='bench'){const result=formation(elapsed,scene==='bench');html=result.html;next=result.next;}
 if(scene==='shootout'||scene==='shootoutCompact')html=shootout(scene==='shootoutCompact');
 if(scene==='bottomScore'){const result=bottomScore(session.context,elapsed);html=result.html;next=Math.min(result.next,data.config.bottomHoldMs-elapsed);}
 if(['goal','substitution','card','cancelGoal','penalty','notice','var','person','statStrip','officials','commentators','entrance','kickoff','sponsor'].includes(scene))next=Math.min(next,data.config.eventHoldMs-elapsed);if(scene==='substitution'&&data.substitution.pairs?.length>1)next=Math.min(next,1200);
 if(extraScenes[scene])html=extraScenes[scene](session,elapsed);
 const outputPart=q.get('part');if(outputPart==='persistent')html=['scoreboard','goal','substitution','card','cancelGoal','notice','var','penalty','statStrip','person','officials','commentators','sponsor'].includes(scene)?scoreboard():'';if(outputPart==='temporary'){const temp=document.createElement('div');temp.innerHTML=html;temp.querySelectorAll('.slim-score').forEach(e=>e.remove());html=temp.innerHTML;}
 if(data.config.replay&&scene!=='clear'&&outputPart!=='persistent')html+='<div class="replay-corner">回放 / REPLAY</div>';
 const frozen=!isLive&&q.get('hold')==='1',transient=['goal','substitution','card','cancelGoal','penalty','notice','var','person','statStrip','officials','commentators','entrance','kickoff','sponsor'].includes(scene),remaining=frozen?null:isLive&&session.expiresAt?session.expiresAt-now:scene==='bottomScore'?data.config.bottomHoldMs-elapsed:transient?data.config.eventHoldMs-elapsed:null;
 motion.paint(html,{run:session.runId||`${previewScene}:${startedAt}`,elapsed,remaining,immediate:scene==='clear'||frozen});decoratePanels(layer,{enabled:data.config.texture!==false});safeImgError();setupDragging();applyFont();fitFormationNames();document.fonts.ready.then(fitFormationNames);
 const isRefresh=lastRun===session.runId;if(isRefresh)layer.querySelectorAll('.full,.full-bg,.shootout').forEach(e=>{if(!e.matches('.opening,.shootout'))e.style.animation='none';});lastRun=session.runId;
 if(remaining!==null&&remaining>0)next=Math.min(next,remaining>EXIT_MS?remaining-EXIT_MS:remaining);
 if(data.matchClock)updateClock();
 layer.querySelectorAll('.slim-score .score-value').forEach(e=>{if(previousScores[e.dataset.side]!==undefined&&previousScores[e.dataset.side]!==e.textContent)e.classList.add('changed');});
 layer.querySelectorAll('video').forEach(video=>{video.muted=true;video.volume=0;video.addEventListener('error',()=>video.remove(),{once:true});const seek=()=>{const age=elapsed-Number(video.dataset.origin||0);if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=(Math.max(0,age)/1000)%video.duration;const play=()=>{if(video.isConnected)video.play().catch(()=>video.remove());};if(age<0)setTimeout(play,-age);else play();};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});});
 if(data.config.sound&&scene!=='clear'&&soundRun!==session.runId){soundRun=session.runId;const sound=new Audio('assets/cue.wav');sound.volume=data.config.volume;sound.play().catch(()=>{});}
 stage.dataset.scene=scene;stage.dataset.elapsed=String(Math.round(elapsed));document.documentElement.dataset.ready='1';
 parent.postMessage({type:'previewState',scene,step:layer.querySelector('.lineup-panel')?.dataset.step},location.origin);
 if(scene==='transition')next=Math.min(next,elapsed<1250?1250-elapsed:elapsed<1400?1400-elapsed:Infinity);if(['summary','halftime','fulltime'].includes(scene))next=Math.min(next,5000-elapsed%5000);if(!isLive&&q.get('hold')==='1')next=Infinity;if(Number.isFinite(next))timer=setTimeout(render,Math.max(16,next+5));
}
function updateClock(){const cv=scoreboardClock(data,Date.now()+offset,!isLive&&q.get('added')==='1');layer.querySelectorAll('.slim-clock>b').forEach(e=>e.textContent=cv.display);layer.querySelectorAll('.slim-clock>span').forEach(e=>e.textContent=cv.phase);}
setInterval(()=>{if(data?.matchClock)updateClock();},200);
let activeFont='';
function applyFont(){const path=data.config.font||'';if(path===activeFont)return;activeFont=path;document.body.style.removeProperty('font-family');stage.style.removeProperty('font-family');stage.style.removeProperty('--font-num');if(!path)return;new FontFace('HustCustom',`url("${path}")`).load().then(font=>{if(activeFont!==path)return;document.fonts.add(font);stage.style.fontFamily='HustCustom,HustTitle,HustBlack,sans-serif';stage.style.setProperty('--font-num','HustCustom,HustTitle,HustBlack,sans-serif');fitFormationNames();}).catch(()=>{});}
const ptitle=(title,english)=>`<header class="full-header">${competition()}<span>${english} / ${title}</span></header>`;
function noticeStrip(label,content,extra=''){return `${scoreboard()}<section class="info-strip cue-graphic ${extra}"><div class="info-label">${esc(label)}</div><div class="info-content">${content}</div></section>`;}
function personContent(){return `<strong>${esc(data.presentation.personName)}</strong><small>${esc(data.presentation.personRole)}</small>`;}
function statRows(single=false,values=data.stats){const keys=single?[data.presentation.statKey]:Object.keys(STAT_LABELS);return keys.filter(k=>values?.[k]&&values[k].home!==null&&values[k].away!==null).map(k=>{const v=values[k],unit=k==='possession'?'%':'';return `<div class="comparison-row"><b>${v.home}${unit}</b><span>${STAT_LABELS[k]}</span><b>${v.away}${unit}</b></div>`;}).join('')||'<p class="unknown-stat">未录入完整对比数据</p>';}
function summaryPanel(session){const half=session.scene==='halftime',goals=goalRows(data,half?'halftime':'fulltime'),pages=Math.max(1,Math.ceil(goals.length/10)),page=Math.floor(currentElapsed/5000)%pages,visible=goals.slice(page*10,page*10+10),title=half?'半场总结':session.scene==='fulltime'?'全场赛果':'比赛总结';return `${fullBase()}<section class="full summary-screen cue-graphic">${ptitle(title,half?'HALF TIME':'MATCH REPORT')}<div class="report-score">${badge(data.home)}<strong>${name(data.home)}</strong><b>${(half?data.halftimeScore:data.score).home} : ${(half?data.halftimeScore:data.score).away}</b><strong>${name(data.away)}</strong>${badge(data.away)}</div><div class="report-subtitle">${esc(data.matchClock?PHASES[data.matchClock.phase]:'')}${data.tie?.enabled?` · 总比分 ${data.aggregate.home} : ${data.aggregate.away}`:''}${data.shootout.home.length?` · 点球 ${shootoutStatus(data.shootout).home} : ${shootoutStatus(data.shootout).away}`:''}</div><div class="report-columns"><div><h2>进球记录 ${pages>1?`${page+1}/${pages}`:''}</h2>${visible.map(g=>`<div class="report-goal"><span>${esc(data[g.team].short)}</span><strong>${esc(g.name)}${goalMarker(g.kind)?' '+goalMarker(g.kind):''}</strong><b>${esc(g.time)}</b></div>`).join('')||'<p>本场暂无有效进球</p>'}</div><div><h2>比赛统计</h2>${statRows(false,half?data.halftimeStats:data.stats)}</div></div>${data.result?.confirmed?`<div class="confirmed-result">${esc(data.result.label)} · ${data.result.winner==='draw'?'平局':name(data[data.result.winner])}</div>`:''}${data.result?.mvp?`<div class="mvp">最佳球员 · ${esc(data.result.mvp)}</div>`:''}<footer class="full-footer"><span>${esc(data.competition.venue)}</span><span>HUST CUP · MATCH REPORT</span></footer></section>`;}
const extraScenes={
 intro:()=>`${fullBase()}<section class="intro-screen cue-graphic ${data.competition.name.length>18?'long-title':''}">${logo()}<div class="intro-overline">HUST CUP BROADCAST</div><h1>${esc(data.competition.name)}</h1><h2>${esc(data.competition.subtitle)}</h2><div class="intro-rule"></div><p>${esc(data.competition.round)} · ${esc(data.competition.venue)}</p></section>`,
 entrance:()=>`<section class="entrance-bar cue-graphic"><div>${esc(data.competition.name)} · ${esc(data.competition.round)}</div>${scoreRow()}<small>${esc(data.competition.kickoff)}　${esc(data.competition.venue)}</small></section>`,
 kickoff:()=>noticeStrip('即将开球 / KICK OFF',`${badge(data.home)}<strong>${name(data.home)}　vs　${name(data.away)}</strong>${badge(data.away)}`),
 starters:()=>{const l=lineupFor(data);return `${fullBase()}<section class="full lineup-screen cue-graphic">${ptitle('首发名单','STARTING LINE-UP')}${leftTeam()}<div class="lineup-panel" data-player-count="${l.players.length}"><div class="starters-list" style="--starter-rows:${l.players.length<=5?l.players.length:Math.ceil(l.players.length/2)};--starter-cols:${l.players.length<=5?1:2}">${l.players.map(p=>`<div><b>${p.number}</b><strong>${esc(p.name)}</strong><small>${esc(p.position)}</small><span class="list-marks">${marks(p)}</span></div>`).join('')}</div></section>`;},
 officials:()=>{const people=Object.entries(REFEREE_ROLES).filter(([key])=>data.presentation[key]?.trim());return people.length?`${scoreboard()}<section class="referee-panel cue-graphic"><div class="referee-title">裁判团队 / MATCH OFFICIALS</div><div class="referee-list">${people.map(([key,label])=>`<div class="referee-row" data-referee="${key}"><span>${label}</span><strong>${esc(data.presentation[key])}</strong>${data.presentation[key+'College']?`<small>${esc(data.presentation[key+'College'])}</small>`:''}</div>`).join('')}</div></section>`:scoreboard();},
 commentators:()=>data.presentation.commentator?.trim()?noticeStrip('解说团队 / COMMENTARY',`<div class="commentator-person"><strong>${esc(data.presentation.commentator)}</strong>${data.presentation.commentatorCollege?`<small>${esc(data.presentation.commentatorCollege)}</small>`:''}</div>`,'commentator-strip'):scoreboard(),
 person:()=>noticeStrip('人物介绍',personContent()),
 card:()=>{const e=data.event||{name:'球员姓名',number:5,team:'home',card:'yellow'},kind=e.effectiveCard||e.card,label=kind==='secondYellow'?'两黄变红':kind==='red'?'红牌':'黄牌';return noticeStrip(label,`${badge(data[e.team])}<span class="card-symbol ${kind}">${kind==='secondYellow'?'<i></i>':''}</span><strong>${esc(e.number)} ${esc(e.name)}</strong><small>${esc(e.time||'')}</small>`,'card-strip');},
 cancelGoal:()=>scoreboard(),
 penalty:()=>noticeStrip('点球 / PENALTY',`<strong>${esc(data.event?.text||'点球判罚')}</strong><small>${esc(data.event?.name||'')} ${esc(data.event?.time||'')}</small>`),
 var:()=>{const e=data.event||{},decided=e.varStage==='decision';return noticeStrip(decided?'VAR 决定 / VAR Decision':'VAR / 判罚审核',`<span class="var-logo ${decided?'decided':'checking'}" aria-label="VAR">VAR</span><div class="var-copy"><strong>${esc(decided?e.decision||e.status||'最终决定':e.subject||'进球')}</strong><small>${esc(decided?e.subject||'':e.status||'检查中')}${e.text?' · '+esc(e.text):''}</small></div>`,'var-strip');},
 notice:()=>noticeStrip('赛事通知',`<strong>${esc(data.event?.text||data.presentation.notice)}</strong>`),
 statStrip:()=>noticeStrip('比赛数据',statRows(true),'single-stat'),
 statistics:()=>`${fullBase()}<section class="full stats-screen cue-graphic">${ptitle('比赛统计','MATCH STATISTICS')}<div class="stats-heading">${badge(data.home)}<strong>${name(data.home)}</strong><strong>${name(data.away)}</strong>${badge(data.away)}</div><div class="stats-body">${statRows()}</div></section>`,
 halftime:summaryPanel,fulltime:summaryPanel,summary:summaryPanel,
 transition:(s,elapsed)=>`<section class="transition-screen ${elapsed>=1250?'wipe-out':''}" style="--wipe-age:-${elapsed}ms">${logo()}<h1>回放 / REPLAY</h1><span>HUST CUP</span></section>`,
 sponsor:()=>noticeStrip('鸣谢 / THANK YOU',`${data.presentation.sponsorLogo?`<img class="sponsor-logo" src="${esc(data.presentation.sponsorLogo)}" alt="赞助商">`:''}<strong>${esc(data.presentation.sponsorName||'感谢支持本届赛事')}</strong>`,'sponsor-strip')
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
 if(event.data?.type==='lineDemoExit'&&q.get('lineMotion')==='1'){const panel=layer.querySelector('.lineup-panel');if(panel)panel.animate([{clipPath:getComputedStyle(panel).clipPath,opacity:1},{clipPath:getComputedStyle(panel).clipPath,opacity:1,offset:.12},{clipPath:'inset(0px calc(100% - 4px) 0px 0px)',opacity:1,offset:.78},{clipPath:'inset(0px calc(100% - 4px) 0px 0px)',opacity:1,offset:.9},{clipPath:'inset(0px calc(100% - 4px) 0px 0px)',opacity:0}],{duration:700,easing:'cubic-bezier(.15,.8,.2,1)',fill:'both'});return;}
 if(event.data?.type==='draft'){const matchClock=data.matchClock;data={...data,...event.data.data,matchClock};render();}if(event.data?.type==='clock'){data.matchClock=event.data.clock;render();}
 if(event.data?.type==='cue'){data=event.data.data;previewScene=event.data.scene;startedAt=Date.now();render();}
 if(event.data?.type==='replay'){startedAt=Date.now();render();}
 if(event.data?.type==='exit')motion.withdraw();
});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data)render();});
