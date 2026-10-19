// Read match kit colours, never team brand colours. Pure helpers also support preview QA.
export function kitChannels(value,fallback='#1355fc'){
 const hex=/^#[0-9a-f]{6}$/i.test(value||'')?value:fallback;
 return hex.slice(1).match(/../g).map(v=>parseInt(v,16));
}
export function readableInk(channels,whiteMix=0){
 const linear=channels.map(v=>{const x=(v*(1-whiteMix)+255*whiteMix)/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
 const l=linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
 return (l+.05)/.05>1.05/(l+.05)?'#102033':'#ffffff';
}
export function kitSurfaceVariables(data,scene='goal'){
 const home=kitChannels(data.home.kitColor),away=kitChannels(data.away.kitColor),side=(data.event?.team||(scene==='substitution'?data.substitution?.team:data.goal?.team))==='away'?'away':'home',event=side==='away'?away:home;
 return {'--home-rgb':home.join(' '),'--away-rgb':away.join(' '),'--event-rgb':event.join(' '),'--home-ink':readableInk(home,.3),'--away-ink':readableInk(away,.3),'--event-edge-ink':readableInk(event)};
}

export function materialSettings(config,{live=false,query=new URLSearchParams()}={}){
 const material=!live&&query.get('concept')==='acrylic'?'acrylic':config.material==='acrylic'?'acrylic':'solid';
 const palette=!live&&query.has('palette')?query.get('palette'):config.materialPalette;
 const value=Number(!live&&query.has('transparency')?query.get('transparency'):config.materialTransparency??25);
 return {material,palette:palette==='fixed'?'fixed':'kits',alpha:1-Math.max(0,Math.min(30,Number.isFinite(value)?value:25))/100};
}
