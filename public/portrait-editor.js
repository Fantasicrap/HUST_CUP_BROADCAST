export function mountPortraitEditor({api}){
 const area=document.createElement('div');area.className='portrait-setup';
 area.innerHTML='<label><input type="checkbox" data-config="photoCutout"> 上传球员照片后，进入可选抠图确认</label><button type="button" id="portrait-check">检查本地抠图环境</button><span id="portrait-status">可选功能：未安装时仍可上传原图或透明PNG。</span><a href="/help/portrait" target="_blank" rel="noopener">安装与使用说明 ↗</a>';
 document.querySelector('#roster-settings .roster-actions').before(area);
 const dialog=document.createElement('dialog');dialog.className='portrait-dialog';dialog.id='portrait-dialog';
 dialog.innerHTML='<h2>球员照片 · 可选抠图</h2><p id="portrait-player"></p><div class="portrait-comparison"><figure><figcaption>原始照片（保留）</figcaption><div class="portrait-checker"><img id="portrait-original" alt="原始球员照片"></div></figure><figure><figcaption>透明人物预览</figcaption><div class="portrait-checker"><img id="portrait-result" alt="抠图预览" hidden></div></figure></div><p id="portrait-message" role="status"></p><div class="portrait-actions"><button id="portrait-generate">生成透明预览</button><button id="portrait-accept" class="primary" disabled>采用抠图结果（仅草稿）</button><button id="portrait-keep">使用原图</button><button id="portrait-cancel">取消，保留之前照片</button></div><p class="hint">照片只在本机处理。请检查头发、双手与球衣边缘；处理结果须确认后采用，实播须另行更新资料。</p>';
 document.body.append(dialog);let settle=null,original='',result='',generation=0;
 const $=id=>document.getElementById(id);
 const check=async()=>{try{const status=await api('/api/portraits/status');$('portrait-status').textContent=status.message;return status;}catch{$('portrait-status').textContent='无法连接抠图服务，请检查服务连接';return {ready:false};}};
 $('portrait-check').onclick=check;
 function close(value){generation++;const resolve=settle;settle=null;dialog.close();resolve?.(value);}
 $('portrait-cancel').onclick=()=>close(null);dialog.addEventListener('cancel',e=>{e.preventDefault();close(null);});
 $('portrait-keep').onclick=()=>close({photo:original,photoOriginal:original});
 $('portrait-accept').onclick=()=>{if(result)close({photo:result,photoOriginal:original});};
 $('portrait-generate').onclick=async()=>{
  const token=++generation;$('portrait-generate').disabled=true;$('portrait-accept').disabled=true;$('portrait-message').textContent='正在本地抠图，首次加载可能需要一些时间；可以取消并继续使用原图。';
  try{const value=await api('/api/portraits/cutout','POST',{path:original});if(token!==generation)return;result=value.path;$('portrait-result').src=result;$('portrait-result').hidden=false;$('portrait-accept').disabled=false;$('portrait-message').textContent=`透明PNG已生成（${value.width} × ${value.height}），尚未采用。确认边缘后点击“采用抠图结果”。`;}
  catch(e){if(token===generation)$('portrait-message').textContent=e.message+'；可点击“使用原图”。';}
  finally{if(token===generation)$('portrait-generate').disabled=false;}
 };
 async function choose(source,name){
  if(dialog.open)return null;original=source;result='';generation++;$('portrait-player').textContent=name;$('portrait-original').src=source;$('portrait-result').removeAttribute('src');$('portrait-result').hidden=true;$('portrait-accept').disabled=true;$('portrait-generate').disabled=false;$('portrait-message').textContent='原图尚未替换球员照片。可生成透明预览，或直接使用原图。';dialog.showModal();
  check();return new Promise(resolve=>{settle=resolve;});
 }
 return {choose};
}
