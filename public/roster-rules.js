// Shared roster rules, without server or renderer dependencies.
export const MAX_BENCH=16;
export const MATCH_FORMATS=[5,7,8,9,11];
export const COMMON_FORMATIONS=['4-3-3','4-4-2','4-2-3-1','4-1-4-1','4-4-1-1','4-3-2-1','3-5-2','3-4-3','5-3-2','5-4-1'];
const presets={5:['1-2-1','2-1-1','2-0-2','1-1-2'],7:['2-3-1','3-2-1','2-2-2','3-1-2'],8:['3-3-1','2-3-2','3-2-2','2-4-1'],9:['3-3-2','3-2-3','2-4-2','4-3-1'],11:COMMON_FORMATIONS};
export const formationsFor=count=>presets[count]||presets[11];
export function normalizeRules(value={}){return {playersPerSide:MATCH_FORMATS.includes(Number(value.playersPerSide))?Number(value.playersPerSide):11,substitutions:value.substitutions==='rolling'?'rolling':'once',substitutionLimits:{enabled:value.substitutionLimits?.enabled===true,players:Number.isInteger(Number(value.substitutionLimits?.players))&&Number(value.substitutionLimits?.players)>=0&&Number(value.substitutionLimits?.players)<=999?Number(value.substitutionLimits.players):5,windows:Number.isInteger(Number(value.substitutionLimits?.windows))&&Number(value.substitutionLimits?.windows)>=0&&Number(value.substitutionLimits?.windows)<=999?Number(value.substitutionLimits.windows):3,concussion:value.substitutionLimits?.concussion===true}};}
export function assertRules(value){if(value?.playersPerSide!==undefined&&!MATCH_FORMATS.includes(Number(value.playersPerSide)))throw Error('请选择5、7、8、9或11人制');if(value?.substitutions!==undefined&&!['once','rolling'].includes(value.substitutions))throw Error('换人方式无效');const l=value?.substitutionLimits;if(l){for(const key of ['enabled','concussion'])if(l[key]!==undefined&&typeof l[key]!=='boolean')throw Error('换人规则开关无效');for(const key of ['players','windows'])if(l[key]!==undefined&&(l[key]===null||l[key]===''||!Number.isInteger(Number(l[key]))||Number(l[key])<0||Number(l[key])>999))throw Error('换人名额与窗口须为0–999的整数');}}
export function assertBenchLimit(...lineups){if(lineups.some(l=>Array.isArray(l?.bench)&&l.bench.length>MAX_BENCH))throw Error('替补名单最多16人，请先移除多余球员；原存档不会自动删除');}
export const groupCounts=l=>Object.fromEntries(['goalkeeper','defenders','midfielders','forwards'].map(k=>[k,(l.players||[]).filter(p=>p.group===k).length]));
export function customShape(l){const n=groupCounts(l);return `${n.defenders}-${n.midfielders}-${n.forwards}`;}
export function lineupErrors(l,count=11){
 const errors=[],players=l?.players||[],bench=l?.bench||[],all=[...players,...bench];
 if(players.length!==count)errors.push(`首发需要${count}人（含1名门将），当前${players.length}人`);
 if(bench.length>MAX_BENCH)errors.push(`替补${bench.length}人，最多${MAX_BENCH}人`);
 const ids=new Set(),numbers=new Set();for(const p of all){if(!p.id||ids.has(p.id))errors.push('球员身份重复或缺失');ids.add(p.id);if(!p.name?.trim())errors.push('有球员姓名未填写');if(!Number.isInteger(Number(p.number))||Number(p.number)<0||Number(p.number)>999||numbers.has(Number(p.number)))errors.push('球衣号码须为0–999且本队不重复');numbers.add(Number(p.number));}
 const counts=groupCounts(l);if(counts.goalkeeper!==1)errors.push('首发必须且只能有1名门将');if(players.some(p=>!Object.hasOwn(counts,p.group)))errors.push('每位首发须指定门将、后卫、中场或前锋分线');
 if(!l?.custom){const shape=String(l?.name||'').replace(/\s/g,'');if(!formationsFor(count).includes(shape))errors.push(`阵型${l?.name||'未选择'}不适用于${count}人制，请选择模板或自定义分线`);else{const rows=shape.split('-').map(Number);if(counts.defenders!==rows[0]||counts.forwards!==rows.at(-1)||counts.midfielders!==rows.slice(1,-1).reduce((a,b)=>a+b,0))errors.push('首发分线与阵型不符，请应用模板或生成自定义阵型');}}
 return [...new Set(errors)];
}
export function assertLineups(rules,...lineups){assertRules(rules);const count=normalizeRules(rules).playersPerSide;lineups.forEach((l,i)=>{const errors=lineupErrors(l,count);if(errors.length)throw Error(`${i===0?'主队':'客队'}：${errors.join('；')}`);});}
export function arrangeFormation(lineup,shape,count=11){
 if(!formationsFor(count).includes(shape))throw Error(`请选择${count}人制常用阵型`);if(lineup.players.length!==count)throw Error(`该阵型需要${count}名首发球员（含门将）`);
 const l=structuredClone(lineup),rows=shape.split('-').map(Number),gk=l.players.find(p=>p.group==='goalkeeper'||p.goalkeeper)||l.players[0],out=l.players.filter(p=>p!==gk);let index=0;Object.assign(gk,{x:50,y:86,group:'goalkeeper',goalkeeper:true,position:'门将'});
 const nonEmpty=rows.map((n,row)=>({n,row})).filter(r=>r.n);nonEmpty.forEach(({n,row},y)=>{const group=row===0?'defenders':row===rows.length-1?'forwards':'midfielders';for(let k=0;k<n;k++){const p=out[index++];if(p.group!==group)p.position={defenders:'后卫',midfielders:'中场',forwards:'前锋'}[group];Object.assign(p,{x:12+76*(k+.5)/n,y:nonEmpty.length===1?42.5:(nonEmpty.length>=4?68:count<=7?64:66)-y*(nonEmpty.length>=4?52:count<=7?45:47)/(nonEmpty.length-1),group,goalkeeper:false});}});l.name=shape;l.custom=false;return l;
}
export function arrangeCustom(lineup,count=11){
 const l=structuredClone(lineup);l.custom=true;l.name=customShape(l);const errors=lineupErrors(l,count);if(errors.length)throw Error(errors.join('；'));
 const groups=['defenders','midfielders','forwards'].filter(g=>l.players.some(p=>p.group===g));for(const p of l.players.filter(p=>p.group==='goalkeeper'))Object.assign(p,{x:50,y:86,goalkeeper:true});
 groups.forEach((g,row)=>{const players=l.players.filter(p=>p.group===g);players.forEach((p,i)=>Object.assign(p,{x:12+76*(i+.5)/players.length,y:groups.length===1?42.5:(count<=7?64:66)-row*(count<=7?45:47)/(groups.length-1),goalkeeper:false}));});return l;
}
