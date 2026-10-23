// Ledger-derived substitution accounting. No renderer or clock side effects.
import {normalizeRules} from './roster-rules.js';
export const SUBSTITUTION_KINDS={normal:'普通换人',concussion:'脑震荡换人',additional:'对方脑震荡赠送换人'};
export const SUBSTITUTION_BREAKS=['halftime','regulationEnd','extraBreak'];
export const substitutionPhase=clock=>clock.phase==='interrupted'?clock.previousPhase||'interrupted':clock.phase;
export const emptySubstitutionUsage=()=>Object.fromEntries(['home','away'].map(team=>[team,{players:0,windows:0,concussion:0,extraGranted:0,extraPlayers:0,extraWindows:0,lastWindow:null}]));
export function accountSubstitution(usage,event,rules){
 const limits=normalizeRules(rules).substitutionLimits,u=usage[event.team],opponent=usage[event.team==='home'?'away':'home'];
 const counts={normal:0,concussion:0,additional:0};for(const pair of event.pairs){const kind=pair.kind||'normal';if(!Object.hasOwn(counts,kind))throw Error('换人类型无效');counts[kind]++;}
 if(counts.concussion&&(!limits.concussion||u.concussion+counts.concussion>1))throw Error(limits.concussion?'每队本场最多1名脑震荡换人':'本赛事未启用脑震荡换人');
 if(counts.additional&&(!limits.concussion||u.extraPlayers+counts.additional>u.extraGranted))throw Error('对方脑震荡赠送的额外换人名额不足');
 if(limits.enabled&&u.players+counts.normal>limits.players)throw Error('普通换人名额不足');
 if(event.substitutionPhase&&!['pregame','first','halftime','second','regulationEnd','extraFirst','extraBreak','extraSecond','shootout','finished','interrupted'].includes(event.substitutionPhase))throw Error('换人发生阶段无效');
 const phase=event.substitutionPhase||({first:'first',extra:'extraFirst'})[event.period]||'second',atBreak=SUBSTITUTION_BREAKS.includes(phase);
 let normalWindow=0,extraWindow=0;
 if(!atBreak&&(counts.normal||counts.additional)){
  if(event.windowMode==='reuse'){
   if(!u.lastWindow||u.lastWindow.phase!==phase)throw Error('没有可沿用的本队当前阶段换人窗口');
   if(event.windowId&&event.windowId!==u.lastWindow.id)throw Error('沿用的换人窗口已被撤销或改变，请先修正关联换人');
   if(counts.normal&&u.lastWindow.type==='additional')throw Error('赠送窗口仅能用于赠送换人，不能安排普通换人');
  }else{
   normalWindow=counts.normal?1:0;extraWindow=normalWindow?0:1;
   if(limits.enabled&&u.windows+normalWindow>limits.windows)throw Error('普通换人窗口已用完');
   if(u.extraWindows+extraWindow>u.extraGranted)throw Error('对方脑震荡赠送的额外换人窗口不足');
   u.lastWindow={id:event.id,phase,type:normalWindow?'normal':'additional'};
  }
 }
 u.players+=counts.normal;u.windows+=normalWindow;u.concussion+=counts.concussion;u.extraPlayers+=counts.additional;u.extraWindows+=extraWindow;opponent.extraGranted+=counts.concussion;
 return {atBreak,normalWindow,extraWindow,...counts};
}
export function eligibleSubstitutes(match,derived,team,kind='normal'){
 const l=derived.lineups[team],rules=normalizeRules(match.rules),initial=match.initial.lineups[team];
 const mayReturn=kind==='concussion'&&rules.substitutionLimits.enabled&&initial.bench.length===rules.substitutionLimits.players;
 const all=[...l.bench,...(mayReturn?l.used||[]:[])],onField=new Set(l.players.map(p=>p.id));
 return [...new Map(all.map(p=>[p.id,p])).values()].filter(p=>!onField.has(p.id)&&!p.dismissed&&!p.concussionWithdrawn);
}
export function remainingSubstitutions(rules,usage,team){
 const limits=normalizeRules(rules).substitutionLimits,u=usage?.[team];if(!u)return null;
 return {players:limits.enabled?Math.max(0,limits.players-u.players):null,windows:limits.enabled?Math.max(0,limits.windows-u.windows):null,extraPlayers:Math.max(0,u.extraGranted-u.extraPlayers),extraWindows:Math.max(0,u.extraGranted-u.extraWindows)};
}
