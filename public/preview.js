const scenes = [
  ['scoreboard','常驻比分牌','中央 logo，双层比分','96 / 64 px 定位，652 px 宽。球队、logo 与比分固定占位；扩展区在底部展开。比分 48 px，时钟 32 px。','短促展开 · 常驻层','色块从左展开，稳定后保持静止。补时、总比分与红牌预留在底部扩展区，不推动主体。'],
  ['goal','进球弹窗','比分 + 进球者双层信息','上方比分牌保持可见；下方事件条展示队徽、号码、姓名、英文名及分钟。样例中的 2:1 为固定演示数据。','PULSE 460 ms / 蓝夜 760 ms','入场后保持展示；“顺序预览”停留 5 秒后退场 320 ms。单帧查看不自动撤下，便于评审。重播不修改数据。'],
  ['substitution','换人弹窗','方向、文字、号码同时出现','换上、换下使用两行结构，箭头和中文标签辅助识别。此画面展示单组换人，正式版在确认后扩展多人记录。','临时信息层 · 与进球排队','事件条与比分牌处于不同区域，单条宽 1060 px。正式版由队列处理互斥与优先级，本预览不实现队列。'],
  ['formation','球场阵型图','场上位置与球队信息分区','左侧展示球队、阵型及主教练；右侧 4–3–3 阵型，号码与姓名完整显示。门将使用金色球衣，队长标记 C。','大画面 · 隐藏比分与事件','1920×1080 画面独占，安全区左右 96 px、上下 54 px。该画面为战术阵型；首发名单将作为独立模块开发。'],
  ['shootout','点球大战面板','八轮实例 · 突然死亡','比赛比分 2:2 与点球比分 6:5 分区呈现。罚进用实心点、罚失用叉号；八轮格线等宽，不依赖颜色。','暂不宣告胜者','展示“已满足决胜条件 · 待操作员确认”。本轮为固定视觉样例；提前决胜、撤销、重罚逻辑将在后续实现。'],
  ['opening','开场对阵画面','双队徽与仪式中心','赛事信息居顶，双队徽分列，原创奖杯图形位于中心，底部展示示例比赛时间与场地。','几何展开 / 光弧显现','两套主题共用数据与结构。PULSE 强调几何色块；NOCTURNE 通过深蓝渐变、细光弧和浅金赛事图形营造仪式感。']
];
let theme = 'pulse', current = 0, timer, playing = false;
const frame = document.querySelector('#output');
const $ = selector => document.querySelector(selector);
$('#scenes').innerHTML = scenes.map((s,i) => `<button data-scene="${i}"><span>${String(i+1).padStart(2,'0')}</span>${s[1]}</button>`).join('');
function url(transparent = $('#transparent').checked) {
  const q = new URLSearchParams({theme,scene:scenes[current][0]});
  if (transparent) q.set('transparent','1');
  if ($('#safe-toggle').checked) q.set('safe','1');
  if ($('#stress').checked) q.set('stress','1');
  if ($('#added').checked) q.set('added','1');
  return 'overlay.html?' + q;
}
function update() {
  frame.src = url();
  $('#output-link').href = url(true);
  $('#scene-number').textContent = String(current+1).padStart(2,'0');
  $('#scene-title').textContent = scenes[current][1];
  $('#theme-label').textContent = theme.toUpperCase();
  $('#detail-title').textContent = scenes[current][2];
  $('#detail').textContent = scenes[current][3];
  $('#motion-title').textContent = scenes[current][4];
  $('#motion').textContent = scenes[current][5];
  document.querySelectorAll('[data-theme]').forEach(b => b.classList.toggle('active',b.dataset.theme === theme));
  document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('active',Number(b.dataset.scene) === current));
}
function stop() { clearTimeout(timer); playing = false; $('#play').textContent = '▷ 顺序预览六个画面'; }
document.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click',() => {stop();theme=b.dataset.theme;update();}));
document.querySelectorAll('[data-scene]').forEach(b => b.addEventListener('click',() => {stop();current=Number(b.dataset.scene);update();}));
document.querySelectorAll('.tools input').forEach(b => b.addEventListener('change',() => {stop();update();}));
$('#replay').addEventListener('click',() => {stop();update();});
$('#play').addEventListener('click',() => {
  if (playing) {stop();return;}
  playing = true; current=0; update(); $('#play').textContent = 'Ⅱ 停止顺序预览';
  function next() { timer = setTimeout(() => { frame.contentWindow.postMessage({type:'exit'},location.origin); timer = setTimeout(() => { current++;if(current>=scenes.length){current=0;stop();update();return;}update();next(); },350); },6000); }
  next();
});
new ResizeObserver(() => { frame.style.transform = `scale(${$('#viewport').clientWidth/1920})`; }).observe($('#viewport'));
update();
