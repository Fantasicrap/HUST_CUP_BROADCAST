const q = new URLSearchParams(location.search);
const theme = q.get('theme') === 'nocturne' ? 'nocturne' : 'pulse';
const allowed = ['scoreboard','goal','substitution','formation','shootout','opening'];
let scene = allowed.includes(q.get('scene')) ? q.get('scene') : 'scoreboard';
const data = await fetch('data/demo.json').then(r => r.json());
const stage = document.querySelector('#stage');
const layer = document.querySelector('#graphics');
stage.classList.add(theme);
stage.classList.toggle('stress', q.get('stress') === '1');
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const trophy = (className = '') => `<svg class="trophy ${className}" viewBox="0 0 120 120" aria-label="HUST CUP"><g fill="none" stroke="currentColor" stroke-width="8"><path d="M30 18v48l30 24 30-24V18M30 45h60M43 18v23m34-23v23M60 90v14m-22 0h44"/><path d="M30 26H15v26l17 14m58-40h15v26L88 66" stroke-width="6"/></g></svg>`;
const badge = (team, className = '') => `<span class="badge ${className}">${q.get('stress') === '1' && team === data.away ? `<span class="badge-fallback">远<br>航</span>` : `<img src="${escape(team.badge)}" alt="${escape(team.name)}队徽">`}</span>`;
const teamName = team => q.get('stress') === '1' ? (team === data.home ? '华中科技大学星火足球队' : '东湖国际学院远航足球队') : team.name;
const kit = team => `<i class="kit" style="--kit:${escape(team.kitColor)}" title="球衣颜色"></i>`;
const competition = () => `<div class="competition">${trophy()}<div><b>${escape(data.competition.name)}</b><span>${escape(data.competition.subtitle)} · ${escape(data.competition.round)}</span></div></div>`;

