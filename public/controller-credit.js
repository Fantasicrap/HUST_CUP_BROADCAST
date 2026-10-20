// Copyright (c) 2026 Fantasticrap@GitHub
// SPDX-License-Identifier: MIT
// Device-local UI preference; never write the draft, match, or output state.
const key='hust-controller-author-credit';
let visible=true;
try{visible=localStorage.getItem(key)!=='false';}catch{}
function apply(value){
 visible=value;
 document.documentElement.dataset.controllerCredit=visible?'visible':'hidden';
 const mark=document.getElementById('controller-author-credit');
 if(mark)mark.hidden=!visible;
 const checkbox=document.getElementById('show-controller-credit');
 if(checkbox)checkbox.checked=visible;
}
apply(visible);
addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.key===null?true:event.newValue!=='false');});
export function mountControllerCredit(){
 const settings=document.getElementById('stage-settings');
 if(!settings||document.getElementById('author-settings'))return;
 const card=document.createElement('section');card.className='desk-card';card.id='author-settings';
 card.innerHTML='<h3>作者署名与开源许可</h3><label class="check"><input id="show-controller-credit" type="checkbox"> 显示控制后台作者署名</label><p class="hint">原作者：Fantasticrap@GitHub。默认显示，仅保存在本浏览器；关闭不改变比赛数据或转播画面。</p><p class="hint">视觉署名可移除。修改或再发布软件时，须按MIT保留原作者版权声明与许可文本，可追加自己的修改者署名。</p><a href="about.html" target="_blank" rel="noopener">查看作者与开源许可 ↗</a>';
 settings.append(card);apply(visible);
 document.getElementById('show-controller-credit').addEventListener('change',event=>{
  apply(event.target.checked);try{localStorage.setItem(key,String(visible));}catch{}
 });
}
