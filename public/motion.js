// Presentation only. Never delays a match update or writes the event ledger.
export const EXIT_MS=360;
const selector='.slim-score,.bottom-score,.compact-pk,.entrance-bar,.mini-event,.info-strip,.referee-panel,.team-event-extension,.added-time-block,.score-context,.dismissal-flags';
const top='.team-event-extension';
function identity(node,run){
 if(node.matches('.slim-score'))return 'scoreboard';
 if(node.matches('.team-event-extension'))return `event:${run}:${node.dataset.eventTeam}`;
 if(node.matches('.added-time-block,.score-context,.dismissal-flags'))return `chip:${node.className}:${node.textContent}:${node.childElementCount}`;
 return `panel:${run}:${[...node.classList].find(c=>c!=='cue-graphic')}`;
}
function items(root,run){return new Map([...root.querySelectorAll(selector)].map(node=>[identity(node,run),node]));}
function exitFrames(node){
 const down=node.matches(top),edge=down?'top':'bottom';
 const thin=edge==='top'?'inset(0 0 calc(100% - 3px) 0)':'inset(calc(100% - 3px) 0 0 0)';
 const closed=edge==='top'?'inset(0 50% calc(100% - 3px) 50%)':'inset(calc(100% - 3px) 50% 0 50%)';
 return [{clipPath:getComputedStyle(node).clipPath==='none'?'inset(-64px -8px -24px -8px)':getComputedStyle(node).clipPath,opacity:1},{clipPath:thin,opacity:1,offset:.6},{clipPath:closed,opacity:0}];
}
export function createMotion(layer){
 const departures=document.createElement('div');departures.id='motion-departures';departures.setAttribute('aria-hidden','true');layer.after(departures);
 let active=new Map();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 function leave(node){
  if(!node.isConnected||reduced())return;
  const rect=node.getBoundingClientRect(),stage=layer.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const clone=node.cloneNode(true),style=getComputedStyle(node),frames=exitFrames(node),box=document.createElement('div');
  // Freeze the computed root style so detached grid/flex items retain their exact size.
  for(const key of style)clone.style.setProperty(key,style.getPropertyValue(key));
  clone.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));clone.removeAttribute('id');
  const scale=rect.width/(node.offsetWidth||rect.width);
  Object.assign(box.style,{position:'absolute',left:`${rect.left-stage.left}px`,top:`${rect.top-stage.top}px`,width:`${node.offsetWidth}px`,height:`${node.offsetHeight}px`,transform:`scale(${scale})`,transformOrigin:'top left',pointerEvents:'none'});
  Object.assign(clone.style,{position:'relative',inset:'auto',left:'0',top:'0',width:`${node.offsetWidth}px`,height:`${node.offsetHeight}px`,margin:'0',transform:'none',animation:'none'});
  clone.querySelectorAll('video,audio').forEach(e=>{e.autoplay=false;e.muted=true;});
  box.dataset.motionExit='1';box.append(clone);departures.append(box);
  const animation=clone.animate(frames,{duration:EXIT_MS,easing:'cubic-bezier(.4,0,.7,1)',fill:'both'});
  animation.finished.catch(()=>{}).finally(()=>box.remove());
 }
 function paint(html,{run,elapsed=0,remaining=null,immediate=false}={}){
  const now=performance.now(),template=document.createElement('template');template.innerHTML=html;
  const next=items(template.content,run),removed=[...active].filter(([key])=>!next.has(key));
  if(immediate){departures.replaceChildren();active.clear();}
  else for(const [,record] of removed){
   if(record.deadline!==null&&now>=record.deadline)continue;
   if(removed.some(([,parent])=>parent!==record&&parent.node.contains(record.node)))continue;
   leave(record.node);
  }
  layer.innerHTML=html;
  const current=items(layer,run),updated=new Map();
  for(const [key,node] of current){
   const previous=active.get(key),sameRun=previous?.run===run;
   const entered=previous?.entered??(active.size&&[...active.values()].some(v=>v.run===run)?now:now-elapsed);
   // Persistent base survives event changes; its extensions animate independently.
   if(node.matches('.slim-score')&&previous)node.style.animation='none';
   else node.style.animationDelay=`-${Math.max(0,now-entered)}ms`;
   if(remaining!==null&&remaining>0&&remaining<=EXIT_MS&&!node.matches('.slim-score,.added-time-block,.score-context,.dismissal-flags')&&!reduced()){
    const a=node.animate(exitFrames(node),{duration:EXIT_MS,easing:'cubic-bezier(.4,0,.7,1)',fill:'both'});a.currentTime=EXIT_MS-remaining;
   }
   updated.set(key,{node,entered:previous&&sameRun?previous.entered:entered,run,deadline:remaining===null?null:now+remaining});
  }
  active=updated;
 }
 function withdraw(){for(const {node} of active.values())if(!node.parentElement.closest(selector))leave(node);layer.replaceChildren();active.clear();}
 return {paint,withdraw};
}
