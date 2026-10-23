// Controller guidance only. Navigation and checks never mutate the match.
import {assertRules,lineupErrors} from './roster-rules.js';
import {PHASES} from './match.js';
import {mountRefereeEditor} from './referee-editor.js';
const $=s=>document.querySelector(s);
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function publication(d){return {home:d.home,away:d.away,competition:d.competition,formation:d.formation,awayFormation:d.awayFormation,presentation:d.presentation,config:Object.fromEntries(Object.entries(d.config||{}).filter(([k])=>!['team','lineupBoth'].includes(k))) };}
export function preparationStatus(d,s){
 const errors=['formation','awayFormation'].flatMap((k,i)=>lineupErrors(d[k],d.rules.playersPerSide).map(e=>`${i?'客队':'主队'}：${e}`));
 try{assertRules(d.rules);}catch(e){errors.push(e.message);}
 const teams=!!(d.home.name.trim()&&d.away.name.trim()&&d.competition.name.trim());
 const synced=!!s&&stable({rules:d.rules,home:d.formation,away:d.awayFormation})===stable({rules:s.match.rules,home:s.match.initial.lineups.home,away:s.match.initial.lineups.away});
 const published=!!s&&stable(publication(d))===stable(publication(s.live.data));
 return {teams,errors,synced,published,ready:teams&&!errors.length&&synced&&published};
}
export function mountWorkflowGuide(h){
 const root=$('#match-desk'),steps=[['资料','人数、赛事与球队'],['阵容','两队名单与同步'],['画面','人员、素材与主题'],['开播','核对、发布与开场']];let state=null,stage='live',step=0,busy=false,lastSignature='';
 const guide=document.createElement('section');guide.className='operator-guide';guide.id='operator-guide';guide.setAttribute('aria-label','当前操作指引');guide.innerHTML='<div><span class="guide-kicker">下一步</span><strong id="guide-title">读取比赛状态…</strong><p id="guide-description">页面切换只用于查看；比赛阶段由明确的计时操作控制。</p></div><button id="guide-action" type="button">查看操作</button>';
 $('.workflow-heading').after(guide);
 const monitorDrawer=document.createElement('details');monitorDrawer.className='workflow-drawer monitor-drawer';monitorDrawer.id='monitor-drawer';monitorDrawer.hidden=true;monitorDrawer.innerHTML='<summary id="monitor-summary">查看实际播出与计时控制</summary>';$('.workflow-top').before(monitorDrawer);
 $('#monitor-expand').addEventListener('click',()=>{if(!monitorDrawer.hidden)monitorDrawer.open=true;});
 const wizard=document.createElement('section');wizard.id='preparation-wizard';wizard.className='preparation-wizard';wizard.innerHTML='<div class="preparation-heading"><strong>赛前准备</strong><span>按顺序完成，可随时返回修改；切换步骤不影响直播。</span></div><div class="preparation-steps" role="tablist" aria-label="赛前准备步骤"></div><div id="preparation-body"></div><div class="preparation-footer"><button id="preparation-back">上一步</button><span id="preparation-position"></span><button id="preparation-next" class="primary">下一步</button></div>';
 const pre=$('#stage-pregame');pre.prepend(wizard);const panels=[];
 steps.forEach(([name,desc],i)=>{const b=document.createElement('button');b.type='button';b.id='prep-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls','prep-panel-'+i);b.innerHTML=`<span class="step-number">0${i+1}</span><div><strong>${name}</strong><small>${desc}</small></div><em></em>`;b.onclick=()=>choose(i);wizard.querySelector('.preparation-steps').append(b);const p=document.createElement('div');p.id='prep-panel-'+i;p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby',b.id);p.className='preparation-panel';$('#preparation-body').append(p);panels.push(p);});
 const relocate=(el,i)=>{if(el)panels[i].append(el);};
 const archive=$('#new-match');const fresh=document.createElement('details');fresh.className='workflow-drawer new-match-drawer';fresh.innerHTML='<summary>新比赛或继续原比赛</summary><p class="hint">继续已有比赛时无需新建。新建会清空本场记录，请先导出备份。</p>';fresh.append(archive);relocate(fresh,0);
 relocate($('#format-settings'),0);relocate($('#team-settings'),0);relocate($('#tie-save').closest('.desk-card'),0);
 relocate($('#roster-settings'),1);$('#roster-settings').open=true;relocate($('#sync-lineups').closest('.desk-card'),1);
 const people=$('#stage-pregame .crew-fields')?.closest('.desk-card');relocate(people,2);
 if(people){
  mountRefereeEditor({host:people,getDraft:h.getDraft,edited:h.edited});
  people.querySelector('h3').textContent='裁判、解说与赞助素材';
  const person=document.createElement('fieldset');person.className='person-introduction-settings';
  person.innerHTML='<legend>通用人物介绍（可选）</legend><p id="person-introduction-purpose" class="hint">仅用于单独播出的姓名／身份信息条，不与球员、球队官员、裁判或解说名单联动。不使用时可留空。</p><div class="form-grid"></div><p class="hint">播出方式：顶部选择「人物介绍」→「预览此画面」→核对后「正式播出此画面」。</p>';
  for(const [key,title,placeholder] of [['personName','介绍对象姓名','例如：王明远'],['personRole','显示身份／职务','例如：嘉宾、主教练、领队']]){
   const input=people.querySelector(`[data-path="presentation.${key}"]`),label=input.closest('label');label.firstChild.textContent=title;input.placeholder=placeholder;input.setAttribute('aria-describedby','person-introduction-purpose');person.querySelector('.form-grid').append(label);
  }
  people.querySelector('h3').after(person);
 }
 const visual=document.createElement('section');visual.className='desk-card';visual.innerHTML='<h3>画面与素材检查</h3><p class="hint">照片和视频在第2步按球员上传。裁判、解说和赞助可留空；不需要的模块可关闭。</p><div class="action-row"><button data-guide-settings>选择主题与启用模块</button><button data-guide-preview="formation">预览首发阵型</button><button data-guide-preview="opening">预览开场对阵</button></div><p class="hint">以上只做编辑与预览；第4步明确发布后进入直播资料。</p>';relocate(visual,2);
 const review=document.createElement('section');review.className='desk-card preparation-review';review.innerHTML='<h3>开播前核对</h3><ul id="preparation-checks"></ul><p id="preparation-detail" class="hint"></p><div class="action-row"><button data-guide-target="sync-lineups">同步两队名单到比赛</button><button data-guide-preview="scoreboard">预览比分牌</button><button data-guide-target="apply-live" class="primary">发布资料到直播（不换画面）</button></div><p class="hint">顺播会正式播放已启用的包装。开场动画结束不会自动开表，实际开球时再开始计时。</p>';relocate(review,3);relocate($('#flow-opening').closest('.desk-card'),3);
 const guideExtras=document.createElement('details');guideExtras.className='workflow-drawer';guideExtras.id='goal2-drawer';guideExtras.innerHTML='<summary>二路进球动画 · 独立输出，不记分</summary>';$('#goal2-control').before(guideExtras);guideExtras.append($('#goal2-control'));
 $('#stage-live').append(guideExtras);
 const stageNotes={halftime:['中场操作顺序','① 停表并应用中场 → ② 核对进球与保存统计 → ③ 播半场包装 → ④ 实际下半场开球时开始计时'],extra:['加时与点球操作顺序','① 在计时区应用相应阶段 → ② 加时照常记事件／点球逐脚录入 → ③ 人工确认点球结束 → ④ 播结果'],postgame:['赛后操作顺序','① 应用全场结束并停表 → ② 核对账本 → ③ 保存人工确认结果 → ④ 播全场包装 → ⑤ 导出项目'],settings:['设置与直播的关系','主题、素材和模块先保存为草稿，再明确发布。时长、延迟和快捷键按各自保存按钮生效。']};
 for(const [id,[title,text]] of Object.entries(stageNotes)){const note=document.createElement('div');note.className='stage-instructions';const b=document.createElement('strong'),p=document.createElement('p');b.textContent=title;p.textContent=text;note.append(b,p);$('#stage-'+id).prepend(note);}
 $('#apply-live').textContent='发布资料（不换画面）';$('#preview-selected').textContent='预览此画面';$('#restore').textContent='结束包装，回到比分牌';$('#restore').title='结束当前包装并清空待播；只在比赛阶段显示左上比分牌，不改比分和计时';
 for(const strong of document.querySelectorAll('.broadcast-help strong')){strong.textContent=strong.textContent.replace('更新直播资料','发布资料（不换画面）').replace('播出所选画面','正式播出此画面').replace('只显示左上比分牌','结束包装，回到比分牌');}
 $('.broadcast-explanation').textContent='① 选择画面 → ② 预览核对 → ③ 正式播出。资料发布不换画面；进球、给牌、换人请使用下方事件入口。';
 const calib=document.createElement('details');calib.className='clock-calibration';calib.innerHTML='<summary>校准时间与清零</summary><div class="action-row"></div>';const calrow=calib.querySelector('div');for(const el of [$('#calibrate').closest('label'),$('#clock-calibrate'),$('#clock-minus-ten'),$('#clock-plus-ten'),$('#clock-reset'),$('#calibration-help')])calrow.append(el);$('.clock-actions').append(calib);
 $('.event-launcher h3').textContent='发生了什么？';$('.event-launcher>p').textContent='点选事件 → 填写球员与时间 → 确认预览 → 应用并播出';
 const hints={goal:'记录进球、更新比分',cancelGoal:'取消原进球并说明原因',card:'黄牌、红牌或两黄变红',substitution:'选择换下与换上球员',penalty:'判罚或罚失，可关联给牌',var:'审核中或最终决定',notice:'播出一条简短消息',adjustment:'只改实际比分，不补进球者'};
 for(const b of document.querySelectorAll('[data-open-event]')){const small=document.createElement('small');small.textContent=hints[b.dataset.openEvent];b.append(small);}
 const handoff=document.createElement('p');handoff.className='operation-boundary';handoff.textContent='应用后才记账、更新比分并送播；重播只播放动画。';$('#event-send').parentElement.before(handoff);
 function focusTarget(el){if(!el)return;let p=el.parentElement;while(p&&p!==document.body){if(p.tagName==='DETAILS')p.open=true;p=p.parentElement;}el.scrollIntoView({block:'center',behavior:'smooth'});el.focus({preventScroll:true});}
 function choose(i){step=Math.max(0,Math.min(3,i));panels.forEach((p,n)=>p.hidden=n!==step);wizard.querySelectorAll('[role="tab"]').forEach((b,n)=>{b.setAttribute('aria-selected',String(n===step));b.tabIndex=n===step?0:-1;});$('#preparation-back').disabled=step===0;$('#preparation-next').hidden=step===3;$('#preparation-position').textContent=`第 ${step+1} / 4 步 · ${steps[step][1]}`;render();}
 wizard.querySelector('[role="tablist"]').addEventListener('keydown',e=>{if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();choose(e.key==='Home'?0:e.key==='End'?3:(step+(e.key==='ArrowRight'?1:3))%4);$('#prep-tab-'+step).focus();});
 $('#preparation-back').onclick=()=>choose(step-1);$('#preparation-next').onclick=()=>{choose(step+1);wizard.scrollIntoView({block:'start',behavior:'smooth'});};
 let nextAction=()=>{};
 function render(){
  if(!state)return;const d=h.getDraft(),r=preparationStatus(d,state),phase=state.match.clock.phase;
  const statuses=[r.teams?'已填写':'待填写',r.errors.length?'需检查':r.synced?'已同步':'待同步','可选配置',r.published?'资料已发布':'资料待发布'];
  wizard.querySelectorAll('[role="tab"] em').forEach((e,i)=>e.textContent=statuses[i]);
  const checks=[['球队与赛事名称',r.teams],['双方首发人数、号码及分线',!r.errors.length],['名单已同步到比赛检索',r.synced],['资料与当前发布版本一致',r.published]];
  const signature=stable(checks);if(signature!==lastSignature){lastSignature=signature;$('#preparation-checks').replaceChildren(...checks.map(([text,ok])=>{const li=document.createElement('li');li.dataset.done=String(ok);li.textContent=`${ok?'✓':'○'} ${text}${ok?'':' · 待处理'}`;return li;}));}
  $('#preparation-detail').textContent=r.errors.length?r.errors.slice(0,2).join('；'):!r.synced?'名单有变化：先同步名单，再预览并发布资料。':!r.published?'草稿与已发布资料有差异：核对后发布；当前直播不会因编辑自动变化。':'资料检查通过。请人工核对队名、照片与名单内容，示例资料也可能通过格式检查。';
  review.querySelector('[data-guide-target="sync-lineups"]').disabled=!!r.errors.length;
  let title,description,label;
  nextAction=()=>focusTarget($('#clock-apply'));
  if(stage==='pregame'){title=phase!=='pregame'?`当前比赛：${PHASES[phase]} · 正在查看赛前资料`:r.ready?'资料检查通过，可以准备开场':'先完成赛前四步，再正式开播';description=phase!=='pregame'?'返回修改资料不会重置比赛。新的一场比赛须先导出旧档，再明确新建。':`${statuses.join(' → ')}。照片、解说和赞助可选，不作为必填。`;label='前往开播核对';nextAction=()=>{choose(3);focusTarget(review);};}
  else if(stage==='settings'){title='设置先编辑，发布再影响转播';description='更换主题、队徽、球衣色或模块后，先预览，再点“发布资料（不换画面）”。';label='回到赛前核对';nextAction=()=>{h.workflow.select('pregame');choose(3);};}
  else if(stage==='live'){
   if(phase==='pregame'||phase==='halftime'){const p=phase==='pregame'?'first':'second';title=phase==='pregame'?'等待上半场开球':'等待下半场开球';description=r.ready?'开场包装与比赛计时独立。实际开球时点击右侧按钮开始计时。':'资料仍有待核对项；可回赛前检查。只有实际开球时才开始计时。';label=`${PHASES[p]}开球 · 开始计时`;nextAction=()=>applyPhase(p);}
   else if(['first','second','extraFirst','extraSecond'].includes(phase)){title=`${PHASES[phase]} · ${state.match.clock.running?'比赛计时中':'计时已暂停'}`;description='进球、给牌、换人从下方事件入口办理；裁判吹停时再手动切换阶段。';label='前往比赛事件';nextAction=()=>focusTarget($('.event-launcher'));}
   else {title=`当前阶段：${PHASES[phase]}`;description='选择要继续的比赛阶段并点击计时“应用”；切换左侧页面不会改变阶段。';label='前往计时控制';}
  }else if(stage==='halftime'){if(phase==='first'){title='先结束上半场，再播放中场包装';description='仅在裁判吹停后操作。此按钮会暂停计时并保存半场数据，不自动播放包装。';label='上半场结束 · 停表并进入中场';nextAction=()=>applyPhase('halftime');}else if(phase==='halftime'){title='核对半场 → 保存统计 → 播出包装';description='下半场开球比分沿用上半场记录。实际开球时再点击右侧按钮。';label='下半场开球 · 开始计时';nextAction=()=>applyPhase('second');}else{title=`当前是${PHASES[phase]}，中场页不会自动停表`;description='需要改变比赛阶段时，在计时区选择并应用。';label='前往计时控制';}}
  else if(stage==='extra'){title='加时和点球必须先应用比赛阶段';description=`当前：${PHASES[phase]}。加时开球用计时“应用”；点球阶段保持停表，逐脚录入后人工确认结束。`;label='前往阶段选择';nextAction=()=>focusTarget($('#phase'));}
  else {title=state.match.clock.running?'先结束计时，再播全场赛果':phase==='finished'?'核对赛果 → 人工确认 → 播出 → 导出':'确认实际比赛结束后，再进入赛后';description='仅页面切换不会结束比赛；胜者、晋级和冠军都需要人工确认。';label=phase==='finished'?'前往结果确认':'全场结束 · 停表';nextAction=phase==='finished'?()=>focusTarget($('#result-winner')):()=>applyPhase('finished');}
  $('#guide-title').textContent=title;$('#guide-description').textContent=description;$('#guide-action').textContent=label;$('#guide-action').disabled=busy;
  $('#monitor-summary').textContent=`查看实播与计时 · ${PHASES[phase]} · ${state.match.clock.running?'计时中':'已暂停'}`;
 }
 function applyPhase(phase){if(busy)return;busy=true;render();$('#phase').value=phase;$('#phase').dispatchEvent(new Event('change',{bubbles:true}));$('#clock-apply').click();setTimeout(()=>{busy=false;render();},900);}
 $('#guide-action').onclick=()=>nextAction();
 root.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-guide-settings'))h.workflow.select('settings');if(b.dataset.guidePreview)h.show(b.dataset.guidePreview).then(()=>focusTarget($('#viewport'))).catch(h.toast);if(b.dataset.guideTarget){const target=$( '#'+b.dataset.guideTarget);focusTarget(target);target.click();}});
 document.addEventListener('workflow:stage',e=>{stage=e.detail;const top=$('.workflow-top');if(stage==='live'){monitorDrawer.before(top);monitorDrawer.hidden=true;}else{monitorDrawer.hidden=false;monitorDrawer.append(top);monitorDrawer.open=false;}render();});
 document.addEventListener('controller:state',e=>{state=e.detail;render();});
 document.addEventListener('draft:changed',render);
 choose(0);h.api('/api/control-state').then(s=>{state=s;render();}).catch(()=>{$('#guide-title').textContent='服务未连接';$('#guide-description').textContent='请检查本地服务启动窗口；连接恢复后继续。';});
 document.body.classList.add('operator-guided');
}
