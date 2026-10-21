// Keep the original named fields for compatibility with saved projects and OBS.
import {REFEREE_ROLES} from './model.js';
export function mountRefereeEditor({host,getDraft,edited}){
 const rows=new Map(Object.keys(REFEREE_ROLES).map(key=>[key,host.querySelector(`[data-path="presentation.${key}"]`).closest('.crew-fields')]));
 const groups=[['主裁判',['referee']],['第一助理裁判',['assistantReferee1']],['第二助理裁判',['assistantReferee2']],['第四官员',['fourthOfficial']],['附加助理裁判',['additionalReferee1','additionalReferee2']],['候补助理裁判',['reserveReferee']]];
 const active=new Set();let matchKey=null;
 const editor=document.createElement('fieldset');editor.className='referee-editor';editor.innerHTML='<legend>裁判团队</legend><p class="hint">选择岗位，点击「＋ 添加裁判」再填写姓名和学院；不需要的岗位无需添加，姓名留空不播出。</p><div class="referee-editor-list"></div><p class="referee-empty hint">尚未添加裁判。</p><div class="referee-add-controls"><label>添加岗位<select id="referee-role-to-add"></select></label><button type="button" id="referee-add">＋ 添加裁判</button></div><p class="hint">附加助理裁判可添加2人，候补助理裁判可添加1人。修改仅保存为草稿，核对后再发布资料。</p>';
 rows.values().next().value.before(editor);const list=editor.querySelector('.referee-editor-list'),select=editor.querySelector('select'),add=editor.querySelector('#referee-add');
 groups.forEach(([label,keys])=>{const option=document.createElement('option');option.value=keys[0];option.textContent=label;select.append(option);});
 for(const [key,row] of rows){
  row.dataset.refereeField=key;row.querySelector('b').textContent=REFEREE_ROLES[key];list.append(row);
  const remove=document.createElement('button');remove.type='button';remove.className='referee-remove';remove.textContent='移除';remove.setAttribute('aria-label','移除'+REFEREE_ROLES[key]);row.append(remove);
  remove.onclick=()=>{active.delete(key);const d=getDraft();for(const suffix of ['', 'College']){d.presentation[key+suffix]='';row.querySelector(`[data-path="presentation.${key+suffix}"]`).value='';}edited();refresh();};
 }
 const populated=key=>[key,key+'College'].some(k=>getDraft().presentation[k]?.trim());
 function refresh(){
  for(const [key,row] of rows){if(populated(key))active.add(key);row.hidden=!active.has(key);}
  for(const option of select.options){const keys=groups.find(([,keys])=>keys[0]===option.value)[1];option.disabled=keys.every(k=>active.has(k));}
  if(!select.selectedOptions.length||select.selectedOptions[0].disabled)select.value=[...select.options].find(o=>!o.disabled)?.value||'';
  add.disabled=!select.value;select.disabled=add.disabled;editor.querySelector('.referee-empty').hidden=!!active.size;
 }
 add.onclick=()=>{const keys=groups.find(([,keys])=>keys[0]===select.value)?.[1],key=keys?.find(k=>!active.has(k));if(!key)return;active.add(key);refresh();const input=rows.get(key).querySelector('input');input.scrollIntoView({block:'nearest',behavior:'smooth'});input.focus({preventScroll:true});};
 document.addEventListener('draft:changed',refresh);
 document.addEventListener('controller:state',e=>{const key=e.detail.match.createdAt;if(matchKey!==null&&matchKey!==key)active.clear();matchKey=key;refresh();});
 refresh();
}
