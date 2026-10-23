// A background layer keeps all text, logos, photos, card symbols and motion geometry intact.
const panels='.full-bg,.score-row,.score-logo,.slim-clock,.added-time-block,.team-event-extension,.score-context,.mini-event,.mini-badge,.substitution-budget,.bottom-context,.bottom-goals,.compact-pk,.compact-pk-title,.pk-row,.shootout,.info-label,.info-content,.referee-panel,.referee-title,.formation-pitch,.focus-panel,.bench-panel,.starters-list,.card-face,.transition-screen';
export function decoratePanels(root,{enabled=true}={}){
 if(!enabled)return;
 for(const node of root.querySelectorAll(panels)){
  if(node.classList.contains('woven-panel'))continue;
  const css=getComputedStyle(node);
  if(css.backgroundImage==='none'&&css.backgroundColor==='rgba(0, 0, 0, 0)')continue;
  node.style.setProperty('--woven-base',css.backgroundImage);
  node.classList.add('woven-panel');
  if(node.matches('.full-bg,.transition-screen'))node.classList.add('woven-large');
  else if(node.matches('.formation-pitch,.focus-panel,.bench-panel,.starters-list,.shootout,.card-face'))node.classList.add('woven-medium');
 }
}
