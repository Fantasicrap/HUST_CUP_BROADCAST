// Reuse the original controls and their listeners; navigating never changes match state.
export function mountWorkflow({showLive}) {
 const $=s=>document.querySelector(s), root=$('#match-desk'), main=$('.main');
 const stages=[
  ['pregame','赛前准备','球队、阵容与入场','开播前完成资料和素材检查，确认后再正式播出。'],
  ['live','赛中','计时、事件与播出','进球、给牌、换人和纠错集中在这里。资料与阵容已收进赛前准备。'],
  ['halftime','中场休息','半场统计与下半场开球','先暂停计时并切换比赛阶段，再选择半场包装；导航不会自动切换阶段。'],
  ['extra','加时与点球','加时赛、逐轮点球','加时阶段在上方手动切换；点球比分独立于比赛比分。'],
  ['postgame','赛后','确认结果与导出存档','计时停止后，核对赛果与胜者，再播出并导出本场存档。'],
  ['settings','系统设置','主题、模块与输出','赛制、延迟、快捷键和各模块开关。修改资料仍需明确应用到实播。']
 ];
 const panes={};
 const make=(tag,cls,html='')=>{const el=document.createElement(tag);el.className=cls;el.innerHTML=html;return el;};
 const move=(selector,parent)=>{const node=typeof selector==='string'?$(selector):selector;if(!node)throw Error('找不到控制项：'+selector);parent.append(node);return node;};
 const drawer=(label,parent,open=false)=>{const el=make('details','workflow-drawer',`<summary>${label}</summary>`);el.open=open;parent.append(el);return el;};
 const card=(title,parent)=>{const el=make('section','desk-card',`<h3>${title}</h3>`);parent.append(el);return el;};
 const nav=make('nav','workflow-nav',stages.map(([id,title,sub],i)=>`<button data-workflow="${id}" aria-controls="stage-${id}" aria-pressed="false"><span>0${i+1}</span><div><strong>${title}</strong><small>${sub}</small></div></button>`).join(''));
 nav.setAttribute('aria-label','比赛流程导航');
 const aside=$('aside'), themes=$('.theme-switch'), scenes=$('#scenes');
 aside.replaceChildren(make('div','workflow-brand','MATCHDAY <span>比赛工作流</span>'),nav,make('p','workflow-nav-hint','按比赛顺序整理操作。<br>切换页面不改变比赛阶段。'));
 aside.append(make('a','obs-link','打开 OBS 合成输出 ↗'));aside.lastChild.href='overlay.html?mode=live&transparent=1';aside.lastChild.target='_blank';aside.lastChild.rel='noopener';
 const heading=make('div','workflow-heading','<div><span id="workflow-step"></span><h1 id="workflow-title"></h1><p id="workflow-hint"></p></div><button id="monitor-expand" aria-expanded="false">放大监看</button>');
 root.prepend(heading); main.prepend(root);
 move('.broadcast-bar',root);
 const top=make('div','workflow-top'),monitor=make('section','workflow-monitor'),operations=make('section','workflow-operations');root.append(top);top.append(monitor,operations);
 move('.toolbar',monitor);move('#viewport',monitor);
 const previewOptions=drawer('预览模块与检查工具',monitor);move(scenes,previewOptions);move('.tools',previewOptions);
 move('.preview-help',monitor);move('.clock-desk',operations);move('.live-scorebar',operations);move('#actual-cue',operations);move('#recovery-banner',root);
 const title=$('.desk-title');move('#match-revision',operations);title.remove();
 for(const [id] of stages){const pane=make('section','workflow-stage');pane.id='stage-'+id;pane.dataset.stage=id;pane.hidden=true;root.append(pane);panes[id]=pane;}
 // Pregame forms are existing nodes, preserving upload handlers and autosave.
 const modules=$('#module-settings'),teams=$('#team-settings'),roster=$('#roster-settings');
 modules.querySelector('summary').textContent='模块开关与停留时间';
 teams.querySelector('summary').textContent='球队、队徽与赛事资料';teams.open=true;
 roster.querySelector('summary').textContent='首发、替补与逐线翻牌';roster.open=false;
 const draftScores=drawer('草稿比分检查（不生成比赛记录）',panes.settings);move('.score-controls',draftScores);
 const layout=drawer('比分牌位置与显示',panes.settings);move(teams.querySelector('[data-config="x"]').closest('.inline-fields'),layout);
 move(teams,panes.pregame);move(roster,panes.pregame);move(modules,panes.settings);
 const themeCard=card('视觉主题',panes.settings);move(themes,themeCard);
 const cards=key=>[...$(`[data-desk-panel="${key}"]`).querySelectorAll('.desk-card')];
 const eventPanel=$('[data-desk-panel="events"]');eventPanel.hidden=false;move(eventPanel,panes.live);
 const eventForm=$('#event-type').closest('.desk-card'), corrections=drawer('修正姓名、号码与所属半场',eventForm);
 corrections.classList.add('event-corrections');eventForm.insertBefore(corrections,$('#goal-fields'));
 const correctionFields=make('div','form-grid');corrections.append(correctionFields);
 for(const id of ['event-name','event-number','event-period'])move($('#'+id).closest('label'),correctionFields);
 const [queue,manual]=cards('queue');
 const liveMore=drawer('待播队列与其他图文',panes.live);liveMore.id='live-more';const moreGrid=make('div','desk-columns');liveMore.append(moreGrid);move(queue,moreGrid);move(manual,moreGrid);manual.querySelector('h3').textContent='手动播出';
 const flowCard=(id,title,button)=>{const el=card(title,panes[id]);move('#'+button,el);return el;};
 const opening=flowCard('pregame','资料确认后 · 开场顺播','flow-opening');opening.append(make('p','hint','只播放已启用模块；可在“赛中 → 待播队列”提前结束或跳过。'));
 const halfFlow=flowCard('halftime','中场包装','flow-halftime'),postFlow=flowCard('postgame','全场包装','flow-fulltime');
 function bottomActions(parent,contexts){const row=make('div','action-row');for(const [context,label] of contexts){const button=make('button','',label);button.dataset.workflowContext=context;button.onclick=()=>{$('#cue-context').value=context;$('#cue-context').dispatchEvent(new Event('change'));$('#bottom-send').click();};row.append(button);}parent.append(row);}
 bottomActions(opening,[['pregame','播出开球简版比分']]);bottomActions(halfFlow,[['halftime','播出半场简版比分'],['secondhalf','播出下半场开球比分']]);bottomActions(postFlow,[['fulltime','播出全场简版比分']]);
 manual.querySelector('.flow-buttons').remove();
 const pk=$('[data-desk-panel="pk"]');pk.hidden=false;move(pk,panes.extra);
 const [stats,result]=cards('stats');
 const tie=card('淘汰赛 / 两回合规则',panes.pregame);const resultStart=$('#result-winner').closest('.form-grid');
 let next=result.querySelector('h3').nextElementSibling;while(next&&next!==resultStart){const saved=next.nextElementSibling;tie.append(next);next=saved;}
 result.querySelector('h3').textContent='最终结果 · 操作员确认';move(result,panes.postgame);
 const statSlots={};for(const id of ['live','halftime','postgame']){const slot=drawer('手动比赛统计 · 留空为未知',panes[id],id!=='live');statSlots[id]=slot;}
 const settings=$('[data-desk-panel="settings"]');settings.hidden=false;move(settings,panes.settings);
 const [archive,people]=cards('portable');
 const rosterSetup=card('阵容确认与同步',panes.pregame);let node=$('#sync-lineups');while(node){const following=node.nextElementSibling;rosterSetup.append(node);node=following;}
 // Keep confirmation and sync beside the roster rather than the live match.
 roster.after(rosterSetup);move(people,panes.pregame);
 const fontCard=card('界面与包装字体',panes.settings);move($('[data-asset="config.font"]').closest('label'),fontCard);move('#font-reset',fontCard);move(people.querySelector('p.hint'),fontCard);people.querySelector('h3').textContent='人物、裁判与赞助素材';
 // Reuse the already-bound new-match button, detached with the old title.
 move(title.querySelector('#new-match'),panes.pregame);panes.pregame.prepend(panes.pregame.lastChild);
 const archiveSlots={};for(const id of ['pregame','postgame','settings']){archiveSlots[id]=drawer('项目导入、导出与演示存档',panes[id],id==='postgame');}
 // Remove empty legacy panel wrappers, never the controls they contained.
 for(const key of ['queue','stats','portable'])$(`[data-desk-panel="${key}"]`).remove();$('.desk-tabs').remove();
 let active='live';
 function select(id){if(!panes[id])return;active=id;document.body.dataset.workflow=id;const stage=stages.find(s=>s[0]===id);$('#workflow-step').textContent=`0${stages.indexOf(stage)+1} / MATCHDAY`;$('#workflow-title').textContent=stage[1];$('#workflow-hint').textContent=stage[3];for(const [key,pane] of Object.entries(panes))pane.hidden=key!==id;nav.querySelectorAll('button').forEach(b=>{const selected=b.dataset.workflow===id;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  if(statSlots[id])statSlots[id].append(stats);
  if(archiveSlots[id])archiveSlots[id].append(archive);
 }
 nav.addEventListener('click',e=>{const button=e.target.closest('[data-workflow]');if(button)select(button.dataset.workflow);});
 nav.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;e.preventDefault();const i=stages.findIndex(s=>s[0]===active),target=e.key==='Home'?0:e.key==='End'?stages.length-1:(i+(e.key==='ArrowDown'?1:-1)+stages.length)%stages.length;select(stages[target][0]);nav.querySelector(`[data-workflow="${active}"]`).focus();});
 $('#monitor-expand').onclick=()=>{const expanded=top.classList.toggle('expanded');$('#monitor-expand').setAttribute('aria-expanded',String(expanded));$('#monitor-expand').textContent=expanded?'收起监看':'放大监看';};
 // A clean entry point is always live operations, monitoring the real OBS timeline.
 select('live');archiveSlots.pregame.append(archive);showLive();
 document.body.classList.add('workflow-ready');
}
