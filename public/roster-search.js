// Enhance the existing select so event and substitution commands keep one source of truth.
export function mountRosterSearch(select){
 const box=document.createElement('div');box.className='roster-search';
 const input=document.createElement('input');input.id=select.id+'-search';input.type='text';input.autocomplete='off';input.placeholder='输入号码 / 球员姓名';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
 const list=document.createElement('div');list.id=select.id+'-results';list.className='roster-search-results';list.setAttribute('role','listbox');list.hidden=true;input.setAttribute('aria-controls',list.id);
 select.before(box);box.append(input,list,select);select.hidden=true;const label=box.closest('label');if(label)label.htmlFor=input.id;
 let choices=[],active=-1,pending=false;
 const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
 const normalize=text=>text.toLowerCase().replace(/[#＃号\s]/g,'');
 function choose(option){select.value=option.value;input.value=option.textContent;pending=false;close();select.dispatchEvent(new Event('change',{bubbles:true}));}
 function draw(query=''){
  const key=normalize(query);choices=[...select.options].filter(o=>o.value&&!o.disabled&&normalize(o.dataset.search||o.textContent).includes(key));
  if(/^\d+$/.test(key))choices.sort((a,b)=>Number(b.textContent.trim().split(' ')[0]===key)-Number(a.textContent.trim().split(' ')[0]===key));
  list.replaceChildren();active=-1;
  choices.forEach((option,i)=>{const button=document.createElement('button');button.type='button';button.id=select.id+'-option-'+i;button.setAttribute('role','option');button.setAttribute('aria-selected',String(option.value===select.value));button.tabIndex=-1;button.textContent=option.textContent;button.addEventListener('mousedown',e=>e.preventDefault());button.onclick=()=>choose(option);list.append(button);});
  if(!choices.length){const empty=document.createElement('p');empty.textContent='没有匹配球员，请核对球队、对象或赛前名单';list.append(empty);}
  list.hidden=false;input.setAttribute('aria-expanded','true');input.removeAttribute('aria-activedescendant');
 }
 input.addEventListener('focus',()=>{input.select();draw();});
 input.addEventListener('input',()=>{pending=true;select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));draw(input.value);});
 input.addEventListener('blur',()=>queueMicrotask(()=>{if(!box.contains(document.activeElement))close();}));
 input.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(list.hidden)draw(pending?input.value:'');if(!choices.length)return;active=active<0?(e.key==='ArrowDown'?0:choices.length-1):(active+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length;[...list.children].forEach((b,i)=>b.classList.toggle('active',i===active));input.setAttribute('aria-activedescendant',list.children[active].id);list.children[active].scrollIntoView({block:'nearest'});}
  if(e.key==='Enter'&&!list.hidden){e.preventDefault();if(choices.length)choose(choices[active<0?0:active]);}
 });
 document.addEventListener('pointerdown',e=>{if(!box.contains(e.target))close();});
 return {sync(){pending=false;input.value=select.selectedOptions[0]?.textContent||'';close();},assertSelected(){if(pending||!select.value)throw Error('请先从号码 / 姓名检索结果中选择球员');}};
}