function scoreboard() {
  const expanded = q.get('added') === '1';
  return `<section class="scorebug enter" aria-label="常驻比分牌"><div class="bug-main"><div class="bug-team home">${kit(data.home)}${badge(data.home)}<span>${escape(teamName(data.home))}</span></div><div class="bug-logo">${trophy()}</div><div class="bug-team away"><span>${escape(teamName(data.away))}</span>${badge(data.away)}${kit(data.away)}</div><div class="bug-scores"><strong>${data.score.home}</strong><span>:</span><strong>${data.score.away}</strong></div></div><div class="bug-clock"><span class="phase">${expanded ? '下半场' : escape(data.clock.phase)}</span><strong>${expanded ? '90:00' : escape(data.clock.display)}</strong>${expanded ? '<span class="added-announced">+4</span>' : '<span class="live-dot"></span>'}</div>${expanded ? '<div class="bug-extensions"><span><i class="red-mark"></i> 远航 1</span><span>总比分 <b>3 : 3</b></span><span>实际补时 <b>02:16</b></span></div>' : ''}</section>`;
}
function event(type) {
  const goal = type === 'goal';
  const team = goal ? data.home : data.away;
  const label = goal ? 'GOAL' : 'SUBSTITUTION';
  const content = goal ? `<div class="goal-name"><b>${data.goal.number}</b><strong>${escape(data.goal.name)}</strong><span>${escape(data.goal.english)}</span></div><div class="event-caption">${escape(team.name)}<span>运动战进球</span></div>` : `<div class="sub-rows"><div class="sub-in"><span class="direction">↑</span><label>换上 IN</label><b>${data.substitution.on.number}</b><strong>${escape(data.substitution.on.name)}</strong></div><div class="sub-out"><span class="direction">↓</span><label>换下 OUT</label><b>${data.substitution.off.number}</b><strong>${escape(data.substitution.off.name)}</strong></div></div>`;
  return `${scoreboard()}<section class="event enter ${goal ? 'goal-event' : 'sub-event'}"><div class="event-brand">${badge(team)}<span>${goal ? '进球' : '换人'}</span></div><div class="event-body"><div class="event-heading"><b>${label}</b><span>${goal ? data.goal.time : data.substitution.time}</span></div>${content}</div><div class="event-edge">${trophy()}<span>HUST CUP</span></div></section>`;
}
function fullBase(extra = '') { return `<div class="full-bg ${extra}"><div class="light-arc arc-one"></div><div class="light-arc arc-two"></div><div class="grid-lines"></div><div class="ghost-mark">${trophy()}</div></div>`; }
function formation() {
  return `${fullBase()}<section class="full formation enter"><header class="full-header">${competition()}<span>TEAM LINE-UP / 战术阵型</span></header><div class="formation-info"><div class="overline">STARTING XI</div>${badge(data.home,'formation-badge')}<h1>${escape(teamName(data.home))}</h1><p>${escape(data.home.english)}</p><div class="formation-number">${data.formation.name}</div><div class="coach"><small>HEAD COACH / 主教练</small><strong>${escape(data.formation.coach)}</strong></div><div class="formation-legend"><span><i class="legend-gk"></i> 门将 GK</span><span><i class="legend-c">C</i> 队长</span></div></div><div class="pitch"><div class="pitch-line border"></div><div class="pitch-line halfway"></div><div class="pitch-line center-circle"></div><div class="pitch-line box top"></div><div class="pitch-line box bottom"></div><div class="pitch-line small-box top"></div><div class="pitch-line small-box bottom"></div>${data.formation.players.map(p => `<div class="player ${p.goalkeeper ? 'goalkeeper' : ''}" style="left:${p.x}%;top:${p.y}%"><div class="shirt"><span>${p.number}</span>${p.captain ? '<i class="captain">C</i>' : ''}</div><strong>${escape(p.name)}</strong></div>`).join('')}</div><footer class="full-footer"><span>HUST CUP · ${escape(data.competition.round)}</span><span>首发阵型 · 演示名单</span></footer></section>`;
}
function shootout() {
  const kicks = data.shootout;
  const rounds = Math.max(kicks.home.length, kicks.away.length, 5);
  const score = side => kicks[side].filter(n => n === 1).length;
  const row = (side, team) => `<div class="pk-row">${badge(team)}<div class="pk-team"><strong>${escape(teamName(team))}</strong><small>${escape(team.english)}</small></div><b class="pk-score">${score(side)}</b><div class="pk-kicks">${Array.from({length:rounds}, (_, i) => `<span class="kick ${kicks[side][i] === 1 ? 'made' : kicks[side][i] === 0 ? 'missed' : 'pending'}" aria-label="第${i+1}轮${kicks[side][i] === 1 ? '罚进' : kicks[side][i] === 0 ? '罚失' : '待罚'}">${kicks[side][i] === 1 ? '●' : kicks[side][i] === 0 ? '×' : '—'}</span>`).join('')}</div></div>`;
  return `<section class="shootout enter"><div class="pk-header">${trophy()}<div><span>PENALTY SHOOT-OUT</span><strong>点球大战</strong></div><div class="pk-match">比赛比分 <b>2 : 2</b><small>加时赛结束</small></div></div><div class="rounds"><span>罚球顺序 · 星火先罚</span><div>${Array.from({length:rounds}, (_,i) => `<span>${String(i+1).padStart(2,'0')}</span>`).join('')}</div></div>${row('home',data.home)}${row('away',data.away)}<div class="pk-footer"><span><i></i> 第 8 轮 · 突然死亡</span><strong>已满足决胜条件 · 待操作员确认</strong></div></section>`;
}
function opening() {
  const team = (t, position) => `<div class="opening-team ${position}">${badge(t)}<h1>${escape(teamName(t))}</h1><p>${escape(t.english)}</p><div class="team-rule" style="--brand:${escape(t.brandColor)}"></div></div>`;
  return `${fullBase('opening-bg')}<section class="opening full enter"><header class="full-header">${competition()}<span>THE FINAL / 决赛</span></header><div class="opening-title"><span>THIS IS OUR GAME.</span><h2>为热爱而战</h2></div><div class="opening-versus">${team(data.home,'home')}<div class="opening-center">${trophy()}<span>VS</span><small>HUST CUP 2026</small></div>${team(data.away,'away')}</div><div class="opening-location"><b>${escape(data.competition.kickoff)}</b><span>${escape(data.competition.venue)} · ${escape(data.competition.subtitle)}</span></div><footer class="full-footer"><span>HUST CUP ORIGINAL BROADCAST IDENTITY</span><span>赛前对阵 / MATCH PREVIEW</span></footer></section>`;
}
function backdrop() {
  return `<svg class="field-backdrop" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"><defs><linearGradient id="field" x2="0" y2="1"><stop stop-color="#142b32"/><stop offset="1" stop-color="#174b43"/></linearGradient><pattern id="stripes" width="360" height="1080" patternUnits="userSpaceOnUse"><path d="M0 0h180v1080H0Z" fill="#fff" opacity=".025"/></pattern></defs><path fill="url(#field)" d="M0 0h1920v1080H0Z"/><path fill="url(#stripes)" d="M0 0h1920v1080H0Z"/><g fill="none" stroke="#a9d5c0" opacity=".14" stroke-width="3"><path d="M-110 100H2030v930H-110ZM960 100v930"/><ellipse cx="960" cy="565" rx="185" ry="166"/><path d="M-100 340h350v460H-100m2130-460h-350v460h350"/></g><g fill="#bfe7d2" opacity=".2"><circle cx="625" cy="300" r="11"/><circle cx="1210" cy="370" r="11"/><circle cx="1410" cy="740" r="11"/><circle cx="730" cy="830" r="11"/><circle cx="1120" cy="620" r="11"/></g><g fill="#d8b8c1" opacity=".22"><circle cx="430" cy="525" r="11"/><circle cx="810" cy="430" r="11"/><circle cx="1320" cy="520" r="11"/><circle cx="1000" cy="815" r="11"/></g></svg><div class="backdrop-label">示意比赛底图 · 仅用于检查叠加效果</div>`;
}
function render() {
  stage.classList.toggle('transparent', q.get('transparent') === '1');
  document.querySelector('#backdrop').innerHTML = backdrop();
  document.querySelector('#safe').classList.toggle('visible', q.get('safe') === '1');
  layer.innerHTML = scene === 'scoreboard' ? scoreboard() : scene === 'goal' || scene === 'substitution' ? event(scene) : scene === 'formation' ? formation() : scene === 'shootout' ? shootout() : opening();
  layer.querySelectorAll('.badge img').forEach(img => {
    const fallback = () => { const span = document.createElement('span'); span.className = 'badge-fallback'; span.textContent = img.alt.startsWith(data.home.name) ? data.home.short : data.away.short; img.replaceWith(span); };
    img.addEventListener('error',fallback,{once:true});
    if(img.complete && img.naturalWidth === 0) fallback();
  });
  document.title = `HUST CUP · ${theme} · ${scene}`;
  document.documentElement.dataset.ready = '1';
}
render();
addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== parent) return;
  if (e.data?.type === 'replay') render();
  if (e.data?.type === 'exit') layer.classList.add('exiting');
});
