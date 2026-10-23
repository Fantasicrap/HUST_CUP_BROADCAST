import {assertRules,MAX_BENCH,formationsFor,lineupErrors,arrangeFormation,arrangeCustom,customShape} from './roster-rules.js';
export function refreshRosterRules(d){
 const count=d.rules?.playersPerSide||11,side=d.config.team==='away'?'awayFormation':'formation',l=d[side];
 document.querySelectorAll('[data-match-format]').forEach(el=>el.checked=Number(el.value)===count);
 const limits=d.rules.substitutionLimits||{enabled:false,players:5,windows:3,concussion:false};for(const [id,key] of [['sub-limits-enabled','enabled'],['sub-concussion-enabled','concussion']]){const el=document.querySelector('#'+id);if(el)el.checked=limits[key];}for(const [id,key] of [['sub-player-limit','players'],['sub-window-limit','windows']]){const el=document.querySelector('#'+id);if(el){el.value=limits[key];el.disabled=!limits.enabled;}}
 const rolling=document.querySelector('#rolling-substitutions');if(rolling)rolling.checked=d.rules?.substitutions==='rolling';
 const select=document.querySelector('#formation-template');if(select){const old=select.value;select.replaceChildren(...[...formationsFor(count),'custom'].map(s=>{const option=document.createElement('option');option.value=s;option.textContent=s==='custom'?'自定义 · 按逐人分线':s;return option;}));select.value=l.custom?'custom':formationsFor(count).includes(l.name)?l.name:formationsFor(count).includes(old)?old:formationsFor(count)[0];}
 const errors=['formation','awayFormation'].map(k=>lineupErrors(d[k],count));try{assertRules(d.rules);}catch(e){errors[0].push(e.message);}
 const status=document.querySelector('#format-validation');if(status){status.textContent=`${count}人制 · 主队首发 ${d.formation.players.length}/${count}，替补 ${d.formation.bench.length}/${MAX_BENCH}；客队首发 ${d.awayFormation.players.length}/${count}，替补 ${d.awayFormation.bench.length}/${MAX_BENCH}。`+errors.map((e,i)=>e.length?` ${i?'客队':'主队'}：${e.join('；')}。`:'').join('');status.classList.toggle('has-roster-errors',errors.some(e=>e.length));}
 const add=document.querySelector('#add-starter');if(add)add.disabled=l.players.length>=count;
 const caption=document.querySelector('#starters-caption');if(caption)caption.textContent=`首发球员 · ${l.players.length}/${count} 人（含1名门将）`;
 const sync=document.querySelector('#sync-lineups');if(sync)sync.disabled=errors.some(e=>e.length);
}
const keeper=p=>p.group==='goalkeeper'||p.goalkeeper||p.position==='门将';
const blank=(l,g='midfielders')=>{const used=new Set([...l.players,...l.bench].map(p=>Number(p.number)));let number=1;while(used.has(number))number++;return {id:crypto.randomUUID(),number,name:'',group:g,goalkeeper:g==='goalkeeper',position:g==='goalkeeper'?'门将':'中场',x:50,y:50,captain:false,yellowCards:0,shirtColor:'',photo:'',video:''};};
export function mountRosterEditor(h){
 const $=s=>document.querySelector(s),lineup=()=>h.getDraft()[h.getDraft().config.team==='away'?'awayFormation':'formation'];
 const changed=()=>{h.edited();h.renderRoster();};
 document.querySelectorAll('[data-match-format]').forEach(el=>el.onchange=()=>{if(el.checked){h.getDraft().rules.playersPerSide=Number(el.value);changed();}});
 for(const [id,key] of [['sub-limits-enabled','enabled'],['sub-concussion-enabled','concussion'],['sub-player-limit','players'],['sub-window-limit','windows']])$('#'+id).onchange=()=>{const input=$('#'+id);h.getDraft().rules.substitutionLimits[key]=input.type==='checkbox'?input.checked:Number(input.value);changed();};
 $('#rolling-substitutions').onchange=()=>{h.getDraft().rules.substitutions=$('#rolling-substitutions').checked?'rolling':'once';changed();};
 $('#add-starter').onclick=()=>{const l=lineup();if(l.players.length>=h.getDraft().rules.playersPerSide)return;l.players.push(blank(l,l.players.some(keeper)?'midfielders':'goalkeeper'));l.custom=true;l.name=customShape(l);changed();};
 $('#add-bench').onclick=()=>{const l=lineup();if(l.bench.length>=MAX_BENCH)return;l.bench.push(blank(l));changed();};
 $('#apply-custom').onclick=async()=>{try{const d=h.getDraft(),key=d.config.team==='away'?'awayFormation':'formation';d[key]=arrangeCustom(d[key],d.rules.playersPerSide);changed();await h.show('formation');}catch(e){h.toast(e.message);}};
 $('#resize-rosters').onclick=()=>{try{
  const d=h.getDraft(),count=d.rules.playersPerSide,plans=['formation','awayFormation'].map(key=>{
   const l=structuredClone(d[key]),all=[...l.players,...l.bench],gk=all.find(keeper),selected=gk?[gk]:[];for(const p of all)if(selected.length<count&&!selected.includes(p)&&!keeper(p))selected.push(p);
   while(selected.length<count){const p=blank({...l,players:[...all,...selected]},selected.some(keeper)?'midfielders':'goalkeeper');selected.push(p);}
   l.players=selected;l.bench=all.filter(p=>!selected.includes(p));if(l.bench.length>MAX_BENCH)throw Error(`${key==='formation'?'主队':'客队'}调整后替补${l.bench.length}人，超过16；请先手动移除不报名球员`);
   return {key,lineup:arrangeFormation(l,formationsFor(count)[0],count)};
  });
  const summary=plans.map(({key,lineup:l})=>`${key==='formation'?'主队':'客队'}首发：${l.players.map(p=>`${p.number} ${p.name||'待填写'}`).join('、')}\n替补：${l.bench.length}人`).join('\n\n');
  if(!confirm(`按${count}人制整理两队（不删除球员）并应用默认阵型，可随后手动调整。\n\n${summary}\n\n确认？`))return;
  plans.forEach(({key,lineup:l})=>d[key]=l);changed();h.toast('两队名单已整理为草稿，请填写空白姓名、核对号码和分线，再同步到比赛');
 }catch(e){h.toast(e.message);}};
 document.addEventListener('input',e=>{const row=e.target.closest('[data-roster]');if(!row)return;if(e.target.dataset.field==='group'){lineup().custom=true;lineup().name=customShape(lineup());$('#formation-name').value=lineup().name;h.edited();}refreshRosterRules(h.getDraft());});
 document.addEventListener('click',e=>{const b=e.target.closest('button'),row=b?.closest('[data-roster]');if(!row)return;try{
  const l=lineup(),i=Number(row.dataset.index),p=l[row.dataset.roster][i];
  if(b.hasAttribute('data-to-bench')){if(l.bench.length>=MAX_BENCH)throw Error('替补已满16人，请先移除不报名球员');l.players.splice(i,1);l.bench.push(p);}
  else if(b.hasAttribute('data-to-starters')){if(l.players.length>=h.getDraft().rules.playersPerSide)throw Error('首发已满，请先将一名首发转到替补');l.bench.splice(i,1);if(keeper(p)){p.group='goalkeeper';p.goalkeeper=true;}l.players.push(p);}
  else if(b.hasAttribute('data-delete-starter')){if(!confirm(`从比赛名单移除 ${p.number} ${p.name||'未填写'}？照片等资料将随该行移除，需保留请先导出项目。`))return;l.players.splice(i,1);}
  else return;
  l.custom=true;l.name=customShape(l);changed();
 }catch(error){h.toast(error.message);}});
 h.renderRoster();
}
