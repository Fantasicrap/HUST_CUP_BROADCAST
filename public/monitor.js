import {outputScene} from './model.js';
export function eventOutputStatus(state,event){
 if(event.active===false)return '已撤销';
 const output=state.output,live=output.live,resolved=outputScene(live,output.serverNow);
 const index=state.queue.findIndex(q=>q.eventId===event.id);
 if(live.eventId===event.id&&!['scoreboard','clear'].includes(resolved.scene)&&(!live.expiresAt||live.expiresAt>output.serverNow))return index>=0?`正在实播 · 重播排队第 ${index+1} 位`:'正在实播';
 if(index>=0)return `排队第 ${index+1} 位`;
 if(state.live.eventId===event.id&&state.live.expiresAt>state.serverNow)return '输出延迟中';
 return '未在播出';
}
