// Device-local controller preference. Never touches match data or OBS output.
(()=>{
 const key='hust-controller-theme';
 const valid=value=>value==='dark'?'dark':'light';
 let mode='light';try{mode=valid(localStorage.getItem(key));}catch{}
 const apply=value=>{
  mode=valid(value);document.documentElement.dataset.controlTheme=mode;
  const button=document.getElementById('control-theme-toggle');
  if(button){button.textContent=mode==='light'?'☀ 白天模式':'☾ 黑夜模式';button.setAttribute('aria-checked',String(mode==='light'));button.title=mode==='light'?'切换到黑夜模式 · 仅操作后台':'切换到白天模式 · 仅操作后台';}
 };
 apply(mode);
 document.addEventListener('DOMContentLoaded',()=>{
  apply(mode);document.getElementById('control-theme-toggle')?.addEventListener('click',()=>{apply(mode==='light'?'dark':'light');try{localStorage.setItem(key,mode);}catch{}});
 });
 addEventListener('storage',event=>{if(event.key===key)apply(event.newValue);});
})();
