// Shared, deterministic match ledger. Rendering never writes this ledger.
export const PHASES={pregame:'赛前',first:'上半场',halftime:'中场',second:'下半场',regulationEnd:'常规时间结束',extraFirst:'加时赛上半场',extraBreak:'加时赛中场',extraSecond:'加时赛下半场',shootout:'点球大战',finished:'全场结束',interrupted:'比赛暂时中断'};
export const STAT_LABELS={possession:'控球率',shots:'射门',onTarget:'射正',corners:'角球',fouls:'犯规',offsides:'越位',yellow:'黄牌',red:'红牌'};
export const EVENT_LABELS={goal:'进球',cancelGoal:'进球无效',card:'给牌',substitution:'换人',penalty:'点球判罚 / 罚失',var:'判罚审核',notice:'通用通知',adjustment:'手动改比分'};
const clone=v=>structuredClone(v),side=v=>v==='away'?'away':'home';
const integer=(v,min=0,max=999)=>{const n=Number(v);if(!Number.isInteger(n)||n<min||n>max)throw Error(`请输入 ${min}–${max} 的整数`);return n;};
const txt=(v,max=100)=>String(v??'').trim().slice(0,max);
const id=()=>globalThis.crypto.randomUUID();
// Old records used team as the beneficiary. New records mark team as the player's team.
export function goalTeams(goal){const team=side(goal.team),own=goal.kind==='own',actor=own&&goal.teamRole!=='player'?(team==='home'?'away':'home'):team;return {team:actor,scoreTeam:own?(actor==='home'?'away':'home'):actor};}
export function specialGoalLabel(kind){return kind==='own'||kind==='乌龙'||kind==='乌龙球'?'乌龙球':kind==='penalty'||kind==='点球'?'点球':'';}
export function goalMarker(kind){return ['own','乌龙','乌龙球'].includes(kind)?'(OG)':['penalty','点球'].includes(kind)?'(P)':'';}
export function phaseBounds(clock){const h=clock.halfMinutes*60000,e=clock.extraMinutes*60000;return {first:[0,h],second:[h,h*2],extraFirst:[h*2,h*2+e],extraSecond:[h*2+e,h*2+e*2]}[clock.phase]||[clock.elapsedMs,Infinity];}
export function clockMs(clock,now=Date.now()){return Math.max(0,clock.elapsedMs+(clock.running?Math.max(0,now-clock.anchor):0));}
export function clockView(clock,now=Date.now()){
 const ms=clockMs(clock,now),seconds=Math.floor(ms/1000),[,end]=phaseBounds(clock),added=Math.max(0,ms-end),fmt=s=>`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
 return {cumulativeDisplay:fmt(seconds),display:clock.displayMode==='separate'&&added>0?`${fmt(Math.floor(end/1000))} +${fmt(Math.floor(added/1000))}`:fmt(seconds),phase:PHASES[clock.phase],added:added>0?fmt(Math.floor(added/1000)):'',announced:clock.announced,eventTime:ms>=end?`${Math.floor(end/60000)}+${Math.floor(added/60000)+1}′`:`${Math.floor(ms/60000)+1}′`};
}
export function newMatch(d,{demo=false,now=Date.now()}={}){
 return {version:1,revision:0,createdAt:now,initial:{score:demo?clone(d.score):{home:0,away:0},goals:demo?clone(d.goals):[],lineups:{home:clone(d.formation),away:clone(d.awayFormation)}},events:[],clock:{phase:'pregame',halfMinutes:45,extraMinutes:15,elapsedMs:0,anchor:now,running:false,announced:0,displayMode:'cumulative'},halftimeScore:{home:0,away:0},halftimeStats:{},shootout:{home:[],away:[],first:'home',confirmed:false,players:{home:[],away:[]}},stats:{},tie:{enabled:false,firstLeg:{home:0,away:0},awayGoals:false,firstLegAway:'home'},result:{confirmed:false,winner:'',label:'胜者',mvp:''},recovery:null};
}
export function deriveMatch(m){
 const score=clone(m.initial.score),goals=clone(m.initial.goals).map(g=>({...g,...goalTeams(g),teamRole:'player'})),lineups=clone(m.initial.lineups),reds={home:0,away:0},yellow={},dismissed=new Set(),cards=[];
 for(const e of m.events.filter(e=>e.active!==false)){
  if(e.type==='goal'){const teams=goalTeams(e);score[teams.scoreTeam]++;goals.push({id:e.id,...teams,teamRole:'player',name:e.name,number:e.number,time:e.time,period:e.period,kind:e.kind,cancelled:false});}
  if(e.type==='cancelGoal'){const g=goals.find(g=>g.id===e.goalId);if(!g||g.cancelled)throw Error('关联进球不存在或已取消');g.cancelled=true;score[goalTeams(g).scoreTeam]--;}
  if(e.type==='adjustment')score[e.team]+=e.delta;
  if(e.type==='card'){
   const key=`${e.team}:${e.playerId||e.role+':'+e.name}`,p=[...lineups[e.team].players,...lineups[e.team].bench].find(p=>p.id===e.playerId);
   if(dismissed.has(key))throw Error('该对象已被罚下，请修正先前给牌记录');
   if(e.card==='yellow'||e.card==='secondYellow')yellow[key]=(yellow[key]||0)+(e.card==='secondYellow'?Math.max(1,2-(yellow[key]||0)):1);
   const red=e.card==='red'||(yellow[key]||0)>=2;
   if(red){dismissed.add(key);if(e.role==='player'&&lineups[e.team].players.some(p=>p.id===e.playerId)){reds[e.team]++;p.dismissed=true;}}
   if(p){p.matchYellow=yellow[key]||0;p.yellowCards=(p.yellowCards||0)+(e.card==='red'?0:1);}
   cards.push({...e,effectiveCard:red?(e.card==='red'?'red':'secondYellow'):'yellow'});
  }
  if(e.type==='substitution'){
   const l=lineups[e.team];
   for(const pair of e.pairs){const oi=l.players.findIndex(p=>p.id===pair.offId),ni=l.bench.findIndex(p=>p.id===pair.onId);if(oi<0||ni<0)throw Error('换人关联失效：换下者须在场、换上者须在替补席；请先修正后续相关换人');const off=l.players[oi],on=l.bench[ni];if(off.dismissed||dismissed.has(`${e.team}:${on.id}`))throw Error('被罚下球员不能参加换人');l.players[oi]={...on,x:off.x,y:off.y,group:off.group,goalkeeper:off.goalkeeper};l.bench.splice(ni,1);(l.used||(l.used=[])).push(off);}
  }
 }
 if(score.home<0||score.away<0)throw Error('修正后比分不能为负数');
 const halftimeScore={home:0,away:0};for(const g of goals)if(!g.cancelled&&g.period==='first')halftimeScore[goalTeams(g).scoreTeam]++;for(const e of m.events)if(e.active!==false&&e.type==='adjustment'&&e.period==='first')halftimeScore[e.team]+=e.delta;halftimeScore.home=Math.max(0,halftimeScore.home);halftimeScore.away=Math.max(0,halftimeScore.away);
 const aggregate={home:score.home+(m.tie.enabled?m.tie.firstLeg.home:0),away:score.away+(m.tie.enabled?m.tie.firstLeg.away:0)};
 const awayGoals={home:m.tie.firstLegAway==='home'?m.tie.firstLeg.home:0,away:(m.tie.firstLegAway==='away'?m.tie.firstLeg.away:0)+score.away};
 let suggestedWinner=aggregate.home!==aggregate.away?(aggregate.home>aggregate.away?'home':'away'):m.tie.enabled&&m.tie.awayGoals&&awayGoals.home!==awayGoals.away?(awayGoals.home>awayGoals.away?'home':'away'):null;
 if(!suggestedWinner&&m.shootout.confirmed)suggestedWinner=penaltyStatus(m.shootout).winner;
 return {score,goals,lineups,reds,cards,halftimeScore,aggregate,awayGoals,suggestedWinner};
}
export function eventScene(e){return ({goal:'goal',cancelGoal:'cancelGoal',card:'card',substitution:'substitution',penalty:'penalty',var:'var',notice:'notice',adjustment:'notice'})[e.type];}
export function changeMatch(original,command,now=Date.now()){
 const m=clone(original),a=deriveMatch(m),c=command,clock=m.clock;
 if(c.action==='clock'){
  clock.elapsedMs=clockMs(clock,now);clock.anchor=now;
  const setPhase=()=>{if(!PHASES[c.phase])throw Error('比赛阶段无效');const resuming=clock.phase==='interrupted'&&clock.previousPhase===c.phase;if(c.phase==='interrupted'){clock.previousPhase=clock.phase;clock.previousAnnounced=clock.announced;}if(resuming)clock.announced=clock.previousAnnounced||0;clock.phase=c.phase;clock.running=false;if(!resuming){clock.announced=0;if(['first','second','extraFirst','extraSecond'].includes(c.phase))clock.elapsedMs=phaseBounds(clock)[0];}if(c.phase==='halftime'){m.halftimeScore=clone(a.halftimeScore);m.halftimeStats=clone(m.stats);}};
  if(c.operation==='apply'){if(!PHASES[c.phase])throw Error('比赛阶段无效');if(c.phase!==clock.phase)setPhase();clock.running=['first','second','extraFirst','extraSecond'].includes(clock.phase);if(clock.running)m.recovery=null;}
  else if(c.operation==='start'){if(!['first','second','extraFirst','extraSecond'].includes(clock.phase))throw Error('请先选择正在比赛的阶段');clock.running=true;m.recovery=null;}
  else if(c.operation==='pause')clock.running=false;
  else if(c.operation==='reset'){if(c.confirm!=='RESET_CLOCK')throw Error('计时清零需要确认');clock.elapsedMs=0;clock.running=false;m.recovery=null;}
  else if(c.operation==='calibrate'){clock.elapsedMs=c.deltaSeconds!==undefined?Math.max(0,Math.min(99999000,clock.elapsedMs+integer(c.deltaSeconds,-99999,99999)*1000)):integer(c.seconds,0,99999)*1000;}
  else if(c.operation==='phase')setPhase();
  else if(c.operation==='settings'){if(clock.running)throw Error('请暂停后修改赛制时长');clock.halfMinutes=integer(c.halfMinutes,1,120);clock.extraMinutes=integer(c.extraMinutes,1,60);clock.displayMode=c.displayMode==='separate'?'separate':'cumulative';}
  else if(c.operation==='added')clock.announced=integer(c.minutes,0,30);
  else if(c.operation==='recover'){if(m.recovery&&c.includeDowntime)clock.elapsedMs+=Math.max(0,now-m.recovery.savedAt);clock.running=false;m.recovery=null;}
  else throw Error('计时操作无效');
 }else if(c.action==='record'){
  const x=c.event||{},team=side(x.team);if(!EVENT_LABELS[x.type])throw Error('事件类型无效');
  if(m.events.some(e=>e.id===c.id))return original;
  const e={id:txt(c.id||id(),80),type:x.type,team,at:now,time:txt(x.time||clockView(clock,now).eventTime,24),period:['first','second','extra'].includes(x.period)?x.period:clock.phase==='first'?'first':clock.phase.startsWith('extra')?'extra':'second',active:true,name:txt(x.name||'未填写球员',40),number:integer(x.number||0),kind:['penalty','own'].includes(x.kind)?x.kind:'normal'};
  if(e.type==='goal')e.teamRole='player';
  if(e.type==='penalty'&&x.relatedCardId)e.relatedCardId=txt(x.relatedCardId,80);
  if(e.type==='card'&&x.parentEventId)e.parentEventId=txt(x.parentEventId,80);
  if(e.type==='cancelGoal'){e.goalId=txt(x.goalId,80);const goal=a.goals.find(g=>g.id===e.goalId&&!g.cancelled);if(!goal)throw Error('关联进球不存在或已取消');e.team=goal.team;e.name=goal.name;e.number=goal.number;e.goalTime=goal.time;}
  if(e.type==='card'){e.playerId=txt(x.playerId,80);e.role=['player','bench','coach'].includes(x.role)?x.role:'player';e.card=['yellow','red','secondYellow'].includes(x.card)?x.card:'yellow';if(e.role!=='coach'){const roster=e.role==='player'?a.lineups[team].players:a.lineups[team].bench;const p=roster.find(p=>p.id===e.playerId);if(!p)throw Error('给牌对象不在所选名单');e.name=p.name;e.number=p.number;}}
  if(e.type==='substitution'){if(!Array.isArray(x.pairs)||!x.pairs.length||x.pairs.length>10)throw Error('请添加 1–10 组换人');e.pairs=x.pairs.map(pair=>{const off=a.lineups[team].players.find(p=>p.id===pair.offId),on=a.lineups[team].bench.find(p=>p.id===pair.onId);if(!off||!on)throw Error('请选择有效换上 / 换下球员');return {offId:off.id,onId:on.id,off:clone(off),on:clone(on)};});}
  if(['penalty','var','notice','adjustment','cancelGoal'].includes(e.type)){e.text=txt(x.text,140);e.subject=txt(x.subject||'进球',30);e.status=txt(x.status||'检查中',30);}
  if(e.type==='var'){e.varStage=x.varStage==='decision'?'decision':'checking';e.decision=txt(x.decision||'进球有效',40);}
  if(e.type==='adjustment')e.delta=integer(x.delta,-999,999);
  m.events.push(e);deriveMatch(m);
 }else if(c.action==='editEvent'){
  const e=m.events.find(e=>e.id===c.id);if(!e)throw Error('事件不存在');
  if(typeof c.active==='boolean')e.active=c.active;
  if(e.type==='goal'&&c.patch&&'kind' in c.patch){e.team=goalTeams(e).team;e.teamRole='player';}
  if(c.patch){for(const k of ['name','time','text'])if(k in c.patch)e[k]=txt(c.patch[k],k==='text'?140:40);if('number' in c.patch)e.number=integer(c.patch.number);if('kind' in c.patch)e.kind=['penalty','own'].includes(c.patch.kind)?c.patch.kind:'normal';}
  deriveMatch(m);
 }else if(c.action==='lineups'){
  if(!c.lineups?.home?.players||!c.lineups?.away?.players)throw Error('阵容无效');m.initial.lineups=clone(c.lineups);deriveMatch(m);
 }else if(c.action==='clearLog'){
  if(c.confirm!=='CLEAR_LOG')throw Error('清理日志需要确认');m.logStartIndex=m.events.length;
 }else if(c.action==='stats'){
  m.stats={};for(const key of Object.keys(STAT_LABELS)){const v=c.stats?.[key]||{};const clean=v=>v===''||v===null||v===undefined?null:integer(v,0,key==='possession'?100:999);m.stats[key]={home:clean(v.home),away:clean(v.away)};}if(m.clock.phase==='halftime')m.halftimeStats=clone(m.stats);
 }else if(c.action==='tie'){m.tie={enabled:!!c.enabled,firstLeg:{home:integer(c.home||0),away:integer(c.away||0)},awayGoals:!!c.awayGoals,firstLegAway:side(c.firstLegAway)};m.result.confirmed=false;
 }else if(c.action==='result'){m.result={confirmed:!!c.confirmed,winner:['home','away','draw'].includes(c.winner)?c.winner:'',label:txt(c.label||'胜者',20),mvp:txt(c.mvp,50)};if(m.result.confirmed&&!m.result.winner)throw Error('请明确选择并确认最终结果');
 }else if(c.action==='pk'){
  const p=m.shootout;p.confirmed=false;
  if(c.operation==='reset'){p.home=[];p.away=[];p.players={home:[],away:[]};p.first=side(c.first);}
  else if(c.operation==='first'){if(p.home.length||p.away.length)throw Error('首罚队须在第一脚前选择');p.first=side(c.first);}
  else if(c.operation==='kick'){const s=penaltyStatus(p);if(s.winner)throw Error('已满足决胜条件，请确认结束或纠错');const team=s.next,slot=p[team].indexOf(null),i=slot<0?p[team].length:slot;p[team][i]=integer(c.value,0,1);p.players[team][i]={name:txt(c.name,40),number:integer(c.number||0)};}
  else if(c.operation==='edit'){const team=side(c.team),i=integer(c.index,0,199);if(i>=p[team].length)throw Error('罚球轮次不存在');p[team][i]=c.value===null?null:integer(c.value,0,1);}
  else if(c.operation==='undo'){const first=p.first,last=p.home.length===p.away.length?(first==='home'?'away':'home'):p.home.length>p.away.length?'home':'away';p[last].pop();p.players[last].pop();}
  else if(c.operation==='confirm'){if(!penaltyStatus(p).winner)throw Error('尚未满足点球决胜条件');p.confirmed=true;}
  else throw Error('点球操作无效');
 }else throw Error('比赛操作无效');
 if(['record','editEvent','pk'].includes(c.action))m.result.confirmed=false;
 m.revision++;return m;
}
export function penaltyStatus(s){
 const totals=side=>s[side].filter(x=>x===0||x===1),h=totals('home'),a=totals('away'),hs=h.reduce((a,b)=>a+b,0),as=a.reduce((a,b)=>a+b,0);let winner=null;
 if(h.length<=5&&a.length<=5){if(hs>as+5-a.length)winner='home';if(as>hs+5-h.length)winner='away';}else if(h.length===a.length&&hs!==as)winner=hs>as?'home':'away';
 let next=h.length===a.length?s.first:h.length>a.length?'away':'home';const hp=s.home.indexOf(null),ap=s.away.indexOf(null);if(hp>=0||ap>=0){winner=null;next=hp<0?'away':ap<0?'home':hp===ap?s.first:hp<ap?'home':'away';}
 return {home:hs,away:as,winner,next,round:Math.max(h.length,a.length)+(h.length===a.length&&!winner?1:0),taken:h.length+a.length,suddenDeath:h.length>=5&&a.length>=5&&!winner};
}
export function composeData(d,m,event=null){
 const out=clone(d),a=deriveMatch(m);out.score=a.score;out.goals=a.goals;out.matchClock=clone(m.clock);out.clock=clockView(m.clock);out.reds=a.reds;out.aggregate=a.aggregate;out.tie=clone(m.tie);out.stats=clone(m.stats);out.result=clone(m.result);out.halftimeScore=clone(a.halftimeScore);out.halftimeStats=clone(m.halftimeStats||{});out.shootout=clone(m.shootout);out.currentLineups=a.lineups;
 if(event){out.event=event.type==='goal'?{...clone(event),...goalTeams(event),teamRole:'player'}:clone(event);if(event.type==='goal')out.goal=clone(out.event);if(event.type==='substitution')out.substitution={...event,...event.pairs[0]};if(event.type==='card')out.event=clone(a.cards.find(e=>e.id===event.id)||event);}
 if(event?.type==='penalty'&&event.relatedCardId)out.companionCard=clone(a.cards.find(e=>e.id===event.relatedCardId)||null);
 return out;
}

// Validate the entire group before returning it: an invalid card cannot leave a half-recorded penalty.
export function recordMatchEvent(original,command,now=Date.now()){
 if(!command.companionCard)return changeMatch(original,command,now);
 if(command.event?.type!=='penalty')throw Error('同时给牌仅用于点球事件');
 const eventId=txt(command.id||id(),60);if(original.events.some(e=>e.id===eventId))return original;
 const cardId=eventId+':card';
 const first=changeMatch(original,{...command,id:eventId,event:{...command.event,relatedCardId:cardId}},now);
 return changeMatch(first,{action:'record',id:cardId,event:{...command.companionCard,type:'card',parentEventId:eventId}},now);
}
