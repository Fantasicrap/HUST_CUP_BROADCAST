import {penaltyStatus} from './match.js';
import {MAX_BENCH,normalizeRules,formationsFor} from './roster-rules.js';
export {MAX_BENCH,MATCH_FORMATS,COMMON_FORMATIONS,formationsFor,assertBenchLimit,assertLineups,arrangeFormation,arrangeCustom,lineupErrors,customShape} from './roster-rules.js';
export const REFEREE_ROLES={referee:'主裁判',assistantReferee1:'第一助理裁判',assistantReferee2:'第二助理裁判',fourthOfficial:'第四官员',additionalReferee1:'附加助理裁判',additionalReferee2:'附加助理裁判',reserveReferee:'候补助理裁判'};
export const MODULES = {scoreboard:'左上常驻比分牌',goal:'进球播报',substitution:'换人播报',opening:'全屏开场对阵',formation:'首发阵型',bench:'替补名单',shootoutCompact:'底部点球进行中',shootout:'点球结果大面板',bottomScore:'底部简要比分牌',intro:'赛事开场',entrance:'球员入场横条',starters:'独立首发名单',officials:'裁判团队',commentators:'解说团队',kickoff:'开球信息条',card:'给牌',cancelGoal:'进球无效',penalty:'比赛点球事件',var:'VAR 判罚审核',notice:'通用通知',statStrip:'单项统计条',statistics:'统计对比',person:'人物介绍',halftime:'半场总结',fulltime:'全场赛果',summary:'比赛总结',transition:'回放转场',sponsor:'赞助鸣谢'};
export const CONTEXTS={pregame:'开场 / 开球',halftime:'半场结束',secondhalf:'下半场开场',fulltime:'全场结束',restart:'进球后重新开球'};
export const GROUPS={goalkeeper:'门将',defenders:'后卫线',midfielders:'中场线',forwards:'前锋线'};
export const POSITIONS=['门将','中后卫','左后卫','右后卫','后腰','中前卫','前腰','左边锋','右边锋','中锋','前锋'];
export const SCENES=Object.keys(MODULES);
const text=(v,f='',max=80)=>typeof v==='string'?v.trim().slice(0,max):f;
const num=(v,f,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):f;
const bool=(v,f=true)=>typeof v==='boolean'?v:f;
const color=(v,f)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:f;
export const assetPath=v=>/^(assets\/[\w.-]+\.(svg|png|jpg|jpeg|webp)|uploads\/[a-f0-9]{64}\.(svg|png|jpg|jpeg|webp|mp4|webm|otf|ttf|woff|woff2))$/i.test(v||'')?v:'';
const imagePath=v=>/\.(svg|png|jpe?g|webp)$/i.test(v||'')?assetPath(v):'';
const videoPath=v=>/\.(mp4|webm)$/i.test(v||'')?assetPath(v):'';
export function normalizeDraft(raw,sample){
 const base=structuredClone(sample);
 const team=side=>{const t=raw[side]||{},d=base[side];return {name:text(t.name,d.name,60),short:text(t.short,d.short,12),english:text(t.english,d.english,80),badge:imagePath(t.badge??d.badge),brandColor:color(t.brandColor,d.brandColor),kitColor:color(t.kitColor,d.kitColor),goalkeeperColor:color(t.goalkeeperColor,'#f1c477')};};
 const lineup=(value,fallback,side)=>{
  const players=Array.isArray(value?.players)?value.players:fallback.players;
  const subs=Array.isArray(value?.bench)?value.bench:[{number:12,name:side==='home'?'沈泽宇':'王天霖',position:'门将'},{number:15,name:side==='home'?'罗嘉佑':'孙子墨',position:'中后卫',yellowCards:1},{number:16,name:side==='home'?'郑予安':'顾锦程',position:'中前卫'},{number:18,name:side==='home'?'程星野':'李沐阳',position:'前锋'},{number:20,name:side==='home'?'陆景澄':'蒋奕帆',position:'边锋'}];
  const clean=(p,i,bench=false)=>({id:text(p.id,`${side}-${bench?'b':'p'}-${i}`,80),number:Math.round(num(p.number,i+1,0,999)),name:text(p.name,`球员${i+1}`,40),position:text(p.position,bench?'中前卫':p.goalkeeper?'门将':p.y>57?'后卫':p.y>27?'中场':'前锋',30),group:Object.hasOwn(GROUPS,p.group)?p.group:p.goalkeeper?'goalkeeper':p.y>57?'defenders':p.y>27?'midfielders':'forwards',x:num(p.x,50,8,92),y:num(p.y,50,10,89),goalkeeper:Object.hasOwn(GROUPS,p.group)?p.group==='goalkeeper':bool(p.goalkeeper,false),captain:bool(p.captain,false),yellowCards:Math.round(num(p.yellowCards,0,0,99)),shirtColor:color(p.shirtColor,''),photo:imagePath(p.photo),photoOriginal:imagePath(p.photoOriginal),video:videoPath(p.video)});
  return {custom:typeof value?.custom==='boolean'?value.custom:!formationsFor(normalizeRules(raw.rules).playersPerSide).includes(text(value?.name,fallback.name,30).replace(/\s/g,'')),name:text(value?.name,fallback.name,30),coach:text(value?.coach,fallback.coach,40),assistantCoach:text(value?.assistantCoach,'',40),manager:text(value?.manager,'',40),medic:text(value?.medic,'',40),players:players.map((p,i)=>clean(p,i)),bench:subs.map((p,i)=>clean(p,i,true))};
 };
 const c=raw.config||{};
 const flags=keys=>Object.fromEntries(Object.keys(keys).map(k=>[k,bool(c.modules?.[k])]));
 const awayFallback={...base.formation,coach:'李承安',players:base.formation.players.map((p,i)=>({...p,name:['方嘉木','苏庭安','周书扬','梁亦舟','秦望舒','韩屿','周奕辰','宋星河','谢景明','沈言川','方以澄'][i]}))};
 const goals=(Array.isArray(raw.goals)?raw.goals:[{team:'home',name:'陈子昂',number:9,time:'23′',period:'first',kind:'normal'},{team:'away',name:'周奕辰',number:8,time:'39′',period:'first',kind:'normal'},{team:'home',name:'陈子昂',number:9,time:'67′',period:'second',kind:'normal'}]).slice(0,100).map((g,i)=>({id:text(g.id,`goal-${i}`,60),team:g.team==='away'?'away':'home',...(g.teamRole==='player'?{teamRole:'player'}:{}),name:text(g.name,'未知球员',40),number:Math.round(num(g.number,0,0,999)),time:text(g.time,'',24),period:['first','second','extra'].includes(g.period)?g.period:'second',kind:['penalty','own'].includes(g.kind)?g.kind:'normal',cancelled:bool(g.cancelled,false)}));
 const kicks=side=>(Array.isArray(raw.shootout?.[side])?raw.shootout[side]:base.shootout[side]).slice(0,100).map(v=>v===1?1:v===0?0:null);
 return {
  rules:normalizeRules(raw.rules===undefined?{substitutionLimits:{enabled:true,players:5,windows:3,concussion:false}}:raw.rules),
  competition:{...Object.fromEntries(['name','subtitle','round','venue','kickoff'].map(k=>[k,text(raw.competition?.[k],base.competition[k],100)])),logo:imagePath(raw.competition?.logo??base.competition.logo)},
  home:team('home'),away:team('away'),score:{home:Math.round(num(raw.score?.home,base.score.home,0,999)),away:Math.round(num(raw.score?.away,base.score.away,0,999))},
  clock:{...base.clock,display:text(raw.clock?.display,base.clock.display,24),phase:text(raw.clock?.phase,base.clock.phase,30)},
  halftimeScore:{home:Math.round(num(raw.halftimeScore?.home,1,0,999)),away:Math.round(num(raw.halftimeScore?.away,1,0,999))},
  formation:lineup(raw.formation,base.formation,'home'),awayFormation:lineup(raw.awayFormation,awayFallback,'away'),
  goal:{team:raw.goal?.team==='away'?'away':'home',name:text(raw.goal?.name,base.goal.name,40),english:text(raw.goal?.english,base.goal.english,80),number:num(raw.goal?.number,9,0,999),time:text(raw.goal?.time,base.goal.time,24),kind:['own','乌龙','乌龙球'].includes(raw.goal?.kind)?'own':['penalty','点球'].includes(raw.goal?.kind)?'penalty':'normal',teamRole:'player'},
  substitution:{team:raw.substitution?.team==='home'?'home':'away',time:text(raw.substitution?.time,base.substitution.time,24),off:{name:text(raw.substitution?.off?.name,base.substitution.off.name,40),number:num(raw.substitution?.off?.number,8,0,999)},on:{name:text(raw.substitution?.on?.name,base.substitution.on.name,40),number:num(raw.substitution?.on?.number,18,0,999)}},
  presentation:{notice:text(raw.presentation?.notice,'比赛即将开始',140),personName:text(raw.presentation?.personName,'王明远',50),personRole:text(raw.presentation?.personRole,'主教练',50),...Object.fromEntries(Object.keys(REFEREE_ROLES).flatMap(k=>[[k,text(raw.presentation?.[k],'',100)],[k+'College',text(raw.presentation?.[k+'College'],'',60)]])),commentator:text(raw.presentation?.commentator,'',100),commentatorCollege:text(raw.presentation?.commentatorCollege,'',60),sponsorName:text(raw.presentation?.sponsorName,'',100),sponsorLogo:imagePath(raw.presentation?.sponsorLogo),statKey:text(raw.presentation?.statKey,'shots',30)},
  goals,shootout:{home:kicks('home'),away:kicks('away'),first:raw.shootout?.first==='away'?'away':'home',confirmed:bool(raw.shootout?.confirmed,false)},
  config:{scoreboardLayout:c.scoreboardLayout==='clock-center'?'clock-center':'logo-center',photoCutout:bool(c.photoCutout,false),lineupBoth:bool(c.lineupBoth,false),positionRibbon:bool(c.positionRibbon),texture:bool(c.texture),material:c.material==='acrylic'?'acrylic':'solid',materialPalette:c.materialPalette==='fixed'?'fixed':'kits',materialTransparency:num(c.materialTransparency,25,0,30),cornerRadius:c.cornerRadius===18?18:0,showScoreEvents:bool(c.showScoreEvents),showRedMarkers:bool(c.showRedMarkers),redMarkers:Object.fromEntries(['home','away'].map(side=>[side,c.redMarkers?.[side]===null||c.redMarkers?.[side]===undefined?null:Math.round(num(c.redMarkers[side],0,0,4))])),font:assetPath(c.font),delayMs:num(c.delayMs,0,0,120000),replay:bool(c.replay,false),sound:bool(c.sound,false),volume:num(c.volume,.2,0,1),varEnabled:bool(c.varEnabled,false),hotkeys:Object.fromEntries(['clear','restore','goal','pause'].map(k=>[k,text(c.hotkeys?.[k],{clear:'Escape',restore:'F2',goal:'F3',pause:'F4'}[k],20)])),theme:c.theme==='nocturne'?'nocturne':'pulse',team:c.team==='away'?'away':'home',modules:flags(MODULES),contexts:Object.fromEntries(Object.keys(CONTEXTS).map(k=>[k,bool(c.contexts?.[k])])),revealGroups:Object.fromEntries(Object.keys(GROUPS).map(k=>[k,bool(c.revealGroups?.[k])])),
   reveal:bool(c.reveal),flip:bool(c.flip),benchAfter:bool(c.benchAfter),showYellow:bool(c.showYellow),showCaptain:bool(c.showCaptain),usePhotos:bool(c.usePhotos),useVideos:bool(c.useVideos),bottomHoldMs:num(c.bottomHoldMs,5500,5000,6000),formationHoldMs:num(c.formationHoldMs,2200,1000,10000),mediaHoldMs:num(c.mediaHoldMs,2800,1000,15000),eventHoldMs:num(c.eventHoldMs,6000,1000,30000),restoreScoreboard:bool(c.restoreScoreboard),x:num(c.x,96,54,1200),y:num(c.y,64,54,850),scale:num(c.scale,1,.65,1.4)}
 };
}
export function lineupFor(d){return d.config.team==='away'?d.awayFormation:d.formation;}
function singleFormationTimeline(d){
 const c=d.config,steps=[];let cursor=0;const revealed=[];
 const add=(kind,duration,group=null,extra={})=>{steps.push({kind,start:cursor,end:cursor+duration,group,revealed:[...revealed],...extra});cursor+=duration;};
 add('formation',c.formationHoldMs);
 if(c.reveal)for(const group of Object.keys(GROUPS))if(c.revealGroups[group]){
  const players=lineupFor(d).players.filter(p=>p.group===group),pages=Math.ceil(players.length/5);
  for(let page=0;page<pages;page++){
   const playerIds=players.slice(page*5,page*5+5).map(p=>p.id),introStart=cursor,shirtMs=Math.max(1400,330+650+(playerIds.length-1)*140),mediaStart=cursor+shirtMs+(c.flip?720:0),groupEnd=mediaStart+c.mediaHoldMs+700;
   const extra={playerIds,page,pages,introStart,mediaStart,groupEnd};
   add('shirts',shirtMs,group,extra);if(c.flip)add('flip',720,group,extra);add('media',c.mediaHoldMs,group,extra);add('lineClose',700,group,extra);
  }
  if(players.length){revealed.push(group);add('formation',1600);}
 }
 add('formation',c.formationHoldMs);
 if(c.benchAfter&&c.modules.bench){if(c.flip)add('benchFlip',720);add('bench',Infinity);}else add('formation',Infinity);
 return steps;
}
export function formationTimeline(d){
 if(!d.config.lineupBoth)return singleFormationTimeline(d);
 const first=d.config.team,second=first==='home'?'away':'home',steps=[];let cursor=0;
 for(const team of [first,second]){
  const timeline=singleFormationTimeline({...d,config:{...d.config,team,lineupBoth:false}});
  for(const step of timeline){const duration=Number.isFinite(step.end)?step.end-step.start:team===first?5000:Infinity;steps.push({...step,team,...Object.fromEntries(['introStart','mediaStart','groupEnd'].filter(k=>Number.isFinite(step[k])).map(k=>[k,step[k]+cursor-step.start])),start:cursor,end:cursor+duration});cursor+=duration;}
  if(team===first){steps.push({kind:'teamFlip',team:second,fromTeam:first,revealed:[],start:cursor,end:cursor+900});cursor+=900;}
 }
 return steps;
}
export function formationDuration(d){return Math.max(45000,formationTimeline(d).at(-1).start+6000);}
export function formationAt(d,elapsed){return formationTimeline(d).find(s=>elapsed>=s.start&&elapsed<s.end)||formationTimeline(d).at(-1);}
export function outputScene(live,now){
 let scene=live.scene;const elapsed=Math.max(0,now-live.startedAt),c=live.data.config;
 const timed=['goal','substitution','card','cancelGoal','penalty','notice','var','person','statStrip','officials','commentators','entrance','kickoff','sponsor'];
 const expires=Number.isFinite(live.expiresAt)?live.expiresAt:scene==='bottomScore'?live.startedAt+c.bottomHoldMs:timed.includes(scene)?live.startedAt+c.eventHoldMs:Infinity;
 if(now>=expires||scene==='bottomScore'&&!c.contexts[live.context])scene=c.restoreScoreboard?'scoreboard':'clear';
 if(scene!=='clear'&&!c.modules[scene])scene='clear';return {scene,elapsed};
}
export function goalRows(d,context){const valid=d.goals.filter(g=>!g.cancelled);return context==='restart'?valid.slice(-1):['halftime','secondhalf'].includes(context)?valid.filter(g=>g.period==='first'):context==='fulltime'?valid:[];}
export const shootoutStatus=penaltyStatus;

// 半场与下半场开场使用相同的有效上半场账本，纠错也同步。
export function bottomScores(d,context){return ['halftime','secondhalf'].includes(context)?d.halftimeScore:d.score;}
