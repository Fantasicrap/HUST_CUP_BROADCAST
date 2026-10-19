const $=s=>document.querySelector(s);
const initial=new URLSearchParams(location.search);for(const id of ['scene','theme','corners','detail','palette']){const el=$('#'+id),value=initial.get(id);if([...el.options].some(o=>o.value===value))el.value=value;}if(initial.has('transparency'))$('#transparency').value=Math.max(0,Math.min(30,Number(initial.get('transparency'))||0));
function size(target){const detail=$('#detail').value==='detail',s=detail?Math.min(.72,target.clientWidth/1180):target.clientWidth/1920,frame=target.querySelector('iframe');target.classList.toggle('detail',detail);frame.style.transform=`scale(${s})`;frame.style.left=detail?`${target.clientWidth/2-($('#scene').value==='goal'?396:960)*s}px`:'0';frame.style.top=detail?`${155-950*s}px`:'0';}
function render(animated=false){$('#transparency-value').value=$('#transparency').value+'%';for(const id of ['solid','glass']){const q=new URLSearchParams({scene:$('#scene').value,palette:$('#palette').value,transparency:$('#transparency').value,theme:$('#theme').value,corners:$('#corners').value,context:'halftime',backdrop:'stadium',...(animated?{}:{hold:'1'}),...(id==='glass'?{concept:'acrylic'}:{})});$('#'+id).src='overlay.html?'+q;size($('#'+id).parentElement);}}
for(const el of document.querySelectorAll('select'))el.addEventListener('change',()=>render());
$('#transparency').addEventListener('input',()=>render());
$('#replay').onclick=()=>render(true);
const observer=new ResizeObserver(entries=>{for(const {target} of entries)size(target);});document.querySelectorAll('.window').forEach(el=>observer.observe(el));
render();
