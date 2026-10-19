import {clockView,goalMarker} from './match.js';

export function scoreboardClock(data,now,demonstration=false){
 const view=data.matchClock?clockView(data.matchClock,now):data.clock;
 return demonstration?{display:'92:16',phase:'下半场',announced:4}:{display:view.cumulativeDisplay||view.display,phase:view.phase,announced:Math.max(0,Math.floor(view.announced??data.clock?.announcedAddedMinutes??0))};
}
export function dismissalMarkers(data,team){
 if(data.config.showRedMarkers===false)return 0;
 const override=data.config.redMarkers?.[team],count=override===null||override===undefined?data.reds?.[team]:override;
 return Math.max(0,Math.min(4,Math.floor(Number(count)||0)));
}
export function scoreboardEvent(data,scene){
 if(data.config.showScoreEvents===false||!['goal','card','cancelGoal','penalty'].includes(scene))return null;
 if(scene==='penalty'){const card=data.companionCard;return card&&card.active!==false?scoreboardEvent({...data,event:card},'card'):null;}
 const event=data.event?.type===scene?data.event:scene==='goal'?{...data.goal,type:'goal'}:scene==='cancelGoal'?{...data.goal,type:'cancelGoal',text:''}:null;
 if(!event||event.active===false||event.type==='goal'&&data.goals?.some(g=>g.id===event.id&&g.cancelled))return null;
 if(scene==='cancelGoal'){const goal=data.goals?.find(g=>g.id===event.goalId);return {...event,team:goal?.team||event.team||'home',name:goal?.name||event.name,number:goal?.number??event.number,time:goal?.time||event.goalTime||event.time,symbol:'cancel',goalMark:goalMarker(goal?.kind||event.kind),label:'进球无效',reason:event.text||''};}
 const card=event.effectiveCard||event.card;
 return {...event,team:event.team==='away'?'away':'home',goalMark:event.type==='goal'?goalMarker(event.kind):'',symbol:event.type==='goal'?'goal':card==='red'||card==='secondYellow'?'red':'yellow',label:event.type==='goal'?'进球':card==='secondYellow'?'两黄变红':card==='red'?'红牌':'黄牌'};
}

export function scoreboardVisible(data){return data.config.modules.scoreboard!==false&&(!data.matchClock||['first','second','extraFirst','extraSecond'].includes(data.matchClock.phase));}
